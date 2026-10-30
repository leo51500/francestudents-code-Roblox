"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");

// La disposition réglée à la poignée est visible pendant le geste (bulle de taille) et
// retrouvée au redémarrage. Test de régression du correctif 1.5.27.
test("les colonnes se redimensionnent avec une bulle de taille et restent en place au redémarrage", { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-layout-")), project = path.join(dir, "project");
    fs.mkdirSync(project);
    const modulePath = name => JSON.stringify(path.join(root, name)), harness = path.join(dir, "launch.cjs");
    fs.writeFileSync(harness, `require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});require(${modulePath("desktop/main.js")});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, FS_SKILLS_DIR: path.join(dir, "skills") };
    delete env.ELECTRON_RUN_AS_NODE;
    const userData = path.join(dir, "electron");
    const launch = () => _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + userData], env, cwd: root });

    const start = async () => {
        const app = await launch();
        const page = await app.firstWindow();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        if (await page.locator("#guide-close").isVisible()) await page.locator("#guide-close").click();
        await page.evaluate(project => window.frst.openProject(project), project);
        await page.setViewportSize({ width: 1400, height: 900 });
        return { app, page };
    };

    let app = null;
    try {
        let page;
        ({ app, page } = await start());
        const handled = page.locator("#resizer-right");
        // Sur une fenêtre étroite l'agent reste affiché mais la colonne peut être masquée :
        // on vérifie d'abord que la poignée est réellement visible et cliquable.
        await handled.waitFor({ state: "visible", timeout: 10000 });
        // La zone de saisie élargie (±5 px) doit répondre partout sur la hauteur du trait,
        // y compris là où un bouton de l'en-tête du chat passe dessous.
        const hit = await page.evaluate(() => {
            const el = document.querySelector("#resizer-right");
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const x = r.x + r.width / 2;
            for (let y = Math.round(r.top) + 20; y < r.bottom - 10; y += 12) {
                const target = document.elementFromPoint(x, y);
                // Le point retenu est le premier que le curseur atteint réellement.
                if (target && target.id === "resizer-right") return { x, y, clean: true };
            }
            return { x, y: r.y + r.height / 2 };
        });
        assert.ok(hit, "la poignée du chat doit être présente");
        assert.equal(hit.clean, true, "la poignée doit être atteignable sur toute sa hauteur");
        const before = hit.x;
        assert.ok(before > 0, `poignée introuvable (x=${before})`);
        const startWidth = await page.locator("#agent").evaluate(el => Math.round(el.getBoundingClientRect().width));
        await page.mouse.move(before, hit.y);
        await page.mouse.down();
        await page.mouse.move(before - 220, hit.y, { steps: 12 });
        await page.waitForTimeout(120);
        // Pendant le geste : la poignée est tenue, le curseur change, la bulle affiche la taille.
        const dragging = await page.evaluate(() => ({
            dragging: document.documentElement.classList.contains("layout-dragging"),
            cursor: getComputedStyle(document.body).cursor,
            badge: document.querySelector("#layout-badge")?.textContent || ""
        }));
        await page.mouse.up();
        assert.equal(dragging.dragging, true, "le glisser doit être reconnu (poignée saisie)");
        assert.match(dragging.cursor, /col-resize/, "le curseur doit indiquer le redimensionnement");
        // La bulle affiche la largeur visée, pas la position du curseur.
        assert.match(dragging.badge, /Chat · \d+ px/, "la bulle doit afficher la largeur en direct");

        const width = await page.locator("#agent").evaluate(el => Math.round(el.getBoundingClientRect().width));
        // Le chat s'élargit au-delà de sa largeur de départ, de la distance parcourue.
        assert.ok(width >= startWidth + 190, `la colonne du chat doit s'être élargie (${startWidth} → ${width} px), badge: ${dragging.badge}, x: ${before}`);
        await app.close();

        ({ app, page } = await start());
        const restored = await page.locator("#agent").evaluate(el => Math.round(el.getBoundingClientRect().width));
        assert.ok(Math.abs(restored - width) <= 2, `largeur retrouvée : ${restored} px au lieu de ${width} px`);
        await app.close();
    } finally {
        if (app) await app.close().catch(() => {});
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
