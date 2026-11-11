"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseAgentResponse, extractJsonObject } = require("../src/agent/agent");
const { repairJsonText, normalizeActionShape, proseFinalAction, describeJsonFailure, looksLikeCapabilityRefusal } = require("../src/agent/json-repair");
const { normalizeProgress, fitProgress, applyProgress } = require("../src/agent/plan-progress");

const fence = "\u0060\u0060\u0060";

test("une virgule finale et des retours à la ligne bruts sont réparés", () => {
    const text = '{"type":"tool","name":"list_directory","args":{"path":".",},"reason":"Lister\nle dossier",}';
    const action = parseAgentResponse(text);
    assert.equal(action.name, "list_directory");
    assert.equal(action.reason, "Lister\nle dossier");
});

test("les guillemets typographiques hors chaîne sont acceptés", () => {
    const action = extractJsonObject('{“type”:“final”,“message”:“ok”}');
    assert.equal(action.type, "final");
    assert.equal(action.message, "ok");
});

test("un final tronqué est fermé et marqué, un outil tronqué est refusé", () => {
    const truncatedFinal = extractJsonObject('{"type":"final","message":"Compte rendu coup');
    assert.equal(truncatedFinal.type, "final");
    assert.equal(truncatedFinal.truncated_response, true);
    assert.match(truncatedFinal.message, /Compte rendu/);

    const truncatedTool = extractJsonObject('{"type":"tool","name":"write_file","args":{"path":"a.js","content":"const a = ');
    assert.equal(truncatedTool, null);
    assert.match(describeJsonFailure('{"type":"tool","name":"write_file","args":{"path":"a.js","content":"const a = '), /tronqué/);
});

test("les alias de clés (tool, arguments, final_answer, content) sont normalisés", () => {
    const tool = parseAgentResponse('{"tool":"list_directory","arguments":{"path":"."}}');
    assert.equal(tool.type, "tool");
    assert.equal(tool.name, "list_directory");
    assert.deepEqual(tool.args, { path: "." });

    const final = parseAgentResponse('{"type":"final_answer","content":"Terminé","completed":"true"}');
    assert.equal(final.type, "final");
    assert.equal(final.message, "Terminé");
    assert.equal(final.completed, true);

    const batch = parseAgentResponse('{"calls":[{"tool":"read_file","arguments":{"path":"README.md"}}]}');
    assert.deepEqual(batch.calls, [{ name: "read_file", args: { path: "README.md" } }]);
});

test("un objet enveloppé, un tableau à un élément ou un bloc de code mal fermé sont lus", () => {
    assert.equal(extractJsonObject('{"action":{"type":"final","message":"ok"}}').message, "ok");
    assert.equal(extractJsonObject('[{"type":"final","message":"ok"}]').message, "ok");
    assert.equal(extractJsonObject(`${fence}json\n{"type":"final","message":"ok"}`).message, "ok");
});

test("un résultat d'outil recopié n'est pas pris pour une action", () => {
    assert.equal(extractJsonObject('{"tool":"read_file","ok":true,"result":{"content":"x"}}'), null);
    assert.equal(normalizeActionShape({ ok: false, error: "x" }).type, undefined);
});

test("une réponse strictement valide est lue exactement comme avant", () => {
    const text = JSON.stringify({ type: "tool", name: "read_file", args: { path: "a" }, reason: "Lire {\"x\":1}" });
    assert.deepEqual(extractJsonObject(text), JSON.parse(text));
    assert.deepEqual(repairJsonText(text), { text, truncated: false });
});

test("les erreurs de parse restent explicites pour la correction", () => {
    assert.match(describeJsonFailure(""), /vide/);
    assert.match(describeJsonFailure("Je vais lire le fichier."), /texte libre/);
    assert.throws(() => parseAgentResponse("pas de json"), /Aucun objet JSON/);
});

test("proseFinalAction ne s'applique qu'au texte libre sans accolade ni bloc de code", () => {
    assert.deepEqual(proseFinalAction("  Voici mon analyse.  "), { type: "final", message: "Voici mon analyse.", completed: false, unverified: true });
    assert.equal(proseFinalAction('Voici {"type":"tool"'), null);
    assert.equal(proseFinalAction(`${fence}js\nconsole.log(1)\n${fence}`), null);
    assert.equal(proseFinalAction(""), null);
});

test("plan_progress tolère les synonymes, objets, chaînes et doublons in_progress", () => {
    assert.deepEqual(normalizeProgress(["done", "En cours", "à faire"]), ["completed", "in_progress", "pending"]);
    assert.deepEqual(normalizeProgress([{ step: "a", status: "completed" }, { status: "todo" }]), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress('["completed","pending"]'), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress("completed, in_progress"), ["completed", "in_progress"]);
    assert.deepEqual(normalizeProgress([true, false]), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress(["in_progress", "in_progress", "pending"]), ["pending", "in_progress", "pending"]);
    assert.equal(normalizeProgress(["invented"]), undefined);
    assert.equal(normalizeProgress([]), undefined);
    assert.equal(normalizeProgress(42), undefined);
});

test("fitProgress ajuste la taille au plan courant sans jamais lever", () => {
    const plan = [{ step: "a", status: "completed" }, { step: "b", status: "in_progress" }, { step: "c", status: "pending" }];
    assert.deepEqual(fitProgress(["completed", "completed"], plan), ["completed", "completed", "pending"]);
    assert.deepEqual(fitProgress(["completed", "completed", "in_progress", "pending"], plan), ["completed", "completed", "in_progress"]);
    assert.equal(fitProgress(["completed"], []), undefined);
    assert.equal(fitProgress(["bogus"], plan), undefined);
    assert.doesNotThrow(() => applyProgress(plan, ["bogus"]));
    assert.doesNotThrow(() => applyProgress([], ["completed"]));
});

test("parseAgentResponse ne rejette plus une action à cause d'un plan_progress illisible", () => {
    const action = parseAgentResponse('{"type":"tool","name":"list_directory","args":{"path":"."},"plan_progress":{"weird":true}}');
    assert.equal(action.name, "list_directory");
    assert.equal(action.plan_progress, undefined);
});

test("un refus de capacité est reconnu même sans le mot accès", () => {
    const refusal = `Le résultat transmis décrit les arguments de get_addon_status ; il ne confirme pas une connexion à Blender. Je n'ai pas de moyen d'exécuter les outils locaux mentionnés depuis cette conversation, et écrire un objet JSON d'appel ne me permettrait pas d'en garantir l'exécution.

Je peux rédiger dans le chat les fichiers Luau. En revanche, aucune création de fichier, capture, validation ou construction .rbxlx n'a été effectuée ici.`;
    assert.equal(looksLikeCapabilityRefusal(refusal), true);
    assert.equal(looksLikeCapabilityRefusal("Je ne peux pas créer ce jeu Roblox dans cette conversation."), true);
    assert.equal(looksLikeCapabilityRefusal("Je peux écrire les scripts Luau et les scripts Python pour Blender dans cette conversation, mais pas piloter un agent local ni exécuter le catalogue d'outils décrit dans tes messages."), true);
    assert.equal(looksLikeCapabilityRefusal("Je peux développer le code Luau et les interfaces de ce jeu dans la conversation, mais les outils locaux roblox_game, roblox_asset et MCP décrits dans ton message ne sont pas disponibles parmi mes outils effectifs. Je n'ai donc ni modifié le projet, ni exécuté Blender, ni construit ou testé une place Roblox."), true);
    assert.equal(looksLikeCapabilityRefusal("Le résultat transmis décrit les paramètres de upload_image ; il ne confirme ni une connexion à Studio ni un accès aux fichiers. Je peux analyser et corriger le code partagé ici, mais pas exécuter ce catalogue local par des objets JSON présentés comme des appels d'outils."), true);
    assert.equal(looksLikeCapabilityRefusal("Pour poursuivre la correction du projet existant, partage le contenu de src/server/services/CityService.luau et de src/server/services/CityHazardService.luau. L'arborescence seule ne permet pas de vérifier leur fonctionnement. Aucun fichier n'a été modifié ni testé."), true);
    const ideRefusal = `Le résultat fourni décrit le schéma de get_addon_status ; il ne prouve pas une connexion à Blender. Aucun projet créé, modèle exporté ou build réussi n'est établi par les résultats transmis.

Je peux écrire et corriger le code du jeu dans le chat, mais pas exécuter les actions locales de ton IDE. Pour poursuivre concrètement, partage les scripts à compléter ou demande un premier ensemble de fichiers Luau à copier : progression des cinq quartiers, batteries, ascenseur collectif et événements du sol.`;
    assert.equal(looksLikeCapabilityRefusal(ideRefusal), true);
    assert.equal(looksLikeCapabilityRefusal("Je peux écrire et corriger le code du jeu dans le chat, mais pas exécuter les actions locales de ton IDE."), true);
    assert.equal(looksLikeCapabilityRefusal("Partage les scripts à compléter pour que je puisse les corriger."), true);
});

test("un compte rendu normal ou une limite externe n'est pas pris pour un refus", () => {
    assert.equal(looksLikeCapabilityRefusal("J'ai créé les fichiers et lancé la validation ; tout est prêt."), false);
    assert.equal(looksLikeCapabilityRefusal("Blender n'est pas lancé : le fichier .blend n'a pas pu être ouvert."), false);
    assert.equal(looksLikeCapabilityRefusal("Je ne peux pas vérifier la pièce jointe avec les outils locaux."), false);
    assert.equal(looksLikeCapabilityRefusal("J'ai lu src/app.js avec read_file et corrigé deux lignes."), false);
    assert.equal(looksLikeCapabilityRefusal("Partage le contenu de ton fichier de configuration externe si tu veux que je l'adapte."), false);
    assert.equal(looksLikeCapabilityRefusal("J'ai corrigé les scripts à copier puis lancé le build ; les cinq quartiers sont prêts."), false);
    assert.equal(looksLikeCapabilityRefusal('{"type":"tool","name":"read_file"}'), false);
});
