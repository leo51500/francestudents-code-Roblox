"use strict";
/* Diagnostic temporaire : #btn-send et la zone du chat. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");
const root = __dirname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-diag10-"));
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
        await page.evaluate(p => window.frst.openProject(p), project);
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(400);
        console.log(JSON.stringify(await page.evaluate(() => {
            const btn = document.getElementById("btn-send"), r = btn.getBoundingClientRect(), cs = getComputedStyle(btn);
            const rules = [];
            for (const sheet of document.styleSheets) for (const rule of sheet.cssRules) {
                if (rule.selectorText && /#btn-send/.test(rule.selectorText)) { try { if (btn.matches(rule.selectorText)) rules.push(rule.selectorText + " => " + rule.style.cssText.slice(0, 200)); } catch { } }
            }
            const agent = document.getElementById("agent").getBoundingClientRect();
            return {
                btn: { text: btn.textContent.trim(), rect: r.toJSON(), color: cs.color, bg: cs.backgroundColor, font: cs.fontSize, w: cs.width },
                rules,
                agent: { w: agent.width, x: agent.x },
                classes: btn.className
            };
        }), null, 1));
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})();
