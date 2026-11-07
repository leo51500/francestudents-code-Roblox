"use strict";

const { requireString, optionalString } = require("./core/args");
const programs = require("../programs");

module.exports = {
    name: "open_in",
    run: args => programs.openPathWith({ target: args.path, app: args.app }),
    check(args) {
        requireString(args.path, "path");
        optionalString(args.app, "app");
    },
    describe: args => (args.app ? `${args.app} · ${args.path}` : args.path ?? "?")
};
