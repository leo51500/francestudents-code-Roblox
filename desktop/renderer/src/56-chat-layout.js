/* One compact chat header and secondary tools on demand. */
const chatNavigationActions = document.createElement("div");
chatNavigationActions.className = "chat-navigation-actions";
const chatNavigation = $("agent").querySelector(".agent-navigation");
chatNavigationActions.append(...document.querySelector("#agent .agent-actions").children, $("agent-focus"));
chatNavigation.append(chatNavigationActions);
document.querySelector("#agent .agent-header").hidden = true;
document.querySelector("#agent .agent-context-bar").hidden = true;
const moreChatTools = document.createElement("button");
moreChatTools.type = "button"; moreChatTools.id = "chat-more-tools"; moreChatTools.className = "attach-btn";
moreChatTools.title = "Outils du chat"; moreChatTools.setAttribute("aria-label", "Outils du chat");
moreChatTools.setAttribute("aria-haspopup", "dialog"); moreChatTools.setAttribute("aria-expanded", "false");
moreChatTools.setAttribute("aria-controls", "chat-tools-menu");
moreChatTools.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
$("btn-attach").after(moreChatTools);
const moreChatMenu = document.createElement("div");
moreChatMenu.id = "chat-tools-menu"; moreChatMenu.className = "chat-access-menu chat-tools-menu";
moreChatMenu.setAttribute("popover", "auto"); moreChatMenu.setAttribute("aria-label", "Outils du chat");
moreChatMenu.setAttribute("role", "dialog");
const moreChatHeading = document.createElement("div"); moreChatHeading.className = "chat-access-heading"; moreChatHeading.textContent = "Outils du chat";
moreChatMenu.append(moreChatHeading, document.querySelector(".composer-topline"));
const clearChatLabel = document.createElement("span"); clearChatLabel.textContent = "Effacer l’affichage";
$("btn-clear").append(clearChatLabel); moreChatMenu.querySelector(".composer-utilities").append($("btn-clear"));
document.body.append(moreChatMenu);
const responseSetting = document.createElement("div"); responseSetting.className = "chat-response-setting";
const responseLabel = document.createElement("label"); responseLabel.htmlFor = "mode-select"; responseLabel.textContent = "Mode de réponse";
const responseDescription = document.createElement("span"); responseDescription.id = "chat-mode-description"; responseDescription.className = "chat-mode-description";
const responseSelect = $("mode-select");
responseSelect.setAttribute("aria-label", "Mode de réponse");
responseSelect.setAttribute("aria-describedby", responseDescription.id);
responseSelect.title = "Choisis comment l’agent répond à tes demandes.";
responseSetting.append(responseLabel, responseSelect, responseDescription);
const composerBox = document.querySelector("#composer .composer-box");
composerBox.insertBefore(responseSetting, composerBox.querySelector(".composer-topline"));
function updateChatModeDescription() {
    const descriptions = {
        auto: "L’agent choisit les outils selon ta demande.",
        agent: "L’agent utilise les outils du projet quand un dossier est ouvert.",
        chat: "Discussion sans utilisation des outils du projet."
    };
    responseDescription.textContent = descriptions[responseSelect.value] || descriptions.auto;
}
responseSelect.addEventListener("change", updateChatModeDescription);
updateChatModeDescription();
const interfaceZoomStorageKey = "frst-ui-zoom";
function applyInterfaceZoom(value) {
    const zoom = Math.max(80, Math.min(140, Number(value) || 100));
    document.documentElement.style.setProperty("--app-zoom", String(zoom / 100));
    localStorage.setItem(interfaceZoomStorageKey, String(zoom));
    return zoom;
}
applyInterfaceZoom(localStorage.getItem(interfaceZoomStorageKey) || 100);
document.addEventListener("keydown", event => {
    if (!event.ctrlKey || event.altKey || event.metaKey) return;
    const zoomIn = event.key === "+" || event.code === "NumpadAdd";
    const zoomOut = event.key === "-" || event.code === "NumpadSubtract";
    const reset = event.key === "0" || event.code === "Numpad0";
    if (!zoomIn && !zoomOut && !reset) return;
    event.preventDefault();
    const currentZoom = Number(localStorage.getItem(interfaceZoomStorageKey)) || 100;
    applyInterfaceZoom(reset ? 100 : currentZoom + (zoomIn ? 10 : -10));
});
for (const [id, label] of [["favorite-open", "Prompts favoris"], ["draft-save-favorite", "Enregistrer le brouillon en favori"], ["conversation-export", "Exporter la conversation"]]) {
    const text = document.createElement("span"); text.textContent = label; $(id).append(text);
}
function positionMoreChatMenu() {
    const rect = moreChatTools.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 24);
    moreChatMenu.style.width = `${width}px`; moreChatMenu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    moreChatMenu.style.maxHeight = `${Math.max(80, rect.top - 20)}px`;
    moreChatMenu.style.top = `${Math.max(12, rect.top - moreChatMenu.getBoundingClientRect().height - 8)}px`;
}
moreChatTools.onclick = () => {
    if (moreChatMenu.matches(":popover-open")) { moreChatMenu.hidePopover(); return; }
    hideModelMenu(); moreChatMenu.showPopover(); positionMoreChatMenu(); moreChatMenu.querySelector("button:not(:disabled)")?.focus();
};
moreChatMenu.addEventListener("toggle", () => moreChatTools.setAttribute("aria-expanded", String(moreChatMenu.matches(":popover-open"))));
moreChatMenu.addEventListener("click", event => { if (event.target.closest("button") && moreChatMenu.matches(":popover-open")) moreChatMenu.hidePopover(); });
window.addEventListener("resize", () => { if (moreChatMenu.matches(":popover-open")) positionMoreChatMenu(); });
// Escape always provides a direct way back to the project, after closing menus.
window.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !$("app").classList.contains("focus-agent") || document.querySelector("dialog[open], :popover-open")) return;
    if (ui.status.busy || !$("slash-menu").classList.contains("hidden")) return;
    setAgentFocus(false); $("agent-focus").focus();
});
