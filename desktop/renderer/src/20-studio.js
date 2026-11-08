/* ---------- Espace agent : activité, sources, favoris et brouillons ---------- */
const studioEntries = [];
let studioRun = null;
let studioWorkspace = undefined;
let studioTab = "conversation";
let studioActivitySeq = 0;
let favoritePrompts = readStudioStorage("frst.prompt-favorites", []);
if (!Array.isArray(favoritePrompts)) favoritePrompts = [];
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
function studioDraftKey(workspace) {return `frst.draft:${workspace || "global"}`;}
function saveStudioDraft() {
    if (studioWorkspace !== undefined) writeStudioStorage(studioDraftKey(studioWorkspace), input.value);
}
function setAgentTab(tab) {
    studioTab = ["conversation", "backups", "activity", "usage"].includes(tab) ? tab : "conversation";
    $("agent").dataset.tab = studioTab;
    for (const button of document.querySelectorAll("[data-agent-tab]")) {
        const selected = button.dataset.agentTab === studioTab;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    if (studioTab === "activity" || studioTab === "backups") refreshStudioActivity();
    if (studioTab === "usage") { renderUsageDashboard(); refreshQuota(); }
}
function updateStudioStatus(status) {
    const workspace = status.workspace || null;
    updateAgentProjectLabel(workspace);
    $("agent-fr-project").disabled = Boolean(status.busy);
    $("agent-fr-project-create").disabled = Boolean(status.busy);
    $("agent-fr-project-chats").disabled = Boolean(status.busy) || !$("agent-fr-project").value;
    $("agent-access").textContent = status.fullAccess ? "Full accès" : status.autoApprove && status.autoApproveCommands ? "Automatique" : "Sur approbation";
    $("agent-access").classList.toggle("full-access", Boolean(status.fullAccess));
    if (studioWorkspace !== workspace) {
        saveStudioDraft();
        studioWorkspace = workspace;
        studioActivitySeq++;
        $("activity-checkpoints").replaceChildren();
        if (studioTab === "activity" || studioTab === "backups") refreshStudioActivity();
        input.value = readStudioStorage(studioDraftKey(workspace), "");
        autosizeInput();
        if (studioRun && studioRun.workspace !== workspace) { studioRun = null; renderAgentActivity(null); }
    }
}
function updateAgentProjectLabel(workspace=ui.workspace){
    const label=workspace?workspace.replace(/[\\/]+$/, "").split(/[\\/]/).pop():"Aucun projet";
    $("agent-project-name").textContent=label;
    $("agent-project-name").title=workspace || "Ouvre un dossier pour travailler sur un projet";
}

let franceStudentProjects = [];

function setFranceStudentProjectState(message, error = false) {
    const status = $("agent-fr-project-state");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", Boolean(error));
}

function renderFranceStudentProjects(data) {
    const select = $("agent-fr-project");
    if (!select) return;
    franceStudentProjects = Array.isArray(data?.projects) ? data.projects.filter(project => project?.id) : franceStudentProjects;
    const selected = data?.selected || null;
    select.replaceChildren(new Option("Aucun projet (historique général)", ""));
    for (const project of franceStudentProjects) {
        const option = new Option(String(project.name || "Projet sans nom"), String(project.id));
        select.appendChild(option);
    }
    if (selected?.id && !franceStudentProjects.some(project => String(project.id) === String(selected.id))) {
        select.appendChild(new Option(String(selected.name || "Projet FranceStudent"), String(selected.id)));
    }
    select.value = selected?.id ? String(selected.id) : "";
    const selectedProject = franceStudentProjects.find(project => String(project.id) === select.value) || selected;
    const chatsButton = $("agent-fr-project-chats");
    select.disabled = Boolean(ui.status.busy);
    $("agent-fr-project-create").disabled = Boolean(ui.status.busy);
    chatsButton.disabled = Boolean(ui.status.busy) || !select.value;
    chatsButton.title = select.value ? "Ouvrir une discussion de ce projet" : "Choisis un projet pour voir ses discussions";
    select.title = select.value
        ? `Les nouvelles discussions seront classées dans « ${selectedProject?.name || "Projet FranceStudent"} »`
        : "Choisis le projet FranceStudent des nouvelles discussions";
    setFranceStudentProjectState(select.value
        ? `Les nouvelles discussions sont classées dans « ${selectedProject?.name || "Projet FranceStudent"} ».`
        : "Sans projet : les discussions restent dans l’historique général.");
    if (data?.forgotten !== undefined) {
        setFranceStudentProjectState(`Le projet « ${data.forgotten || "mémorisé"} » n’existe plus ou n’est plus accessible. Sans projet : les discussions restent dans l’historique général.`, true);
    }
}

function syncFranceStudentProjectSelection(selected) {
    const select = $("agent-fr-project");
    if (!select || !Array.isArray(franceStudentProjects)) return;
    renderFranceStudentProjects({ projects: franceStudentProjects, selected });
}

async function refreshFranceStudentProjects() {
    const data = await api.franceStudentProjects("list");
    renderFranceStudentProjects(data);
    return data;
}

$("agent-fr-project-refresh").onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    setFranceStudentProjectState("Actualisation des projets FranceStudent…");
    try {
        await refreshFranceStudentProjects();
    } catch (error) {
        setFranceStudentProjectState(`Impossible d’actualiser les projets : ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
};

$("agent-fr-project").addEventListener("change", async event => {
    const select = event.currentTarget;
    select.disabled = true;
    try {
        const data = await api.franceStudentProjects(select.value ? "select" : "clear", select.value ? { id: select.value } : {});
        renderFranceStudentProjects(data);
        applyStatus(await api.status());
        studioFeedback(data.selected
            ? `Les nouvelles discussions seront classées dans « ${data.selected.name} ».`
            : "Les nouvelles discussions ne seront rattachées à aucun projet FranceStudent.");
    } catch (error) {
        studioFeedback(error.message);
        syncFranceStudentProjectSelection(ui.status.frProject || null);
        try { await refreshFranceStudentProjects(); }
        catch (refreshError) { setFranceStudentProjectState(`Impossible d’actualiser les projets : ${refreshError.message}`, true); }
    } finally {
        select.disabled = Boolean(ui.status.busy);
    }
});

function openFranceStudentProjectDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "center-dialog";
    dialog.innerHTML = '<form method="dialog"><div class="center-dialog-head"><h2>Créer un projet FranceStudent</h2><button type="button" data-close>Fermer</button></div><p class="history-intro">Donne un nom à ce groupe de conversations. Il sera créé dans FranceStudent.</p><label class="center-code-label">Nom du projet<input name="name" required maxlength="255" autocomplete="off" placeholder="Mon projet Roblox"></label><p class="studio-message" data-error role="status"></p><div class="center-dialog-actions"><button type="button" data-cancel>Annuler</button><button type="submit" class="primary">Créer et sélectionner</button></div></form>';
    const form = dialog.querySelector("form");
    const nameInput = form.elements.name;
    const error = dialog.querySelector("[data-error]");
    const close = () => { if (dialog.open) dialog.close(); };
    dialog.querySelector("[data-close]").onclick = close;
    dialog.querySelector("[data-cancel]").onclick = close;
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        error.textContent = "Création en cours…";
        try {
            const data = await api.franceStudentProjects("create", { name });
            renderFranceStudentProjects(data);
            close();
            applyStatus(await api.status());
            studioFeedback(data.created
                ? `Projet « ${data.selected.name} » créé. Les nouvelles discussions y seront classées.`
                : `Projet « ${data.selected.name} » sélectionné.`);
        } catch (createError) {
            error.textContent = createError.message;
            submit.disabled = false;
        }
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
    nameInput.focus();
}

$("agent-fr-project-create").onclick = openFranceStudentProjectDialog;

async function openFranceStudentProjectChats() {
    const projectId = $("agent-fr-project").value;
    if (!projectId) {
        studioFeedback("Choisis d’abord un projet FranceStudent.");
        return;
    }
    const project = franceStudentProjects.find(item => String(item.id) === projectId);
    const dialog = document.createElement("dialog");
    dialog.className = "center-dialog fs-project-chats-dialog";
    const heading = document.createElement("div");
    heading.className = "center-dialog-head";
    const title = document.createElement("h2");
    title.textContent = "Discussions du projet";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Fermer";
    heading.append(title, close);
    const description = document.createElement("p");
    description.className = "history-intro";
    description.textContent = `Reprends une conversation de « ${project?.name || "Projet FranceStudent"} ».`;
    const status = document.createElement("p");
    status.className = "settings-help";
    status.setAttribute("role", "status");
    const list = document.createElement("div");
    list.className = "fs-project-chat-list";
    const more = document.createElement("button");
    more.type = "button";
    more.className = "history-open";
    more.textContent = "Charger plus";
    more.hidden = true;
    dialog.append(heading, description, status, list, more);
    const previous = document.activeElement;
    dialog.addEventListener("close", () => {
        dialog.remove();
        requestAnimationFrame(() => { if (previous?.isConnected) previous.focus(); });
    }, { once: true });
    close.onclick = () => dialog.close();
    let cursor = "";
    const load = async () => {
        more.disabled = true;
        status.textContent = "Chargement des discussions…";
        try {
            const data = await api.franceStudentProjects("chats", { id: projectId, limit: 30, cursorChatId: cursor });
            const chats = Array.isArray(data?.chats) ? data.chats : [];
            for (const chat of chats) {
                const id = String(chat?.id || chat?.chatId || "");
                if (!id) continue;
                const item = document.createElement("button");
                item.type = "button";
                item.className = "fs-project-chat-item";
                const updated = chat.updatedAt || chat.updated_at || chat.lastMessageAt || chat.createdAt || chat.created_at;
                const date = updated && !Number.isNaN(new Date(updated).getTime())
                    ? new Date(updated).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "";
                const chatTitle = document.createElement("strong");
                chatTitle.textContent = chat.title || chat.name || chat.chatName || "Discussion sans titre";
                const detail = document.createElement("span");
                detail.textContent = [date, chat.model].filter(Boolean).join(" · ") || `ID ${id}`;
                item.append(chatTitle, detail);
                item.title = `Reprendre cette discussion (${id})`;
                item.onclick = async () => {
                    if (ui.status.busy) {
                        studioFeedback("Une demande est en cours : attends sa fin avant de changer de conversation.");
                        return;
                    }
                    dialog.close();
                    try {
                        await api.conversationsOpen(id);
                        setAgentTab("conversation");
                    } catch (error) {
                        studioFeedback(error.message);
                    }
                };
                list.appendChild(item);
            }
            const last = chats.at(-1);
            cursor = last ? String(last.id || last.chatId || "") : "";
            more.hidden = !data?.hasMore || !cursor;
            status.textContent = list.children.length ? "" : "Aucune discussion dans ce projet pour l’instant.";
        } catch (error) {
            status.textContent = `Impossible de charger les discussions : ${error.message}`;
        } finally {
            more.disabled = false;
        }
    };
    more.onclick = load;
    document.body.appendChild(dialog);
    dialog.showModal();
    await load();
}

$("agent-fr-project-chats").onclick = () => openFranceStudentProjectChats();
function recordStudioEntry(entry) {
    if (entry.type === "user" && /^\/new\b/.test(entry.text || "")) studioEntries.length = 0;
    if (["user", "assistant", "tool", "result", "error", "warn", "plan"].includes(entry.type)) {
        studioEntries.push({ ...entry, at: new Date().toISOString() });
        if (studioEntries.length > 3000) studioEntries.shift();
    }
}
function exportStudioMarkdown() {
    const header = `# Conversation FranceStudent\n\nProjet : ${studioWorkspace || "Aucun"}\nExport : ${new Date().toISOString()}\n\n`;
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
    if(run && run.workspace!==ui.workspace)run=null;
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
        const [run, jobs, checkpoints] = await Promise.all([api.agentActivity(), api.backgroundJobs("list"), api.checkpoints("list")]);
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
        if (!checkpoints.length) emptyStudioText(pointsHost, "Les versions disponibles apparaîtront ici après une demande à l’agent.");
        for (const point of checkpoints) {
            const row = document.createElement("div"); row.className = "workspace-item";
            const label = document.createElement("div"); label.textContent = point.task || "Version sans titre";
            const time = document.createElement("small"); time.textContent = `${new Date(point.at).toLocaleString("fr-FR")} · ${point.kind === "safety" ? "Sécurité avant restauration" : "Avant la demande"}`;
            const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Voir et restaurer"; restore.disabled = Boolean(ui.status.busy);
            restore.onclick = async () => {
                if (ui.tabs.some(tab => tab.dirty)) { studioFeedback("Enregistre tous les fichiers ouverts avant de restaurer une version."); return; }
                restore.disabled = true;
                try {
                    const preview = await api.checkpoints("preview", point.id);
                    if (!preview.changes.length) { studioFeedback("Les fichiers suivis correspondent déjà à cette version."); return; }
                    if (preview.changes.length > 100) { studioFeedback("Plus de 100 fichiers diffèrent : restauration désactivée pour éviter un aperçu incomplet."); return; }
                    const details = preview.changes.map(change => `${change.action} : ${change.path}`).join("\n");
                    const excluded = preview.excludedPaths || [];
                    const excludedDetails = excluded.length ? `\n\nChemins exclus (${excluded.length}) :\n${excluded.slice(0, 20).join("\n")}${excluded.length > 20 ? `\n… et ${excluded.length - 20} autre(s).` : ""}` : "";
                    const message = `Revenir à l’état précédant « ${point.task} » ?\n\n${details}\n\nTous les changements listés depuis cette version seront annulés, y compris tes modifications manuelles et celles des demandes suivantes. Les fichiers marqués « retirer » seront supprimés. Une version de sécurité sera créée avant la restauration.${excludedDetails}\n\nLes chemins exclus et les actions externes ne sont pas restaurés.`;
                    if (!await confirmStudioAction(message, { title: "Restaurer une version", confirmLabel: "Restaurer", danger: true })) return;
                    if (ui.tabs.some(tab => tab.dirty)) throw new Error("Enregistre tous les fichiers ouverts avant de restaurer une version.");
                    const workspace = ui.workspace;
                    const result = await api.checkpoints("restore", point.id, preview.expected);
                    let dirtyRemoved = false;
                    if (ui.workspace === workspace) {
                        for (const change of preview.changes.filter(item => item.action === "retirer")) {
                            const tab = ui.tabs.find(item => item.path === change.path);
                            if (!tab) continue;
                            if (tab.dirty) { dirtyRemoved = true; continue; }
                            await closeTab(tab.path);
                        }
                    }
                    studioFeedback(`${result.restored} fichier(s) restauré(s).${dirtyRemoved ? " Un onglet modifié reste ouvert alors que son fichier a été retiré : vérifie son contenu avant de l’enregistrer." : ""}`);
                    scheduleRefresh(); refreshStudioActivity();
                } catch (error) { studioFeedback(error.message); scheduleRefresh(); refreshStudioActivity(); }
                finally { restore.disabled = Boolean(ui.status.busy); }
            };
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Supprimer la version"; remove.disabled = Boolean(ui.status.busy);
            remove.onclick = async () => {
                if (!await confirmStudioAction(`Supprimer définitivement la version « ${point.task || "sans titre"} » ? Les fichiers actuels ne seront pas modifiés.`, { title: "Supprimer une version", confirmLabel: "Supprimer", danger: true })) return;
                remove.disabled = true;
                try { await api.checkpoints("remove", point.id); studioFeedback("Version supprimée."); await refreshStudioActivity(); }
                catch (error) { studioFeedback(error.message); }
                finally { remove.disabled = Boolean(ui.status.busy); }
            };
            row.append(label, time, restore, remove); pointsHost.appendChild(row);
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
function setAgentFocus(active){
    $("app").classList.toggle("focus-agent",active);
    const button=$("agent-focus"),label=active?"Quitter le plein écran du chat":"Agrandir le chat";
    button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",label);button.title=label;
    button.textContent=active?"⤡":"⤢";
}
$("agent-focus").onclick = () => setAgentFocus(!$("app").classList.contains("focus-agent"));
setAgentFocus(false);
$("activity-refresh").onclick = refreshStudioActivity;
$("backups-refresh").onclick = refreshStudioActivity;
$("favorite-open").onclick = () => { renderFavoritePrompts(); $("agent-favorites").classList.toggle("hidden"); };
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
setInterval(() => { if ((studioTab === "activity" || studioTab === "backups") && !document.hidden) refreshStudioActivity(); }, 3000);
setAgentTab("conversation");
