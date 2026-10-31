/* Crash notices are local, actionable and acknowledged explicitly. */
let stabilityNotice = null, stabilityNoticeShown = false;
function maybeShowStabilityNotice() {
    if (!stabilityNotice || stabilityNoticeShown || !$("startup-loading").hidden || document.querySelector("dialog[open]")) return;
    stabilityNoticeShown = true;
    stabilityNoticeObserver.disconnect();
    document.removeEventListener("close", maybeShowStabilityNotice, true);
    const notice = stabilityNotice, dialog = centerNode("dialog", "fs-dialog");
    dialog.id = "stability-notice";
    studioSurfaceHeader(dialog, { title: "Après un arrêt inattendu", subtitle: "Voici ce que l’application a pu identifier.", badge: notice.code, icon: "clock" });
    const body = centerNode("section", "fs-dialog-section");
    body.append(centerNode("h3", "", notice.title), centerNode("p", "", notice.reasonText), centerNode("p", "fs-dialog-note", notice.advice));
    const report = centerNode("pre", "fs-stability-report", notice.report);
    body.append(report, centerNode("p", "fs-section-description", "Diagnostic local : le texte des conversations et des fichiers, les jetons et les traces complètes ne sont pas collectés. Aucun envoi automatique."));
    if (!notice.persisted) body.append(centerNode("p", "fs-dialog-note", "Le journal local n’a pas pu être sauvegardé. Copie ce diagnostic avant de fermer."));
    const footer = centerNode("div", "fs-dialog-footer"), copy = centerNode("button", "", "Copier le diagnostic"), save = centerNode("button", "", "Enregistrer le diagnostic"), done = centerNode("button", "primary", "J’ai compris");
    copy.id = "stability-copy"; save.id = "stability-save"; done.id = "stability-acknowledge"; copy.type = save.type = done.type = "button";
    copy.onclick = () => api.copyText(notice.report).then(() => { copy.textContent = "Diagnostic copié"; }).catch(error => studioFeedback(error.message));
    save.onclick = () => api.stability("save").then(result => {
        if (result && result.path) save.textContent = "Diagnostic enregistré";
    }).catch(error => studioFeedback(error.message));
    done.onclick = () => dialog.close();
    dialog.addEventListener("close", () => { api.stability("acknowledge", notice.id).catch(error => studioFeedback(error.message)); dialog.remove(); }, { once: true });
    footer.append(copy, save, done); dialog.append(body, footer); document.body.append(dialog); dialog.showModal(); done.focus();
}
const stabilityNoticeObserver = new MutationObserver(maybeShowStabilityNotice);
stabilityNoticeObserver.observe($("startup-loading"), { attributes: true, attributeFilter: ["hidden"] });
document.addEventListener("close", maybeShowStabilityNotice, true);
api.stability().then(notice => {
    stabilityNotice = notice;
    if (notice) maybeShowStabilityNotice();
    else { stabilityNoticeObserver.disconnect(); document.removeEventListener("close", maybeShowStabilityNotice, true); }
}).catch(() => { stabilityNoticeObserver.disconnect(); document.removeEventListener("close", maybeShowStabilityNotice, true); });
