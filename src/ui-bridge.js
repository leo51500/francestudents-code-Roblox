/**
 * Port d'interface (étape 1 du plan).
 *
 * Les modules métier appellent `ui.xxx()` sans savoir quel rendu est actif :
 * la CLI readline (par défaut) ou la TUI Ink (branchée via setUiBackend).
 * Chaque méthode délègue au backend actif au moment de l'appel.
 */

const UI_METHODS = [
    "info", "warn", "error", "debug", "print", "assistant", "plan", "reason",
    "tool", "result", "diff", "commandLine", "stream", "spinner", "confirm",
    "askCommand", "ask", "askSecret", "onInterrupt", "banner", "prompt",
    "clear",
    // Suivi d'un sous-agent : début, tour, fin. Optionnel — un backend qui ne le
    // fournit pas ignore simplement l'avancement (le compte rendu reste renvoyé au parent).
    "subagent"
];

let backend = null;

/**
 * Renvoie le backend actif. Le backend CLI est chargé à la demande
 * (require paresseux) pour éviter un cycle avec state/config.
 */
function getUiBackend() {
    if (!backend) backend = require("./cli/ui").ui;
    return backend;
}

/**
 * Remplace le backend actif. `null` ou `undefined` rétablit le backend CLI par défaut.
 */
function setUiBackend(impl) {
    if (impl != null && typeof impl !== "object") {
        throw new TypeError("Interface : le backend doit être un objet.");
    }
    backend = impl || null;
}

const ui = {};
for (const name of UI_METHODS) {
    ui[name] = function (...args) {
        const impl = getUiBackend();
        if (typeof impl[name] !== "function") {
            throw new Error(`Interface : méthode « ${name} » absente du backend actif.`);
        }
        return impl[name].apply(impl, args);
    };
}
// Méthodes optionnelles : silencieuses quand le backend actif ne les implémente pas.
const OPTIONAL = new Set(["subagent"]);

for (const name of OPTIONAL) {
    ui[name] = function (...args) {
        const impl = getUiBackend();
        if (typeof impl[name] !== "function") return undefined;
        return impl[name].apply(impl, args);
    };
}

Object.freeze(ui);

module.exports = { ui, setUiBackend, getUiBackend, UI_METHODS, OPTIONAL };
