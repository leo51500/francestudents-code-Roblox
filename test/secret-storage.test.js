"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const secrets = require("../src/secret-storage");
const { CONFIG } = require("../src/config");

function fakeDpapi() {
    const key = crypto.randomBytes(32);
    return (value, decrypt) => {
        if (decrypt) {
            const bytes = Buffer.from(value, "base64");
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
            decipher.setAuthTag(bytes.subarray(-16));
            return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString("utf8");
        }
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
    };
}

test("Windows secret storage keeps protected values opaque and rejects corrupt ciphertext", () => {
    const dpapi = fakeDpapi();
    const store = secrets.createSecretStorage({ dpapi });
    const encrypted = store.protect("IDENTIFIANT_DEMO_été");
    assert.equal(encrypted.backend, "windows-dpapi");
    assert.doesNotMatch(JSON.stringify(encrypted), /IDENTIFIANT/);
    assert.equal(store.unprotect(encrypted), "IDENTIFIANT_DEMO_été");
    assert.equal(secrets.createSecretStorage({ dpapi }).unprotect(encrypted), "IDENTIFIANT_DEMO_été");
    assert.equal(store.unprotect({ ...encrypted, data: "invalid" }), null);
    assert.throws(() => secrets.createSecretStorage({ dpapi: () => { throw Error("SECRET_DETAIL"); } }).protect("SECRET_DETAIL"),
        error => !error.message.includes("SECRET_DETAIL"));
});

test("FranceStudent legacy migration keeps cookies, device, preferences and histories", async () => {
    secrets.configure({ dpapi: fakeDpapi() });
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    const cookie = "DEMO_SESSION_NOT_A_REAL_CREDENTIAL", file = path.join(CONFIG.dataDir, "session.json");
    const preserved = { "settings.json": '{"automaticUpdates":false}', "history.json": '[{"title":"Projet existant"}]', "projects.json": '["aurora"]' };
    for (const [name, data] of Object.entries(preserved)) fs.writeFileSync(path.join(CONFIG.dataDir, name), data);
    fs.writeFileSync(file, JSON.stringify({ deviceId: "existing-device", signedOut: false, cookies: { "next-auth.session-token": cookie } }));
    delete require.cache[require.resolve("../src/api/auth")];
    const auth = require("../src/api/auth");
    await auth.loadSession();
    assert.equal(auth.auth.jar.get(auth.SESSION_COOKIE), cookie);
    assert.equal(auth.auth.deviceId, "existing-device");
    assert.ok(!fs.readFileSync(file, "utf8").includes(cookie));
    assert.ok(JSON.parse(fs.readFileSync(file)).protectedCookies);
    delete require.cache[require.resolve("../src/api/auth")];
    const restarted = require("../src/api/auth");
    await restarted.loadSession();
    assert.equal(restarted.auth.jar.get(restarted.SESSION_COOKIE), cookie);
    assert.equal(restarted.auth.deviceId, "existing-device");
    for (const [name, data] of Object.entries(preserved)) assert.equal(fs.readFileSync(path.join(CONFIG.dataDir, name), "utf8"), data);
});

test("Unavailable DPAPI keeps the current login in memory and strips legacy plaintext", async () => {
    const unavailable = () => { throw new Error("VAULT_LOCKED_DETAIL"); };
    secrets.configure({ dpapi: unavailable });
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    const file = path.join(CONFIG.dataDir, "session.json"), cookie = "DEMO_LOCKED_VAULT_COOKIE";
    fs.writeFileSync(file, JSON.stringify({ deviceId: "same-device", cookies: { "next-auth.session-token": cookie } }));
    delete require.cache[require.resolve("../src/api/auth")];
    const auth = require("../src/api/auth");
    await auth.loadSession();
    assert.equal(auth.auth.jar.get(auth.SESSION_COOKIE), cookie);
    assert.equal(auth.auth.sessionOnly, true);
    assert.ok(!fs.readFileSync(file, "utf8").includes(cookie));
});

test("Windows DPAPI round trip works with Unicode and after a cold start", () => {
    const first = secrets.createSecretStorage(), value = "SESSION_DEMO_été_你好", encrypted = first.protect(value);
    assert.equal(encrypted.backend, "windows-dpapi");
    assert.ok(!encrypted.data.includes(value));
    assert.equal(secrets.createSecretStorage().unprotect(encrypted), value);
});
