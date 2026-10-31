"use strict";

const js = require("@eslint/js");
const globals = require("globals");

// Symboles déclarés au niveau racine par les modules concaténés du renderer.
// Le fichier est généré par scripts/renderer-globals.js (prelint).
let rendererGlobals = {};
try {
    rendererGlobals = require("./desktop/renderer/globals.generated.json");
} catch {
    // Le premier lint sans fichier généré reste possible ; prelint le crée.
}

const commonRules = {
    "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-control-regex": "off",
    // Règles ajoutées au jeu recommandé d'ESLint 10 : signalées sans bloquer,
    // en attendant de corriger le code existant.
    "no-useless-assignment": "warn",
    "no-useless-escape": "warn",
    "preserve-caught-error": "warn"
};

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "release/**",
            "desktop/renderer/app.js",
            "desktop/renderer/vendor/**",
            "desktop/vendor-effectcraft/**",
            "probe_*",
            "qa/**",
            "qa2/**",
            "qa3/**",
            "**/*.tmp"
        ]
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "commonjs",
            globals: { ...globals.node }
        },
        rules: commonRules
    },
    {
        files: ["**/*.mjs", "src/tui/**/*.jsx"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: { ...globals.node },
            parserOptions: { ecmaFeatures: { jsx: true } }
        },
        rules: commonRules
    },
    {
        // Modules concaténés dans app.js : ils partagent la même portée globale,
        // les références d'un module à l'autre ne sont donc pas vérifiables ici.
        files: ["desktop/renderer/**/*.js"],
        languageOptions: {
            sourceType: "script",
            globals: { ...globals.browser, ...rendererGlobals }
        },
        rules: {
            // no-undef est fiable grâce à la liste générée des symboles partagés.
            // no-unused-vars et no-redeclare restent désactivés : une déclaration
            // peut être consommée par un module chargé plus tard.
            "no-undef": "error",
            "no-unused-vars": "off",
            "no-redeclare": "off"
        }
    },
    {
        // page.evaluate() exécute ces fonctions dans la fenêtre Electron.
        files: ["e2e/**/*.js"],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser }
        }
    }
];
