"use strict";

/**
 * Rôles des sous-agents (outil `task`).
 *
 * Un sous-agent garde un contexte propre et ne voit pas la conversation principale :
 * un rôle ne remplace donc pas la mission, il ajoute les conventions du métier pour que
 * le compte rendu soit directement exploitable par l'agent principal.
 *
 * Le registre vit dans ./subagents/index.js : chaque rôle y déclare ses instructions,
 * ses skills et — s'il peut modifier le projet — ses outils d'écriture. Pour ajouter un
 * sous-agent, voir src/agent/subagents/README.md ; rien d'autre ne change ici.
 */

const registry = require("./subagents");

/** Objet { nom: { label, instructions } } conservé pour les consommateurs existants. */
const ROLES = Object.freeze(Object.fromEntries(
    registry.roles().map(role => [role.name, { label: role.label, instructions: role.instructions }])
));

const NAMES = Object.freeze(registry.names());

/** Rôle normalisé ; un rôle inconnu est refusé pour ne pas inventer de consignes. */
function roleOf(value) {
    if (value === undefined || value === null || value === "") return "general";
    const name = String(value).trim().toLowerCase();
    if (!NAMES.includes(name)) throw new Error(`Rôle de sous-agent inconnu : ${name}. Rôles disponibles : ${NAMES.join(", ")}.`);
    return name;
}

/** Bloc ajouté au prompt du sous-agent, après la mission. */
function rolePrompt(name) {
    const role = ROLES[roleOf(name)];
    const canWrite = registry.canWrite(name);
    const access = canWrite
        ? "Tu peux MODIFIER le projet avec les outils de ton rôle, uniquement dans les zones indiquées. Une écriture que l'application refuse s'arrête là : ne la contourne pas par un autre outil."
        : "Reste en LECTURE SEULE : tu ne modifies aucun fichier.";
    return `SPÉCIALITÉ : ${role.label}\n${role.instructions}\n${access}\nTout ce qui est hors de ta spécialité ne doit pas être produit : signale-le dans le compte rendu pour que l'agent principal le confie à un autre sous-agent.\nTon compte rendu remplace des fichiers et des outils pour l'agent principal : chemins relatifs, chemins produits, contrôles réellement exécutés, décisions à prendre. Ce compte rendu est aussi montré à l'utilisateur : français, factuel, sans balises internes.`;
}

module.exports = { ROLES, NAMES, roleOf, rolePrompt };
