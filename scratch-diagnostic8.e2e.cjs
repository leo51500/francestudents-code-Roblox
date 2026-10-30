"use strict";
/* Diagnostic temporaire : barre du chat en pleine largeur, onglets cliquables ? */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");
const root = __dirname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-diag8-"));
const project = path.join(dir, "project"); fs.mkdirSync(project);
const modulePath = name => JSON.stringify(path.join(root, name)), harness = path.join(dir, "launch.cjs");
fs.writeFileSync(harness, `
require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});
require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1003,name:'GPT-6.1 Sol',model:'gpt-6.1-sol'}],source:'api'});
require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});
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
        for (const [w, h] of [[1400, 900], [1000, 700]]) {
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(250);
            const info = await page.evaluate(() => {
                const nav = document.querySelector(".agent-navigation").getBoundingClientRect();
                const head = document.querySelector(".agent-header").getBoundingClientRect();
                const fp = document.getElementById("agent-fr-project").getBoundingClientRect();
                const tab = document.querySelector('[data-agent-tab="conversation"]').getBoundingClientRect();
                return {
                    viewport: [innerWidth, innerHeight], head: { y: head.y, h: head.height }, nav: { y: nav.y, h: nav.height }, fr: { y: fp.y, h: fp.height }, tab: { y: tab.y, h: tab.height },
                    stack: document.elementsFromPoint(tab.x + tab.width / 2, tab.y + tab.height / 2).slice(0, 2).map(e => e.tagName + "." + e.className)
                };
            });
            console.log("info", JSON.stringify(info));
            await page.locator('[data-agent-tab="conversation"]').click({ timeout: 5000 }).then(() => console.log("click-ok")).catch(e => console.log("click-fail", String(e).split("\n")[0]));
            await page.screenshot({ path: path.join(root, `diag-chat-${w}.png`) });
        }
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})();
