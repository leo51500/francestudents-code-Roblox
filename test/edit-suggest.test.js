"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { closestMatch, notFoundMessage, normalizeLine } = require("../src/tools/fs/edit-suggest");

const FILE = [
    "local Players = game:GetService(\"Players\")",
    "",
    "local function ouvrirPorte(porte, joueur)",
    "    if not porte or not joueur then",
    "        return",
    "    end",
    "    porte.CanCollide = false",
    "    tare(1.5)",
    "end",
    ""
].join("\n");

test("edit-suggest : une virgule oubliée retrouve la ligne réelle", () => {
    const match = closestMatch(FILE, "    porte.CanCollide = false\n    tare(1.5)");
    assert.ok(match, "aucune correspondance trouvée");
    assert.equal(match.startLine, 7);
    assert.equal(match.text, "    porte.CanCollide = false\n    tare(1.5)");
});

test("edit-suggest : l'indentation différente est tolérée", () => {
    const match = closestMatch(FILE, "if not porte or not joueur then\nreturn\nend");
    assert.ok(match);
    assert.equal(match.startLine, 4);
    assert.match(match.text, /^ {4}if not porte/);
});

test("edit-suggest : guillemets droits ou typographiques désignent la même ligne", () => {
    const typed = '"Players"';
    const curly = `\u201C${typed.slice(1, -1)}\u201D`;
    assert.equal(normalizeLine(`local P = game:GetService(${curly})`), normalizeLine(`local P = game:GetService(${typed})`));
    const match = closestMatch(FILE, `local Players = game:GetService(${curly})`);
    assert.ok(match);
    assert.equal(match.startLine, 1);
    assert.equal(normalizeLine("  a  =  1,2  "), "a = 1,2");
});

test("edit-suggest : un texte vraiment absent ne propose rien", () => {
    assert.equal(closestMatch(FILE, "function totalementDifferent(x)\n  return x * 2\nend"), null);
});

test("edit-suggest : le message contient le texte exact à recopier", () => {
    const message = notFoundMessage("src/porte.luau", FILE, "    porte.CanCollide=false");
    assert.match(message, /introuvable/);
    assert.match(message, /ligne 7/);
    assert.match(message, /porte\.CanCollide = false/);
});

test("edit-suggest : sans correspondance, le message renvoie à read_file", () => {
    const message = notFoundMessage("src/porte.luau", FILE, "zzzz yyyy xxxx");
    assert.match(message, /read_file/);
    assert.doesNotMatch(message, /Correspondance/);
});
