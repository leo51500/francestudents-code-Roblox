"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Avant tout require du projet : la config lit l'environnement au chargement.
process.env.FS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fscli-locked-"));

const { state, resetConversation } = require("../src/state");
const api = require("../src/api/api");
const { runAgent } = require("../src/agent/agent");
const { TOOLS } = require("../src/tools/tools");
const memory = require("../src/project/memory");

/**
 * Un fichier gardé par un autre programme (Studio, OneDrive…) fait échouer write_file
 * avec EBUSY/EPERM. Le test vérifie le comportement RÉEL de la boucle : l'agent ne
 * rejoue pas la même écriture indéfiniment, il reçoit une consigne de sortie et termine.
 */
test("runAgent : un fichier verrouillé ne boucle pas, il reçoit une consigne de sortie", { concurrency: false }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fscli-proj-locked-"));
    const target = path.join(dir, "Place.rbxl");
    fs.writeFileSync(target, "ancienne place\n");

    resetConversation();
    state.workspace = dir;
    state.autoApprove = true;

    // Refus système simulé au niveau de l'outil : mémoire et UI réelles, seule l'écriture
    // échoue. La mémoire avance comme après une écriture, sinon l'observation suivante
    // utilise un cache différent et l'écriture est reprise.
    const originalRun = TOOLS.write_file.run;
    const originalChanges = memory.sessionChanges;
    const changesBefore = memory.sessionChanges();
    let attempts = 0;
    memory.sessionChanges = () => changesBefore + (attempts ? 1 : 0);
    TOOLS.write_file.run = async () => {
        attempts += 1;
        const error = new Error("EBUSY: resource busy or locked, open 'Place.rbxl'");
        error.code = "EBUSY";
        throw error;
    };

    const write = JSON.stringify({
        type: "tool",
        name: "write_file",
        args: { path: "Place.rbxl", content: "nouvelle place\n" },
        reason: "Enregistrer la place"
    });
    const answers = [write, write, '{"type":"final","message":"Fichier verrouillé : enregistre sous Place_nouveau.rbxl ou ferme Studio."}'];
    const sent = [];

    const originalRequest = api.requestModel;
    api.requestModel = async (message) => {
        sent.push(message);
        state.chatIds.agent = "agent-locked";
        state.chatId = "agent-locked";
        api.usage.requests++;
        api.usage.chars += message.length;
        return answers.shift();
    };

    const log = console.log;
    console.log = () => { };

    let result;
    let onDisk;
    try {
        result = await runAgent("Enregistre la place Roblox");
        // Lu avant le nettoyage : sinon le dossier temporaire n'existe plus.
        onDisk = fs.readFileSync(target, "utf8");
    } finally {
        console.log = log;
        api.requestModel = originalRequest;
        TOOLS.write_file.run = originalRun;
        memory.sessionChanges = originalChanges;
        state.workspace = null;
        fs.rmSync(dir, { recursive: true, force: true });
    }

    // Une seule tentative réelle : l'écriture verrouillée n'est jamais rejouée à l'identique.
    assert.equal(attempts, 1, `écritures réellement tentées : ${attempts}`);
    assert.equal(result.completed, true);
    assert.match(result.message, /verrouillé|Place_nouveau/);

    // Le contenu d'origine est intact : aucun échec silencieux n'a tronqué le fichier.
    assert.equal(onDisk, "ancienne place\n");

    // La consigne de sortie a bien été transmise à l'agent après le premier échec.
    const steering = sent.slice(1).join("\n");
    assert.match(steering, /FICHIER VERROUILLÉ/);
    assert.match(steering, /Ne rejoue pas la même écriture/);
    assert.match(steering, /Place_nouveau/);

    // Et l'agent a terminé de lui-même, sans message d'abandon de boucle.
    assert.doesNotMatch(result.message, /Je tourne en rond/);
});
