"use strict";
/* Diagnostic temporaire : capture le compositeur et l'en-tête du chat. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");
const root = __dirname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-diag11-"));
const project = path.join(dir, "project"); fs.mkdirSync(project);
const modulePath = name => JSON.stringify(path.join(root, name)), harness = path.join(dir, "launch.cjs");
fs.writeFileSync(harness, `
require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});
require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1003,name:'GPT-6.1 Sol',model:'gpt-6.1-sol'}],source:'api'});
require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});
require(${modulePath("src/api/fr-projects")}).listProjects=async()=>({projects:[{id:'p1',name:'Jeu Roblox'},{id:'p2',name:'Blender perso'}],sharedUnavailable:false});
require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("./package.json").version)},automaticUpdates:false});
require(${modulePath("desktop/main.js")});`);
const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, FS_SKILLS_DIR: path.join(dir, "skills") }; delete env.ELECTRON_RUN_AS_NODE;
(async () => {
    const app = await _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "electron")], env, cwd: root });
    try {
        const page = await app.firstWindow();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        if (await page.locator("#guide-close").isVisible()) await page.locator("#guide-close").click();
        await page.evaluate(p => window.frst.openProject(p), project);
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(400);
        console.log(JSON.stringify(await page.evaluate(() => {
            const nav = document.querySelector(".agent-navigation").getBoundingClientRect();
            const fp = document.getElementById("agent-fr-project").getBoundingClientRect();
            const tabs = document.querySelector(".agent-tabs").getBoundingClientRect();
            return {
                nav: nav.toJSON(), fp: fp.toJSON(), tabs: tabs.toJSON(),
                fpOrder: getComputedStyle(document.getElementById("agent-fr-project")).order,
                fpBasis: getComputedStyle(document.getElementById("agent-fr-project")).flexBasis,
                navWrap: getComputedStyle(document.querySelector(".agent-navigation")).flexWrap
            };
        })));
        await page.locator("#agent").screenshot({ path: path.join(root, "panel.png") });
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})();
