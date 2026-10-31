"use strict";

/*
 * Garde-fou de fin de tâche.
 *
 * Le prompt demandait déjà « lance roblox_check avant de conclure ». Rien dans
 * le code ne l'imposait : un modèle pouvait annoncer un jeu fonctionnel après
 * une écriture, sans build ni vérification. Ce module sépare les phases
 * (génération → validation → test), exige une validation APRÈS la dernière
 * modification, détecte les affirmations non prouvées, et produit la checklist
 * de fin de tâche.
 *
 * Il ne remplace pas le jugement du modèle : il empêche seulement une
 * conclusion « terminé » contredite par les résultats d'outils réels.
 */

const MUTATION_TOOLS = new Set([
    "write_file", "edit_file", "create_directory", "move_path", "copy_path",
    "delete_path", "roblox_game"
]);

const VALIDATION_TOOLS = new Set(["roblox_check", "diagnostics"]);
const TEST_TOOLS = new Set(["roblox_playtest"]);

const LUAU_PATH = /\.(luau|lua)$/i;
const ROJO_PATH = /(\.project\.json|\.model\.json|init\.meta\.json)$/i;
const ROBLOX_TASK = /\b(roblox|roblox studio|luau|rojo|obby|tycoon|simulator|simulateur|rpg|blender)\b/i;

function mutationPaths(tool, args, result) {
    const paths = new Set();

    if (typeof args?.path === "string") paths.add(args.path);
    if (typeof args?.from === "string") paths.add(args.from);
    if (typeof args?.to === "string") paths.add(args.to);

    if (Array.isArray(result?.files)) {
        for (const file of result.files) if (typeof file === "string") paths.add(file);
    }
    if (Array.isArray(result?.files_written)) {
        for (const file of result.files_written) if (typeof file === "string") paths.add(file);
    }
    if (Array.isArray(result?.written)) {
        for (const file of result.written) if (typeof file === "string") paths.add(file);
    }
    if (typeof result?.output === "string" && /\.(glb|blend|png)$/i.test(result.output)) {
        paths.add(result.output);
    }

    return [...paths].filter(Boolean);
}

function claimsStudioTest(message) {
    const text = String(message || "");
    if (/\b(non|pas|jamais|aucun)\b[^.]{0,60}\b(test|playtest|studio)\b/i.test(text)) return false;
    return /\b(playtest|test[ée]s?\s+(dans|avec|sur)\s+(roblox\s+)?studio|valid[ée]s?\s+dans\s+(roblox\s+)?studio|v[ée]rifi[ée]s?\s+dans\s+(roblox\s+)?studio)\b/i.test(text);
}

function claimsBuildSuccess(message) {
    const text = String(message || "");
    if (/\b(non|pas|jamais|aucun)\b[^.]{0,60}\b(build|compil)\b/i.test(text)) return false;
    return /\b(rojo build\s+(?:est\s+)?(r[ée]ussi|ok|passe)|build\s+(?:est\s+)?(r[ée]ussi|ok|valid[ée])|compil[ée]?\s+sans\s+erreur)\b/i.test(text);
}

function formatChecklist(state) {
    const lines = ["— CONTRÔLE DE FIN DE TÂCHE —"];
    const files = [...state.mutations.values()].map(item => item.path);

    lines.push(files.length
        ? `• Modifications : ${files.length} fichier(s) — ${files.slice(0, 6).join(", ")}${files.length > 6 ? ", …" : ""}`
        : "• Modifications : aucune");

    const validation = state.lastValidation;
    if (!validation) {
        lines.push("• Validation : aucune vérification structurée exécutée");
    } else if (validation.denied) {
        lines.push("• Validation : refusée ou interrompue — résultat non prouvé");
    } else if (state.needsValidation && state.validationGeneration < state.luauGeneration) {
        lines.push("• Validation : exécutée avant la dernière modification — à relancer");
    } else if (validation.clean === false) {
        lines.push(`• Validation : ${validation.tool} signale ${validation.errors ?? "des"} erreur(s) — résultat non validé`);
    } else {
        lines.push(`• Validation : ${validation.tool} clean — après la dernière modification`);
    }

    const test = state.lastTest;
    if (!test) lines.push("• Test d'exécution : non exécuté (à faire dans Studio si demandé)");
    else if (test.denied || test.status === "denied") lines.push("• Test d'exécution : refusé par l'utilisateur");
    else if (state.testGeneration < state.generation) lines.push("• Test d'exécution : antérieur à la dernière modification — à relancer");
    else if (test.status === "ok") lines.push("• Test d'exécution : roblox_playtest OK");
    else lines.push(`• Test d'exécution : ${test.tool} ${test.status || "en échec"}`);

    const remaining = [];
    if (state.needsValidation && (!validation || state.validationGeneration < state.luauGeneration || validation.clean === false)) {
        remaining.push("corriger puis relancer roblox_check");
    }
    if (!test && state.needsValidation) remaining.push("tester le jeu dans Studio (roblox_playtest)");
    if (state.lastTest && !state.lastTest.denied && state.testGeneration < state.generation) {
        remaining.push("relancer le test d'exécution après la dernière modification");
    }
    if (state.lastTest && state.lastTest.status !== "ok" && state.lastTest.status !== "denied" && state.testGeneration >= state.generation) {
        remaining.push("corriger l'échec du test d'exécution");
    }
    if (state.buildFailed) remaining.push("corriger le build Rojo : la place ne se compile pas");
    lines.push(`• Reste à vérifier : ${remaining.length ? remaining.join(" ; ") : "rien de bloquant signalé"}`);

    return lines.join("\n");
}

function createCompletionGuard({ task = "", readOnly = false } = {}) {
    const state = {
        mutations: new Map(),
        lastValidation: null,
        lastTest: null,
        needsValidation: false,
        taskRoblox: ROBLOX_TASK.test(String(task)),
        generation: 0,
        luauGeneration: 0,
        validationGeneration: 0,
        testGeneration: 0,
        buildFailed: false,
        startedAt: Date.now()
    };

    let forcedValidation = 0;
    let forcedTest = 0;
    const MAX_FORCED = 2;

    /** Enregistre une modification et fait avancer la génération correspondante. */
    function addMutation(path, tool, at) {
        if (!path) return;
        state.mutations.set(path, { path, tool, at });
        state.generation++;

        if (LUAU_PATH.test(path) || ROJO_PATH.test(path)) {
            state.needsValidation = true;
            state.luauGeneration++;
        }
    }

    function record({ tool, args = {}, ok = true, result = {} }) {
        if (!tool) return;
        const now = Date.now();

        if (MUTATION_TOOLS.has(tool) && ok) {
            for (const path of mutationPaths(tool, args, result)) addMutation(path, tool, now);
        }

        if (tool === "task" && ok && Array.isArray(result.files_written)) {
            for (const file of result.files_written) {
                if (typeof file === "string") addMutation(file, tool, now);
            }
        }

        if (tool === "roblox_check") {
            const denied = Boolean(result.denied);
            state.lastValidation = {
                tool,
                at: now,
                denied,
                clean: denied ? null : ok ? result.clean : false,
                errors: result.errors,
                build: result.build || null
            };
            state.validationGeneration = state.luauGeneration;
            if (result.build && result.build.status !== "ok") state.buildFailed = true;
            else state.buildFailed = false;
        } else if (tool === "diagnostics") {
            state.lastValidation = {
                tool,
                at: now,
                denied: Boolean(result.denied),
                clean: result.denied ? null : Number(result.errors || 0) === 0,
                errors: result.errors
            };
            state.validationGeneration = state.luauGeneration;
        }

        if (TEST_TOOLS.has(tool)) {
            state.lastTest = { tool, at: now, status: result.denied ? "denied" : result.status };
            state.testGeneration = state.generation;
        } else if (tool === "run_command") {
            const command = String(args.command || args.name || "");
            if (/\b(test|rojo build|blender .*--background)\b/i.test(command)) {
                state.lastTest = {
                    tool,
                    at: now,
                    status: result.exit_code === 0 ? "ok" : "failed"
                };
                state.testGeneration = state.generation;
            }
        }

        if (tool === "roblox_game" && ok && result.validation) {
            // Le scaffold renvoie sa propre validation : elle ne remplace pas un
            // roblox_check postérieur à une modification manuelle.
            if (result.validation.clean !== undefined) {
                state.lastValidation = {
                    tool: "roblox_game",
                    at: now,
                    denied: false,
                    clean: result.validation.clean,
                    errors: result.validation.errors,
                    build: result.validation.build || null
                };
                state.validationGeneration = state.luauGeneration;
            }
        }
    }

    function validationMissing() {
        if (!state.needsValidation) return false;
        if (!state.lastValidation) return true;
        if (state.lastValidation.denied) return true;
        return state.validationGeneration < state.luauGeneration;
    }

    function validationFailed() {
        return Boolean(state.lastValidation && (state.lastValidation.clean === false || state.lastValidation.denied));
    }

    /** Un test a déjà tourné, puis du code a changé : il ne prouve plus l'état actuel. */
    function testMissing() {
        if (!state.lastTest) return false;
        if (state.lastTest.denied || state.lastTest.status === "denied") return false;
        return state.testGeneration < state.generation;
    }

    /** Le dernier test porte sur l'état actuel et a échoué. */
    function testFailed() {
        return Boolean(
            state.lastTest &&
            state.lastTest.status !== "ok" &&
            state.lastTest.status !== "denied" &&
            state.testGeneration >= state.generation
        );
    }

    /**
     * Décide du sort d'une réponse finale.
     * - force:true → ne pas terminer, renvoyer la consigne au modèle ;
     * - sinon, `action` corrigée (completed/message) et `checklist`.
     */
    function evaluateFinal(action = {}) {
        let completed = action.completed !== false;
        const problems = [];

        if (readOnly) {
            return { force: false, completed, message: action.message, checklist: "" };
        }

        if (completed && validationMissing() && forcedValidation < MAX_FORCED) {
            forcedValidation++;
            const reason = state.lastValidation?.denied
                ? "La vérification a été refusée ou interrompue : elle ne prouve rien."
                : state.lastValidation
                    ? "La dernière vérification est antérieure à ta dernière modification."
                    : "Aucune vérification n'a été exécutée après tes modifications.";
            return {
                force: true,
                steering:
                    `VÉRIFICATION BLOQUANTE (${forcedValidation}/${MAX_FORCED}) — ${reason} ` +
                    "Lance roblox_check sur les fichiers modifiés (build compris) et lis son résultat réel avant toute réponse finale. " +
                    "Si clean vaut false, corrige les diagnostics et relance. Si l'outil est absent, refuse ou échoue, dis exactement ce qui n'a pas pu être vérifié et mets completed:false. " +
                    "Ne présente jamais le jeu comme fonctionnel sans ce résultat."
            };
        }

        if (completed && validationFailed()) {
            completed = false;
            problems.push(
                `roblox_check signale encore ${state.lastValidation.errors ?? "des"} erreur(s)` +
                (state.buildFailed ? " et le build Rojo a échoué" : "") +
                " : le résultat ne peut pas être annoncé comme validé."
            );
        }

        if (completed && testMissing() && forcedTest < MAX_FORCED) {
            forcedTest++;
            return {
                force: true,
                steering:
                    `TEST BLOQUANT (${forcedTest}/${MAX_FORCED}) — un test d'exécution a déjà été lancé, mais ta dernière modification est postérieure : il ne prouve plus l'état actuel. ` +
                    "Relance roblox_playtest (ou le test équivalent) sur la version corrigée et lis le résultat réel. " +
                    "Si le test échoue, corrige puis reteste ; s'il est impossible, dis exactement pourquoi et mets completed:false."
            };
        }

        if (completed && testFailed()) {
            completed = false;
            problems.push("Le dernier test d'exécution porte sur la version actuelle et a échoué : le résultat ne peut pas être annoncé comme fonctionnel.");
        }

        if (completed && claimsStudioTest(action.message) &&
            !(state.lastTest && state.lastTest.status === "ok" && state.testGeneration >= state.generation)) {
            completed = false;
            problems.push("Le message annonce un test dans Studio, mais aucun roblox_playtest réussi et postérieur aux modifications ne figure dans les résultats d'outils.");
        }

        if (completed && claimsBuildSuccess(action.message) &&
            !(state.lastValidation && state.lastValidation.clean === true &&
                state.validationGeneration >= state.luauGeneration &&
                state.lastValidation.build && state.lastValidation.build.status === "ok")) {
            completed = false;
            problems.push("Le message annonce un build réussi, mais aucun build Rojo réussi postérieur aux modifications ne le confirme.");
        }

        if (validationMissing() && forcedValidation >= MAX_FORCED) {
            completed = false;
            problems.push("La vérification obligatoire n'a pas été exécutée après la dernière modification ; exécute roblox_check puis relance la conclusion.");
        }

        if (testMissing() && forcedTest >= MAX_FORCED) {
            completed = false;
            problems.push("Le test d'exécution n'a pas été relancé après la dernière modification ; reteste avant de conclure.");
        }

        const warning = problems.length
            ? `\n\nÀ VÉRIFIER AVANT DE CONSIDÉRER LA TÂCHE TERMINÉE : ${problems.join(" ")}`
            : "";

        return {
            force: false,
            completed,
            message: `${action.message}${warning}`,
            checklist: state.mutations.size || state.lastValidation || state.lastTest ? formatChecklist(state) : "",
            problems
        };
    }

    return {
        record,
        evaluateFinal,
        validationMissing,
        validationFailed,
        state: () => state,
        hasWork: () => state.mutations.size > 0 || Boolean(state.lastValidation) || Boolean(state.lastTest)
    };
}

module.exports = {
    createCompletionGuard,
    claimsStudioTest,
    claimsBuildSuccess,
    formatChecklist,
    mutationPaths,
    MUTATION_TOOLS,
    VALIDATION_TOOLS,
    TEST_TOOLS,
    LUAU_PATH,
    ROJO_PATH,
    ROBLOX_TASK
};
