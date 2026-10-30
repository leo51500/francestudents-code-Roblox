"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { inspectGlb, describeGlb, listTemplates } = require("../src/tools/blender");
const { checkArgs } = require("../src/tools/blender-tool");

function buildGlb(json, { magic = 0x46546c67, version = 2, truncate = false, declaredExtra = 0 } = {}) {
    const body = Buffer.from(JSON.stringify(json), "utf8");
    const padded = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(magic, 0);
    header.writeUInt32LE(version, 4);
    header.writeUInt32LE(20 + padded.length + declaredExtra, 8);
    header.writeUInt32LE(padded.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const out = Buffer.concat([header, padded]);
    return truncate ? out.subarray(0, out.length - 8) : out;
}

function withFile(buffer, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-glb-"));
    const file = path.join(dir, "modele.glb");
    fs.writeFileSync(file, buffer);
    try {
        return fn(file);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const VALID = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    materials: [{}, {}],
    textures: [{}],
    images: [{}],
    accessors: [{ count: 24 }, { count: 36 }]
};

test("blender : un GLB valide est analysé (meshes, triangles, matériaux)", () => {
    const report = withFile(buildGlb(VALID), inspectGlb);
    assert.equal(report.valid, true);
    assert.equal(report.meshes, 1);
    assert.equal(report.triangles, 12, "36 indices = 12 triangles");
    assert.equal(report.materials, 2);
    assert.equal(report.multiMaterial, false);
    assert.match(describeGlb(report), /12 triangle\(s\)/);
});

test("blender : un fichier qui n'est pas un GLB est refusé clairement", () => {
    const report = withFile(Buffer.from("<html>pas un modèle</html>"), inspectGlb);
    assert.equal(report.valid, false);
    assert.match(report.error, /Ce n'est pas un GLB/);
});

test("blender : une caméra exportée est signalée comme un point à corriger", () => {
    const report = withFile(buildGlb({ ...VALID, cameras: [{}] }), inspectGlb);
    assert.equal(report.valid, true);
    assert.ok(report.problems.some(item => /caméra/i.test(item)), report.problems.join(" | "));
});

test("blender : un fichier tronqué est refusé (JSON ou taille incohérente)", () => {
    const truncated = withFile(buildGlb(VALID, { truncate: true }), inspectGlb);
    assert.equal(truncated.valid, false);
    assert.match(truncated.error, /tronqué|illisible/i);

    const shortDeclared = withFile(buildGlb(VALID, { declaredExtra: 0 }), inspectGlb);
    assert.equal(shortDeclared.valid, true);
});

test("blender : un fichier vide ou sans mesh n'est pas validé", () => {
    assert.equal(withFile(Buffer.alloc(4), inspectGlb).valid, false);
    const empty = withFile(buildGlb({ asset: { version: "2.0" } }), inspectGlb);
    assert.equal(empty.valid, true);
    assert.ok(empty.problems.some(item => /Aucun mesh/.test(item)));
});

test("blender : les modèles Python embarqués sont listés", () => {
    const templates = listTemplates();
    const names = templates.map(item => item.name);
    assert.ok(names.length >= 3, `modèles : ${names.join(",")}`);
    assert.ok(names.includes("prop_box.py"));
    assert.ok(names.includes("render_preview.py"));
    assert.ok(templates.every(item => fs.existsSync(item.path)));
});

test("blender : arguments de l'outil validés", () => {
    assert.throws(() => checkArgs({ action: "inconnue" }), /action doit valoir/);
    assert.throws(() => checkArgs({ action: "inspect" }), /path/);
    assert.throws(() => checkArgs({ action: "script", path: "a.py", script_args: ["x", 3] }), /script_args/);
    assert.doesNotThrow(() => checkArgs({ action: "script", path: "a.py", script_args: ["--name", "Test"] }));
});

test("blender : plusieurs matériaux sans texture = palette importée par l'importeur Roblox", () => {
    const colors = {
        ...VALID,
        materials: [{ name: "bois" }, { name: "metal" }, { name: "pierre" }],
        textures: [],
        images: []
    };
    const report = withFile(buildGlb(colors), inspectGlb);
    assert.equal(report.valid, true);
    assert.equal(report.materials, 3);
    assert.equal(report.multiMaterial, true);
    assert.deepEqual(report.materialNames, ["bois", "metal", "pierre"]);
    assert.equal(report.problems.length, 0, report.problems.join(" | "));
    assert.match(describeGlb(report), /palette de 3 couleurs/);
});

test("blender : plus de cinq matériaux et couleurs mélangées à une texture sont signalés", () => {
    const tooMany = withFile(buildGlb({
        ...VALID,
        materials: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }, { name: "e" }, { name: "f" }],
        textures: [],
        images: []
    }), inspectGlb);
    assert.ok(tooMany.problems.some(item => /5 couleurs/.test(item)), tooMany.problems.join(" | "));

    const mixed = withFile(buildGlb({ ...VALID, materials: [{ name: "bois" }, { name: "metal" }], textures: [{}], images: [{}] }), inspectGlb);
    assert.ok(mixed.problems.some(item => /texture/i.test(item)), mixed.problems.join(" | "));
});

test("blender : blender_common.py fournit les outils de géométrie et la palette", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "blender", "blender_common.py"), "utf8");
    for (const fn of ["def bevel", "def sphere", "def cone", "def torus", "def mirror", "def boolean_cut", "def lathe", "def noise", "def palette", "def assign_palette", "def render_preview", "def assemble_quad_image"]) {
        assert.ok(source.includes(fn), `outil manquant : ${fn}`);
    }
    for (const color of ["bois", "metal", "feuillage", "pierre"]) {
        assert.ok(source.includes(`"${color}"`), `couleur de palette manquante : ${color}`);
    }
    assert.match(source, /PREVIEW_ANGLES/, "quatre angles de contrôle attendus");
});
