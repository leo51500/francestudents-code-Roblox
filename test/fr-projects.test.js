"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const { chatTitleFrom } = require("../src/api/fr-projects");

test("le titre d'un chat vient de la demande de l'utilisateur, pas du tour d'agent", () => {
    assert.equal(
        chatTitleFrom("Crée un HUD de vie et de munitions pour le mode combat."),
        "Crée un HUD de vie et de munitions pour le mode combat."
    );
    // Une demande peut arriver au milieu d'un message complet : on garde la demande.
    assert.equal(
        chatTitleFrom("TOUR 3 — choisis la prochaine action.\nDEMANDE DE L'UTILISATEUR\nAjoute une boutique d'armes."),
        "Ajoute une boutique d'armes."
    );
});

test("un tour de suivi ne donne pas de titre : le fil lisait « Tour 28 sur 40 »", () => {
    assert.equal(chatTitleFrom("Tour 28/40. Termine avec final."), "");
    assert.equal(chatTitleFrom("CORRECTION : réponse précédente invalide"), "");
    assert.equal(chatTitleFrom("RÉSULTATS DES OUTILS (plus récents en dernier)"), "");
    assert.equal(chatTitleFrom(""), "");
});

test("le titre est court et garde la première phrase", () => {
    const long = "Ajoute un inventaire complet. Avec des icônes, des catégories et un tri par rareté pour chaque objet ramassé.";
    assert.equal(chatTitleFrom(long), "Ajoute un inventaire complet.");
    const title = chatTitleFrom("x".repeat(200));
    assert.ok(title.length <= 80, `titre trop long : ${title.length}`);
    assert.ok(title.endsWith("…"));
});

test("adoptChat ne va sur le réseau que pour un identifiant réel", async () => {
    const fr = require("../src/api/fr-projects");
    // Sans fil, rien n'est appelé : aucune rencontre avec ce module dans les autres tests.
    assert.deepEqual(await fr.adoptChat(null, "Crée un HUD"), { attached: false, named: false });
});


test("la liste des projets cible l'API v3 et accepte ses formes de réponse", { concurrency: false }, async () => {
    const { auth } = require("../src/api/auth");
    const frProjects = require("../src/api/fr-projects");
    const originalFetch = global.fetch;
    const previousAuth = { accessToken: auth.accessToken, expiresAt: auth.expiresAt, deviceId: auth.deviceId };
    auth.accessToken = "projects-test-token";
    auth.expiresAt = Date.now() + 300_000;
    auth.deviceId = "projects-test-device";
    try {
        const requests = [];
        global.fetch = async (url, options) => {
            requests.push({ url: String(url), options });
            const projects = String(url).endsWith("/projects/shared")
                ? [{ id: "project-2", name: "Projet partagé" }]
                : [{ id: "project-1", name: "Mon projet" }, { id: "project-2", name: "Doublon partagé" }];
            return new Response(JSON.stringify(projects), { status: 200 });
        };
        assert.deepEqual(await frProjects.listProjects(), {
            projects: [
                { id: "project-1", name: "Mon projet" },
                { id: "project-2", name: "Projet partagé" }
            ],
            sharedUnavailable: false
        });
        assert.deepEqual(requests.map(request => request.url).sort(), [
            "https://api.francestudent.ai/projects",
            "https://api.francestudent.ai/projects/shared"
        ]);
        assert.equal(requests.length, 2);
        assert.ok(requests.every(request => request.options.headers.Authorization === "Bearer projects-test-token"));
        assert.equal(requests[0].options.headers["francestudent-client-platform"], "web_fs_ai");

        global.fetch = async url => new Response(JSON.stringify(String(url).endsWith("/shared") ? [] : [{ id: "project-3", name: "Projet direct" }]), { status: 200 });
        assert.deepEqual(await frProjects.listProjects(), { projects: [{ id: "project-3", name: "Projet direct" }], sharedUnavailable: false });
    } finally {
        Object.assign(auth, previousAuth);
        global.fetch = originalFetch;
    }
});

test("la liste des projets conserve le vrai statut et explique une réponse non JSON", { concurrency: false }, async () => {
    const { auth } = require("../src/api/auth");
    const frProjects = require("../src/api/fr-projects");
    const originalFetch = global.fetch;
    const previousAuth = { accessToken: auth.accessToken, expiresAt: auth.expiresAt };
    auth.accessToken = "projects-test-token";
    auth.expiresAt = Date.now() + 300_000;
    const originalDeviceId = auth.deviceId;
    auth.deviceId = "projects-test-device";
    try {
        global.fetch = async url => new Response(String(url).endsWith("/shared") ? "route not found" : "<html>error</html>", { status: String(url).endsWith("/shared") ? 404 : 200 });
        await assert.rejects(frProjects.listProjects(), /Réponse non JSON.*GET \/projects/);

        global.fetch = async url => new Response(String(url).endsWith("/shared") ? "route not found" : JSON.stringify([{ id: "project-4", name: "Projet détenu" }]), { status: String(url).endsWith("/shared") ? 404 : 200 });
        assert.deepEqual(await frProjects.listProjects(), { projects: [{ id: "project-4", name: "Projet détenu" }], sharedUnavailable: true });
    } finally {
        Object.assign(auth, previousAuth);
        auth.deviceId = originalDeviceId;
        global.fetch = originalFetch;
    }
});


test("refresh des projets interprète les erreurs HTTP comme un diagnostic actionnable", () => {
    const projectStatus = (message) => {
        const detail = String(message || "");
        const code = /^HTTP (\d{3})\b/i.exec(detail)?.[1];
        if (/Aucune session|Connexion impossible|HTTP 401|HTTP 403/i.test(detail)) return "session";
        if (code === "404") return "not-found";
        if (code === "400" || code === "422") return "request-rejected";
        if (code) return "service-error";
        return "network-error";
    };
    assert.equal(projectStatus("HTTP 404 sur GET /projects"), "not-found");
    assert.equal(projectStatus("HTTP 401 sur GET /projects"), "session");
    assert.equal(projectStatus("HTTP 403 sur GET /projects"), "session");
    assert.equal(projectStatus("HTTP 500 sur GET /projects"), "service-error");
    assert.equal(projectStatus("fetch failed"), "network-error");
});
