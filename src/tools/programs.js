"use strict";

const { requireString } = require("./core/args");
const programs = require("../programs");

module.exports = {
    name: "open_program",
    run: args => programs.launchProgram(args.program),
    check(args) {
        requireString(args.program, "program");
        programs.getDefinition(args.program);
    },
    describe: args => args.program ?? "?"
};
