/* Zoom de l'interface et des conversations : une seule échelle pour tout l'écran.
 * Ctrl + molette, Ctrl + = / − / 0, ou le menu Affichage. La valeur est mémorisée
 * par le processus principal (settings.desktopZoom) et appliquée à la fenêtre,
 * donc le chat, l'éditeur, les dialogues et les aperçus suivent ensemble. */
const ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2];
const ZOOM_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2];
ui.zoom = 1;

function nearestZoom(level) {
    return ZOOM_LEVELS.reduce((closest, value) => Math.abs(value - level) < Math.abs(closest - level) ? value : closest, ZOOM_LEVELS[0]);
}

function zoomLabel(value = ui.zoom) {
    return `${Math.round(value * 100)} %`;
}

function applyZoomLocal(level) {
    ui.zoom = nearestZoom(level);
    const root = document.documentElement;
    // Repli visuel immédiat si le processus principal n'a pas encore répondu.
    root.classList.toggle("ui-zoomed", Math.abs(ui.zoom - 1) > 0.001);
    const badge = $("st-zoom");
    if (badge) {
        badge.textContent = zoomLabel();
        badge.classList.toggle("zoomed", Math.abs(ui.zoom - 1) > 0.001);
        badge.title = `Zoom ${zoomLabel()} · Ctrl + molette, Ctrl + = / − / 0`;
    }
    document.dispatchEvent(new CustomEvent("frst:zoom", { detail: { zoom: ui.zoom } }));
    return ui.zoom;
}

async function setZoom(level) {
    const target = nearestZoom(level);
    applyZoomLocal(target);
    try {
        const applied = await api.uiZoom("set", target);
        if (typeof applied === "number" && Math.abs(applied - target) > 0.001) applyZoomLocal(applied);
    } catch (error) {
        reportUiIssue("zoom", error);
    }
}

function stepZoom(direction) {
    const index = ZOOM_STEPS.indexOf(ui.zoom);
    const next = index === -1 ? (direction > 0 ? 1.1 : 0.9) : ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))];
    return setZoom(next);
}

function resetZoom() {
    applyZoomLocal(1);
    return api.uiZoom("reset").catch(error => reportUiIssue("zoom", error));
}

/* Ctrl + molette : même geste partout (chat, éditeur, terminal, aperçus). */
window.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (event.deltaY === 0) return;
    stepZoom(event.deltaY < 0 ? 1 : -1);
}, { passive: false, capture: true });

window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key;
    if (key === "=" || key === "+" || key === "Add") { event.preventDefault(); stepZoom(1); }
    else if (key === "-" || key === "_" || key === "Subtract") { event.preventDefault(); stepZoom(-1); }
    else if (key === "0") { event.preventDefault(); resetZoom(); }
});

/* Pastille discrète dans la barre d'état : montre le niveau et permet de revenir à 100 %. */
(function mountZoomBadge() {
    const status = $("statusbar");
    if (!status) return;
    const badge = document.createElement("button");
    badge.type = "button";
    badge.id = "st-zoom";
    badge.className = "status-zoom";
    badge.textContent = zoomLabel();
    badge.title = "Zoom de l'interface · cliquer pour revenir à 100 %";
    badge.onclick = async () => {
        if (Math.abs(ui.zoom - 1) < 0.001) return;
        const previous = ui.zoom;
        await resetZoom();
        badge.classList.add("zoom-reset-flash");
        setTimeout(() => badge.classList.remove("zoom-reset-flash"), 600);
        void previous;
    };
    const usage = $("st-usage");
    status.insertBefore(badge, usage || null);
    applyZoomLocal(ui.zoom);
})();

/* Valeur réellement appliquée par la fenêtre : source de vérité au démarrage. */
api.uiZoom("get").then((value) => { if (typeof value === "number" && value > 0) applyZoomLocal(value); }).catch(() => {});
