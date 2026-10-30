"use strict";

/**
 * Garde-fou de boucle de l'agent.
 *
 * Deux situations étaient confondues auparavant :
 * 1. l'agent répète une action qui a RÉUSSI (lecture identique, liste identique) : inutile,
 *    l'action est ignorée et une consigne de changement de démarche le relance ;
 * 2. une action ÉCHOUE (fichier verrouillé, lecture seule, chemin absent) puis est rejouée :
 *    c'est normal, par exemple après avoir corrigé le vrai problème. Rejouer ne suffit pas
 *    à conclure à une boucle, mais répéter le même échec plusieurs fois si.
 *
 * Répéter ne doit jamais couper la tâche au premier avertissement : seule une boucle
 * persistante arrête l'agent, avec un compte rendu utile au lieu d'un abandon sec.
 */

// Les vérifications doivent pouvoir être relancées : c'est leur raison d'être.
const VERIFY_TYPES = /(build|test|check|lint|render|inspect|validate|playtest)/i;
// Commandes dont le but est de relancer une vérification : npm test, rojo build…
const VERIFY_COMMANDS = /\b(test|build|check|lint|render|blender .*--background|rojo (build|sourcemap|serve))\b/i;

function isVerification(action) {
    if (VERIFY_TYPES.test(String(action?.name || ""))) return true;
    return action?.name === "run_command" && VERIFY_COMMANDS.test(String(action?.args?.command || ""));
}

/** Nombre de répétitions tolérées avant d'ignorer une action identique. */
function repeatLimitFor(action) {
    if (action?.calls) return 3;
    return isVerification(action) ? 6 : 3;
}

/** Détail lisible d'une action refusée, pour construire la consigne de déblocage. */
function actionLabel(action) {
    if (action?.calls) return `un lot de ${action.calls.length} lecture(s)`;
    const target = action?.args?.path || action?.args?.query || action?.args?.command || action?.args?.url || "";
    return target ? `${action.name} (${String(target).slice(0, 120)})` : String(action?.name || "cette action");
}

/** Consigne ajoutée à la prochaine étape quand une action identique a déjà réussi. */
function repeatSteering(action, seen, stuck) {
    return `BOUCLE D'AGENT (avertissement ${stuck}) — ${actionLabel(action)} vient d'être exécutée ${seen} fois ou plus avec exactement les mêmes arguments, et elle avait réussi : son résultat est déjà dans les RÉSULTATS DES OUTILS. Ne la relance pas. Choisis une démarche différente : lis la plage utile avec read_file (start_line/end_line), cherche le nom réel avec search_files, liste le dossier parent avec list_directory, applique la correction avec edit_file/write_file, puis termine avec final. Si une information manque vraiment, appelle ask_user au lieu de boucler.`;
}

/** Message final d'arrêt : ce qui a été tenté, ce qui existe déjà, ce qu'il reste à faire. */
function stuckSummary(observations = []) {
    const attempts = observations
        .filter(item => item && item.tool)
        .slice(-5)
        .map(item => {
            const target = item.args?.path || item.args?.query || item.args?.command || "";
            const label = target ? `${item.tool} ${String(target).slice(0, 80)}` : String(item.tool || "action");
            return item.ok === false ? `${label} : échec` : `${label} : exécuté`;
        });
    const lines = [
        "J'arrête ici pour ne pas répéter les mêmes actions indéfiniment, mais le travail déjà effectué est conservé.",
        attempts.length ? `Dernières étapes : ${attempts.join(" ; ")}.` : "",
        "Pour continuer, précise le fichier ou le dossier exact (chemin entier) ou dis-moi ce que je dois vérifier en premier."
    ];
    return lines.filter(Boolean).join(" ");
}

// Fichier verrouillé par Studio, lecture seule, ou refus d'écriture disque.
const LOCKED_FILE = /(another instance|autre instance|used by another process|utilisé par un autre processus|read[- ]only|lecture seule|EBUSY|EPERM|EACCES|permission denied|access denied|accès refusé|acc[eè]s refus[eé]|verrouill)/i;

/**
 * Fichier verrouillé : la même écriture échouera encore. Renvoie une consigne
 * de déblocage (null si l'échec n'a rien à voir avec un verrou).
 */
function lockedFileHint(action, result = {}) {
    if (!action || action.calls) return null;
    if (!["edit_file", "write_file"].includes(action.name)) return null;
    const detail = String(result?.error || result?.message || result?.stderr || result?.output || "");
    if (!LOCKED_FILE.test(detail)) return null;
    const target = action.args?.path || "ce fichier";
    const alternative = String(target).replace(/(\.[^./\\]+)$/, "_nouveau$1");
    return `FICHIER VERROUILLÉ — ${target} n'a pas pu être écrit : ${detail.slice(0, 240)} Un autre programme (souvent Roblox Studio, ou une autre fenêtre de ce dossier) garde ce fichier. Ne rejoue pas la même écriture : le contenu préparé n'est pas perdu et l'échec vient du système, pas du code. Décris précisément à l'utilisateur ce qui a déjà été modifié, puis propose de l'enregistrer sous un nom différent (write_file vers ${alternative}, même contenu, puis indique ce qui reste à reporter) ou demande de fermer la session qui le verrouille (Studio enregistre la place, puis se déconnecte) avant de relancer la modification. Ne prétends jamais que le fichier a été enregistré.`;
}

module.exports = { repeatLimitFor, isVerification, repeatSteering, stuckSummary, lockedFileHint, actionLabel, LOCKED_FILE, VERIFY_TYPES, VERIFY_COMMANDS };
