/* ---------- Explorateur Roblox Studio (arbre de scène Rojo) ----------
   Lit default.project.json côté processus principal (lecture seule) et affiche les services
   comme Roblox Studio : Workspace, ReplicatedStorage, ServerScriptService… Chaque feuille
   ouvre le fichier réel du projet au clic. */

ui.robloxTree = ui.robloxTree || { loading: false, data: null, error: null, seq: 0 };
ui.showRobloxTree = false;
const rojoTreeOpen = new Set();

const SERVICE_CLASS = {
    Workspace: "W", Players: "P", Lighting: "L", ReplicatedFirst: "RF", ReplicatedStorage: "RS",
    ServerScriptService: "SSS", ServerStorage: "SS", StarterGui: "SG", StarterPack: "SP",
    StarterPlayer: "StP", SoundService: "So", Teams: "T"
};
const CLASS_TAGS = {
    Script: "S", LocalScript: "LS", ModuleScript: "M", Folder: "▤", Model: "◈",
    Workspace: "▣", Configuration: "⚙"
};

function robloxClassTag(className) {
    return CLASS_TAGS[className] || SERVICE_CLASS[className] || "•";
}

async function refreshRobloxTree() {
    const host = $("roblox-tree");
    if (!host) return;
    if (!ui.workspace) {
        host.innerHTML = '<p class="muted">Ouvre un dossier pour voir la scène Roblox.</p>';
        $("roblox-packages")?.classList.add("hidden");
        return;
    }
    const seq = ++ui.robloxTree.seq;
    if (!ui.robloxTree.data) host.innerHTML = '<p class="muted">Lecture du projet Rojo…</p>';
    try {
        const data = await api.robloxTree();
        if (seq !== ui.robloxTree.seq) return;
        ui.robloxTree = { ...ui.robloxTree, data, error: null };
    } catch (error) {
        if (seq !== ui.robloxTree.seq) return;
        ui.robloxTree = { ...ui.robloxTree, data: null, error: error.message };
    }
    renderRobloxTree();
}

function renderRobloxTree() {
    const host = $("roblox-tree");
    if (!host) return;
    const data = ui.robloxTree.data;
    host.replaceChildren();
    $("roblox-packages").classList.add("hidden");
    if (ui.robloxTree.error) {
        const line = document.createElement("p");
        line.className = "muted";
        line.textContent = ui.robloxTree.error;
        host.appendChild(line);
        return;
    }
    if (!data) return;
    if (!data.project) {
        const line = document.createElement("p");
        line.className = "muted";
        line.textContent = (data.warnings && data.warnings[0]) || "Aucun projet Rojo détecté.";
        host.appendChild(line);
        return;
    }
    const title = document.createElement("p");
    title.className = "roblox-tree-project";
    title.textContent = `${data.name || "Jeu"} · ${data.project}`;
    title.title = "Arbre lu depuis default.project.json (aucune modification)";
    host.appendChild(title);

    for (const service of data.services || []) {
        host.appendChild(robloxTreeNode(service, 0, true));
    }
    if (data.warnings?.length) {
        const warn = document.createElement("p");
        warn.className = "roblox-tree-warning";
        warn.textContent = `${data.warnings.length} fichier(s) hors service : ${data.warnings[0]}`;
        warn.title = data.warnings.join("\n");
        host.appendChild(warn);
    }
    renderRobloxPackages();
}

function robloxTreeNode(node, depth, isService = false) {
    const key = `${isService ? "s:" : "n:"}${node.name}@${node.path || ""}`;
    const row = document.createElement("div");
    row.className = "node roblox-node" + (node.path && node.path === ui.active ? " selected" : "");
    row.style.paddingLeft = `${6 + depth * 12}px`;
    row.dataset.robloxPath = node.path || "";
    row.title = node.path ? `${node.className} · ${node.path}` : node.className;

    const children = Array.isArray(node.children) ? node.children : [];
    const open = rojoTreeOpen.has(key);
    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = children.length ? (open ? "▾" : "▸") : "";
    const icon = document.createElement("span");
    icon.className = "ficon roblox-class";
    icon.dataset.class = isService ? "service" : node.className;
    icon.textContent = robloxClassTag(isService ? node.name : node.className);
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = node.name;
    row.append(twisty, icon, label);

    const wrap = document.createElement("div");
    wrap.className = "roblox-node-wrap";
    wrap.appendChild(row);

    const openable = Boolean(node.path && (node.init || !children.length));
    row.onclick = () => {
        if (children.length) {
            if (open) rojoTreeOpen.delete(key);
            else rojoTreeOpen.add(key);
            renderRobloxTree();
            return;
        }
        if (openable) openFile(node.path);
    };
    if (node.path) {
        row.oncontextmenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
            showContextMenu(event, { name: node.name, path: node.path, type: "file" });
        };
    }

    if (open && children.length) {
        const nested = document.createElement("div");
        nested.className = "roblox-children";
        for (const child of children) nested.appendChild(robloxTreeNode(child, depth + 1));
        wrap.appendChild(nested);
    }
    if (node.missing) {
        const missing = document.createElement("span");
        missing.className = "mod-mark";
        missing.textContent = "!";
        missing.title = "Chemin déclaré dans default.project.json mais absent du disque.";
        row.appendChild(missing);
    }
    return wrap;
}

/* Paquets Wally indexés pour la complétion (Packages / ServerPackages). */
function renderRobloxPackages() {
    const host = $("roblox-packages");
    if (!host) return;
    api.wallyAction("status").then((state) => {
        if (!ui.workspace) return;
        host.replaceChildren();
        if (!state.manifest && !state.packages.length) {
            host.classList.add("hidden");
            return;
        }
        host.classList.remove("hidden");
        const head = document.createElement("div");
        head.className = "roblox-packages-head";
        const title = document.createElement("strong");
        title.textContent = `Wally · ${state.packages.length} paquet(s)`;
        title.title = state.message || "";
        const actions = document.createElement("span");
        actions.className = "roblox-tree-actions";
        for (const [action, label, hint] of [["install", "Installer", "wally install"], ["update", "Mettre à jour", "wally update"]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.title = hint;
            button.disabled = !state.binary;
            button.onclick = () => runWally(button, action);
            actions.appendChild(button);
        }
        head.append(title, actions);
        host.appendChild(head);
        if (!state.binary) {
            const note = document.createElement("p");
            note.className = "muted";
            note.textContent = "wally absent : aftman add UpliftGames/wally";
            host.appendChild(note);
        }
        for (const pkg of state.packages.slice(0, 40)) {
            const row = document.createElement("div");
            row.className = "node roblox-node";
            row.style.paddingLeft = "6px";
            row.title = pkg.path;
            const icon = document.createElement("span");
            icon.className = "ficon roblox-class";
            icon.dataset.class = "ModuleScript";
            icon.textContent = "M";
            const label = document.createElement("span");
            label.className = "label";
            label.textContent = pkg.version ? `${pkg.name} (${pkg.version})` : pkg.name;
            row.append(icon, label);
            row.onclick = () => openFile(pkg.path);
            host.appendChild(row);
        }
        if (state.packages.length > 40) {
            const more = document.createElement("p");
            more.className = "muted";
            more.textContent = `et ${state.packages.length - 40} autre(s) paquet(s).`;
            host.appendChild(more);
        }
    }).catch(() => host.classList.add("hidden"));
}

async function runWally(button, action) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = action === "install" ? "Installation…" : "Mise à jour…";
    try {
        const result = await api.wallyAction(action);
        studioFeedback(result.message);
        if (!result.ok && result.log) appendOutput(result.log);
        if (result.luaurc) setTimeout(() => lspOnActivate?.(), 500);
    } catch (error) {
        studioFeedback(error.message);
    } finally {
        button.disabled = false;
        button.textContent = previous;
        refreshRobloxTree();
    }
}

function setRobloxExplorer(active) {
    ui.showRobloxTree = active === true;
    // L'onglet « Studio » de la barre latérale reflète toujours la vue affichée.
    const tab = document.querySelector('#sidebar-tabs [data-view="roblox"]');
    tab?.classList.toggle("active", ui.showRobloxTree);
    tab?.setAttribute("aria-selected", String(ui.showRobloxTree));
    document.querySelector('#sidebar-tabs [data-view="explorer"]')?.classList.toggle("active", !ui.showRobloxTree);
    $("app").classList.toggle("tree-roblox", Boolean(ui.showRobloxTree));
    const title = $("explorer-title");
    if (title) title.textContent = ui.showRobloxTree ? "Roblox Studio" : "Fichiers";
    if (ui.showRobloxTree && ui.workspace) refreshRobloxTree();
}




$("roblox-tree-refresh")?.addEventListener("click", refreshRobloxTree);

/* ---------- Tableau de bord Rojo (panneau du bas) ----------
   Vert : Studio connecté au serveur Rojo. Orange : serveur en attente de connexion.
   Boutons : recompiler le projet (rojo build) et relancer la sourcemap (rojo serve). */

let rojoDashboardSeq = 0;

function rojoToneLabel(tone) {
    return { live: "Studio connecté", waiting: "En attente de connexion", offline: "Serveur arrêté" }[tone] || "Inconnu";
}

function relativeTime(ms) {
    if (!ms) return "jamais";
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 60) return `il y a ${seconds} s`;
    if (seconds < 3600) return `il y a ${Math.round(seconds / 60)} min`;
    return new Date(ms).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function refreshRojoDashboard() {
    const host = $("rojo");
    if (!host) return;
    if (!ui.workspace) {
        host.innerHTML = '<p class="muted">Ouvre un projet Roblox pour piloter Rojo et Wally.</p>';
        return;
    }
    const seq = ++rojoDashboardSeq;
    try {
        const state = await api.robloxDashboard("status");
        if (seq !== rojoDashboardSeq) return;
        renderRojoDashboard(state);
    } catch (error) {
        if (seq !== rojoDashboardSeq) return;
        host.replaceChildren();
        const line = document.createElement("p");
        line.className = "muted";
        line.textContent = error.message;
        host.appendChild(line);
    }
}

function renderRojoDashboard(state) {
    const host = $("rojo");
    if (!host) return;
    host.replaceChildren();

    const head = document.createElement("div");
    head.className = "rojo-head";
    const dot = document.createElement("span");
    dot.className = `rojo-dot rojo-dot-${state.tone}`;
    const title = document.createElement("strong");
    title.textContent = `Rojo · ${rojoToneLabel(state.tone)}`;
    const detail = document.createElement("span");
    detail.className = "muted";
    detail.textContent = state.project
        ? `${state.project}${state.running ? ` · ${state.host}:${state.port} · ${state.clients} client(s)` : ""}`
        : "Aucun default.project.json";
    head.append(dot, title, detail);
    const actions = document.createElement("div");
    actions.className = "rojo-actions";
    const buttons = [
        state.running ? ["stop", "Arrêter Rojo"] : ["start", "Démarrer Rojo"],
        ["restart", "Relancer la sourcemap"],
        ["build", "Recompiler (rojo build)"]
    ];
    for (const [action, label] of buttons) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.rojoAction = action;
        button.textContent = label;
        button.disabled = !state.project && action !== "status";
        button.onclick = () => runRojoAction(action, button);
        actions.appendChild(button);
    }
    head.appendChild(actions);
    host.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "rojo-grid";
    const build = state.build || {};
    const cards = [
        ["Dernier build", build.exists ? `${relativeTime(build.at)}${build.stale ? " · en retard" : ""}` : "aucun build", build.exists ? build.path : "Recompiler lance rojo build dans .frst/build."],
        ["Sourcemap", state.running ? (state.connected ? "Studio connecté" : "en attente de Studio") : "serveur arrêté", state.last_error || "rojo serve écoute uniquement sur 127.0.0.1."]
    ];
    for (const [label, value, hint] of cards) {
        const card = document.createElement("div");
        card.className = "rojo-card";
        const small = document.createElement("small");
        small.textContent = label;
        const strong = document.createElement("strong");
        strong.textContent = value;
        const note = document.createElement("span");
        note.className = "muted";
        note.textContent = hint || "";
        card.append(small, strong, note);
        grid.appendChild(card);
    }
    host.appendChild(grid);

    if (build.stale && build.newest_script) {
        const late = document.createElement("p");
        late.className = "rojo-note";
        late.textContent = `${build.newest_script} a changé après le dernier build : « Recompiler » pour vérifier.`;
        host.appendChild(late);
    }
    if (state.log?.length) {
        const log = document.createElement("pre");
        log.className = "rojo-log";
        log.textContent = state.log.map(entry => entry.line).join("\n");
        host.appendChild(log);
    }
}

async function runRojoAction(action, button) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = action === "build" ? "Compilation…" : action === "restart" ? "Relance…" : "…";
    try {
        const result = await api.robloxDashboard(action);
        if (result.message) studioFeedback(result.message);
        if (action === "build") {
            appendOutput(`${result.message}\n${result.log || ""}`);
            if (!result.ok) selectPanel("output");
        }
        // La barre d'état est actualisée par la boucle de statut ; ici on redessine le panneau.
        renderRojoDashboard(result);
    } catch (error) {
        studioFeedback(error.message);
        button.disabled = false;
        button.textContent = previous;
    }
    if (ui.showRobloxTree) refreshRobloxTree();
}

function openRojoPanel() {
    const host = $("rojo");
    if (!host) return;
    if (!$("tab-output").parentElement.querySelector('[data-panel="rojo"]')) return;
    if (typeof selectPanel === "function") {
        selectPanel("rojo");
        refreshRojoDashboard();
    }
}

/* Indicateur de la barre d'état : vert si Studio est connecté, orange en attente. */
function updateRojoStatusIndicator(rojo) {
    const span = $("st-rojo");
    if (!span) return;
    // Dernier état gagne après un petit délai (anti-écho d'une lecture de statut en cours),
    // et une parenthèse n'efface pas la pastille déjà affichée.
    const now = Date.now();
    if (ui.rojoServerAt && now - ui.rojoServerAt < 1500 && JSON.stringify(rojo) !== JSON.stringify(ui.rojoServer)) return;
    if (!rojo) rojo = { tone: "offline", host: "127.0.0.1", port: 34872 };
    if (!ui.workspace) {
        span.classList.add("hidden");
        return;
    }
    ui.rojoServer = rojo;
    ui.rojoServerAt = now;
    span.classList.remove("hidden");
    span.classList.toggle("st-rojo-live", rojo.tone === "live");
    span.classList.toggle("st-rojo-waiting", rojo.tone === "waiting");
    span.classList.toggle("st-rojo-offline", rojo.tone === "offline");
    span.textContent = rojo.tone === "live"
        ? `Rojo ${rojo.port} · Studio connecté`
        : rojo.tone === "waiting"
            ? `Rojo ${rojo.port} · en attente`
            : "Rojo arrêté";
    span.title = rojo.tone === "live"
        ? `Roblox Studio est connecté au serveur Rojo (${rojo.host}:${rojo.port}). Clic : panneau Rojo.`
        : rojo.tone === "waiting"
            ? `Serveur Rojo sur ${rojo.host}:${rojo.port} : ouvre le plugin Rojo dans Studio et clique Connect. Clic : panneau Rojo.`
            : `Serveur Rojo arrêté. Clic : panneau Rojo pour le démarrer et recompiler.`;
    span.setAttribute("role", "button");
    span.tabIndex = 0;
    span.onclick = openRojoPanel;
    span.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openRojoPanel();
        }
    };
}

refreshRobloxTree();
