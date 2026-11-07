"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { auth } = require("../src/api/auth");
const projects = require("../src/api/fr-projects");

const originalFetch = global.fetch;

test.after(() => {
    global.fetch = originalFetch;
});

function prepareAuth() {
    auth.accessToken = "test-token";
    auth.expiresAt = Date.now() + 300_000;
    auth.deviceId = "test-device";
}

test("listAvailableProjects combine projets personnels et partagés sans doublons", { concurrency: false }, async () => {
    prepareAuth();
    const calls = [];
    global.fetch = async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith("/projects/shared")) {
            return Response.json([{ id: "shared-1", name: "Partagé" }, { id: "owned-1", name: "Projet renommé" }]);
        }
        return Response.json([{ id: "owned-1", name: "Projet" }]);
    };

    const result = await projects.listAvailableProjects();

    assert.deepEqual(result, [
        { id: "owned-1", name: "Projet renommé" },
        { id: "shared-1", name: "Partagé" }
    ]);
    assert.match(calls[0].url, /\/projects$/);
    assert.match(calls[1].url, /\/projects\/shared$/);
    assert.match(calls[0].init.headers.Authorization, /^Bearer /);
});

test("listAvailableProjects tolère une route de projets partagés non disponible", { concurrency: false }, async () => {
    prepareAuth();
    global.fetch = async url => String(url).endsWith("/projects/shared")
        ? new Response("", { status: 404 })
        : Response.json([{ id: "owned-1", name: "Projet" }]);

    assert.deepEqual(await projects.listAvailableProjects(), [{ id: "owned-1", name: "Projet" }]);
});

test("listProjectChats encode le projet et applique une pagination bornée", { concurrency: false }, async () => {
    prepareAuth();
    let seen;
    global.fetch = async (url, init) => {
        seen = { url: String(url), init };
        return Response.json({ chats: [{ id: "chat-1", title: "Conversation" }], hasMore: true });
    };

    const result = await projects.listProjectChats("project / 1", { limit: 500, cursorChatId: "chat previous" });

    assert.match(seen.url, /\/projects\/project%20%2F%201\/chats\?/);
    assert.match(seen.url, /limit=100/);
    assert.match(seen.url, /cursor_chat_id=chat\+previous/);
    assert.match(seen.init.headers.Authorization, /^Bearer /);
    assert.deepEqual(result, { chats: [{ id: "chat-1", title: "Conversation" }], hasMore: true });
});
