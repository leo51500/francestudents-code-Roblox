"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildGraph, analyzeSource, serviceFor, scriptKind, instanceName, buildStudioTree } = require("../src/tools/roblox-graph");

function makeProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-rojo-"));
    const write = (rel, content) => {
        const file = path.join(dir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    };
    write("default.project.json", JSON.stringify({
        name: "MonJeu",
        tree: { $className: "DataModel", ServerScriptService: { $path: "src/server" }, ReplicatedStorage: { $path: "src/shared" } }
    }));
    write("src/shared/Porte.luau", [
        "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")",
        "local remote = Instance.new(\"RemoteEvent\")",
        "remote.Name = \"OuvrirPorte\"",
        "remote.Parent = ReplicatedStorage",
        "return remote"
    ].join("\n"));
    write("src/server/Porte.server.luau", [
        "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")",
        "local remote = ReplicatedStorage:WaitForChild(\"OuvrirPorte\")",
        "remote.OnServerEvent:Connect(function(player, porte)",
        "    if typeof(porte) ~= \"Instance\" then return end",
        "    CollectionService:AddTag(porte, \"Ouverte\")",
        "end)"
    ].join("\n"));
    write("src/client/HUD.client.luau", [
        "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")",
        "local remote = ReplicatedStorage:WaitForChild(\"OuvrirPorte\")",
        "remote:FireServer(workspace.Porte)",
        "local autre = ReplicatedStorage:WaitForChild(\"DonnerArgent\")",
        "autre:FireServer(1000000)"
    ].join("\n"));
    return dir;
}

test("roblox_graph : destination Rojo, remotes émis et écoutés", () => {
    const dir = makeProject();
    try {
        const graph = buildGraph(dir);
        assert.equal(graph.roblox, true);
        assert.equal(graph.project.name, "MonJeu");
        assert.equal(graph.counts.files, 3);
        assert.equal(graph.counts.server, 1);
        assert.equal(graph.counts.client, 1);
        assert.equal(graph.counts.modules, 1);

        const porte = graph.scripts.find(item => item.file.endsWith("Porte.server.luau"));
        assert.equal(porte.service, "ServerScriptService");
        assert.equal(porte.kind, "Script");

        const ouvrir = graph.remotes.find(item => item.name === "OuvrirPorte");
        assert.ok(ouvrir, "le remote OuvrirPorte doit être listé");
        assert.ok(ouvrir.emitted >= 1);
        assert.ok(ouvrir.listened >= 1);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("roblox_graph : un remote jamais écouté est signalé", () => {
    const dir = makeProject();
    try {
        const graph = buildGraph(dir);
        assert.ok(
            graph.problems.some(item => /DonnerArgent/.test(item)),
            `points : ${graph.problems.join(" | ")}`
        );
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("roblox_graph : fichiers sans projet Rojo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-norojo-"));
    try {
        const graph = buildGraph(dir);
        assert.equal(graph.roblox, false);
        assert.equal(graph.scripts.length, 0);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("roblox_graph : analyse de source ignore les commentaires", () => {
    const info = analyzeSource([
        "-- remote:FireServer(truc)",
        "--[=[ while true do ]=]",
        "local x = 1"
    ].join("\n"));
    assert.deepEqual(Object.keys(info.remotes), []);
    assert.equal(info.loops, 0);
});

test("roblox_graph : nom et type d'Instance déduits du chemin", () => {
    assert.equal(scriptKind("src/server/Porte.server.luau"), "Script");
    assert.equal(scriptKind("src/client/HUD.client.luau"), "LocalScript");
    assert.equal(scriptKind("src/shared/Porte.luau"), "ModuleScript");
    assert.equal(instanceName("src/shared/Porte.luau"), "Porte");
    assert.equal(serviceFor("src/client/HUD.client.luau"), "StarterPlayer");
    assert.equal(serviceFor("src/server/Porte.server.luau"), "ServerScriptService");
});

test("buildStudioTree : services Roblox, dossiers et scripts, comme l'Explorer", () => {
    const dir = makeProject();
    try {
        fs.mkdirSync(path.join(dir, "src", "server", "Modules"), { recursive: true });
        fs.writeFileSync(path.join(dir, "src", "server", "Modules", "init.luau"), "return {}\n");
        fs.writeFileSync(path.join(dir, "src", "server", "Modules", "Outils.luau"), "return {}\n");

        const tree = buildStudioTree(dir);
        assert.equal(tree.project, "default.project.json");
        assert.deepEqual(tree.services.map(s => s.name), ["ReplicatedStorage", "ServerScriptService"]);

        const server = tree.services.find(s => s.name === "ServerScriptService");
        assert.equal(server.className, "ServerScriptService");
        assert.equal(server.path, "src/server");
        const porte = server.children.find(c => c.name === "Porte");
        assert.equal(porte.className, "Script");
        assert.equal(porte.path, "src/server/Porte.server.luau");

        // Un dossier avec init.luau devient un ModuleScript qui contient ses voisins.
        const modules = server.children.find(c => c.name === "Modules");
        assert.equal(modules.className, "ModuleScript");
        assert.equal(modules.init, "src/server/Modules/init.luau");
        assert.ok(modules.children.some(c => c.name === "Outils" && c.className === "ModuleScript"));

        // Un fichier qui n'est mappé par aucun service est signalé, jamais caché.
        assert.ok(Array.isArray(tree.warnings));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("buildStudioTree : objets imbriqués du default.project.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-tree-"));
    try {
        fs.mkdirSync(path.join(dir, "src", "shared"), { recursive: true });
        fs.writeFileSync(path.join(dir, "src", "shared", "Config.luau"), "return {}\n");
        fs.writeFileSync(path.join(dir, "default.project.json"), JSON.stringify({
            name: "Jeu",
            tree: {
                $className: "DataModel",
                ReplicatedStorage: {
                    Shared: { $path: "src/shared" },
                    Packages: { $path: "Packages" }
                }
            }
        }));
        const tree = buildStudioTree(dir);
        const storage = tree.services[0];
        assert.equal(storage.name, "ReplicatedStorage");
        assert.deepEqual(storage.children.map(c => c.name), ["Shared", "Packages"]);
        assert.equal(storage.children[1].className, "Folder");
        assert.ok(storage.children[1].missing, "un dossier absent est signalé sans planter");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("buildStudioTree : sans projet Rojo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-norojo-"));
    try {
        const tree = buildStudioTree(dir);
        assert.deepEqual(tree.services, []);
        assert.match(tree.warnings[0], /project\.json/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
