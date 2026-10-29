"use strict";
/* global setRobloxExplorer, selectPanel */
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { _electron } = require("playwright-core"), electron = require("electron"), root = path.resolve(__dirname, "..");

function makeProject(dir) {
    const project = path.join(dir, "project");
    fs.mkdirSync(path.join(project, "src", "server"), { recursive: true });
    fs.mkdirSync(path.join(project, "src", "client"), { recursive: true });
    fs.mkdirSync(path.join(project, "src", "shared"), { recursive: true });
    fs.mkdirSync(path.join(project, "Packages", "Promise@4.0.0"), { recursive: true });
    fs.writeFileSync(path.join(project, "default.project.json"), JSON.stringify({
        name: "MonJeu",
        tree: {
            $className: "DataModel",
            ReplicatedStorage: { $path: "src/shared" },
            ServerScriptService: { $path: "src/server" },
            StarterPlayer: { StarterPlayerScripts: { $path: "src/client" } }
        }
    }, null, 2));
    fs.writeFileSync(path.join(project, "src", "server", "Porte.server.luau"), "print('porte')\n");
    fs.writeFileSync(path.join(project, "src", "client", "HUD.client.luau"), "print('hud')\n");
    fs.writeFileSync(path.join(project, "src", "shared", "Porte.luau"), "return {}\n");
    fs.writeFileSync(path.join(project, "wally.toml"), '[package]\nname="a/b"\nversion="0.1.0"\n\n[dependencies]\nPromise = "evaera/promise@4.0.0"\n');
    fs.writeFileSync(path.join(project, "Packages", "Promise@4.0.0", "package.json"), JSON.stringify({ version: "4.0.0" }));
    return project;
}

test("e2e : arbre Roblox Studio, paquets Wally et tableau de bord Rojo", { timeout: 90000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-roblox-e2e-"));
    const project = makeProject(dir);
    const harness = path.join(dir, "launch.cjs");
    fs.writeFileSync(harness, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(dir, "electron"))});const session=require(${JSON.stringify(path.join(root, "src/core/session"))});session.bootstrap=async()=>({ok:true});require(${JSON.stringify(path.join(root, "src/api/agents"))}).listAgents=async()=>({agents:[{id:-1002,name:'GPT 6 Luna'}],source:'local'});require(${JSON.stringify(path.join(root, "desktop/main.js"))});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" };
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({ executablePath: electron, args: [harness], env, cwd: root, timeout: 30000 });
    try {
        const page = await app.firstWindow(), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.waitForFunction(async () => (await window.frst.status()).booted);
        await page.evaluate(project => window.frst.openProject(project), project);

        // Les skills Roblox sont préchargés dès l'ouverture d'un projet Rojo.
        await page.waitForFunction(async () => Boolean((await window.frst.status()).workspace));
        const skills = await page.evaluate(async () => (await window.frst.skillsList()).skills.map(s => `${s.scope}:${s.name}`));
        assert.ok(skills.includes("projet:roblox-luau"), `skills : ${skills.join(", ")}`);

        // Arbre de scène : services, puis scripts, ouverts au clic.
        await page.evaluate(() => setRobloxExplorer(true));
        await page.waitForFunction(() => document.querySelectorAll("#roblox-tree .roblox-node").length > 0);
        const tree = await page.locator("#roblox-tree").innerText();
        assert.match(tree, /ServerScriptService/);
        assert.match(tree, /ReplicatedStorage/);
        assert.match(tree, /StarterPlayer/);
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("tree")).display), "none");

        await page.locator("#roblox-tree .roblox-node", { hasText: "ServerScriptService" }).first().click();
        await page.waitForFunction(() => document.querySelector("#roblox-tree").innerText.includes("Porte"));
        await page.locator("#roblox-tree .roblox-node", { hasText: "Porte" }).first().click();
        await page.waitForFunction(() => document.getElementById("st-file").textContent === "src/server/Porte.server.luau", null, { timeout: 15000 });

        // Wally : paquets indexés dans la barre latérale.
        await page.waitForFunction(() => !document.getElementById("roblox-packages").classList.contains("hidden"));
        assert.match(await page.locator("#roblox-packages").innerText(), /Promise@4\.0\.0/);

        // Indicateur de barre d'état : le vrai état vient du serveur Rojo géré par l'IDE.
        const started = await page.evaluate(() => window.frst.robloxDashboard("start")).catch(() => null);
        if (started && started.running) {
            // Studio n'est pas lancé ici : pastille orange « en attente », puis arrêt explicite.
            await page.waitForFunction(() => document.getElementById("st-rojo").textContent.includes("en attente"), null, { timeout: 15000 });
            assert.ok(await page.evaluate(() => document.getElementById("st-rojo").classList.contains("st-rojo-waiting")));
            await page.evaluate(() => window.frst.robloxDashboard("stop"));
            await page.waitForFunction(() => document.getElementById("st-rojo").textContent === "Rojo arrêté", null, { timeout: 15000 });
            assert.ok(await page.evaluate(() => document.getElementById("st-rojo").classList.contains("st-rojo-offline")));
        }

        // Panneau Rojo : actions réelles (aucune commune rojo attendue : message explicite, sans plantage).
        await page.evaluate(() => selectPanel("rojo"));
        await page.waitForFunction(() => document.querySelectorAll("#rojo [data-rojo-action]").length === 3);
        const panel = await page.locator("#rojo").innerText();
        assert.match(panel, /Recompiler/);
        assert.match(panel, /Relancer la sourcemap/);
        await page.locator('[data-rojo-action="build"]').click();
        await page.waitForFunction(() => !document.querySelector('[data-rojo-action="build"]').disabled, null, { timeout: 30000 });
        const status = await page.evaluate(() => window.frst.robloxDashboard("status"));
        assert.equal(status.build.project, "default.project.json");

        if (process.env.FRST_QA_SCREENSHOT) await page.screenshot({ path: process.env.FRST_QA_SCREENSHOT });
        assert.deepEqual(errors, []);
    } finally {
        await app.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
