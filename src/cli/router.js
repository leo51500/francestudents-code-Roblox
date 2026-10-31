"use strict";

const { state } = require("../state");

const LETTER = "\\p{L}";

function wordRegex(words) {
    return new RegExp(`(?<!${LETTER})(?:${words})(?!${LETTER})`, "iu");
}

const FILE_NOUN_RE = wordRegex(
    "fichiers?|dossiers?|r[ée]pertoires?|code|source|readme|src|projet|" +
    "fonctions?|classes?|module|script|fichier|arborescence"
);

const FILE_NAME_RE = new RegExp(
    "package\\.json" +
    "|\\.(?:js|mjs|cjs|ts|tsx|jsx|json|md|py|html|css|txt|ya?ml|env|sh|ps1)(?![\\p{L}\\d])",
    "iu"
);

const FILE_VERB_RE = wordRegex(
    "lis|lire|ouvre|ouvrir|affiche|liste|lister|cr[ée]e|cr[ée]er|ajoute|ajouter|" +
    "modifie|modifier|corrige|corriger|[ée]dite|[ée]diter|remplace|remplacer|" +
    "renomme|renommer|d[ée]place|d[ée]placer|copie|copier|supprime|supprimer|efface|" +
    "[ée]cris|[ée]crire|g[ée]n[èe]re|explique|analyse|refactor\\w*|am[ée]liore|" +
    "mets?\\s+[àa]\\s+jour|mettre\\s+[àa]\\s+jour|mise\\s+[àa]\\s+jour|" +
    "applique|appliquer|int[èe]gre|int[ée]grer|migr\\w*|corrige|reprends|reprend|" +
    "read|open|list|create|write|edit|fix|move|rename|delete|copy|add|update|upgrade|implement|apply"
);

function seemsToRequestLocalFiles(input) {
    return FILE_NAME_RE.test(input) || (FILE_VERB_RE.test(input) && FILE_NOUN_RE.test(input));
}

/* Le raccourci ne répond que sur une question courte qui porte vraiment sur le
 * dossier courant. Les mots nus « ou » et « où » ne suffisent pas : dans une
 * longue demande (« … la récolte ou les ouvriers … », « structure des
 * dossiers »), ils renvoyaient le chemin du projet sans lancer l'agent. */
const WORKSPACE_NOUN = `(?:projets?|dossiers?|workspaces?|r[ée]pertoires?)(?!${LETTER})`;
const WORKSPACE_DETERMINER =
    `(?:(?:ce|cet|cette|le|la|les|mon|ma|mes|ton|ta|tes|notre|votre)\\s+|l['’]\\s*)?`;

// La question doit s'arrêter sur l'état du dossier : « Quel projet veux-tu
// créer ? » reste une demande pour l'agent, pas une consultation du chemin.
const WORKSPACE_QUESTION_TAIL =
    `\\s*(?:(?:actuel(?:le)?|courant(?:e)?|ouvert(?:e)?|s[ée]lectionn[ée]e?|en\\s+cours|de\\s+travail|suis-je|je\\s+suis|on\\s+est|nous\\s+sommes|path|root|folder|directory)\\s*)?[?.!…]*\\s*$`;

const WORKSPACE_QUESTION_RES = [
    // « Où est le projet ? », « Où se trouve mon dossier ? »
    new RegExp(
        `(?<!${LETTER})où(?!${LETTER})\\s+(?:est|sont|se\\s+trouve(?:nt)?|se\\s+situe(?:nt)?)\\s+${WORKSPACE_DETERMINER}${WORKSPACE_NOUN}${WORKSPACE_QUESTION_TAIL}`,
        "iu"
    ),
    // « Quel est le projet actuel ? », « Quel dossier courant ? »
    new RegExp(
        `(?<!${LETTER})(?:quel|quelle|quels|quelles)(?!${LETTER})\\s+(?:est|sont)?\\s*${WORKSPACE_DETERMINER}${WORKSPACE_NOUN}${WORKSPACE_QUESTION_TAIL}`,
        "iu"
    ),
    // « Dans quel projet suis-je ? »
    new RegExp(
        `(?<!${LETTER})dans\\s+quel(?:le|s|les)?(?!${LETTER})\\s+${WORKSPACE_DETERMINER}${WORKSPACE_NOUN}${WORKSPACE_QUESTION_TAIL}`,
        "iu"
    ),
    // « What is the project path? »
    new RegExp(
        `(?<!${LETTER})(?:which|what)(?!${LETTER})\\s+(?:is|are)?\\s*(?:the|my|this|current)?\\s*(?:project|folder|directory|workspace)(?!${LETTER})${WORKSPACE_QUESTION_TAIL}`,
        "iu"
    )
];

// Une question sur le dossier courant tient en une phrase : au-delà, c'est une
// vraie demande (cahier des charges, liste de fonctionnalités) pour l'agent.
const WORKSPACE_QUESTION_MAX_CHARS = 200;

function isWorkspaceQuestion(input) {
    const text = String(input ?? "").trim();
    if (!text || text.length > WORKSPACE_QUESTION_MAX_CHARS) return false;
    return WORKSPACE_QUESTION_RES.some((pattern) => pattern.test(text)) && !seemsToRequestLocalFiles(text);
}

/** Faut-il passer par l'agent (outils fichiers) pour ce message ? */
function shouldUseAgent(input) {
    if (!state.workspace) return false;
    if (state.mode === "agent") return true;
    if (state.mode === "chat") return false;
    return seemsToRequestLocalFiles(input);
}

module.exports = { seemsToRequestLocalFiles, isWorkspaceQuestion, shouldUseAgent };
