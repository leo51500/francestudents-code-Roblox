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
