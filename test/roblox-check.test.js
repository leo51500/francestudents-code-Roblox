"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { inspectLuau, parseSelene, parseLuauAnalyze, findRojoProject } = require("../src/tools/roblox-check");

test("roblox_check : boucle serrée et service sans GetService détectés", () => {
    const source = [
        "--!strict",
        "local joueurs = Players:GetPlayers()",
        "while true do",
        "    print(\"tick\")",
        "end"
    ].join("\n");
    const found = inspectLuau(source, "src/server/main.server.luau");
    const codes = found.map(item => item.code);
    assert.ok(codes.includes("tight-loop"), `tight-loop manquant : ${codes.join(",")}`);
    assert.ok(codes.includes("service-global"), "Players utilisé sans GetService doit être signalé");
    assert.equal(found.find(item => item.code === "tight-loop").line, 3);
});

test("roblox_check : un code Luau sain ne produit aucun diagnostic", () => {
    const source = [
        "--!strict",
        "local Players = game:GetService(\"Players\")",
        "local RunService = game:GetService(\"RunService\")",
        "local connexion = RunService.Heartbeat:Connect(function(dt)",
        "    local part = Instance.new(\"Part\")",
        "    part.Name = \"Plateforme\"",
        "    part.Parent = workspace",
        "end)",
        "connexion:Disconnect()"
    ].join("\n");
    assert.deepEqual(inspectLuau(source, "src/server/main.server.luau"), []);
});

test("roblox_check : parent en 2e argument, WaitForChild sans délai et connexion sans Disconnect", () => {
    const source = [
        "local Players = game:GetService(\"Players\")",
        "local model = Instance.new(\"Model\", workspace)",
        "local cible = workspace:WaitForChild(\"Cible\")",
        "local function demarrer()",
        "    Players.PlayerAdded:Connect(function(joueur)",
        "        print(joueur.Name)",
        "    end)",
        "end",
        "demarrer()"
    ].join("\n");
    const found = inspectLuau(source, "src/client/jeu.client.luau");
    const codes = found.map(item => item.code);
    assert.ok(codes.includes("instance-new-parent"), `instance-new-parent manquant : ${codes.join(",")}`);
    assert.ok(codes.includes("waitforchild-timeout"), `waitforchild-timeout manquant : ${codes.join(",")}`);
    assert.ok(codes.includes("connect-without-disconnect"), `connect-without-disconnect manquant : ${codes.join(",")}`);
});

test("roblox_check : PlayerRemoving sans PlayerAdded signalé sur un script serveur", () => {
    const source = [
        "local Players = game:GetService(\"Players\")",
        "Players.PlayerRemoving:Connect(function(joueur)",
        "    print(joueur.Name)",
        "end)"
    ].join("\n");
    const codes = inspectLuau(source, "src/server/session.server.luau").map(item => item.code);
    assert.ok(codes.includes("playeradded-missing"), `playeradded-missing manquant : ${codes.join(",")}`);
});

test("roblox_check : commentaires --[[ ]] et chaînes longues ignorés", () => {
    const source = [
        "--[[ while true do",
        "print(\"dans un commentaire\")",
        "]]",
        "local texte = [[",
        "while true do",
        "]]",
        "print(texte)"
    ].join("\n");
    assert.deepEqual(inspectLuau(source, "src/shared/util.luau"), []);
});

test("roblox_check : DataStore côté client refusé, affectation coupée signalée", () => {
    const source = [
        "local DataStoreService = game:GetService(\"DataStoreService\")",
        "local sauvegarde",
        "= DataStoreService:GetDataStore(\"Joueurs\")"
    ].join("\n");
    const codes = inspectLuau(source, "src/client/sauvegarde.client.luau").map(item => item.code);
    assert.ok(codes.includes("datastore-client"));
    assert.ok(codes.includes("split-assignment"));
});

test("roblox_check : sorties selene et luau-analyze converties en diagnostics", () => {
    const workspace = process.cwd();
    const selene = parseSelene(`${workspace}\\src\\server\\main.luau:4:5: warning[unused_variable]: a is defined, but never used`, workspace);
    assert.equal(selene.length, 1);
    assert.equal(selene[0].file, "src/server/main.luau");
    assert.equal(selene[0].line, 4);
    assert.equal(selene[0].code, "unused_variable");
    assert.equal(selene[0].source, "selene");

    const luau = parseLuauAnalyze(`${workspace}/src/shared/a.luau(2,7): TypeError: string is not compatible with number`, workspace);
    assert.equal(luau.length, 1);
    assert.equal(luau[0].file, "src/shared/a.luau");
    assert.equal(luau[0].severity, "error", "TypeError est bloquant en Luau");

    const global = parseLuauAnalyze(`${workspace}/src/shared/a.luau(9,1): UnknownGlobal: Unknown global 'foo'`, workspace);
    assert.equal(global[0].severity, "warning", "UnknownGlobal reste un avertissement");
});

test("roblox_check : projet Rojo détecté en priorité", () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-rojo-"));
    try {
        assert.equal(findRojoProject(dir), null);
        fs.writeFileSync(path.join(dir, "game.project.json"), "{}");
        assert.equal(findRojoProject(dir), "game.project.json");
        fs.writeFileSync(path.join(dir, "default.project.json"), "{}");
        assert.equal(findRojoProject(dir), "default.project.json");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("roblox_check : wait/spawn/delay/tick obsolètes, task.wait accepté", () => {
    const legacy = [
        "wait(1)",
        "spawn(function() end)",
        "delay(1, function() end)",
        "local temps = tick()"
    ].join("\n");
    const codes = inspectLuau(legacy, "src/shared/temps.luau").map(item => item.code);
    assert.equal(codes.filter(code => code === "deprecated-global").length, 4);

    const modern = [
        "local Players = game:GetService(\"Players\")",
        "task.wait(1)",
        "task.spawn(function() end)",
        "local temps = os.clock()"
    ].join("\n");
    assert.deepEqual(inspectLuau(modern, "src/shared/temps.luau"), []);
});

test("roblox_check : game.Workspace et RemoteEvent créé côté client signalés", () => {
    const source = [
        "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")",
        "local base = game.Workspace.Baseplate",
        "local event = Instance.new(\"RemoteEvent\")",
        "event.Parent = ReplicatedStorage"
    ].join("\n");
    const codes = inspectLuau(source, "src/client/jeu.client.luau").map(item => item.code);
    assert.ok(codes.includes("game-workspace"), codes.join(","));
    assert.ok(codes.includes("remote-client-creation"), codes.join(","));
});

test("roblox_check : OnServerEvent sans validation et DataStore non protégé", () => {
    const source = [
        "local DataStoreService = game:GetService(\"DataStoreService\")",
        "local store = DataStoreService:GetDataStore(\"Joueurs\")",
        "store:SetAsync(player.Name, 1)",
        "Remotes.BuyItem.OnServerEvent:Connect(function(player, item)",
        "    print(item)",
        "end)"
    ].join("\n");
    const codes = inspectLuau(source, "src/server/achat.server.luau").map(item => item.code);
    assert.ok(codes.includes("datastore-player-name-key"), codes.join(","));
    assert.ok(codes.includes("datastore-no-pcall"), codes.join(","));
    assert.ok(codes.includes("remote-client-validation"), codes.join(","));
});

test("roblox_check : une connexion au chargement du script n'est pas un fuite", () => {
    const topLevel = [
        "local Players = game:GetService(\"Players\")",
        "Players.PlayerAdded:Connect(function(player)",
        "    print(player.Name)",
        "end)"
    ].join("\n");
    assert.deepEqual(inspectLuau(topLevel, "src/server/joueurs.server.luau"), []);

    const repeated = [
        "local function installer(signal)",
        "    signal:Connect(function() print(\"x\") end)",
        "end",
        "installer(workspace.ChildAdded)"
    ].join("\n");
    assert.ok(inspectLuau(repeated, "src/server/installer.server.luau").some(item => item.code === "connect-without-disconnect"));
});
