/* Terminal profile applies to new terminals; running shells are preserved. */
const terminalSettingsCard = document.createElement("section");
terminalSettingsCard.className = "settings-card";
terminalSettingsCard.dataset.settingsGroup = "general";
terminalSettingsCard.setAttribute("aria-labelledby", "settings-terminal-title");
terminalSettingsCard.innerHTML = '<h3 id="settings-terminal-title">Terminal intégré</h3><p class="settings-help">Choisis le terminal des nouveaux onglets. Les terminaux ouverts conservent leur session.</p><label class="center-code-label">Terminal par défaut<select id="settings-terminal-profile" disabled></select></label><div class="studio-actions"><button type="button" id="settings-terminal-save" class="primary" disabled>Enregistrer</button><button type="button" id="settings-terminal-refresh">Actualiser les terminaux</button></div><p id="settings-terminal-message" class="settings-help" role="status"></p><p class="settings-help">Ouvre un nouvel onglet avec + après avoir enregistré. Le terminal simple de secours ne conserve pas tout l’état d’un shell interactif.</p>';
$("settings-model-title").closest(".settings-card").after(terminalSettingsCard);
const terminalProfileSelect = $("settings-terminal-profile");
let terminalSettingsLoading = false;
function terminalSettingsMessage(text) { $("settings-terminal-message").textContent = text; }
async function loadTerminalSettings() {
    if (terminalSettingsLoading) return;
    terminalSettingsLoading = true;
    terminalSettingsMessage("Détection des terminaux…");
    terminalProfileSelect.disabled = true;
    $("settings-terminal-save").disabled = true;
    try {
        const value = await api.terminalPreferences();
        terminalProfileSelect.replaceChildren();
        for (const profile of value.profiles) terminalProfileSelect.append(new Option(profile.name, profile.id));
        terminalProfileSelect.value = value.profile;
        terminalProfileSelect.disabled = false;
        $("settings-terminal-save").disabled = false;
        terminalSettingsMessage("");
    } catch (error) {
        terminalSettingsMessage(error.message);
    } finally {
        terminalSettingsLoading = false;
    }
}
terminalProfileSelect.onchange = () => {
    terminalSettingsMessage("");
    $("settings-terminal-save").disabled = false;
};
$("settings-terminal-refresh").onclick = loadTerminalSettings;
$("settings-terminal-save").onclick = async () => {
    $("settings-terminal-save").disabled = true;
    terminalProfileSelect.disabled = true;
    try {
        const value = await api.terminalPreferences("save", { profile: terminalProfileSelect.value });
        terminalSettingsMessage(`Terminal enregistré : ${value.profiles.find(item => item.id === value.profile)?.name || value.profile}. Ouvre un nouvel onglet avec +.`);
    } catch (error) {
        terminalSettingsMessage(error.message);
    } finally {
        $("settings-terminal-save").disabled = false;
        terminalProfileSelect.disabled = false;
    }
};
loadTerminalSettings();
