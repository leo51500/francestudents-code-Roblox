"use strict";
/* Diagnostic temporaire : quelles règles placent #agent sous la barre de titre ? */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");
const root = __dirname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-diag6-"));
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
        console.log(JSON.stringify(await page.evaluate(() => {
            const agents = [...document.querySelectorAll("#agent")];
            const rules = [];
            for (const sheet of document.styleSheets) {
                const walk = ruleset => {
                    for (const rule of ruleset.cssRules || []) {
                        if (rule.cssRules && rule.conditionText && !rule.selectorText) { if (matchMedia(rule.conditionText).matches) walk(rule); continue; }
                        if (!rule.selectorText) continue;
                        if (/grid-row|grid-template|#agent/.test(rule.style.cssText)) {
                            for (const sel of rule.selectorText.split(",")) { try { if (document.getElementById("agent").matches(sel.trim()) && /grid-row|grid-template/.test(rule.style.cssText)) { rules.push(sel.trim() + " => " + rule.style.cssText.slice(0, 160)); break; } } catch { } }
                        }
                    }
                };
                walk(sheet);
            }
            const tb = document.getElementById("titlebar");
            const tbRules = [];
            for (const sheet of document.styleSheets) for (const rule of sheet.cssRules) {
                if (rule.selectorText && /#titlebar/.test(rule.selectorText)) { try { if (tb.matches(rule.selectorText)) tbRules.push(rule.selectorText + " => " + rule.style.cssText.slice(0, 160)); } catch { } }
            }
            return { agents: agents.map(a => ({ id: a.id, cls: a.className, row: getComputedStyle(a).gridRow, rect: a.getBoundingClientRect().toJSON(), parent: a.parentElement.id })), rules, tbRules, tbRect: tb.getBoundingClientRect().toJSON(), titlebarVarComputed: getComputedStyle(document.documentElement).getPropertyValue("--titlebar") };
        }), null, 1));
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})();
