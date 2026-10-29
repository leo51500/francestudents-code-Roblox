"use strict";

/**
 * Visualiseur de build Roblox : lit un fichier .rbxlx/.rbxmx (XML) ou .rbxl/.rbxm (binaire)
 * et renvoie la hiérarchie réelle du jeu (services, instances, scripts), plus les statistiques
 * utiles pour juger un résultat : parts, meshparts, scripts, remotes, meshes importés.
 *
 * Lecture seule : aucun fichier modifié. Le contenu reste dans le projet ouvert.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_ITEMS = 1200;
const MAX_DEPTH = 8;

/**
 * Parcours réel du XML Roblox : <Item class="X"> englobe ses <Properties> et ses enfants.
 * Un événement à la fois, sans regex sur du contenu imbriqué : la hiérarchie reste exacte.
 */
function parseXmlTree(text, maxItems = MAX_ITEMS) {
    const roots = [];
    const stack = [];
    let count = 0;
    const tagRe = /<(\/?)Item\b([^>]*)>/g;
    let match;

    while ((match = tagRe.exec(text)) !== null && count < maxItems) {
        const closing = match[1] === "/";
        if (!closing) {
            const className = /class="([^"]+)"/.exec(match[2])?.[1] || "Instance";
            const current = { className, name: null, referent: null, children: [], openAt: tagRe.lastIndex };
            if (stack.length) stack[stack.length - 1].children.push(current);
            else roots.push(current);
            stack.push(current);
            count += 1;
            continue;
        }
        const node = stack.pop();
        if (node) {
            // Nom et referent : fragment entre CETTE ouverture et sa fermeture, sans les enfants.
            const fragment = text.slice(node.openAt, match.index).replace(/<Item\b[^>]*>/g, "");
            node.name = decodeXml(/<string\s+name="Name">([^<]*)<\/string>/.exec(fragment)?.[1] || node.className);
            node.referent = /<Ref\s+name="referent">([^<]+)<\/Ref>/.exec(fragment)?.[1] || null;
            delete node.openAt;
        }
    }
    // Les Items non fermés (fichier tronqué) restent dans l'arbre : le build est signalé invalide plus haut.
    for (const node of stack) {
        if (!node.name) node.name = node.className;
        delete node.openAt;
    }
    return roots;
}

function decodeXml(value) {
    return String(value)
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, "&");
}

/** Statistiques sur l'arbre : parts, meshes, scripts, remotes. */
function stats(nodes, acc = { instances: 0, parts: 0, meshParts: 0, scripts: 0, localScripts: 0, modules: 0, remotes: 0, values: 0 }, depth = 0) {
    // Acc cumulé sur tout l'arbre (récursion profonde bornée par MAX_DEPTH).
    for (const node of nodes) {
        acc.instances += 1;
        if (/^(Part|WedgePart|CylinderPart|TrussPart|SpawnLocation)$/.test(node.className)) acc.parts += 1;
        if (node.className === "MeshPart") acc.meshParts += 1;
        if (node.className === "Script") acc.scripts += 1;
        if (node.className === "LocalScript") acc.localScripts += 1;
        if (node.className === "ModuleScript") acc.modules += 1;
        if (/Remote(Event|Function)$/.test(node.className)) acc.remotes += 1;
        if (/Value$/.test(node.className)) acc.values += 1;
        if (depth < MAX_DEPTH && node.children.length) stats(node.children, acc, depth + 1);
    }
    return acc;
}

/** Réduit l'arbre pour l'affichage : profondeur et nombre limités, comptes conservés. */
function trim(nodes, depth = 0) {
    return nodes.slice(0, 200).map(node => ({
        // openAt n'est qu'un détail d'analyse : il ne sort jamais vers l'interface.
        className: node.className,
        name: node.name,
        children: depth < MAX_DEPTH ? trim(node.children, depth + 1) : [],
        hidden: node.children.length > 200 ? node.children.length - 200 : 0
    }));
}

function inspectBuild(file) {
    const info = { file: path.basename(file), bytes: 0, format: null };
    try {
        info.bytes = fs.statSync(file).size;
    } catch {
        return { ...info, valid: false, error: "Fichier introuvable." };
    }
    const ext = path.extname(file).toLowerCase();
    if (![".rbxl", ".rbxm", ".rbxlx", ".rbxmx"].includes(ext)) {
        return { ...info, valid: false, error: "Format attendu : .rbxlx, .rbxmx, .rbxl ou .rbxm." };
    }
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (error) {
        return { ...info, valid: false, error: `Lecture impossible : ${error.message}` };
    }
    // Un .rbxl peut aussi être du binaire : seule l'absence d'en-tête XML fait basculer.
    if (!/<roblox[^>]*>/.test(text.slice(0, 4096))) {
        const binary = [".rbxl", ".rbxm"].includes(ext);
        return {
            ...info,
            format: binary ? "binaire" : "XML",
            valid: false,
            error: binary ? "Build binaire non lisible en détail." : "En-tête <roblox> absent : ce n'est pas une place Roblox.",
            message: binary
                ? "Ce build est en binaire : sa hiérarchie n'est pas lisible ici. Relance « rojo build --output game.rbxlx » pour un build XML détaillé."
                : "Build invalide.",
            stats: null,
            tree: []
        };
    }
    const tree = parseXmlTree(text);
    const counts = stats(tree);
    return {
        ...info,
        format: "XML",
        valid: true,
        tree: trim(tree),
        stats: counts,
        message: `${counts.instances} instance(s), ${counts.parts} part(s), ${counts.meshParts} mesh(es), ${counts.scripts + counts.localScripts} script(s), ${counts.modules} module(s), ${counts.remotes} remote(s).`
    };
}

module.exports = { inspectBuild, parseXmlTree, stats, trim };
