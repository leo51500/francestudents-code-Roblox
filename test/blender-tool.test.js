"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const blender = require("../src/tools/blender");
const blenderTool = require("../src/tools/blender-tool");

/** GLB minimal : un mesh dont POSITION va de (0,0,0) à (1,2,0.5) mètres. */
function writeGlb(dir, name = "Coffre.glb", extra = {}) {
    const json = {
        asset: { version: "2.0" },
        scenes: [{}],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [{ count: 3, min: [0, 0, 0], max: [1, 2, 0.5] }],
        nodes: [{}],
        materials: [],
        textures: [],
        ...extra
    };
    const pad = text => text + " ".repeat((4 - text.length % 4) % 4);
    const payload = Buffer.from(pad(JSON.stringify(json)), "utf8");
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + payload.length, 8);
    const chunk = Buffer.alloc(8);
    chunk.writeUInt32LE(payload.length, 0);
    chunk.writeUInt32LE(0x4e4f534a, 4);
    fs.mkdirSync(path.join(dir, "build", "models"), { recursive: true });
    const file = path.join(dir, "build", "models", name);
    fs.writeFileSync(file, Buffer.concat([header, chunk, payload]));
    return file;
}

test("inspectGlb calcule la taille en studs depuis les accesseurs POSITION", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-glb-"));
    try {
        const report = blender.inspectGlb(writeGlb(dir));
        assert.equal(report.valid, true);
        assert.deepEqual(report.size_studs, { x: 3.57, y: 7.14, z: 1.79 });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("writeManifest écrit un JSON relisible et importPlan copie le modèle dans Rojo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-manifest-"));
    try {
        const glb = writeGlb(dir);
        const report = blender.inspectGlb(glb);
        const written = blender.writeManifest(dir, glb, report, { name: "Coffre" });
        assert.equal(written.file, "build/models/Coffre.manifest.json");
        assert.equal(written.manifest.name, "Coffre");
        assert.deepEqual(written.manifest.size_studs, report.size_studs);
        assert.equal(blender.readManifest(glb).name, "Coffre");

        const plan = blender.importPlan(dir, glb, written.manifest);
        assert.equal(plan.target, "src/ReplicatedStorage/Assets/Coffre.glb");
        assert.equal(fs.existsSync(path.join(dir, plan.target)), true);
        assert.equal(fs.existsSync(path.join(dir, plan.manifestTarget)), true);
        assert.ok(plan.steps.some(step => /Import 3D/.test(step)));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("parseMarker ignore une sortie sans marqueur ou avec un JSON invalide", () => {
    assert.equal(blender.parseMarker("rien", "VALIDATE"), null);
    assert.equal(blender.parseMarker("VALIDATE {invalide}", "VALIDATE"), null);
    assert.deepEqual(blender.parseMarker("bruit\nVALIDATE {\"ok\":true}\nautre", "VALIDATE"), { ok: true });
});

test("blender validate et export_blender exigent un chemin", () => {
    assert.throws(() => blenderTool.checkArgs({ action: "validate" }), /path/);
    assert.throws(() => blenderTool.checkArgs({ action: "export_blender" }), /path/);
    assert.throws(() => blenderTool.checkArgs({ action: "inconnu" }), /action doit valoir/);
    assert.doesNotThrow(() => blenderTool.checkArgs({ action: "validate", path: "build/models/Coffre.glb" }));
    assert.doesNotThrow(() => blenderTool.checkArgs({ action: "manifest", path: "build/models/Coffre.glb", name: "Coffre" }));
});

test("les modèles Blender embarqués couvrent prop, rig et validation", () => {
    const names = blender.listTemplates().map(item => item.name);
    for (const expected of ["prop_box.py", "prop_tree.py", "prop_weapon.py", "prop_panel.py", "tile_ground.py", "rig_r15.py", "validate_model.py", "export_for_roblox.py", "render_preview.py"]) {
        assert.ok(names.includes(expected), `modèle manquant : ${expected}`);
    }
});
