"use strict";

/**
 * Tests e2e de l'application de bureau (Electron piloté par playwright-core).
 * Lancement : npm run test:e2e (hors npm test, car il faut un affichage).
 * Le registre des projets est isolé dans un dossier temporaire (FS_STATE_DIR).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

let electronApi = null;
let electronPath = null;
try {
    electronApi = require("playwright-core")._electron;
    electronPath = require("electron");
} catch {
    // dépendances absentes : les tests sont ignorés
}

const skip = !electronApi || typeof electronPath !== "string" ? "playwright-core ou electron indisponible" : false;

async function launch() {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "fscli-e2e-state-"));
    const env={...process.env,FS_STATE_DIR:stateDir,FS_DATA_DIR:stateDir,ELECTRON_DISABLE_SECURITY_WARNINGS:"1"};
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electronApi.launch({
        executablePath: electronPath,
        args: [path.join(ROOT, "desktop", "main.js"),"--user-data-dir="+path.join(stateDir,"electron")],
        cwd: ROOT,
        env,
        timeout: 60000
    });
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#startup-loading").waitFor({state:"hidden",timeout:12000});
    await page.locator("#guide-close").waitFor({ state: "visible", timeout: 2000 }).then(() => page.locator("#guide-close").click()).catch(() => {});
    return { app, page };
}

test("e2e : la fenêtre s'ouvre avec la zone de saisie, le transcript et la barre d'état", { skip, timeout: 120000 }, async () => {
    const { app, page } = await launch();
    try {
        const errors = [];
        page.on("pageerror", (err) => errors.push(err.message));
        await page.waitForSelector("#input", { timeout: 30000 });
        assert.equal(await page.locator("#transcript").count(), 1);
        assert.ok(await page.isVisible("#agent-starter"));
        assert.ok(await page.isVisible("#statusbar"));
        assert.equal(await page.evaluate(() => typeof window.frst?.submit), "function");
        await page.waitForTimeout(500);
        assert.deepEqual(errors, []);
    } finally {
        await app.close();
    }
});

test("e2e : la saisie de / affiche les commandes slash", { skip, timeout: 120000 }, async () => {
    const { app, page } = await launch();
    try {
        await page.waitForSelector("#input", { timeout: 30000 });
        await page.fill("#input", "/");
        await page.dispatchEvent("#input", "input");
        await page.waitForTimeout(300);
        const text = await page.evaluate(() => document.body.innerText);
        assert.match(text, /\/help/);
    } finally {
        await app.close();
    }
});

test("e2e : le panneau Git est retiré et le connecteur GitHub reste accessible", { skip, timeout: 120000 }, async () => {
    const { app, page } = await launch();
    try {
        const errors = [];
        page.on("pageerror", (err) => errors.push(err.message));
        await page.waitForSelector("#input", { timeout: 30000 });
        // Plus d'onglet ni de raccourci Git, et la vue est masquée en permanence.
        assert.equal(await page.locator('[data-view="git"]').count(), 0);
        await page.keyboard.press("Control+Shift+G");
        await page.waitForTimeout(200);
        assert.ok(await page.evaluate(() => !document.getElementById("app").classList.contains("view-git")));
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById("git-view")).display === "none"));
        // Le connecteur GitHub (compte, remote, releases) est le point d'entrée restant.
        // Le connecteur s'ouvre par la palette ; l'identifiant du bouton reste inchangé.
        await page.evaluate(() => document.getElementById("gh-connector-open").click());
        await page.waitForSelector("#github-connector-dialog[open]", { timeout: 10000 });
        await page.waitForSelector("#github-connector-token", { state: "visible", timeout: 10000 });
        assert.deepEqual(errors, []);
    } finally {
        await app.close();
    }
});

test("e2e : vrai terminal - xterm.js chargé et le PTY exécute une commande", { skip, timeout: 120000 }, async () => {
    const { app, page } = await launch();
    try {
        const errors = [];
        page.on("pageerror", (err) => errors.push(err.message));
        await page.waitForSelector("#input", { timeout: 30000 });
        assert.equal(await page.evaluate(() => typeof window.Terminal), "function");
        assert.equal(await page.evaluate(() => typeof window.FitAddon?.FitAddon), "function");
        assert.equal(await page.evaluate(() => window.frst.ptyAvailable()), true, "node-pty doit se charger dans Electron (npm run rebuild:native)");

        const output = await page.evaluate(async (root) => {
            await window.frst.openProject(root);
            let text = "";
            let ptyId = null;
            const off = window.frst.onEvent((channel, data) => {
                if (channel === "ptyData" && data && data.id === ptyId) text += data.data;
            });
            try {
                const res = await window.frst.ptyCreate(".", 100, 30);
                ptyId = res.id;
                await window.frst.ptyWrite(ptyId, "echo FRST_$((40+2))_PTY\r");
                const start = Date.now();
                while (!text.includes("FRST_42_PTY") && Date.now() - start < 15000) {
                    await new Promise((r) => setTimeout(r, 100));
                }
                await window.frst.ptyKill(ptyId);
                return text;
            } finally {
                off();
            }
        }, ROOT);
        // « FRST_42_PTY » n'apparaît que si le shell a réellement évalué $((40+2)).
        assert.match(output, /FRST_42_PTY/);

        await page.click("#tab-terminal");
        await page.waitForSelector("#terminal .xterm", { timeout: 10000 });
        assert.deepEqual(errors, []);
    } finally {
        await app.close();
    }
});
