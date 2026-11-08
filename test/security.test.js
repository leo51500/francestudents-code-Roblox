"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { normalizeRelative, resolveInWorkspace, PATH_LIMITS } = require("../src/tools/security");

test("normalizeRelative accepte les chemins ordinaires", () => {
    assert.equal(normalizeRelative("src/app.js"), "src/app.js");
    assert.equal(normalizeRelative("src\\tools\\a.js"), "src/tools/a.js");
    assert.equal(normalizeRelative("."), ".");
    assert.equal(normalizeRelative("console.js"), "console.js");
    assert.equal(normalizeRelative(".dockerignore"), ".dockerignore");
    assert.equal(normalizeRelative("docker/config.json"), "docker/config.json");
});

test("normalizeRelative bloque les fichiers d'identifiants", () => {
    for (const p of [
        ".npmrc",
        "a/.netrc",
        ".pgpass",
        ".docker/config.json",
        "sub/.Docker/Config.json",
        ".kube/config",
        "db.kdbx",
        "app.keystore",
        "cert.jks",
        ".env.local",
        "id_rsa"
    ]) {
        assert.throws(() => normalizeRelative(p), /interdit/, p);
    }
});

test("normalizeRelative refuse les noms réservés Windows", () => {
    for (const p of ["CON", "nul.txt", "a/com1", "LPT9.log", "aux"]) {
        assert.throws(() => normalizeRelative(p), /réservé/, p);
    }
});

test("normalizeRelative refuse un point ou un espace final", () => {
    for (const p of ["file.", "dir /x.js", "a/b.js "]) {
        assert.throws(() => normalizeRelative(p), /point ou espace final/, p);
    }
});

test("normalizeRelative limite la longueur et la profondeur", () => {
    assert.throws(
        () => normalizeRelative("a".repeat(PATH_LIMITS.maxChars + 1)),
        /trop long/
    );

    const deep = Array(PATH_LIMITS.maxSegments + 1).fill("a").join("/");
    assert.throws(() => normalizeRelative(deep), /trop profond/);

    const ok = Array(PATH_LIMITS.maxSegments).fill("a").join("/");
    assert.equal(normalizeRelative(ok), ok);
});

test("normalizeRelative refuse '..', ':' et les chemins absolus", () => {
    assert.throws(() => normalizeRelative("../x"), /'\.\.'/);
    assert.throws(() => normalizeRelative("a:b"), /':'/);
    assert.throws(() => normalizeRelative("C:\\x"), /invalide/);
    assert.throws(() => normalizeRelative("/etc/passwd"), /invalide/);
});

test("resolveInWorkspace convertit un chemin absolu situé dans le projet", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-security-"));

    try {
        const absolute = path.join(dir, "src", "app.js");
        const result = await resolveInWorkspace(dir, absolute);
        assert.equal(result.rel, "src/app.js");
        assert.equal(result.target, absolute);

        const root = await resolveInWorkspace(dir, dir);
        assert.equal(root.rel, ".");
        assert.equal(root.target, dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("resolveInWorkspace refuse un chemin absolu hors du projet", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-security-"));

    try {
        const outside = path.join(os.tmpdir(), "frst-security-hors-projet.txt");
        await assert.rejects(resolveInWorkspace(dir, outside), /hors du projet|absolu|invalide/i);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
