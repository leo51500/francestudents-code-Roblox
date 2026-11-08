"use strict";

const programs = require("../programs");

function requireTarget(args) {
    const provided = ["name", "path", "appId"].filter(key => typeof args[key] === "string" && args[key].trim());
    if (provided.length !== 1) {
        throw new Error("Indique soit name, soit path, soit appId (un seul).");
    }
    if (args.target !== undefined && (typeof args.target !== "string" || !args.target.trim())) {
        throw new Error("target doit être un fichier, un dossier ou une URL.");
    }
}

module.exports = {
    name: "open_app",
    run: args => programs.launchApplication({ name: args.name, path: args.path, appId: args.appId, target: args.target }),
    check: requireTarget,
    describe: args => args.target || args.name || args.path || args.appId || "?"
};
