"use strict";

const TOOL_LABELS = {
    list_directory: "Lister",
    read_file: "Lire",
    search_files: "Chercher",
    create_directory: "Créer le dossier",
    write_file: "Écrire",
    edit_file: "Éditer",
    move_path: "Déplacer",
    copy_path: "Copier",
    delete_path: "Supprimer",
    remember: "Mémoriser",
    run_command: "Commande",
    open_program: "Ouvrir",
    open_app: "Ouvrir une application",
    open_in: "Ouvrir avec",
    roblox_game: "Projet Roblox",
    roblox_asset: "Modèle 3D / son",
    web_fetch: "Web"
};

function toolLabel(name) {
    return TOOL_LABELS[name] || String(name ?? "");
}

module.exports = { TOOL_LABELS, toolLabel };
