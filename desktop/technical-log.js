"use strict";

/**
 * Journal technique consultable dans le panneau « Logs ».
 *
 * Il ne conserve que des métadonnées utiles au dépannage : type, date, code HTTP
 * éventuel et message d'erreur. Aucun contenu de conversation, prompt, jeton ou
 * trace complète n'est enregistré, et rien n'est envoyé automatiquement.
 */

const MAX_ENTRIES = 400;

function normalizeType(type) {
    if (type === "error" || type === "err") return "error";
    if (type === "warn") return "warn";
    if (type === "system") return "system";
    return "info";
}

/** Code HTTP et nom d'erreur détectés dans un message, sans le reproduire en entier. */
function describe(text) {
    const value = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
    const status = /(?:HTTP|status(?:Code)?["']?\s*[:=])\s*["']?(\d{3})\b/i.exec(value);
    const name = /\b(ECONN[A-Z]*|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EPIPE|EACCES)\b/.exec(value);
    return { status: status ? Number(status[1]) : null, errorCode: name ? name[1] : null };
}

function createTechnicalLog({ now = () => Date.now(), max = MAX_ENTRIES } = {}) {
    const entries = [];
    let nextId = 1;

    function push(event = {}) {
        const text = String(event.text ?? event.message ?? "").trim();
        if (!text) return null;
        const type = normalizeType(event.type);
        const entry = {
            id: nextId++,
            at: event.at || new Date(now()).toISOString(),
            type,
            source: String(event.source || (type === "error" ? "agent" : "app")).slice(0, 40),
            message: text.replace(/\s+/g, " ").slice(0, 1200),
            ...describe(text)
        };
        entries.push(entry);
        if (entries.length > max) entries.splice(0, entries.length - max);
        return entry;
    }

    return {
        push,
        list: () => entries.slice(),
        clear() { entries.length = 0; },
        count: () => entries.length
    };
}

module.exports = { createTechnicalLog, describe, MAX_ENTRIES };
