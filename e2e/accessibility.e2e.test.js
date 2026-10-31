"use strict";

/**
 * Contrôle d'accessibilité automatisé sur la fenêtre principale (axe-core).
 *
 * Lancement : npm run test:e2e (ou node --test e2e/accessibility.e2e.test.js).
 * Le seuil est volontairement limité aux violations critiques, et aux
 * violations sérieuses hors contraste : le thème sombre a ses propres valeurs
 * vérifiées visuellement, et un audit strict du contraste rendrait la suite
 * fragile au moindre ajustement de palette.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

let electronApi = null;
let electronPath = null;
let axePath = null;
try {
    electronApi = require("playwright-core")._electron;
    electronPath = require("electron");
    // axe.min.js plutôt que le point d’entrée UMD : la CSP de la page
    // (`script-src 'self'`) bloque les scripts injectés comme texte.
    axePath = path.join(path.dirname(require.resolve("axe-core")), "axe.min.js");
} catch {
    // dépendances absentes : le test est ignoré
}

const skip = !electronApi || typeof electronPath !== "string" || !axePath ? "playwright-core, electron ou axe-core indisponible" : false;

async function launch() {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-a11y-state-"));
    // axe est servi depuis la même origine que l’interface : la CSP
    // (`script-src 'self'`) n’a pas besoin de s’assouplir pour être auditée.
    const axeTarget = path.join(ROOT, "desktop", "renderer", "vendor", "axe.min.js");
    fs.mkdirSync(path.dirname(axeTarget), { recursive: true });
    fs.copyFileSync(axePath, axeTarget);
    const env = { ...process.env, FS_STATE_DIR: stateDir, FS_DATA_DIR: stateDir, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" };
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electronApi.launch({
        executablePath: electronPath,
        args: [path.join(ROOT, "desktop", "main.js"), "--user-data-dir=" + path.join(stateDir, "electron")],
        cwd: ROOT,
        env,
        timeout: 60000
    });
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#startup-loading").waitFor({ state: "hidden", timeout: 20000 });
    await page.locator("#guide-close").waitFor({ state: "visible", timeout: 2000 }).then(() => page.locator("#guide-close").click()).catch(() => {});
    return { app, page };
}

function summarize(violations) {
    return violations.map((violation) => `${violation.id} (${violation.impact}) : ${violation.help} — ${violation.nodes.length} élément(s)`).join("\n");
}

test("e2e : la fenêtre principale ne contient aucune violation critique", { skip, timeout: 120000 }, async () => {
    const { app, page } = await launch();
    try {
        await page.waitForSelector("#input", { timeout: 30000 });
        await page.addScriptTag({ url: "./vendor/axe.min.js" });
        const results = await page.evaluate(async () =>
            window.axe.run(document, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
            })
        );
        const critical = results.violations.filter((violation) => violation.impact === "critical");
        const serious = results.violations.filter((violation) => violation.impact === "serious" && violation.id !== "color-contrast");
        assert.deepEqual(critical, [], `Violations critiques :\n${summarize(critical)}`);
        assert.deepEqual(serious, [], `Violations sérieuses :\n${summarize(serious)}`);
    } finally {
        await app.close();
    }
});
