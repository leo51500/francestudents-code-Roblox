"use strict";

/** Lit le texte du presse-papier du système, ou "" s'il est vide ou illisible. */
function readClipboard() {
    const { execFile } = require("node:child_process");
    const cmd = "powershell.exe";
    const args = ["-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard -Raw"];
    return new Promise(resolve => {
        execFile(cmd, args, { encoding: "utf8", windowsHide: true, timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout) => resolve(error ? "" : String(stdout || "")));
    });
}

module.exports = { readClipboard };
