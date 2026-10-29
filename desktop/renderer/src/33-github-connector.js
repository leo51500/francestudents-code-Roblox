/* ---------- Connecteur natif GitHub ---------- */
const githubConnectorDialog = document.createElement("dialog");
githubConnectorDialog.id = "github-connector-dialog";
githubConnectorDialog.className = "conversation-import-dialog github-connector-dialog";
githubConnectorDialog.setAttribute("aria-labelledby", "github-connector-title");
githubConnectorDialog.innerHTML = `<div class="workspace-section-head"><h2 id="github-connector-title">GitHub <small>Bêta</small></h2><button type="button" id="github-connector-close" aria-label="Fermer le connecteur GitHub">×</button></div>
<p id="github-connector-account" class="settings-help"></p><p id="github-connector-repo" class="settings-help"></p>
<div class="studio-actions github-connector-nav"><button type="button" data-github-view="releases">Releases</button><button type="button" data-github-view="pull_requests">Pull requests</button><button type="button" data-github-view="issues">Issues</button><button type="button" data-github-view="repositories">Mes dépôts</button><button type="button" id="github-connector-readme">Modifier le README avec l’IA</button></div>
<p id="github-connector-status" role="status"></p><div id="github-connector-list"></div>
<details id="github-connector-create"><summary>Préparer une release</summary><p class="settings-help">Un brouillon sera créé. Ajoute ses fichiers et vérifie ses notes avant de publier.</p><label>Tag<input id="github-release-tag" placeholder="v1.0.0"></label><label>Commit ou branche cible<input id="github-release-target" placeholder="SHA du commit ou main"></label><label>Titre<input id="github-release-title" placeholder="Version 1.0.0"></label><label>Notes<textarea id="github-release-body" rows="4"></textarea></label><button type="button" id="github-release-create">Créer le brouillon</button></details>
<div class="github-connector-account"><label>Compte GitHub<input id="github-connector-token" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_… ou github_pat_…"></label><button type="button" id="github-connector-login">Connecter</button><button type="button" id="github-connector-logout" class="hidden">Déconnecter</button></div>
<details class="github-connector-repo-setup"><summary>Lier ou créer un dépôt distant</summary><p class="settings-help">Lier un dépôt ne télécharge aucun fichier : le dossier ouvert doit déjà être un dépôt Git. Les commandes push, pull et commit se lancent depuis la palette (Ctrl+Maj+P) ou le terminal.</p><label>owner/repo ou URL GitHub<input id="github-connector-repo-input" spellcheck="false" placeholder="proprietaire/depot"></label><button type="button" id="github-connector-repo-link">Lier au projet</button><label>Nom du nouveau dépôt<input id="github-connector-repo-name" spellcheck="false" placeholder="mon-jeu-roblox"></label><label class="git-check"><input id="github-connector-repo-public" type="checkbox"> Dépôt public</label><button type="button" id="github-connector-repo-create">Créer le dépôt</button></details>
<p class="settings-help">Le dépôt vient du remote origin du projet ouvert. Les droits dépendent du token connecté. L’agent dispose de l’outil natif github ; les modifications demandent une confirmation en mode Demander, mais pas en Full accès. Une publication ou un push ne peut pas être annulé comme une lecture locale.</p>`;
document.body.appendChild(githubConnectorDialog);
let githubConnectorView = "releases", githubConnectorLoading = false;
async function githubConnectorWork(operation) {
    if (githubConnectorLoading) return;
    githubConnectorLoading = true;
    const buttons = [...githubConnectorDialog.querySelectorAll("button:not(#github-connector-close)")];
    buttons.forEach(button => { button.disabled = true; });
    $("github-connector-status").textContent = "Chargement…";
    try { await operation(); }
    catch (error) { $("github-connector-status").textContent = error.message; }
    finally { githubConnectorLoading = false; buttons.forEach(button => { if (button.isConnected) button.disabled = false; }); }
}
async function loadGithubConnector() {
    const result = await api.githubConnector({ action: githubConnectorView });
    const list = $("github-connector-list"); list.replaceChildren();
    for (const item of result.items || result.repositories || []) {
        const card = document.createElement("article"); card.className = "github-connector-card";
        const title = document.createElement("b"); title.textContent = item.title || item.name;
        const status = document.createElement("span"); status.textContent = item.draft ? "Brouillon" : item.state || (item.private === true ? "Privé" : item.private === false ? "Public" : "Publié");
        const actions = document.createElement("div"); actions.className = "studio-actions";
        const open = document.createElement("button"); open.textContent = "Voir sur GitHub"; open.onclick = () => api.openExternal(item.url, true).catch(error => { $("github-connector-status").textContent = error.message; });
        actions.append(open);
        if (item.draft && githubConnectorView === "releases") {
            const upload = document.createElement("button"); upload.textContent = "Ajouter un fichier"; upload.onclick = () => githubConnectorWork(async () => { await api.githubUploadAsset(item.id); await loadGithubConnector(); });
            const publish = document.createElement("button"); publish.textContent = "Publier la release"; publish.onclick = () => githubConnectorWork(async () => { await api.githubConnector({ action: "publish_release", id: item.id }); await loadGithubConnector(); });
            actions.append(upload, publish);
        }
        if (githubConnectorView === "repositories") {
            const link = document.createElement("button"); link.textContent = "Lier au projet"; link.onclick = () => githubConnectorWork(async () => {
                // La liaison modifie seulement le remote : elle ne télécharge ni ne crée les
                // fichiers du projet. Le dire avant une confirmation évite une fausse attente.
                const git = await api.gitStatus();
                if (!git.repo) {
                    $("github-connector-status").textContent = "Le dossier ouvert n’est pas un dépôt Git. Ouvre un dépôt existant, clone ce dépôt dans un nouveau dossier, ou initialise Git dans le dossier actuel avant de le lier. La liaison ne télécharge aucun fichier.";
                    return;
                }
                const current = await api.githubStatus();
                if (current.remote && !await confirmStudioAction(`Le remote origin est actuellement « ${current.remote} ». Le remplacer par « ${item.name} » ?`, { title: "Modifier le dépôt distant", confirmLabel: "Remplacer" })) {
                    $("github-connector-status").textContent = "Liaison annulée : le remote existant est conservé.";
                    return;
                }
                await api.githubSetRemote(item.name);
                $("github-connector-repo").textContent = item.name;
                $("github-connector-status").textContent = "Remote origin mis à jour. Aucun fichier n’a été téléchargé.";
            }); actions.append(link);
        }
        card.append(title, status);
        if (item.body) { const details = document.createElement("details"), summary = document.createElement("summary"), body = document.createElement("pre"); summary.textContent = "Notes"; body.textContent = item.body; details.append(summary, body); card.append(details); }
        for (const asset of item.assets || []) { const line = document.createElement("small"); line.textContent = `${asset.name} · ${formatBytes(asset.size)}`; card.append(line); }
        card.append(actions); list.append(card);
    }
    $("github-connector-status").textContent = list.children.length ? `${list.children.length} élément(s)` : "Aucun élément.";
    for (const button of githubConnectorDialog.querySelectorAll("[data-github-view]")) button.setAttribute("aria-pressed", String(button.dataset.githubView === githubConnectorView));
}
// Le panneau Git n'est plus affiché : le connecteur porte aussi la connexion du compte.
function githubConnectorOpen() {
    githubConnectorDialog.showModal();
    githubConnectorWork(async () => {
        const account = await api.githubStatus();
        $("github-connector-account").textContent = account.connected ? `Compte connecté : ${account.login || "GitHub"}${account.masked ? ` · token ${account.masked}` : ""}` : "Compte GitHub non connecté : colle un token ci-dessous (stocké de façon sécurisée sur cet ordinateur).";
        $("github-connector-repo").textContent = account.remote || "Aucun dépôt lié au projet.";
        $("github-connector-logout").classList.toggle("hidden", !(account.connected || account.masked));
        if (!account.connected) { $("github-connector-list").replaceChildren(); $("github-connector-status").textContent = "Connexion GitHub nécessaire."; return; }
        try { const repo = await api.githubConnector({ action: "overview" }); $("github-connector-repo").textContent = `${repo.repository} · ${repo.branch}${repo.private ? " · Privé" : " · Public"}`; $("github-release-target").value = repo.branch; } catch { githubConnectorView = "repositories"; }
        await loadGithubConnector();
    });
}
$("gh-connector-open").onclick = () => githubConnectorOpen();
$("github-connector-close").onclick = () => githubConnectorDialog.close();
$("github-connector-login").onclick = () => githubConnectorWork(async () => {
    const token = $("github-connector-token").value.trim();
    if (!token) { $("github-connector-status").textContent = "Colle un token GitHub."; $("github-connector-token").focus(); return; }
    try { const user = await api.githubLoginToken(token); $("github-connector-status").textContent = `Connecté en tant que ${user.login || "?"}.`; }
    finally { $("github-connector-token").value = ""; }
    await githubConnectorRefreshAccount();
});
$("github-connector-logout").onclick = () => githubConnectorWork(async () => {
    await api.githubLogout();
    $("github-connector-status").textContent = "Token GitHub supprimé de cet ordinateur.";
    $("github-connector-list").replaceChildren();
    await githubConnectorRefreshAccount();
});
$("github-connector-token").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); $("github-connector-login").click(); } });
$("github-connector-repo-link").onclick = () => githubConnectorWork(async () => {
    const spec = $("github-connector-repo-input").value.trim();
    if (!spec) { $("github-connector-status").textContent = "Indique owner/repo ou une URL GitHub."; return; }
    try {
        const r = await api.githubSetRemote(spec);
        $("github-connector-repo-input").value = "";
        $("github-connector-status").textContent = `Remote ${r.remote} ${r.updated ? "mis à jour" : "ajouté"} : ${r.url}. Aucun fichier n’a été téléchargé.`;
    } catch (error) {
        $("github-connector-status").textContent = error.message?.includes("dépôt Git") ? error.message : `Liaison impossible : ${error.message}`;
    }
});
$("github-connector-repo-create").onclick = () => githubConnectorWork(async () => {
    const name = $("github-connector-repo-name").value.trim();
    if (!name) { $("github-connector-status").textContent = "Indique le nom du dépôt à créer."; return; }
    const repo = await api.githubCreateRepo(name, $("github-connector-repo-public").checked);
    const state = await api.githubStatus().catch(() => null);
    let extra = "";
    if (state && !state.remote) {
        await api.githubSetRemote(repo.full_name);
        extra = " Remote origin défini.";
    }
    $("github-connector-repo-name").value = "";
    $("github-connector-status").textContent = `Dépôt ${repo.private ? "privé" : "public"} créé.${extra}`;
});
/** Relit uniquement le compte, sans recharger une liste qui exigerait un dépôt lié. */
async function githubConnectorRefreshAccount() {
    const account = await api.githubStatus().catch(() => null);
    if (!account) return;
    $("github-connector-account").textContent = account.connected ? `Compte connecté : ${account.login || "GitHub"}${account.masked ? ` · token ${account.masked}` : ""}` : account.error || "Compte GitHub non connecté.";
    $("github-connector-logout").classList.toggle("hidden", !(account.connected || account.masked));
    $("github-connector-repo").textContent = account.remote || "Aucun dépôt lié au projet.";
}
for (const button of githubConnectorDialog.querySelectorAll("[data-github-view]")) button.onclick = () => githubConnectorWork(async () => { githubConnectorView = button.dataset.githubView; await loadGithubConnector(); });
$("github-release-create").onclick = () => githubConnectorWork(async () => {
    await api.githubConnector({ action: "create_release", tag: $("github-release-tag").value.trim(), target: $("github-release-target").value.trim(), title: $("github-release-title").value.trim(), body: $("github-release-body").value });
    githubConnectorView = "releases"; await loadGithubConnector();
});
$("github-connector-readme").onclick = () => { githubConnectorDialog.close(); setAgentTab("conversation"); input.value = "Examine le projet et son README, puis mets à jour le README pour expliquer simplement son utilisation. Utilise les outils de fichiers locaux ; prépare un commit et un push uniquement si je te le demande."; autosizeInput(); saveStudioDraft(); input.focus(); };
