/* One compact chat header and secondary tools on demand, in Code and Motion. */
const chatNavigationActions = document.createElement("div");
chatNavigationActions.className = "chat-navigation-actions";
const chatNavigation = $("agent").querySelector(".agent-navigation");
chatNavigationActions.append(...document.querySelector("#agent .agent-actions").children, $("agent-focus"));
chatNavigation.append(chatNavigationActions);
document.querySelector("#agent .agent-header").hidden = true;
document.querySelector("#agent .agent-context-bar").hidden = true;
/* Logs : accessible aussi depuis les outils du chat, sans quitter la conversation. */
const chatLogsButton = document.createElement("button");
chatLogsButton.type = "button"; chatLogsButton.id = "chat-open-logs"; chatLogsButton.className = "composer-icon-button";
chatLogsButton.title = "Voir les erreurs et les logs (Ctrl+Maj+L)";
chatLogsButton.setAttribute("aria-label", "Voir les erreurs et les logs");
chatLogsButton.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>';
chatLogsButton.addEventListener("click", () => {
    if (typeof selectPanel === "function") selectPanel("logs");
    if (typeof refreshLogs === "function") refreshLogs();
});
document.querySelector("#agent .agent-actions")?.prepend(chatLogsButton);

const moreChatTools = document.createElement("button");
moreChatTools.type = "button"; moreChatTools.id = "chat-more-tools"; moreChatTools.className = "attach-btn";
moreChatTools.title = "Outils du chat"; moreChatTools.setAttribute("aria-label", "Outils du chat");
moreChatTools.setAttribute("aria-haspopup", "dialog"); moreChatTools.setAttribute("aria-expanded", "false");
moreChatTools.setAttribute("aria-controls", "chat-tools-menu");
moreChatTools.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
$("btn-attach").after(moreChatTools);
const moreChatMenu = document.createElement("div");
moreChatMenu.id = "chat-tools-menu"; moreChatMenu.className = "chat-access-menu chat-tools-menu";
// Popover MANUEL : un popover "auto" s'ouvre seul quand il reçoit le focus au démarrage,
// et recouvrait alors la conversation, l'en-tête et les poignées. Manuel, il ne s'ouvre
// que par le bouton « Outils du chat » ; Échap et un clic extérieur le referment.
moreChatMenu.setAttribute("popover", "manual"); moreChatMenu.setAttribute("aria-label", "Outils du chat");
moreChatMenu.setAttribute("role", "dialog");
const moreChatHeading = document.createElement("div"); moreChatHeading.className = "chat-access-heading"; moreChatHeading.textContent = "Outils du chat";
moreChatMenu.append(moreChatHeading, document.querySelector(".composer-topline"));
const clearChatLabel = document.createElement("span"); clearChatLabel.textContent = "Effacer l’affichage";
$("btn-clear").append(clearChatLabel); moreChatMenu.querySelector(".composer-utilities").append($("btn-clear"));
const modeSetting = document.createElement("label"); modeSetting.className = "chat-mode-setting";
const modeLabel = document.createElement("span"); modeLabel.textContent = "Mode de conversation";
modeSetting.append(modeLabel, $("mode-select")); moreChatMenu.append(modeSetting);
document.body.append(moreChatMenu);
for (const [id, label] of [["favorite-open", "Prompts favoris"], ["draft-save-favorite", "Enregistrer le brouillon en favori"], ["conversation-export", "Exporter la conversation"]]) {
    const text = document.createElement("span"); text.textContent = label; $(id).append(text);
}
/*
 * Le menu est ancré à son bouton (position: fixed, calcul en pixels) : un popover non
 * positionné s'affiche au centre de la fenêtre, c'est-à-dire au milieu du chat qu'il
 * recouvrait. On réserve sa hauteur réelle avant de le placer, puis on corrige après
 * le rendu (le contenu peut encore changer de taille).
 */
function positionMoreChatMenu() {
    const anchor = moreChatTools.getBoundingClientRect();
    const margin = 8;
    const width = Math.max(220, Math.min(320, window.innerWidth - margin * 2));
    moreChatMenu.style.width = `${width}px`;
    // Au-dessus du bouton, jamais hors de la fenêtre.
    const maxTop = Math.max(margin, anchor.top - 8 - 40);
    moreChatMenu.style.maxHeight = `${Math.min(window.innerHeight - margin * 2, maxTop)}px`;
    const height = moreChatMenu.getBoundingClientRect().height || 0;
    const left = Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(anchor.top - height - 8, window.innerHeight - height - margin));
    moreChatMenu.style.left = `${Math.round(left)}px`;
    moreChatMenu.style.top = `${Math.round(top)}px`;
}
moreChatTools.onclick = () => {
    if (moreChatMenu.matches(":popover-open")) { moreChatMenu.hidePopover(); return; }
    hideModelMenu();
    // Position calculée AVANT l'affichage : le navigateur centre sinon le popover.
    moreChatMenu.style.visibility = "hidden";
    moreChatMenu.showPopover();
    positionMoreChatMenu();
    requestAnimationFrame(() => {
        positionMoreChatMenu();
        moreChatMenu.style.visibility = "";
        moreChatMenu.querySelector("button:not(:disabled)")?.focus();
    });
};
moreChatMenu.addEventListener("toggle", () => {
    const open = moreChatMenu.matches(":popover-open");
    moreChatTools.setAttribute("aria-expanded", String(open));
    // Fermé : aucune position ne doit rester dans le flux du chat.
    if (!open) { moreChatMenu.style.visibility = ""; }
});
// Un popover manuel ne se ferme pas comme un popover auto : on gère Échap et le clic dehors.
document.addEventListener("pointerdown", (event) => {
    if (moreChatMenu.matches(":popover-open") && !moreChatMenu.contains(event.target) && event.target !== moreChatTools && !moreChatTools.contains(event.target)) moreChatMenu.hidePopover();
}, true);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && moreChatMenu.matches(":popover-open")) moreChatMenu.hidePopover(); }, true);
moreChatMenu.hidePopover?.();
moreChatMenu.addEventListener("click", event => { if (event.target.closest("button") && moreChatMenu.matches(":popover-open")) moreChatMenu.hidePopover(); });
window.addEventListener("resize", () => { if (moreChatMenu.matches(":popover-open")) positionMoreChatMenu(); });
// Fenêtre étroite : le modèle reste lisible et les actions conservent leur cible de clic.
const responsiveChat = document.createElement("style");
responsiveChat.textContent = `
@media (max-width: 900px) {
  #model-label { max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chat-navigation-actions { gap: 1px; }
  .chat-navigation-actions > button { width: 28px; min-width: 28px; }
}
`;
document.head.append(responsiveChat);

// Escape always provides a direct way back to the project, after closing menus.
window.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !$("app").classList.contains("focus-agent") || document.querySelector("dialog[open], :popover-open")) return;
    if (ui.status.busy || !$("slash-menu").classList.contains("hidden")) return;
    setAgentFocus(false); $("agent-focus").focus();
});
