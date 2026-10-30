/* ---------- Raccourcis globaux ---------- */

function isEditable(el) {
    return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

window.addEventListener("keydown", (ev) => {
    if (document.querySelector("dialog[open]")) return;
    if (!ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        if (ev.key === "Escape" && !contextMenu.classList.contains("hidden")) {
            ev.stopPropagation();
            hideContextMenu();
            return;
        }
        if (ev.key === "Escape" && !modelMenuEl.classList.contains("hidden")) {
            const active = document.activeElement;
            // La recherche et le renommage de l'historique gèrent Escape eux-mêmes.
            if (active && modelMenuEl.contains(active) && active.matches(".history-search, .history-rename")) return;
            ev.stopPropagation();
            hideModelMenu();
            return;
        }
        const p = ui.prompts[0];
        const free = !isEditable(document.activeElement) && !document.querySelector(".modal-overlay") && $("palette").classList.contains("hidden");
        if (p && p.kind === "confirm" && free) {
            const k = ev.key.toLowerCase();
            const value = k === "o" || k === "y" ? "o" : k === "n" ? "n" : k === "t" && !p.force ? "t" : null;
            if (value) {
                ev.preventDefault();
                ev.stopPropagation();
                api.resolvePrompt(p.id, value).catch((err) => renderEntry({ type: "error", text: err.message }));
            }
        }
        return;
    }
    const key = ev.key.toLowerCase();
    let action = null;
    // Ctrl+Alt+A : masquer ou rétablir le chat, sans chercher le bouton.
    if (ev.ctrlKey && ev.altKey && key === "a") action = typeof toggleAgent === "function" ? toggleAgent : null;
    else if ((ev.code === "Backquote" || key === "`" || key === "²") && ev.shiftKey) action = () => {
        selectPanel("terminal", false);
        createTerminal(true);
    };
    else if (ev.code === "Backquote" || key === "`" || key === "²") action = () => togglePanel("terminal");
    else if (key === "p" && ev.shiftKey) action = () => openPalette("commands");
    else if (key === "p") action = () => openPalette("files");
    else if (key === "f" && ev.shiftKey) action = focusSearch;
    else if (key === "e" && ev.shiftKey) action = () => toggleSideView("explorer");
    else if (key === "j" && !ev.shiftKey) action = () => togglePanel();
    else if (key === "l" && ev.shiftKey) action = () => { selectPanel("logs"); if (typeof refreshLogs === "function") refreshLogs(); };

    else if (key === "r" && ev.shiftKey) action = () => toggleSideView("roblox");
    else if (key === "g" && !ev.shiftKey) action = askGoToLine;
    else if (key === "n" && !ev.shiftKey) action = () => newEntry("file", ".");
    else if (key === "b" && !ev.shiftKey) action = () => toggleSideView(ui.sideView || "explorer");
    if (!action) return;
    ev.preventDefault();
    ev.stopPropagation();
    action();
}, true);

document.addEventListener("mousedown", (ev) => {
    if (!contextMenu.classList.contains("hidden") && !contextMenu.contains(ev.target)) hideContextMenu();
    if (!modelMenuEl.classList.contains("hidden") &&
        !modelMenuEl.contains(ev.target) &&
        !ev.target.closest("#btn-model") &&
        !ev.target.closest("#btn-history") &&
        !ev.target.closest("#st-model")) {
        hideModelMenu();
    }
    const pal = $("palette");
    if (!pal.classList.contains("hidden") && !pal.contains(ev.target)) closePalette();
});
window.addEventListener("blur", hideContextMenu);

/* ---------- Copie des blocs de code ---------- */

transcript.addEventListener("dblclick", (ev) => {
    const pre = ev.target.closest("pre");
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
        pre.classList.add("copied");
        setTimeout(() => pre.classList.remove("copied"), 900);
    }).catch(() => {});
});

/* ---------- Disposition mémorisée ---------- */

const LAYOUT_KEY = "frst.desktop.layout";
const LAYOUT_VARS = ["--left", "--right", "--bottom"];

function saveLayout() {
    try {
        const app = $("app");
        // Les trois panneaux sont mémorisés : rouvrir l'application retrouve la même
        // disposition, qu'une colonne soit masquée ou non.
        const data = {
            noPanel: app.classList.contains("no-panel"),
            noSidebar: app.classList.contains("no-sidebar"),
            noAgent: app.classList.contains("no-agent")
        };
        for (const v of LAYOUT_VARS) {
            const custom = document.documentElement.style.getPropertyValue(`${v}-custom`).trim();
            const value = custom || document.documentElement.style.getPropertyValue(v).trim();
            if (/^[0-9]+px$/.test(value)) data[v] = value;
        }
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(data));
    } catch {
        // stockage local indisponible
    }
}

try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
    for (const v of LAYOUT_VARS) {
        // Reprise telle quelle de la largeur enregistrée : elle redevient une largeur
        // choisie au démarrage, sinon la règle de taille de fenêtre l'écrasait.
        if (/^[0-9]+px$/.test(saved[v] || "")) document.documentElement.style.setProperty(v === "--bottom" ? v : `${v}-custom`, saved[v]);
    }
    // Le panneau du bas et la colonne des fichiers se rouvrent comme ils étaient fermés ;
    // le chat n'est pas mémorisé masqué (il porte la conversation et le mode compact).
    if (saved.noPanel) $("app").classList.add("no-panel");
    if (saved.noSidebar && !window.matchMedia("(max-width: 900px)").matches) $("app").classList.add("no-sidebar");
    if (typeof syncLayoutCustom === "function") syncLayoutCustom();
} catch {
    // disposition par défaut
}

/* ---------- Barre de titre, accueil et zone de saisie ---------- */

function bindClick(id, fn) {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
}

function toggleAgent() {
    const app = $("app");
    app.classList.toggle("no-agent");
    if (!app.classList.contains("no-agent")) input.focus();
    saveLayout();
    // La colonne revient avec sa largeur réglée (ou la place disponible), sans attente.
    if (typeof scheduleClampLayout === "function") scheduleClampLayout();
}

function syncTitlebar() {
    const app = $("app");
    const set = (id, on) => {
        const el = $(id);
        if (el) el.classList.toggle("active", on);
    };
    set("tb-toggle-sidebar", !app.classList.contains("no-sidebar"));
    set("tb-toggle-panel", !app.classList.contains("no-panel"));
    set("tb-toggle-agent", !app.classList.contains("no-agent"));
}

bindClick("tb-palette", () => openPalette("files"));
bindClick("tb-toggle-sidebar", () => toggleSideView(ui.sideView || "explorer"));
// Une fois la barre rouverte, le bouton reflète l'état réel (le masquage ne le mettait pas à jour).
$("tb-toggle-sidebar")?.addEventListener("click", () => requestAnimationFrame(syncTitlebar));
bindClick("tb-toggle-panel", () => togglePanel());
bindClick("tb-toggle-agent", toggleAgent);
bindClick("wa-open", () => openProject());
bindClick("wa-goto", () => openPalette("files"));
bindClick("wa-palette", () => openPalette("commands"));
bindClick("wa-terminal", () => togglePanel("terminal"));

new MutationObserver(syncTitlebar).observe($("app"), { attributes: true, attributeFilter: ["class"] });
syncTitlebar();

/* ---------- Petite fenêtre : le panneau de fichiers se replie sans casser Ctrl+B ----------
 * Sous 900 px, il n'y a plus la place pour la colonne des fichiers. Le HTML le dit
 * (.no-sidebar), ce qui garde le bouton de la barre de titre cohérent ; un clic
 * explicite sur « Fichiers » rouvre la colonne en superposition réduite
 * (.sidebar-auto-hidden) au lieu de laisser l'interface inerte. */
const COMPACT_LAYOUT = window.matchMedia("(max-width: 900px)");

function autoHideSidebar(compact) {
    const app = $("app");
    app.classList.remove("sidebar-auto-hidden");
    if (!compact) return;
    app.classList.add("no-sidebar");
    // Le tiroir ne vaut que si la colonne est réellement sortie.
    requestAnimationFrame(() => {
        if (getComputedStyle($("sidebar")).display === "none") app.classList.add("sidebar-auto-hidden");
    });
}

COMPACT_LAYOUT.addEventListener("change", (e) => autoHideSidebar(e.matches));
if (COMPACT_LAYOUT.matches) autoHideSidebar(true);

$("sidebar-tabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-view]");
    if (!tab) return;
    const app = $("app");
    // Sur une fenêtre réduite, choisir une section rouvre la colonne repliée.
    if (COMPACT_LAYOUT.matches && app.classList.contains("no-sidebar")) {
        app.classList.remove("no-sidebar");
        app.classList.add("sidebar-auto-hidden");
    }
    if (COMPACT_LAYOUT.matches && !app.classList.contains("no-sidebar")) {
        const shown = getComputedStyle($("sidebar")).display !== "none";
        app.classList.toggle("sidebar-auto-hidden", !shown);
    }
    // En capture, le repli est levé avant les gestionnaires de section (onclick).
}, true);

$("tb-toggle-sidebar")?.addEventListener("click", () => $("app").classList.remove("sidebar-auto-hidden"), true);

function autosizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
}

input.addEventListener("input", autosizeInput);
input.addEventListener("keyup", autosizeInput);
$("composer").addEventListener("submit", () => setTimeout(autosizeInput, 0));

window.addEventListener("mouseup", () => setTimeout(saveLayout, 0));
window.addEventListener("beforeunload", saveLayout);

/* ---------- Événements du processus principal ---------- */

api.onEvent((channel, data) => {
    switch (channel) {
        case "entry":
            renderEntry(data);
            if (data.type === "result" || data.type === "diff") scheduleRefresh();
            break;
        case "liveStart":
            liveStart();
            break;
        case "liveAppend":
            liveAppend(data);
            break;
        case "liveEnd":
            liveEnd();
            break;
        case "spinner":
            setSpinner(data);
            break;
        case "prompt":
            ui.prompts.push(data);
            if (ui.prompts.length === 1) showPrompt();
            break;
        case "promptResolved": {
            const wasFirst = ui.prompts[0] && ui.prompts[0].id === data.id;
            ui.prompts = ui.prompts.filter((p) => p.id !== data.id);
            if (wasFirst) showPrompt();
            break;
        }
        case "commandLine":
            appendOutput(data);
            break;
        case "clear":
            renderWorkPlan([]);
            studioEntries.length = 0;
            transcript.innerHTML = "";
            $("agent-starter").classList.remove("hidden");
            toolGroup = null;
            liveEnd();
            if (typeof hideThinkingIndicator === "function") hideThinkingIndicator();
            clearChanges();
            ui.interrupted = false;
            $("btn-resume").classList.add("hidden");
            break;
        case "terminalData":
            termData(data);
            break;
        case "terminalExit":
            termExit(data || {});
            break;
        case "ptyData":
            ptyData(data);
            break;
        case "ptyExit":
            ptyExit(data || {});
            break;
        case "status":
            applyStatus(data);
            break;
        case "taskQueue":
            renderTaskQueue(data);
            break;
        case "agentActivity":
            renderAgentActivity(data);
            break;
        default:
            break;
    }
});

