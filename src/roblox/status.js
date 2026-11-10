"use strict";

/**
 * État lisible d'un projet Roblox : phases, systèmes, fichiers attendus,
 * assets et prochaine action utile.
 */

const { PHASES, SYSTEMS } = require("./blueprint");
const { readBlueprint, readLibrary, exists, listProjectFiles } = require("./project");
const { readAudioLibrary } = require("./assets");
const { TARGET_DIRS } = require("./scaffold");

function expectedFiles(systemId) {
    const definition = SYSTEMS[systemId];
    if (!definition) return [];
    return (definition.files || [])
        .filter(file => Object.hasOwn(TARGET_DIRS, file.target))
        .map(file => `${TARGET_DIRS[file.target]}/${file.name}`);
}

async function projectStatus(workspace) {
    const blueprint = await readBlueprint(workspace);
    const library = await readLibrary(workspace);
    const audio = await readAudioLibrary(workspace).catch(() => ({ sounds: [] }));
    const files = await listProjectFiles(workspace);
    const fileSet = new Set(files);

    const systems = blueprint.systems.map(system => {
        const expected = expectedFiles(system.id);
        const present = expected.filter(rel => fileSet.has(rel));
        const missing = expected.filter(rel => !fileSet.has(rel));
        return {
            id: system.id,
            label: system.label,
            status: system.status,
            files: `${present.length}/${expected.length}`,
            missing
        };
    });

    const missingCore = [
        "default.project.json",
        "src/shared/GameConfig.luau",
        "src/server/ServerMain.server.luau",
        "src/client/ClientMain.client.luau"
    ].filter(rel => !fileSet.has(rel));

    const phase = blueprint.phases.find(item => item.status === "in_progress")
        || blueprint.phases.find(item => item.status !== "completed")
        || null;
    const nextSteps = [];
    if (missingCore.length) nextSteps.push(`Structure incomplète : ${missingCore.join(", ")}.`);
    if (library.assets.length === 0) {
        nextSteps.push("Aucun asset : décris un asset puis utilise roblox_asset (action:spec puis action:build).");
    } else {
        const unbuilt = library.assets.filter(asset => !asset.files || !asset.files.lod0);
        if (unbuilt.length) nextSteps.push(`Assets non exportés : ${unbuilt.map(asset => asset.id).join(", ")}.`);
        const toUpload = library.assets.filter(asset => asset.files?.lod0 && !asset.upload?.assetId);
        if (toUpload.length) {
            nextSteps.push(`Modèles prêts à envoyer sur Roblox : ${toUpload.map(asset => asset.id).join(", ")} (roblox_asset action:upload).`);
        }
    }
    const soundsToUpload = audio.sounds.filter(sound => !sound.upload?.assetId);
    if (soundsToUpload.length) {
        nextSteps.push(`Sons prêts à envoyer sur Roblox : ${soundsToUpload.map(sound => sound.id).join(", ")} (roblox_asset action:upload).`);
    }
    if (blueprint.systems.some(system => system.status === "code")) {
        nextSteps.push("Personnalise les systèmes générés (objets, PNJ, missions, offres) puis valide le Luau.");
    }
    if (phase) nextSteps.push(`Phase en cours : ${phase.label}.`);

    const hasBuild = await exists(workspace, "build/last-build.json");
    if (hasBuild) nextSteps.push("Une place .rbxlx existe dans build/ : ouvre-la dans Roblox Studio pour tester.");

    return {
        name: blueprint.name,
        slug: blueprint.slug,
        genre: blueprint.genre,
        workspace,
        version: blueprint.version,
        systems,
        screens: blueprint.uiScreens,
        phases: blueprint.phases.map(item => ({ id: item.id, label: item.label, status: item.status, note: item.note })),
        currentPhase: phase ? phase.id : "delivery",
        assets: {
            total: library.assets.length,
            built: library.assets.filter(asset => asset.files && asset.files.lod0).length,
            uploaded: library.assets.filter(asset => asset.upload?.assetId).length,
            items: library.assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                kind: asset.kind,
                lod: asset.lods || 0,
                preview: asset.preview || null,
                assetId: asset.upload?.assetId || null
            }))
        },
        audio: {
            total: audio.sounds.length,
            uploaded: audio.sounds.filter(sound => sound.upload?.assetId).length,
            items: audio.sounds.map(sound => ({
                id: sound.id,
                name: sound.name,
                file: sound.file,
                assetId: sound.upload?.assetId || null
            }))
        },
        files: {
            total: files.length,
            luau: files.filter(file => file.endsWith(".luau")).length,
            missingCore
        },
        nextSteps,
        message:
            `${blueprint.name} — ${blueprint.systems.length} système(s), ` +
            `${library.assets.length} asset(s) (${library.assets.filter(asset => asset.upload?.assetId).length} envoyé(s)), ` +
            `${audio.sounds.length} son(s), ${files.length} fichier(s).`
    };
}

async function projectExists(workspace) {
    return exists(workspace, "game.blueprint.json");
}

module.exports = { expectedFiles, projectStatus, projectExists, PHASES };
