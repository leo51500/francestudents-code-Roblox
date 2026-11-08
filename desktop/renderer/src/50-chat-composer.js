/* Model selection controls shared by the chat composer. */
const composerTools = document.createElement("div");
composerTools.className = "chat-composer-tools";
const composerModelRow = document.createElement("div"), composerSettingsRow = document.createElement("div");
composerModelRow.className = "chat-model-row"; composerSettingsRow.className = "chat-settings-row";
composerTools.append(composerModelRow, composerSettingsRow);
function chatControlContent(button, icon, label) {
    button.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span class="chat-control-label"></span><svg class="chat-control-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>`;
    button.querySelector(".chat-control-label").textContent = label;
}
composerModelRow.append($("btn-model"));
composerSettingsRow.append($("eco-mode-toggle"));
$("composer").querySelector(".composer-actions").before(composerTools);
