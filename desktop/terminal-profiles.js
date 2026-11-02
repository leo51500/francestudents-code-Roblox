"use strict";
const fs = require("node:fs");
const path = require("node:path");
const settings = require("../src/settings");
const systemDir = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
function executable(name) {
    for (const dir of (process.env.PATH || "").split(path.delimiter)) {
        const full = path.join(dir.replace(/^"|"$/g, ""), name);
        if (fs.existsSync(full)) return full;
    }
    return null;
}
function profiles() {
    const result = [{ id: "default", name: "PowerShell Windows (par défaut)" }, { id: "cmd", name: "Invite de commandes (cmd)" }];
    if (executable("pwsh.exe")) result.push({ id: "pwsh", name: "PowerShell 7" });
    return result;
}
async function preferences(action, payload = {}) {
    if (action === "save") {
        if (!profiles().some(item => item.id === payload.profile)) throw new Error("Ce terminal n’est pas disponible sur cet ordinateur.");
        settings.save({ terminalProfile: payload.profile });
    } else if (action !== "get") throw new Error("Action de terminal inconnue.");
    const value = settings.load();
    const available = profiles();
    const profile = available.some(item => item.id === value.terminalProfile) ? value.terminalProfile : "default";
    return { profiles: available, profile };
}
function resolveTerminal(cwd, command) {
    const value = settings.load();
    const profile = profiles().some(item => item.id === value.terminalProfile) ? value.terminalProfile : "default";
    let file, args, name;
    if (profile === "cmd") {
        file = path.join(systemDir, "cmd.exe");
        name = "cmd";
        args = command === undefined ? [] : ["/d", "/s", "/c", command];
    } else {
        file = profile === "pwsh" ? executable("pwsh.exe") : path.join(systemDir, "WindowsPowerShell", "v1.0", "powershell.exe");
        name = profile === "pwsh" ? "PowerShell 7" : "PowerShell";
        args = command === undefined ? ["-NoLogo"] : ["-NoLogo", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")];
    }
    return { file, args, name, cwd };
}
module.exports = { profiles, preferences, resolveTerminal };
