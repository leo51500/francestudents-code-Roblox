"use strict";

/**
 * Rôles des sous-agents (outil `task`).
 *
 * Un sous-agent garde un contexte propre et ne voit pas la conversation principale :
 * un rôle ne remplace donc pas la mission, il ajoute les conventions du métier pour que
 * le compte rendu soit directement exploitable par l'agent principal.
 * Étape actuelle : lecture seule. L'écriture par sous-agent viendra plus tard, avec des
 * chemins réservés et un verrou par dossier pour éviter deux écritures concurrentes.
 */

const ROLES = {
    general: {
        label: "Exploration générale",
        instructions: "Comprends la structure du projet et rapporte les faits utiles avec leurs chemins."
    },
    "roblox-luau": {
        label: "Scripts Luau et architecture Roblox",
        instructions: "Luau moderne (--!strict quand c'est possible), API actuelles et typées, remotes validés côté serveur, nettoyage des connexions, pas de boucle sans task.wait. Respecte Rojo (*.project.json, src/), Aftman/Wally et StyLua. Pour chaque constat, cite le service Roblox concerné (ServerScriptService, ReplicatedStorage, StarterPlayer…)."
    },
    "roblox-interface": {
        label: "Interface Roblox (GUI)",
        instructions: "UI construite dans le code ou en .model.json : ScreenGui/SurfaceGui, UIGridLayout, UIPadding, UIAspectRatioConstraint, UIScale, UIListLayout, TextScaled plutôt que tailles figées ; adapté mobile, manette et console. Rapporte les écrans, leurs composants et les textes visibles."
    },
    "roblox-3d": {
        label: "Scène, modèle 3D et niveau",
        instructions: "Contenu de jeu : Parts, MeshParts, modèles, positions, échelle (1 stud = 0,28 m), collisions et NetworkOwnership. Vérifie les limites de performances (nombre d'instances, polygones, textures 1024 px max) et rapporte les fichiers de scène (.model.json, init.meta.json) concernés."
    },
    blender: {
        label: "Modélisation Blender",
        instructions: "Géométrie propre en mètres, origine à la base, normales cohérentes, UV sans chevauchement, textures 1024 px max, caméras et lumières retirées avant l'export GLB. Un modèle n'est décrit comme valide qu'après inspect puis validate ; un rendu n'est examiné que via l'outil d'image."
    }
};

const NAMES = Object.keys(ROLES);

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
    return `SPÉCIALITÉ : ${role.label}\n${role.instructions}\nReste en LECTURE SEULE : tu ne modifies aucun fichier. Ton compte rendu doit être directement utilisable par l'agent principal (chemins relatifs, numéros de ligne, décisions à prendre).`;
}

module.exports = { ROLES, NAMES, roleOf, rolePrompt };
