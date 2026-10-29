/* Panneau « Logs » du panneau inférieur : erreurs de l'interface, refus IPC et
 * réponses techniques (code HTTP, nom d'erreur réseau) réunis dans un seul endroit.
 * Rien n'est envoyé : le journal reste local et peut être copié à la demande. */
const logState = { filter: "all", query: "", entries: [], booted: false, hidden: true };

function logClock(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("fr-FR", { hour12: false });
}

function logText(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

/** Ajoute une entrée au journal, côté interface ou après une action technique. */
function recordLog({ type = "info", source = "app", text = "" } = {}) {
    if (!text || !$("logs-list")) return;
    const at = new Date().toISOString();
    logState.entries.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at, type, source, message: logText(text), status: /HTTP\s*(\d{3})/i.test(text) ? Number(/HTTP\s*(\d{3})/i.exec(text)[1]) : null });
    if (logState.entries.length > 400) logState.entries.splice(0, logState.entries.length - 400);
    paintLogs();
}

/** Une erreur de l'interface est visible dans le chat (si pertinent) et toujours dans Logs. */
function reportUiIssue(source, error) {
    const message = error && error.message ? error.message : String(error || "Erreur inconnue.");
    recordLog({ type: "error", source, text: message });
    return message;
}

/* Le compteur d'erreurs reste un élément stable de l'onglet Logs (jamais recréé). */
function paintLogBadge(tab, errors) {
    const badge = tab.querySelector(".log-error-count");
    if (!errors) {
        if (badge) { badge.textContent = ""; badge.hidden = true; }
        return;
    }
    if (!badge) return;
    badge.hidden = false;
    badge.textContent = String(errors);
    badge.title = `${errors} erreur${errors > 1 ? "s" : ""} dans le journal`;
}

function paintLogs() {
    const list = $("logs-list");
    if (!list) return;
    const query = logState.query.toLowerCase();
    const rows = logState.entries.filter((entry) => {
        if (logState.filter === "error" && entry.type !== "error") return false;
        if (logState.filter === "warn" && !["warn", "error"].includes(entry.type)) return false;
        if (logState.filter === "network" && !entry.errorCode && !(entry.status >= 400)) return false;
        if (!query) return true;
        return `${entry.message} ${entry.source} ${entry.status || ""}`.toLowerCase().includes(query);
    });
    const errors = logState.entries.filter((entry) => entry.type === "error").length;
    const tab = $("tab-logs");
    if (tab) paintLogBadge(tab, errors);
    if (!logState.booted) return;
    if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "logs-empty";
        empty.innerHTML = logState.entries.length
            ? "<b>Aucune entrée pour ce filtre.</b><span>Change de filtre ou efface la recherche.</span>"
            : "<b>Aucun problème enregistré.</b><span>Les erreurs de l’interface et les réponses refusées par le service apparaîtront ici, avec leur heure.</span>";
        list.replaceChildren(empty);
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of [...rows].reverse()) {
        const row = document.createElement("article");
        row.className = `log-row log-${entry.type}`;
        const head = document.createElement("div");
        head.className = "log-head";
        const time = document.createElement("time");
        time.textContent = logClock(entry.at);
        const kind = document.createElement("span");
        kind.className = "log-kind";
        kind.textContent = entry.errorCode ? `${entry.type} · ${entry.errorCode}` : entry.type;
        const source = document.createElement("span");
        source.className = "log-source";
        source.textContent = entry.source;
        head.append(time, kind, source);
        if (entry.status) {
            const status = document.createElement("span");
            status.className = "log-status";
            status.textContent = `HTTP ${entry.status}`;
            head.append(status);
        }
        const message = document.createElement("p");
        message.className = "log-message";
        message.textContent = entry.message;
        row.append(head, message);
        fragment.append(row);
    }
    list.replaceChildren(fragment);
}

async function refreshLogs() {
    try {
        const entries = await api.technicalLog("list");
        // Les entrées de cette session (élément à élément) complètent le journal central.
        const central = Array.isArray(entries) ? entries.slice(-400) : [];
        const seen = new Set(central.map((entry) => entry.message + entry.at));
        logState.entries = [...central, ...logState.entries.filter((entry) => String(entry.id).startsWith("local-") && !seen.has(entry.message + entry.at))].slice(-400);
    } catch (error) {
        logState.entries = logState.entries.length ? logState.entries : [];
        void error;
    }
    logState.booted = true;
    paintLogs();
}

function openLogs() {
    selectPanel("logs");
}



function copyLogs() {
    const lines = logState.entries.map((entry) => `${entry.at}  ${entry.type.padEnd(5)} ${String(entry.source || "").padEnd(22)} ${entry.status ? `HTTP ${entry.status} ` : ""}${entry.errorCode ? `${entry.errorCode} ` : ""}${entry.message}`);
    return api.copyText(lines.join("\n") || "Journal vide.").then(() => {
        const feedback = $("logs-feedback");
        if (feedback) { feedback.textContent = "Journal copié."; setTimeout(() => { if (feedback.textContent === "Journal copié.") feedback.textContent = ""; }, 2000); }
    }).catch((error) => { const feedback = $("logs-feedback"); if (feedback) feedback.textContent = error.message; });
}

/* Erreurs non prévues de l'interface : toujours consignées, jamais affichées en double. */
window.addEventListener("error", (event) => {
    if (!event || !event.message) return;
    recordLog({ type: "error", source: "interface", text: event.message });
});
window.addEventListener("unhandledrejection", (event) => {
    const reason = event && event.reason;
    recordLog({ type: "error", source: "promesse", text: reason && reason.message ? reason.message : String(reason || "") });
});

$("logs-refresh")?.addEventListener("click", () => refreshLogs());
$("logs-copy")?.addEventListener("click", copyLogs);
$("logs-clear")?.addEventListener("click", async () => {
    logState.entries = [];
    paintLogs();
    const feedback = $("logs-feedback");
    if (feedback) { feedback.textContent = "Journal vidé."; setTimeout(() => { if (feedback.textContent === "Journal vidé.") feedback.textContent = ""; }, 2000); }
});
$("logs-search")?.addEventListener("input", (event) => { logState.query = event.target.value.trim(); paintLogs(); });
for (const button of document.querySelectorAll("[data-log-filter]")) {
    button.addEventListener("click", () => {
        logState.filter = button.dataset.logFilter;
        for (const other of document.querySelectorAll("[data-log-filter]")) other.setAttribute("aria-pressed", String(other === button));
        paintLogs();
    });
}
document.addEventListener("frst:log", (event) => { recordLog(event.detail || {}); });
