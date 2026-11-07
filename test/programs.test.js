"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const programs = require("../src/programs");
const settings = require("../src/settings");

test("programmes : alias et chemins Steam échappés", () => {
    assert.equal(programs.getDefinition("blender").id, "blender");
    assert.equal(programs.getDefinition("Roblox Studio").id, "robloxStudio");
    assert.equal(programs.getDefinition("roblox-studio").id, "robloxStudio");
    assert.throws(() => programs.getDefinition("calc"), /Programme inconnu/);

    assert.deepEqual(
        programs.parseSteamLibraryFolders('"libraryfolders"\n{\n "1"\n {\n  "path" "D:\\\\SteamLibrary"\n }\n "2" { "path" "C:\\\\Program Files (x86)\\\\Steam" } }'),
        ["D:\\SteamLibrary", "C:\\Program Files (x86)\\Steam"]
    );
});

test("programmes : chemin choisi validé, conservé puis effacé", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frst-programs-"));
    const blender = path.join(directory, "blender.exe");
    const other = path.join(directory, "calc.exe");
    fs.writeFileSync(blender, "");
    fs.writeFileSync(other, "");

    try {
        assert.throws(() => programs.setProgramPath("blender", other), /n’est pas Blender/);
        assert.throws(() => programs.setProgramPath("blender", path.join(directory, "absent.exe")), /introuvable/);

        const saved = programs.setProgramPath("blender", blender);
        assert.equal(saved.configured, true);
        assert.equal(saved.path, blender);
        assert.equal(settings.load().programPaths.blender, blender);

        const cleared = programs.clearProgramPath("blender");
        assert.equal(cleared.configured, false);
        assert.equal(settings.load().programPaths.blender, undefined);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("programmes : détection structurée sans lancer d’application", () => {
    const report = programs.detectPrograms();
    assert.equal(report.platform, process.platform);
    assert.deepEqual(report.programs.map(item => item.id), ["blender", "robloxStudio"]);
    for (const item of report.programs) {
        assert.equal(typeof item.label, "string");
        assert.equal(typeof item.found, "boolean");
        assert.equal(typeof item.running, "boolean");
        if (item.found) assert.equal(path.isAbsolute(item.path), true);
    }
});

test("applications : lecture de Get-StartApps et recherche sans accents", () => {
    const items = programs.parseStartApps(JSON.stringify([
        { Name: "Bloc-notes", AppID: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App" },
        { Name: "Calculatrice", AppID: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App" },
        { Name: "BeamNG.drive", AppID: "steam://rungameid/284160" },
        { Name: "WinRAR", AppID: "{6D809377}\\WinRAR\\WinRAR.exe" },
        { Name: "Site", AppID: "https://example.com" },
        { Name: "Doublon", AppID: "steam://rungameid/284160" },
        { Name: "", AppID: "vide" }
    ]));

    assert.deepEqual(items.map(item => item.name), ["BeamNG.drive", "Bloc-notes", "Calculatrice", "WinRAR"]);
    assert.equal(items.find(item => item.name === "BeamNG.drive").source, "Steam");
    assert.equal(items.find(item => item.name === "BeamNG.drive").kind, "steam");
    assert.equal(items.find(item => item.name === "Calculatrice").source, "Microsoft Store");
    assert.equal(programs.parseStartApps("").length, 0);
    assert.equal(programs.parseStartApps("pas du json").length, 0);

    assert.deepEqual(
        programs.searchApplications(items, "calc").map(item => item.name),
        ["Calculatrice"]
    );
    assert.deepEqual(
        programs.searchApplications(items, "bloc notes").map(item => item.name),
        ["Bloc-notes"]
    );
    assert.deepEqual(
        programs.searchApplications(items, "notes").map(item => item.name),
        ["Bloc-notes"]
    );
    assert.equal(programs.searchApplications(items, "", 2).length, 2);
});

test("applications : nom exact, préfixe unique et ambiguïté refusée", () => {
    const items = [
        { id: "a", name: "Visual Studio Code", source: "Menu Démarrer", target: "a", kind: "app" },
        { id: "b", name: "Visual Studio Installer", source: "Menu Démarrer", target: "b", kind: "app" },
        { id: "c", name: "Paint", source: "Microsoft Store", target: "c", kind: "app" }
    ];

    assert.equal(programs.findApplication(items, "Paint").id, "c");
    assert.equal(programs.findApplication(items, "visual studio code").id, "a");
    assert.throws(() => programs.findApplication(items, "visual studio"), /Plusieurs applications/);
    assert.throws(() => programs.findApplication(items, "Inconnue"), /introuvable/);
    assert.throws(() => programs.findApplication(items, ""), /nom de l’application/);
});

test("applications : lancement refusé sans cible valide", async () => {
    await assert.rejects(programs.launchApplication({}), /un seul/);
    await assert.rejects(programs.launchApplication({ name: "Paint", path: "C:\\absent.exe" }), /un seul/);
    await assert.rejects(programs.launchApplication({ path: "C:\\absent-application.exe" }), /Fichier introuvable/);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frst-applications-"));
    const text = path.join(directory, "notes.txt");
    fs.writeFileSync(text, "");
    try {
        await assert.rejects(programs.launchApplication({ path: text }), /\.exe, \.lnk ou \.url/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("applications : résout les fichiers et dossiers et limite les protocoles URL", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frst-open-target-"));
    const file = path.join(directory, "notes.txt");
    fs.writeFileSync(file, "");
    try {
        assert.deepEqual(programs.resolveOpenTarget(file), {
            target: file,
            url: false,
            directory: false,
            file: true
        });
        assert.deepEqual(programs.resolveOpenTarget(directory), {
            target: directory,
            url: false,
            directory: true,
            file: false
        });
        assert.equal(programs.resolveOpenTarget("https://example.com").url, true);
        assert.throws(() => programs.resolveOpenTarget("file://example.com/"), /HTTP et HTTPS/);
        assert.throws(() => programs.resolveOpenTarget(path.join(directory, "missing.txt")), /introuvable/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("applications : open_app accepte une cible avec une application unique", () => {
    const openApp = require("../src/tools/applications");
    assert.doesNotThrow(() => openApp.check({ name: "Visual Studio Code", target: "src/app.js" }));
    assert.throws(() => openApp.check({ name: "Visual Studio Code", target: "" }), /target/);
    assert.throws(() => openApp.check({ name: "Code", path: "C:\\Tools\\Code.exe" }), /un seul/);
});
