/* ---------- Espace agent : activité, sources, favoris et brouillons ---------- */
const studioEntries = [];
let studioRun = null;
let studioWorkspace = undefined;
let studioTab = "conversation";
let studioActivitySeq = 0;
let favoritePrompts = readStudioStorage("frst.prompt-favorites", []);
if (!Array.isArray(favoritePrompts)) favoritePrompts = [];
// "Outils du chat" est un menu : fermé au lancement, sinon il recouvre la conversation
// et masque l'en-tête (onglets, projet des discussions) tant qu'on ne l'a pas fermé.
document.getElementById("agent-favorites")?.classList.add("hidden");
const starterFavorites = [
    { title: "Revue des changements", prompt: "Inspecte le diff Git local et recherche les bugs et régressions. Donne les fichiers et lignes concernés, le niveau de gravité et les vérifications utiles, sans modifier le code." },
    { title: "Corriger un bug", prompt: "Reproduis le problème suivant, identifie sa cause, corrige-le puis vérifie la correction : " },
    { title: "Écrire les tests utiles", prompt: "Inspecte le code et les tests existants. Identifie les comportements importants non couverts, ajoute les tests pertinents et lance-les." },
    { title: "Améliorer les performances", prompt: "Cherche un problème de performance mesurable. Établis une mesure de référence, propose et implémente une amélioration puis compare les résultats." },
    { title: "Documenter le projet", prompt: "Vérifie les commandes et le fonctionnement réel du projet, puis mets à jour sa documentation d’installation, d’utilisation et de test." }
];

function readStudioStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStudioStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { studioFeedback("Le stockage local est indisponible."); }
}
function studioFeedback(message) { $("composer-feedback").textContent = message || ""; }
function studioDraftKey(workspace,mode=typeof motionChatMode!=="undefined"?motionChatMode:"code") {return `frst.draft:${workspace || "global"}${mode==="motion"?":motion":""}`;}
function saveStudioDraft() {
    if (studioWorkspace !== undefined) writeStudioStorage(studioDraftKey(studioWorkspace), input.value);
}
function setAgentTab(tab) {
    studioTab = ["conversation", "activity", "usage"].includes(tab) ? tab : "conversation";
    $("agent").dataset.tab = studioTab;
    for (const button of document.querySelectorAll("[data-agent-tab]")) {
        const selected = button.dataset.agentTab === studioTab;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    if (studioTab === "activity") refreshStudioActivity();
    if (studioTab === "usage") { renderUsageDashboard(); refreshQuota(); }
}
function updateStudioStatus(status) {
    const workspace = status.workspace || null;
    updateAgentProjectLabel(workspace);
    // Projet FranceStudent : chaque nouvelle discussion part dans le projet choisi.
    if (typeof syncFrProject === "function") syncFrProject(status.frProject || null, status.booted);
    $("agent-access").textContent = status.fullAccess ? "Full accès" : status.autoApprove && status.autoApproveCommands ? "Automatique" : "Sur approbation";
    $("agent-access").classList.toggle("full-access", Boolean(status.fullAccess));
    if (studioWorkspace !== workspace) {
        saveStudioDraft();
        studioWorkspace = workspace;
        input.value = readStudioStorage(studioDraftKey(workspace), "");
        autosizeInput();
        if (studioRun && studioRun.workspace !== workspace) { studioRun = null; renderAgentActivity(null); }
    }
}
function updateAgentProjectLabel(workspace=ui.workspace){
    const motion=typeof isMotionOpen==="function" && isMotionOpen();
    $("agent-project-name").textContent=motion?"Projet EffectCraft":workspace?workspace.replace(/[\\/]+$/, "").split(/[\\/]/).pop():"Aucun projet";
    $("agent-project-name").title=motion?"Projet motion indépendant du dossier ouvert dans l’espace code":workspace || "Ouvre un dossier pour travailler sur un projet";
}
function recordStudioEntry(entry) {
    if (entry.type === "user" && /^\/new\b/.test(entry.text || "")) studioEntries.length = 0;
    if (["user", "assistant", "tool", "result", "error", "warn", "plan"].includes(entry.type)) {
        studioEntries.push({ ...entry, at: new Date().toISOString() });
        if (studioEntries.length > 3000) studioEntries.shift();
    }
}
function exportStudioMarkdown() {
    const header = `# Conversation FranceStudent ${isMotionOpen()?"Motion design":"Code"}\n\nProjet : ${isMotionOpen()?"EffectCraft":studioWorkspace || "Aucun"}\nExport : ${new Date().toISOString()}\n\n`;
    return header + studioEntries.map(entry => {
        if (entry.type === "user" || entry.type === "assistant") return `## ${entry.type === "user" ? "Vous" : "Agent"}\n\n${entry.text}\n`;
        if (entry.type === "tool") return `**${toolLabel(entry.name)}**\n\n\`\`\`text\n${entry.arg || ""}\n\`\`\`\n`;
        if (entry.type === "plan") return `### Plan\n${(entry.items || []).map(item => `- ${item}`).join("\n")}\n`;
        return `> ${String(entry.text || "").replace(/\n/g, "\n> ")}\n`;
    }).join("\n");
}
function humanDuration(start, end) {
    const seconds = Math.max(0, Math.floor(((end || Date.now()) - start) / 1000));
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
function emptyStudioText(parent, text) {
    const note = document.createElement("p"); note.className = "muted"; note.textContent = text; parent.appendChild(note);
}
function renderAgentActivity(run) {
    const motion=typeof isMotionOpen==="function" && isMotionOpen();
    if(run && (!!run.motionDesign!==motion || !motion && run.workspace!==ui.workspace))run=null;
    studioRun = run;
    const steps = run?.steps || [];
    if (!ui.replayingConversation) renderWorkPlan(steps, { status: run?.status || "idle" });
    const overview = $("activity-overview"); overview.replaceChildren();
    const timeline = $("activity-timeline"); timeline.replaceChildren();
    const sources = $("activity-sources"); sources.replaceChildren();
    if (!run) {
        emptyStudioText(overview, "Les actions, les commandes et les sources apparaîtront ici dès la prochaine demande.");
        return;
    }
    const status = { running: "En cours", done: "Terminée", failed: "À vérifier", interrupted: "Interrompue" }[run.status] || run.status;
    const title = document.createElement("div"); title.className = "run-title"; title.textContent = run.prompt;
    const line = document.createElement("p"); line.className = `run-status run-status-${run.status}`; line.textContent = `${status} · ${humanDuration(run.startedAt, run.endedAt)}`;
    const stats = document.createElement("div"); stats.className = "activity-stats";
    for (const [value, label] of [[run.commands, "commandes"], [run.reads, "explorations"], [run.writes, "écritures"]]) {
        const stat = document.createElement("div"); const number = document.createElement("strong"); number.textContent = value || 0;
        const name = document.createElement("small"); name.textContent = label; stat.append(number, name); stats.appendChild(stat);
    }
    overview.append(title, line, stats);
    // Bandeau des sous-agents : ils travaillent en parallèle avec leurs propres outils, donc
    // leur place est au-dessus de la chronologie (qui ne montre que les actions du parent).
    const team = document.createElement("div"); team.className = "activity-subagents";
    for (const agent of run.subagents || []) {
        const row = document.createElement("details"); row.className = `activity-action activity-subagent activity-action-${agent.state === "running" ? "running" : agent.state === "done" ? "done" : "failed"}`;
        row.open = agent.state === "running";
        const summary = document.createElement("summary");
        const turns = agent.turns ? ` · ${agent.turns} tour(s)` : "";
        summary.textContent = `${agent.state === "running" ? "◉" : agent.state === "done" ? "✓" : "!"} Sous-agent ${agent.label}${turns}`;
        const body = document.createElement("pre");
        body.textContent = [agent.brief && `Brief : ${agent.brief}`, agent.written?.length && `Fichiers : ${agent.written.join(", ")}`, agent.report].filter(Boolean).join("\n\n");
        row.append(summary, body); team.appendChild(row);
    }
    if (team.childElementCount) overview.appendChild(team);
    for (const action of (run.actions || []).slice().reverse()) {
        const row = document.createElement("details"); row.className = `activity-action activity-action-${action.status}`;
        const summary = document.createElement("summary"); summary.textContent = `${action.status === "done" ? "✓" : action.status === "running" ? "◉" : "!"} ${toolLabel(action.name)} · ${humanDuration(action.startedAt, action.endedAt)}`;
        const body = document.createElement("pre"); body.textContent = [action.argument, action.result].filter(Boolean).join("\n\n");
        row.append(summary, body); timeline.appendChild(row);
    }
    if (!run.actions?.length) emptyStudioText(timeline, "L’agent prépare sa prochaine action.");
    for (const source of run.sources || []) {
        const row = document.createElement("button"); row.type = "button"; row.className = "source-card";
        const title = document.createElement("strong"); title.textContent = source.title;
        const meta = document.createElement("small");
        try { meta.textContent = `${new URL(source.url).hostname} · ${source.consulted ? "Source consultée" : "Résultat de recherche"}`; } catch { continue; }
        row.append(title, meta); row.onclick = () => api.openExternal(source.url).catch(error => studioFeedback(error.message)); sources.appendChild(row);
    }
    if (!run.sources?.length) emptyStudioText(sources, "Les liens sont distingués selon qu’ils ont été trouvés ou effectivement consultés.");
}
async function refreshStudioActivity() {
    const seq = ++studioActivitySeq;
    try {
        const motion=isMotionOpen();
        const [run, jobs, checkpoints] = await Promise.all([api.agentActivity(), motion?[]:api.backgroundJobs("list"), motion?[]:api.checkpoints("list")]);
        if (seq !== studioActivitySeq) return;
        renderAgentActivity(run);
        const jobsHost = $("activity-jobs"); jobsHost.replaceChildren();
        if (!jobs.length) emptyStudioText(jobsHost, "Aucune commande en arrière-plan.");
        for (const job of jobs) {
            const row = document.createElement("div"); row.className = "workspace-item";
            const label = document.createElement("div"); label.textContent = `${job.id} · ${job.command}`;
            const meta = document.createElement("small"); meta.textContent = `${job.status} · ${Math.floor(job.duration_ms / 1000)} s${job.exit_code !== null ? ` · code ${job.exit_code}` : ""}`;
            const output = document.createElement("button"); output.type = "button"; output.textContent = "Sortie";
            output.onclick = async () => { try { const result = await api.backgroundJobs("output", job.id); $("activity-job-output").textContent = result.output || "Aucune sortie."; $("activity-job-output").classList.remove("hidden"); } catch (error) { studioFeedback(error.message); } };
            row.append(label, meta, output);
            if (job.status === "running") {
                const stop = document.createElement("button"); stop.type = "button"; stop.textContent = "Arrêter";
                stop.onclick = () => api.backgroundJobs("stop", job.id).then(refreshStudioActivity).catch(error => studioFeedback(error.message)); row.appendChild(stop);
            }
            jobsHost.appendChild(row);
        }
        const pointsHost = $("activity-checkpoints"); pointsHost.replaceChildren();
        if (!checkpoints.length) emptyStudioText(pointsHost, "Un point de reprise est créé avant chaque demande sur le projet.");
        for (const point of checkpoints) {
            const row = document.createElement("div"); row.className = "workspace-item";
            const label = document.createElement("div"); label.textContent = point.task;
            const time = document.createElement("small"); time.textContent = new Date(point.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Restaurer"; restore.disabled = Boolean(ui.status.busy);
            restore.onclick = async () => {
                if (!await confirmStudioAction(`Restaurer les modifications suivies avant « ${point.task} » ? Les commandes shell ne sont pas annulées.`)) return;
                try { const result = await api.checkpoints("restore", point.id); studioFeedback(`${result.reverted || 0} modification(s) restaurée(s).`); scheduleRefresh(); refreshStudioActivity(); }
                catch (error) { studioFeedback(error.message); }
            };
            row.append(label, time, restore); pointsHost.appendChild(row);
        }
    } catch (error) { studioFeedback(error.message); }
}
function renderFavoritePrompts() {
    const list = $("favorite-list"); list.replaceChildren();
    for (const [index, favorite] of [...favoritePrompts, ...starterFavorites].entries()) {
        const row = document.createElement("div"); row.className = "favorite-row";
        const use = document.createElement("button"); use.type = "button"; use.textContent = favorite.title; use.title = favorite.prompt;
        use.onclick = () => { input.value = favorite.prompt; saveStudioDraft(); autosizeInput(); setAgentTab("conversation"); $("agent-favorites").classList.add("hidden"); input.focus(); };
        row.appendChild(use);
        if (index < favoritePrompts.length) {
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Retirer ${favorite.title}`);
            remove.onclick = () => { favoritePrompts.splice(index, 1); writeStudioStorage("frst.prompt-favorites", favoritePrompts); renderFavoritePrompts(); }; row.appendChild(remove);
        }
        list.appendChild(row);
    }
}

for (const button of document.querySelectorAll("[data-agent-tab]")) {
    button.onclick = () => setAgentTab(button.dataset.agentTab);
    button.onkeydown = event => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll("[data-agent-tab]")];
        const next = tabs[(tabs.indexOf(button) + (event.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length];
        setAgentTab(next.dataset.agentTab); next.focus();
    };
}
for (const button of document.querySelectorAll("[data-starter]")) button.onclick = () => { input.value = button.dataset.starter; autosizeInput(); saveStudioDraft(); input.focus(); };
$("agent-access").onclick = () => showSideView("settings");

/* ---------- Projet FranceStudent des discussions ----------
 * Chaque nouvelle discussion est rattachée au projet choisi ici (même réglage que
 * /fr-project dans le CLI). La liste vient du compte : rien n'est inventé ni créé, et
 * un projet supprimé sur le site disparaît du sélecteur. */
let frProjectSelected = null;

function renderFrProjects(data, message = "") {
    const select = $("fr-project-select"), state = $("fr-project-state"), refresh = $("fr-project-refresh");
    if (!select) return;
    const projects = Array.isArray(data?.projects) ? data.projects : [];
    frProjectSelected = data?.selected ? { id: String(data.selected.id), name: String(data.selected.name) } : null;
    select.replaceChildren();
    if (state && data?.sharedUnavailable) {
        state.textContent = "Projets partagés indisponibles sur ce serveur ; seuls les projets personnels sont listés.";
    }
    const none = document.createElement("option");
    none.value = "";
    none.textContent = projects.length ? "Aucun projet" : "Aucun projet sur le site";
    select.appendChild(none);
    for (const project of projects) {
        const option = document.createElement("option");
        option.value = String(project.id);
        option.textContent = String(project.name || project.id);
        option.title = `Les nouvelles discussions iront dans « ${option.textContent} »`;
        select.appendChild(option);
    }
    select.value = frProjectSelected?.id || "";
    select.disabled = !projects.length;
    select.dataset.loaded = "1";
    if (state) {
        state.classList.toggle("error", /impossible|erreur|refus/i.test(message));
        state.textContent = message || (frProjectSelected
            ? `Les nouvelles discussions sont classées dans « ${frProjectSelected.name} ».`
            : "Sans projet : les discussions restent dans l’historique général.");
    }
    select.title = frProjectSelected
        ? `Nouvelles discussions dans « ${frProjectSelected.name} »`
        : "Choisis le projet FranceStudent des nouvelles discussions";
    if (refresh) refresh.disabled = false;
}

async function refreshFrProjects(message = "") {
    const select = $("fr-project-select"), state = $("fr-project-state"), refresh = $("fr-project-refresh");
    if (select) select.disabled = true;
    if (refresh) refresh.disabled = false;
    if (ui.status && ui.status.booted === false) {
        if (state) {
            state.classList.remove("error");
            state.textContent = "Connecte-toi pour classer tes discussions dans tes projets FranceStudent.";
        }
        if (select) {
            select.replaceChildren();
            const none = document.createElement("option");
            none.value = "";
            none.textContent = "Aucun projet";
            select.appendChild(none);
            select.value = "";
            select.disabled = true;
            delete select.dataset.loaded;
        }
        return;
    }
    if (refresh) refresh.disabled = true;
    if (state && !message) state.textContent = "Chargement de vos projets…";
    try {
        const result = await api.frProjects("list");
        renderFrProjects(result, message);
        if (state && Array.isArray(result?.projects) && result.projects.length === 0 && !result.sharedUnavailable && !result.selected) {
            state.textContent = "Aucun projet retourné par l’API. Vérifie le compte FranceStudent connecté et la liste sur le site.";
        }
    } catch (error) {
        if (state) {
            state.classList.add("error");
            const detail = String(error.message || "");
            const status = /^HTTP (\d{3})\b/i.exec(detail)?.[1];
            if (/Aucune session|Connexion impossible|HTTP 401|HTTP 403/i.test(detail)) {
                state.textContent = "Session de l’application refusée ou expirée. Vérifie ton compte dans les paramètres, puis réessaie ou reconnecte-toi.";
                if (typeof openConnectionGuide === "function") {
                    const login = document.createElement("button");
                    login.type = "button"; login.className = "fr-project-login"; login.textContent = "Se reconnecter";
                    login.addEventListener("click", () => openConnectionGuide());
                    state.append(" ", login);
                }
            } else if (status === "404") {
                state.textContent = "Le service des projets FranceStudent n’a pas été trouvé (HTTP 404).";
            } else if (status === "400" || status === "422") {
                state.textContent = `La requête des projets a été refusée (HTTP ${status}) : ${detail.slice(0, 180)}`;
            } else if (status) {
                state.textContent = `Le service des projets répond HTTP ${status}. Réessaie plus tard.`;
            } else {
                state.textContent = `Impossible de joindre le service des projets : ${detail.slice(0, 180)}`;
            }
        }
        if (select) select.disabled = true;
        if (refresh) refresh.disabled = false;
    }
}

function syncFrProject(project, booted = ui.status?.booted) {
    if (booted && !$("fr-project-select")?.dataset.loaded) {
        refreshFrProjects();
        return;
    }
    // Tant que la liste n'est pas chargée, le statut ne dit rien de plus qu'« aucun
    // projet » : inutile de relancer une requête à chaque poussée de statut.
    const select = $("fr-project-select");
    if (!select || !select.dataset.loaded) return;
    const next = project ? String(project.id) : "";
    if (select.value !== next) {
        refreshFrProjects();
        return;
    }
    frProjectSelected = project ? { id: next, name: String(project.name) } : null;
    if ($("fr-project-state")) {
        $("fr-project-state").classList.remove("error");
        $("fr-project-state").textContent = frProjectSelected
            ? `Les nouvelles discussions sont classées dans « ${frProjectSelected.name} ».`
            : "Sans projet : les discussions restent dans l’historique général.";
    }
}

$("fr-project-select")?.addEventListener("change", async (event) => {
    const id = event.target.value;
    const name = event.target.selectedOptions[0]?.textContent || "";
    try {
        const data = await api.frProjects("select", { id });
        renderFrProjects(data, id ? `Les nouvelles discussions iront dans « ${name} ».` : "Nouveau : plus de rattachement à un projet.");
    } catch (error) {
        $("fr-project-state").classList.add("error");
        $("fr-project-state").textContent = `Choix non enregistré : ${error.message}`;
        refreshFrProjects();
    }
});

$("fr-project-refresh")?.addEventListener("click", () => refreshFrProjects());
$("fr-project-open")?.addEventListener("click", () => {
    api.openExternal(typeof connectionOrigin === "string" ? `${connectionOrigin.replace(/\/$/, "")}/projects` : "https://ia.francestudent.org/projects").catch((error) => studioFeedback(error.message));
});
refreshFrProjects();
function setAgentFocus(active){
    const app = $("app"), button = $("agent-focus");
    const focused = active === true;
    if (focused) {
        app.dataset.focusGridColumns = app.style.gridTemplateColumns;
        app.dataset.focusGridRows = app.style.gridTemplateRows;
        app.dataset.focusTitlebar = app.style.getPropertyValue("--titlebar");
        app.dataset.focusLeft = app.style.getPropertyValue("--left");
        app.dataset.focusRight = app.style.getPropertyValue("--right");
        app.dataset.focusRail = app.style.getPropertyValue("--rail");
        app.style.gridTemplateColumns = "0 0 0 0 0 minmax(0, 1fr)";
        app.style.gridTemplateRows = "minmax(0, 1fr) 0";
        app.style.setProperty("--left", "0px"); app.style.setProperty("--right", "0px"); app.style.setProperty("--rail", "0px");
    }
    app.classList.toggle("focus-agent", focused);
    if (focused) {
        app.style.gridTemplateRows = app.classList.contains("chat-detached") ? "minmax(0, 1fr) 24px" : "minmax(0, 1fr) 0";
        app.style.setProperty("--titlebar", "0px");
    }
    const label = focused ? "Quitter le plein écran du chat" : "Agrandir le chat";
    button.setAttribute("aria-pressed",String(focused));button.setAttribute("aria-label",label);button.title=label;
    button.textContent=focused?"⤡":"⤢";
    if (!focused) {
        const columns = app.dataset.focusGridColumns || "";
        const rows = app.dataset.focusGridRows || "";
        const left = app.dataset.focusLeft || "", right = app.dataset.focusRight || "", rail = app.dataset.focusRail || "";
        delete app.dataset.focusGridColumns; delete app.dataset.focusGridRows;
        delete app.dataset.focusLeft; delete app.dataset.focusRight; delete app.dataset.focusRail;
        if (app.dataset.focusTitlebar) app.style.setProperty("--titlebar", app.dataset.focusTitlebar);
        else app.style.removeProperty("--titlebar");
        delete app.dataset.focusTitlebar;
        if (left) app.style.setProperty("--left", left); else app.style.removeProperty("--left");
        if (right) app.style.setProperty("--right", right); else app.style.removeProperty("--right");
        if (rail) app.style.setProperty("--rail", rail); else app.style.removeProperty("--rail");
        app.style.gridTemplateColumns = columns; app.style.gridTemplateRows = rows;
    }
}
$("agent-focus").onclick = () => setAgentFocus(!$("app").classList.contains("focus-agent"));
setAgentFocus(false);

/* ---------- Fenêtre du chat détachée ----------
 * Une vraie fenêtre système : on la place, on la redimensionne et on la déplace où l'on
 * veut (bords libres, multi-écrans), sans palier imposé. Elle affiche la même conversation
 * (même flux d'événements) et la grande fenêtre masque alors sa colonne pour éviter
 * tout doublon ou chevauchement. */
function setChatPinned(pinned) {
    $("app").classList.toggle("chat-detached", pinned === true);
    const button = $("agent-detach");
    if (!button) return;
    const label = pinned ? "Rattacher le chat à la fenêtre principale" : "Afficher le chat dans sa propre fenêtre (glisser pour le placer où vous voulez)";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(pinned === true));
    button.classList.toggle("active", pinned === true);
}

$("agent-hide")?.addEventListener("click", () => {
    // Masquer le chat libère tout l'espace pour le code ; Ctrl+Alt+A le fait revenir.
    $("app").classList.add("no-agent");
    saveLayout();
    if (typeof scheduleClampLayout === "function") scheduleClampLayout();
});

$("agent-detach")?.addEventListener("click", async () => {
    try {
        const state = await api.chatWindowAction($("app").classList.contains("chat-detached") ? "close" : "open");
        setChatPinned(state && state.open === true);
    } catch (error) { studioFeedback(error.message); }
});

api.chatWindowAction("state").then(state => setChatPinned(state && state.open === true)).catch(() => {});

if (api.chatWindow) {
    // Cette fenêtre EST le chat détaché : pas de superflu autour, juste le panneau agent.
    $("app").classList.add("chat-only");
    api.setChatWindowPinned(true);
    window.addEventListener("beforeunload", () => api.setChatWindowPinned(false));
}

$("activity-refresh").onclick = refreshStudioActivity;
// « Outils du chat » : le panneau ne s'ouvre qu'au clic explicite (bouton ⋯ ou "…").
// Il était visible au lancement et recouvrait la conversation, l'en-tête et le sélecteur
// de projet — d'où les superpositions signalées.
const favoritesPanel = $("agent-favorites");
favoritesPanel?.classList.add("hidden");
function closeFavorites() { favoritesPanel?.classList.add("hidden"); }
$("favorite-open").addEventListener("click", () => {
    renderFavoritePrompts();
    favoritesPanel.classList.toggle("hidden");
});
document.addEventListener("pointerdown", (event) => {
    if (!favoritesPanel || favoritesPanel.classList.contains("hidden")) return;
    if (favoritesPanel.contains(event.target) || event.target.closest("#favorite-open")) return;
    closeFavorites();
}, true);
window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeFavorites(); }, true);
$("favorite-close").onclick = () => $("agent-favorites").classList.add("hidden");
$("draft-save-favorite").onclick = () => {
    const prompt = input.value.trim();
    if (!prompt) { studioFeedback("Écris un prompt avant de l’enregistrer."); return; }
    if (favoritePrompts.length >= 30) { studioFeedback("Tu as déjà 30 favoris. Retire un favori pour en ajouter un."); return; }
    favoritePrompts.unshift({ title: prompt.replace(/\s+/g, " ").slice(0, 55), prompt: prompt.slice(0, 30000) });
    writeStudioStorage("frst.prompt-favorites", favoritePrompts); studioFeedback("Prompt enregistré en favori.");
};
$("conversation-export").onclick = () => api.exportConversation(exportStudioMarkdown()).then(result => studioFeedback(result.canceled ? "Export annulé." : "Conversation exportée.")).catch(error => studioFeedback(error.message));
input.addEventListener("input", saveStudioDraft);
window.addEventListener("beforeunload", saveStudioDraft);
transcript.addEventListener("click", event => {
    const link = event.target.closest("a[data-web-url]");
    if (link) { event.preventDefault(); api.openExternal(link.dataset.webUrl).catch(error => studioFeedback(error.message)); }
});
setInterval(() => { if (studioTab === "activity" && !document.hidden) refreshStudioActivity(); }, 3000);

// L'état arrive par le statut (chatPinned) : la colonne se rétablit aussi au redémarrage.
setAgentTab("conversation");
