"use strict";

const { execFile } = require("node:child_process");

const MAX_BUFFER = 8 * 1024 * 1024;

function runGit(cwd, args) {
    return new Promise((resolve, reject) => {
        execFile("git", args, { cwd, maxBuffer: MAX_BUFFER, windowsHide: true, encoding: "utf8" }, (error, stdout, stderr) => {
            if (error) {
                const message = String(stderr || error.message || "").trim();
                reject(new Error(message || "git a échoué."));
                return;
            }
            resolve(stdout);
        });
    });
}

module.exports = { runGit };
