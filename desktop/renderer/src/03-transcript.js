/* ---------- Transcript ---------- */

function scrollDown() {
    if(ui.replayingConversation)return;
    transcript.scrollTop = transcript.scrollHeight;
}

const QUIET_TOOLS = new Set(["read_file", "search_files", "list_directory"]);
let toolGroup = null;
let livePaintTimer = null;

function renderAssistantText(text) {
    const value = String(text ?? "");
    // Large replies remain complete, but avoid expensive Markdown highlighting.
    return value.length > 64000 ? `<div class="fs-long-message">${escapeHtml(value)}</div>` : renderMarkdown(value);
}

function toolRowHtml(e) {
    return `<span class="tdot"></span><span class="name">${escapeHtml(toolLabel(e.name))}</span><span class="arg" title="${escapeHtml(e.arg || "")}">${escapeHtml(e.arg || "")}</span>`;
}

function plural(n, word) {
    return `${n} ${word}${n > 1 ? "s" : ""}`;
}

/** Lectures, recherches et listes successives : une seule ligne repliable. */
function addQuietTool(e) {
    if (!toolGroup) {
        const el = addEntry("tool-group", "<details><summary></summary><div class=\"tool-group-body\"></div></details>");
        toolGroup = { el, summary: el.querySelector("summary"), body: el.querySelector(".tool-group-body"), reads: 0, searches: 0, lists: 0, awaitingResult: false };
    }
    const g = toolGroup;
    if (e.name === "read_file") g.reads++;
    else if (e.name === "search_files") g.searches++;
    else g.lists++;
    const parts = [];
    if (g.reads) parts.push(plural(g.reads, "lecture"));
    if (g.searches) parts.push(plural(g.searches, "recherche"));
    if (g.lists) parts.push(`${plural(g.lists, "dossier")} listé${g.lists > 1 ? "s" : ""}`);
    g.summary.textContent = parts.join(" · ");
    const row = document.createElement("div");
    row.className = "entry tool";
    row.innerHTML = toolRowHtml(e);
    g.body.appendChild(row);
    g.awaitingResult = true;
    scrollDown();
    return row;
}

function addEntry(cls, html) {
    toolGroup = null;
    // La première trace de réponse remplace l'indicateur de réflexion. Une entrée
    // rejouée depuis l'historique, elle, apparaît sans mouvement.
    if (!/^(tool|result|tool-group)/.test(cls)) hideThinkingIndicator();
    const div = document.createElement("div");
    div.className = `entry ${cls}`;
    // L'entrée doit exister avant l'ajout de la classe, sinon l'historique rechargé s'anime.
    if (ui.replayingConversation) div.classList.add("is-replayed");
    div.innerHTML = html;
    transcript.appendChild(div);
    scrollDown();
    return div;
}

function appendOutput(text) {
    output.textContent += `${text}\n`;
    if (output.textContent.length > 200000) output.textContent = output.textContent.slice(-150000);
    output.scrollTop = output.scrollHeight;
}

function renderEntry(e) {
    recordStudioEntry(e);
    if(["info","warn","error"].includes(e.type)){
        const budget=parseBudgetNotice(e.text);
        if(budget){
            if(e.type==="error")$("agent-starter").classList.add("hidden");
            return renderBudgetEntry(budget,e.text,{projectSummary:/Résumé IA indisponible/i.test(String(e.text||""))});
        }
    }
    const sessionPrivacyNotice = e.type === "warn" && /^Le contenu du projet \(fichiers, RESUME\.md\) est envoyé à ton fournisseur API\./.test(String(e.text || ""));
    if (sessionPrivacyNotice || e.type === "info" && /^(?:Connecté \(le token|Projet : |Projet FranceStudent : |Projet existant : |Mémoire : |Résumé du projet |Index local du projet |R[ÉE]SUM[ÉE]\.md |Nouveau projet enregistré)/.test(String(e.text || ""))) {
        let group = transcript.querySelector(".session-notices");
        if (!group) group = addEntry("session-notices", "<details><summary>Informations de session</summary><div class=\"chat-session-lines\"></div></details>");
        const line = document.createElement("div"); line.className = "chat-session-line"; line.textContent = e.text;
        if (sessionPrivacyNotice) { line.classList.add("session-privacy-line"); group.querySelector("summary").textContent = "Session et données transmises"; }
        group.querySelector(".chat-session-lines").append(line);
        return group;
    }
    switch (e.type) {
        case "welcome":
            return null;
        case "user":
            $("agent-starter").classList.add("hidden");
            return addEntry("user", `<div class="message-content">${escapeHtml(e.text)}</div>`);
        case "assistant": {
            $("agent-starter").classList.add("hidden");
            const message = addEntry("assistant", `<div class="message-content">${renderAssistantText(e.text)}</div>`);
            const actions = document.createElement("div");
            actions.className = "message-actions";
            const copy = document.createElement("button");
            copy.type = "button"; copy.textContent = "Copier";
            copy.onclick = () => api.copyText(e.text).then(() => { copy.textContent = "Copié ✓"; }).catch(error => studioFeedback(error.message));
            actions.appendChild(copy); message.appendChild(actions);
            attachServerControls(message, e.text);
            return message;
        }
        case "reason": {
            const el = addEntry("reason collapsed", `<span class="reason-mark">✻</span><span class="reason-text">${inline(e.text)}</span>`);
            el.title = "Cliquer pour déplier ou replier la réflexion";
            el.onclick = () => {
                if (!String(window.getSelection())) el.classList.toggle("collapsed");
            };
            return el;
        }
        case "info":
        case "warn":
        case "error": {
            if (e.type === "error") {
                $("agent-starter").classList.add("hidden");
                // Toute erreur reçue du service rejoint le panneau « Logs », lisible d'un seul endroit.
                if (typeof recordLog === "function") recordLog({ type: "error", source: "agent", text: e.text });
                const context=parseContextLimitNotice(e.text);
                if(context)return renderContextLimitEntry(context,e.text);
                const apiError=parseApiErrorNotice(e.text);
                if(apiError)return renderApiErrorEntry(apiError,e.text);
            } else if (e.type === "warn" && typeof recordLog === "function") {
                recordLog({ type: "warn", source: "agent", text: e.text });
            }
            return addEntry(e.type, escapeHtml(e.text));
        }
        case "print":
            return addEntry("print", `<pre>${escapeHtml((e.lines || []).join("\n"))}</pre>`);
        case "plan":
            renderWorkPlan(Array.isArray(e.steps) ? e.steps : workPlanItems(e.items), { status: e.replayed ? "history" : "running" });
            return null;
        case "tool":
            if (e.name === "run_command") appendOutput(`$ ${e.arg}`);
            if (QUIET_TOOLS.has(e.name)) return addQuietTool(e);
            return addEntry("tool", toolRowHtml(e));
        case "result": {
            if (toolGroup && toolGroup.awaitingResult) {
                const row = document.createElement("div");
                row.className = `entry result ${e.tone || ""}`;
                row.textContent = `└ ${e.text}`;
                toolGroup.body.appendChild(row);
                toolGroup.awaitingResult = false;
                if (e.tone === "error" || e.tone === "err") {
                    toolGroup.el.classList.add("has-error");
                    if (typeof recordLog === "function") recordLog({ type: "error", source: "outil", text: e.text });
                }
                scrollDown();
                return row;
            }
            return addEntry(`result ${e.tone || ""}`, `└ ${escapeHtml(e.text)}`);
        }
        case "diff": {
            const el = addEntry("diff-entry", "");
            el.appendChild(buildDiffCard(e));
            if (e.path) recordChange(e.path, e.added, e.removed);
            return el;
        }
        default:
            return addEntry("info", escapeHtml(JSON.stringify(e)));
    }
}

function liveStart() {
    liveEnd();
    hideThinkingIndicator();
    ui.liveText = "";
    ui.live = addEntry("assistant", "");
    ui.live.classList?.add("is-live");
}

function paintLiveMessage() {
    livePaintTimer = null;
    if (!ui.live?.isConnected) return;
    ui.live.innerHTML = renderAssistantText(ui.liveText);
    scrollDown();
}

function liveAppend(text) {
    if (!ui.live) liveStart();
    ui.liveText += text;
    if (livePaintTimer === null) livePaintTimer = setTimeout(paintLiveMessage, 80);
}

function liveEnd() {
    if (livePaintTimer !== null) clearTimeout(livePaintTimer);
    paintLiveMessage();
    if (ui.live?.isConnected && ui.liveText) {
        ui.live.classList?.remove("is-live");
        attachServerControls(ui.live, ui.liveText);
    }
    ui.live = null;
    ui.liveText = "";
}

function setSpinner(data) {
    if (data.stop) {
        if (ui.spinnerId === data.id) {
            $("spinner").classList.add("hidden");
            hideThinkingIndicator();
            stopThinkingRhythm();
            ui.spinnerId = null;
            ui.spinnerStart = 0;
            if (ui.spinnerTimer) clearInterval(ui.spinnerTimer);
            ui.spinnerTimer = null;
        }
        return;
    }
    if (ui.spinnerId !== data.id || !ui.spinnerStart) ui.spinnerStart = Date.now();
    ui.spinnerId = data.id;
    ui.spinnerLabel = data.label || "";
    const paint = () => {
        const secs = Math.floor((Date.now() - ui.spinnerStart) / 1000);
        const elapsed = secs >= 60 ? `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, "0")} s` : `${secs} s`;
        $("spinner-label").textContent = ui.spinnerLabel ? `${ui.spinnerLabel} · ${elapsed}` : elapsed;
    };
    paint();
    if (!ui.spinnerTimer) ui.spinnerTimer = setInterval(() => { if (ui.spinnerId) paint(); }, 1000);
    $("spinner").classList.remove("hidden");
    showThinkingIndicator(data.label);
    startThinkingRhythm();
}

/* « L'agent réfléchit » : une ligne vivante au bas du transcript, tant que le
 * travail dure. Elle disparaît dès que le premier mot de la réponse arrive. */
const THINKING_PHRASES = ["Il réfléchit", "Il prépare une réponse", "Il vérifie le contexte"];

function hideThinkingIndicator() {
    const indicator = typeof $ === "function" ? $("chat-thinking") : null;
    if (!indicator) return;
    indicator.classList.add("leaving");
    setTimeout(() => indicator.remove(), 220);
}

function showThinkingIndicator(label) {
    const transcriptEl = typeof $ === "function" ? $("transcript") : null;
    if (!transcriptEl) return;
    let indicator = $("chat-thinking");
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "chat-thinking";
        indicator.className = "chat-thinking";
        indicator.setAttribute("role", "status");
        indicator.innerHTML = '<span class="chat-thinking-dots"><i></i><i></i><i></i></span><span class="chat-thinking-text"></span>';
        transcriptEl.appendChild(indicator);
    }
    indicator.classList.remove("leaving");
    const text = String(label || "").replace(/\s*·\s*\d+\s*s\s*$/, "").trim();
    // Sans libellé, on alterne doucement les formules ; avec libellé, on le garde tel quel.
    const phrase = text || THINKING_PHRASES[Math.floor((Date.now() - (ui.spinnerStart || Date.now())) / 4000) % THINKING_PHRASES.length];
    indicator.querySelector(".chat-thinking-text").textContent = String(phrase).endsWith("…") ? phrase : `${phrase}…`;
    scrollDown();
}

/* Toutes les 4 secondes, la formule change : la réflexion reste lisible sans être usante.
 * La boucle est demandée à la page et non créée au chargement, pour qu'aucun minuteur
 * ne reste actif quand l'agent est au repos. */
function startThinkingRhythm() {
    if (ui.thinkingTimer) return;
    ui.thinkingTimer = setInterval(() => {
        if (!ui.spinnerId || ui.spinnerLabel) return;
        showThinkingIndicator("");
    }, 4000);
    ui.thinkingTimer?.unref?.();
}

function stopThinkingRhythm() {
    if (!ui.thinkingTimer) return;
    clearInterval(ui.thinkingTimer);
    ui.thinkingTimer = null;
}

