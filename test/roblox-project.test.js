"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Avant tout require du projet : la config lit l'environnement au chargement.
process.env.FS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fscli-roblox-project-"));

const { resolveSystems, slugify, createBlueprint, SYSTEMS } = require("../src/roblox/blueprint");
const { normalizeSpec, stageSource } = require("../src/roblox/assets");
const { resolveConfig } = require("../src/roblox/opencloud");
const { buildFiles, scaffoldProject } = require("../src/roblox/scaffold");

test("les systèmes demandés tirent leurs dépendances et gardent l'ordre", () => {
    assert.deepEqual(resolveSystems(["npc"]), ["data", "currency", "combat", "npc"]);
    assert.deepEqual(resolveSystems(["quests", "shop"]), ["data", "currency", "inventory", "quests", "shop"]);
    assert.deepEqual(resolveSystems([]), ["data", "currency"]);
    assert.throws(() => resolveSystems(["inconnu"]), /Système inconnu/);
});

test("les alias de système sont acceptés", () => {
    assert.deepEqual(resolveSystems(["mission"]), ["data", "currency", "inventory", "quests"]);
    assert.deepEqual(resolveSystems(["economy"]), ["data", "currency"]);
});

test("chaque fichier déclaré existe dans les templates", async () => {
    const blueprint = createBlueprint({ name: "Test complet", systems: Object.keys(SYSTEMS) });
    const files = await buildFiles(blueprint);
    const rels = files.map(file => file.rel);

    assert.ok(rels.includes("src/shared/NpcDefs.luau"));
    assert.ok(rels.includes("src/shared/BuildDefs.luau"));
    assert.equal(new Set(rels).size, rels.length, "aucun fichier en double");
    assert.ok(files.every(file => !file.content.includes("{{")), "aucune variable non remplacée");

    const config = files.find(file => file.rel === "src/shared/GameConfig.luau");
    assert.match(config.content, /Test complet/);
});

test("la structure est écrite sans écraser et le blueprint est valide", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "roblox-scaffold-"));
    const blueprint = createBlueprint({ name: "Atelier d’essai", systems: ["inventory"] });
    const result = await scaffoldProject(workspace, blueprint, { confirm: false });

    assert.equal(result.created, result.expected);
    assert.ok(fs.existsSync(path.join(workspace, "game.blueprint.json")));
    assert.ok(fs.existsSync(path.join(workspace, "src/server/ServerMain.server.luau")));
    assert.ok(fs.existsSync(path.join(workspace, "src/shared/Items.luau")));

    const again = await scaffoldProject(workspace, blueprint, { confirm: false });
    assert.equal(again.created, 0, "la seconde structure ne réécrit rien");
});

test("une spécification d'asset est normalisée avec des valeurs sûres", () => {
    const spec = normalizeSpec({
        name: "Épée bois",
        kind: "weapon",
        parts: [{ name: "Lame", shape: "box", size: [1, 1, 4], position: [0, 0, 2], material: "wood" }]
    });

    assert.equal(spec.id, "epee-bois");
    assert.equal(spec.parts.length, 1);
    assert.equal(spec.parts[0].shape, "box");
    assert.deepEqual(spec.lodRatios, [1, 0.5, 0.25, 0.1]);
    assert.equal(spec.parts[0].color[0] > 0, true);

    const fallback = normalizeSpec({ name: "Caisse", size: [2, 2, 2] });
    assert.equal(fallback.parts.length, 1);
    assert.equal(fallback.parts[0].name, "Body");

    assert.throws(() => normalizeSpec({ name: "X", parts: [{ shape: "pyramide" }] }), /shape inconnu/);
    assert.equal(slugify("L’Île des Gardiens"), "l-ile-des-gardiens");
});

test("une spécification importée accepte une source validée", () => {
    const spec = normalizeSpec({
        id: "coffre",
        name: "Coffre importé",
        kind: "prop",
        source: "assets/sources/coffre.glb",
        height: 1.2,
        scale: 1.5,
        rotation: [0, 90, 0],
        bevel: true
    });

    assert.equal(spec.source, "assets/sources/coffre.glb");
    assert.equal(spec.height, 1.2);
    assert.equal(spec.scale, 1.5);
    assert.deepEqual(spec.rotation, [0, 90, 0]);
    assert.equal(spec.bevel, true);
    assert.equal(spec.parts.length, 0, "aucune pièce par défaut pour un import");

    assert.throws(
        () => normalizeSpec({ name: "X", source: "assets/sources/x.exe" }),
        /source invalide/
    );
    assert.throws(
        () => normalizeSpec({ name: "Y", source: "ailleurs/y.glb" }),
        /source invalide/
    );
});

test("un modèle source est copié dans le projet", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "roblox-source-"));
    const source = path.join(workspace, "modele.glb");
    fs.writeFileSync(source, Buffer.from("glTF-stub"));

    const staged = await stageSource(workspace, source, "modele");
    assert.equal(staged.rel, "assets/sources/modele.glb");
    assert.equal(staged.bytes, 9);
    assert.ok(fs.existsSync(path.join(workspace, staged.rel)));
    assert.equal(fs.readFileSync(path.join(workspace, staged.rel), "utf8"), "glTF-stub");

    await assert.rejects(() => stageSource(workspace, "manquant.glb", "manquant"), /introuvable/);
    await assert.rejects(() => stageSource(workspace, source, "modele").then(
        () => stageSource(workspace, path.join(workspace, "modele.exe"), "modele")
    ), /Format non pris en charge/);
});

test("un glTF copie ses buffers et textures externes", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "roblox-gltf-"));
    const sourceDir = path.join(workspace, "entree");
    fs.mkdirSync(path.join(sourceDir, "textures"), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "scene.gltf"), JSON.stringify({
        buffers: [{ uri: "data.bin" }],
        images: [{ uri: "textures/albedo.png" }]
    }));
    fs.writeFileSync(path.join(sourceDir, "data.bin"), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(sourceDir, "textures/albedo.png"), Buffer.from([4, 5]));

    const staged = await stageSource(workspace, path.join(sourceDir, "scene.gltf"), "scene");
    assert.equal(staged.rel, "assets/sources/scene/model.gltf");
    assert.ok(fs.existsSync(path.join(workspace, "assets/sources/scene/model.gltf")));
    assert.ok(fs.existsSync(path.join(workspace, "assets/sources/scene/data.bin")));
    assert.ok(fs.existsSync(path.join(workspace, "assets/sources/scene/textures/albedo.png")));
});

test("la configuration Open Cloud manquante est signalée sans clé", async () => {
    delete process.env.ROBLOX_OPEN_CLOUD_KEY;
    delete process.env.ROBLOX_CREATOR_ID;
    delete process.env.ROBLOX_CREATOR_TYPE;

    const config = await resolveConfig();
    assert.equal(config.ready, false);
    assert.ok(config.missing.some(item => item.includes("ROBLOX_OPEN_CLOUD_KEY")));
    assert.ok(config.missing.some(item => item.includes("ROBLOX_CREATOR_ID")));
    assert.equal(config.apiKey, "");
});
