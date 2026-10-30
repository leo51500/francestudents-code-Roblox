"use strict";

/**
 * Terminaux de l'application de bureau : commandes simples (spawn) et vraie session
 * interactive (node-pty). Extrait de main.js pour que le processus principal reste
 * lisible ; la logique et les messages sont inchangés.
 *
 * Dépendances injectées, pour éviter un require circulaire vers main.js :
 * - send(channel, data) : envoie un événement à la fenêtre ;
 * - insideWorkspace(rel) : chemin absolu dans le projet, refusé hors projet ;
 * - stability : moniteur FST (codes d'erreur réels).
 */

const path = require("node:path");
const fs = require("node:fs/promises");

function createTerminals({ send, insideWorkspace, stability }) {
    const terminals = new Map();
    let nextTerminalId = 1;

    /**
     * Résout le dossier courant d'un terminal après « cd » : renvoie le chemin
     * relatif au projet (« . » pour la racine). Refuse toute sortie du projet.
     */
    async function terminalCd(currentRel, target) {
        const { state } = require("../src/state");
        const base = insideWorkspace(String(currentRel || "."));
        const raw = String(target ?? "").trim().replace(/^["']|["']$/g, "");
        const full = !raw || raw === "~" ? insideWorkspace(".") : path.resolve(base, raw);
        const rel = path.relative(state.workspace, full);
        if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Dossier hors du projet.");
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || !stat.isDirectory()) throw new Error(`Dossier introuvable : ${raw}`);
        return rel ? rel.split(path.sep).join("/") : ".";
    }

    function runTerminal(commandLine, cwdRel) {
        const line = String(commandLine ?? "").trim();
        if (!line) throw new Error("Commande vide.");
        const { spawn } = require("node:child_process");
        const id = nextTerminalId++;
        const env = { ...process.env, FORCE_COLOR: "1", CLICOLOR_FORCE: "1", TERM: "xterm-256color" };
        delete env.NO_COLOR;
        const selected = require("./terminal-profiles").resolveTerminal(insideWorkspace(String(cwdRel || ".")), line);
        const child = spawn(selected.file, selected.args, {
            cwd: selected.cwd,
            shell: false,
            windowsHide: true,
            env
        });
        terminals.set(id, child);
        const forward = (chunk) => send("terminalData", { id, text: chunk.toString("utf8") });
        child.stdout.on("data", forward);
        child.stderr.on("data", forward);
        child.on("error", (error) => send("terminalData", { id, text: `${error.message}\n` }));
        child.on("close", (code, signal) => {
            terminals.delete(id);
            send("terminalExit", { id, code, signal });
        });
        return id;
    }

    function killTerminal(id) {
                const child = terminals.get(id);
                if (!child) return false;
                if (process.platform === "win32") {
                    require("node:child_process").spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
                } else {
                    child.kill("SIGTERM");
                }
                return true;
            }

    /* ---------- Vrai terminal (pseudo-terminal node-pty) ---------- */

    const ptys = new Map();
        let nextPtyId = 1;
        let ptyModule;

        /** Charge node-pty au premier usage ; null s'il est absent ou non compilé pour Electron. */
        function loadPty() {
            if (ptyModule !== undefined) return ptyModule;
            try {
                ptyModule = require("node-pty");
            } catch (error) {
                console.warn(`[pty] node-pty indisponible : ${error.message}`);
                ptyModule = null;
            }
            return ptyModule;
        }

        function ptyAvailable() {
            return Boolean(loadPty());
        }

        function clampSize(value, fallback, max) {
            const n = Math.floor(Number(value));
            return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
        }

        function ptyCreate(cwdRel, cols, rows) {
            const pty = loadPty();
            if (!pty) throw new Error("node-pty indisponible : lancer « npm run rebuild:native ».");
            const shellInfo = require("./terminal-profiles").resolveTerminal(insideWorkspace(String(cwdRel || ".")));
            const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", TERM_PROGRAM: "FranceStudentCode" };
            delete env.NO_COLOR;
            if (!env.LANG) env.LANG = "fr_FR.UTF-8";
            const id = nextPtyId++;
            const proc = pty.spawn(shellInfo.file, shellInfo.args, {
                name: "xterm-256color",
                cols: clampSize(cols, 80, 1000),
                rows: clampSize(rows, 24, 500),
                cwd: shellInfo.cwd,
                env
            });
            ptys.set(id, proc);
            proc.on("error", error => {
                if (!ptys.delete(id)) return;
                stability.record("FST-301", { errorCode: error?.code, errorName: error?.name });
                send("ptyExit", { id, code: -1, errorCode: "FST-301" });
                try { proc.kill(); } catch { /* Transport already closed. */ }
            });
            proc.onData((data) => { if (ptys.has(id)) send("ptyData", { id, data }); });
            proc.onExit(({ exitCode, signal }) => {
                if (!ptys.delete(id)) return;
                send("ptyExit", { id, code: exitCode, signal });
            });
            return { id, pid: proc.pid, shell: shellInfo.name };
        }

        function ptyWrite(id, data) {
            const proc = ptys.get(Number(id));
            if (!proc) return false;
            proc.write(String(data ?? ""));
            return true;
        }

        function ptyResize(id, cols, rows) {
            const proc = ptys.get(Number(id));
            if (!proc) return false;
            try {
                proc.resize(clampSize(cols, 80, 1000), clampSize(rows, 24, 500));
            } catch {
                return false;
            }
            return true;
        }

        function ptyKill(id) {
            const proc = ptys.get(Number(id));
            if (!proc) return false;
            ptys.delete(Number(id));
            try {
                proc.kill();
            } catch {
                // déjà terminé
            }
            return true;
        }

        function killAll() {
            for (const id of [...terminals.keys()]) killTerminal(id);
            for (const id of [...ptys.keys()]) ptyKill(id);
        }

        return {
            terminalCd,
            runTerminal,
            killTerminal,
            ptyAvailable,
            ptyCreate,
            ptyWrite,
            ptyResize,
            ptyKill,
            killAll
        };
    }

    module.exports = { createTerminals };
