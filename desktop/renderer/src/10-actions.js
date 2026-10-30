/* ---------- Boutons et raccourcis ---------- */

$("btn-stop").onclick = () => {
    ui.interrupted = true;
    api.interrupt().catch(() => {});
};
$("btn-resume").onclick = () => {
    ui.interrupted = false;
    $("btn-resume").classList.add("hidden");
    send("Reprends la tâche précédente là où tu t'es arrêté (elle a été interrompue).");
};
$("btn-new").onclick = () => send("/new");
$("btn-clear").onclick = () => send("/clear");
$("btn-help").onclick = () => send("/help");
$("mode-select").onchange = (ev) => send(`/mode ${ev.target.value}`);
$("btn-model").onclick = (ev) => {
    ev.stopPropagation();
    toggleModelMenu();
};
$("st-model").onclick = () => toggleModelMenu();
$("btn-history").onclick = (ev) => {
    ev.stopPropagation();
    toggleHistoryMenu();
};
$("st-usage").onclick = () => {
    setAgentTab("usage");
};
$("st-usage").setAttribute("role", "button");
$("st-usage").tabIndex = 0;
$("st-usage").onkeydown = event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setAgentTab("usage"); }
};
$("btn-open-project").onclick = openProject;
$("btn-open-project-2").onclick = openProject;
$("btn-refresh-tree").onclick = () => (typeof ui !== "undefined" && ui.showRobloxTree ? refreshRobloxTree() : renderTree());
$("btn-clear-output").onclick = () => {
    output.textContent = "";
};

function toggleSidebar() {
    const app = $("app");
    app.classList.toggle("no-sidebar");
}

// « Fichiers » revient toujours à l'explorateur du projet, même depuis la scène ou les réglages.
document.querySelector('#sidebar-tabs [data-view="explorer"]').onclick = () => {
    $("app").classList.remove("no-sidebar");
    if (typeof ui !== "undefined" && ui.showRobloxTree && typeof setRobloxExplorer === "function") setRobloxExplorer(false);
    showSideView("explorer");
};

document.addEventListener("keydown", (ev) => {
    if(document.querySelector("dialog[open]"))return;
    if (!ev.ctrlKey) {
        if (ev.key === "Escape" && ui.status.busy && document.activeElement !== input) {
            api.interrupt().catch(() => {});
        }
        return;
    }
    const key = ev.key.toLowerCase();
    if (ev.shiftKey && key === "e") {
        ev.preventDefault();
        toggleSidebar();
    } else if (ev.shiftKey && key === "a") {
        ev.preventDefault();
        input.focus();
    } else if (key === "s") {
        ev.preventDefault();
        saveCurrent();
    } else if (key === "o") {
        ev.preventDefault();
        openProject();
    } else if (key === "w") {
        ev.preventDefault();
        if (ui.active) closeTab(ui.active);
    } else if (key === "l") {
        ev.preventDefault();
        input.focus();
    }
});

window.addEventListener("beforeunload", (ev) => {
    if (ui.tabs.some((t) => t.dirty)) {
        ev.preventDefault();
        ev.returnValue = "";
    }
});

// Pas de palier imposé : une zone va de son minimum utile jusqu'à toute la place libre
// de la fenêtre. Seule la taille de l'éditeur restant (CENTER_MIN_WIDTH) borne le geste.
const LAYOUT_LIMITS = {
    "--left": { min: 120 },
    "--right": { min: 240 },
    "--bottom": { min: 48 },
};
const CENTER_MIN_WIDTH = 260;
const EDITOR_MIN_HEIGHT = 120;
// Rail de navigation et poignées : lus réellement dans la page, pas supposés, pour que
// l'espace disponible corresponde à la fenêtre telle qu'elle est affichée.
const LAYOUT_CHROME_WIDTH = 8;

function layoutPx(cssVar) {
    const value = parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVar), 10);
    return Number.isFinite(value) ? value : LAYOUT_LIMITS[cssVar].min;
}

/** Largeur réellement occupée par le rail de navigation. */
function layoutRailWidth() {
    const rail = $("sidebar-tabs");
    const width = rail ? rail.getBoundingClientRect().width : 0;
    return Math.max(0, Math.round(width));
}

function layoutHidden(cssVar) {
    const app = $("app");
    if (cssVar === "--left") return app.classList.contains("no-sidebar");
    if (cssVar === "--right") return app.classList.contains("no-agent");
    return app.classList.contains("no-panel");
}

function layoutMax(cssVar, otherMeasured = null) {
    const limits = LAYOUT_LIMITS[cssVar];
    let room;
    if (cssVar === "--bottom") {
        const center = $("center");
        const height = center && center.clientHeight ? center.clientHeight : window.innerHeight;
        room = height - EDITOR_MIN_HEIGHT;
    } else {
        const other = cssVar === "--left" ? "--right" : "--left";
        const otherWidth = layoutHidden(other)
            ? 0
            : (Number.isFinite(otherMeasured) && otherMeasured > 0 ? otherMeasured : layoutPx(other)) + 4;
        room = window.innerWidth - layoutRailWidth() - LAYOUT_CHROME_WIDTH - otherWidth - CENTER_MIN_WIDTH;
    }
    return Math.max(limits.min, room);
}

function clampLayout() {
    // Une fenêtre réduite ne doit pas écraser la largeur choisie : quand la place
    // revient, les colonnes retrouvent leur valeur enregistrée au lieu de rester grosses.
    if (appLayoutCustom()) return;
    for (const v of ["--right", "--left", "--bottom"]) {
        if (layoutHidden(v)) continue;
        const current = layoutPx(v);
        const next = Math.max(LAYOUT_LIMITS[v].min, Math.min(layoutMax(v), current));
        if (next !== current) {
            if (next < current) layoutPreferred[v] = current;
            document.documentElement.style.setProperty(v, `${next}px`);
        } else if (layoutPreferred[v] && layoutPreferred[v] > current) {
            const restored = Math.min(layoutPreferred[v], layoutMax(v));
            if (restored > current) document.documentElement.style.setProperty(v, `${restored}px`);
            if (restored >= layoutPreferred[v]) delete layoutPreferred[v];
        }
    }
    if (typeof syncLayoutCustom === "function") syncLayoutCustom();
}

// Dernière largeur demandée par l'utilisateur, avant réduction forcée par la taille de fenêtre.
const layoutPreferred = {};

function appLayoutCustom() {
    return $("app").classList.contains("layout-custom");
}

/* Une largeur choisie par l'utilisateur (poignées ou disposition enregistrée) est publiée
 * dans --left-custom / --right-custom, et .layout-custom laisse la grille s'y référer.
 * Le CSS ne fige donc jamais une largeur qui n'était qu'un repli pour la taille courante. */
function publishCustomWidth(cssVar) {
    const value = document.documentElement.style.getPropertyValue(cssVar);
    if (!/^[0-9]+px$/.test(value)) return;
    document.documentElement.style.setProperty(`${cssVar}-custom`, value);
    document.documentElement.style.removeProperty(cssVar);
}

function syncLayoutCustom() {
    $("app").classList.toggle("layout-custom", ["--left", "--right", "--bottom"].some(v => document.documentElement.style.getPropertyValue(v).trim()));
}

let layoutFrame = 0;

function scheduleClampLayout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
        layoutFrame = 0;
        clampLayout();
    });
}

/* Bulle de taille : pendant un glisser (et sur un double-clic) elle affiche la valeur réelle
 * de la colonne, pas la position du curseur, pour savoir exactement où on se trouve.
 * Elle est créée à la demande : sans élément, `$("layout-badge")` renvoie null et la bulle
 * n'apparaissait jamais (masquée par le garde-fou ci-dessous). */
let layoutBadgeTimer = 0;

function showLayoutBadge(data, sticky = false) {
    let badge = $("layout-badge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "layout-badge";
        badge.className = "layout-badge";
        badge.setAttribute("role", "status");
        badge.setAttribute("aria-live", "polite");
        document.body.appendChild(badge);
    }
    badge.textContent = data.label;
    badge.classList.remove("hidden");
    const size = badge.offsetWidth || 84;
    const height = badge.offsetHeight || 24;
    // La bulle suit la poignée sans jamais sortir de la fenêtre.
    const left = Math.max(6, Math.min(window.innerWidth - size - 6, data.clientX - size / 2));
    const top = Math.max(6, Math.min(window.innerHeight - height - 6, data.clientY - height / 2));
    badge.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    if (layoutBadgeTimer) clearTimeout(layoutBadgeTimer);
    if (!sticky) layoutBadgeTimer = setTimeout(() => badge.classList.add("hidden"), 180);
}

function hideLayoutBadge() {
    if (layoutBadgeTimer) clearTimeout(layoutBadgeTimer);
    if (typeof windowBadgeTimer === "number" && windowBadgeTimer) clearTimeout(windowBadgeTimer);
    layoutBadgeTimer = 0;
    windowBadgeTimer = 0;
    const badge = $("layout-badge");
    if (badge) badge.classList.add("hidden");
}

/** Largeur (ou hauteur) réellement occupée par une zone, en pixels CSS. */
function layoutSizeOf(id, axis) {
    const el = $(id);
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.round(axis === "x" ? rect.width : rect.height);
}

function dragResizer(id, cssVar, axis, invert, zoneId) {
    const handle = $(id);
    if (!handle) return;

    // Libellé et zone mesurée : on lit la taille réellement occupée par le panneau.
    const label = cssVar === "--left" ? "Fichiers" : cssVar === "--right" ? "Chat" : "Bas";
    const describe = () => `${label} · ${layoutSizeOf(zoneId, axis)} px`;

    // Double-clic : largeur par défaut de la colonne, tout de suite visible.
    handle.addEventListener("dblclick", (ev) => {
        ev.preventDefault();
        const fallback = cssVar === "--left" ? 248 : cssVar === "--right" ? 420 : 160;
        document.documentElement.style.setProperty(cssVar, `${Math.max(LAYOUT_LIMITS[cssVar].min, Math.min(layoutMax(cssVar), fallback))}px`);
        delete layoutPreferred[cssVar];
        if (cssVar !== "--bottom") publishCustomWidth(cssVar);
        syncLayoutCustom();
        if (typeof saveLayout === "function") saveLayout();
        requestAnimationFrame(() => showLayoutBadge({ label: describe(), clientX: ev.clientX, clientY: ev.clientY }, true));
        layoutBadgeTimer = setTimeout(hideLayoutBadge, 900);
    });

    handle.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        try {
            handle.setPointerCapture(ev.pointerId);
        } catch {
            // capture indisponible
        }
        // Retour immédiat : la classe est posée dès l'appui, même si aucune pose du
        // pointeur ne survient avant le relâchement (test automatique, glisser très court).
        document.body.classList.add(axis === "x" ? "resizing-x" : "resizing-y");
        document.documentElement.classList.add("layout-dragging");
        const start = axis === "x" ? ev.clientX : ev.clientY;
        const initial = layoutPx(cssVar);
        const min = LAYOUT_LIMITS[cssVar].min;
        // La place libre dépend de l'autre colonne telle qu'elle est affichée maintenant,
        // et non de sa valeur mémorisée (qui peut être plus grande que la place réelle).
        const max = layoutMax(cssVar, layoutSizeOf(cssVar === "--left" ? "agent" : "sidebar", "x"));
        let last = start;
        let frame = 0;
        // Un appui direct jusqu'au bord peut ne produire aucune pose intermédiaire : la
        // bulle montre tout de suite la taille tenue.
        showLayoutBadge({ label: describe(), clientX: ev.clientX, clientY: ev.clientY }, true);
        const apply = (animate) => {
            frame = 0;
            const delta = last - start;
            const value = Math.max(min, Math.min(max, initial + (invert ? -delta : delta)));
            // Au relâchement, la classe de glisser est retirée avant d'écrire la valeur
            // finale : la dernière petite distance parcourue depuis la dernière image
            // s'anime au lieu d'être perdue (transition coupée uniquement pendant le geste).
            if (animate && value === layoutPx(cssVar)) animate = false;
            if (animate) document.documentElement.classList.remove("layout-dragging");
            document.documentElement.style.setProperty(cssVar, `${value}px`);
            // La bulle affiche la taille de la valeur visée, disponible dès la frame suivante.
            showLayoutBadge({ label: `${label} · ${value} px`, clientX: pointer.x, clientY: pointer.y });
        };
        const pointer = { x: ev.clientX, y: ev.clientY };
        const move = (e) => {
            last = axis === "x" ? e.clientX : e.clientY;
            pointer.x = e.clientX;
            pointer.y = e.clientY;
            if (!frame) frame = requestAnimationFrame(apply);
        };
        const up = () => {
            if (frame) {
                cancelAnimationFrame(frame);
                apply(true);
            } else if (last !== start) {
                // Aucune pose intermédiaire (glisser très court) : la position relâchée
                // compte quand même, au lieu de perdre le geste.
                apply(true);
            }
            // La valeur finale reste visible un court instant après le relâchement.
            showLayoutBadge({ label: describe(), clientX: pointer.x, clientY: pointer.y }, true);
            layoutBadgeTimer = setTimeout(hideLayoutBadge, 900);
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            handle.removeEventListener("pointercancel", up);
            document.body.classList.remove("resizing-x", "resizing-y");
            document.documentElement.classList.remove("layout-dragging");
            delete layoutPreferred[cssVar];
            // --bottom reste une variable de hauteur (le panneau la lit) : il ne passe pas
            // par --left-custom / --right-custom, réservés aux colonnes de la grille.
            if (cssVar !== "--bottom") publishCustomWidth(cssVar);
            syncLayoutCustom();
            // Réévalue la place disponible après le geste (largeur enregistrée, classes de
            // disposition) sans attendre le prochain redimensionnement de la fenêtre.
            if (layoutFrame) cancelAnimationFrame(layoutFrame);
            layoutFrame = requestAnimationFrame(() => {
                layoutFrame = 0;
                if (appLayoutCustom()) return;
                clampLayout();
            });
            if (typeof saveLayout === "function") saveLayout();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
    });

    // Accessibilité clavier : flèches pour ajuster, Maj pour un pas de 40 px.
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", axis === "x" ? "vertical" : "horizontal");
    handle.setAttribute("aria-label", `Redimensionner ${cssVar === "--right" ? "le chat" : cssVar === "--left" ? "les fichiers" : "le panneau du bas"} (flèches)`);
    handle.addEventListener("keydown", (ev) => {
        const keys = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (!keys.includes(ev.key)) return;
        ev.preventDefault();
        // Flèche vers le bord de la fenêtre = agrandir cette zone.
        const grow = axis === "x" ? ev.key === "ArrowRight" : ev.key === "ArrowDown";
        const step = (ev.shiftKey ? 40 : 8) * (grow === !invert ? 1 : -1) * (invert ? -1 : 1);
        const next = Math.max(LAYOUT_LIMITS[cssVar].min, Math.min(layoutMax(cssVar), layoutPx(cssVar) + step));
        document.documentElement.style.setProperty(cssVar, `${next}px`);
        delete layoutPreferred[cssVar];
        if (cssVar !== "--bottom") publishCustomWidth(cssVar);
        syncLayoutCustom();
        const rect = handle.getBoundingClientRect();
        showLayoutBadge({ label: cssVar === "--bottom" ? `Bas · ${next} px` : `${describe()}`, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }, true);
        layoutBadgeTimer = setTimeout(hideLayoutBadge, 900);
        if (typeof saveLayout === "function") saveLayout();
    });
}

dragResizer("resizer-left", "--left", "x", false, "sidebar");
dragResizer("resizer-right", "--right", "x", true, "agent");
dragResizer("resizer-bottom", "--bottom", "y", true, "panel");

let windowBadgeTimer = 0;
window.addEventListener("resize", () => {
    scheduleClampLayout();
    // Taille en direct de la fenêtre : les poignées internes ont leur propre bulle.
    if (document.documentElement.classList.contains("layout-dragging")) return;
    showLayoutBadge({ label: `Fenêtre · ${window.innerWidth} × ${window.innerHeight}`, clientX: window.innerWidth / 2, clientY: 40 }, true);
    if (windowBadgeTimer) clearTimeout(windowBadgeTimer);
    windowBadgeTimer = setTimeout(hideLayoutBadge, 900);
});

new MutationObserver(scheduleClampLayout).observe($("app"), { attributes: true, attributeFilter: ["class"] });
syncLayoutCustom();
scheduleClampLayout();

/* ---------- Boîte de saisie ---------- */

function inputDialog(title, value = "") {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        const box = document.createElement("div");
        box.className = "modal";
        const heading = document.createElement("div");
        heading.className = "modal-title";
        heading.textContent = title;
        const field = document.createElement("input");
        field.type = "text";
        field.value = value;
        const buttons = document.createElement("div");
        buttons.className = "buttons";
        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "primary";
        ok.textContent = "OK";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Annuler";
        buttons.append(ok, cancel);
        box.append(heading, field, buttons);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };
        ok.onclick = () => close(field.value.trim() || null);
        cancel.onclick = () => close(null);
        overlay.addEventListener("mousedown", (ev) => {
            if (ev.target === overlay) close(null);
        });
        field.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                close(field.value.trim() || null);
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close(null);
            }
        });
        setTimeout(() => {
            field.focus();
            const slash = field.value.lastIndexOf("/");
            const dot = field.value.lastIndexOf(".");
            field.setSelectionRange(slash + 1, dot > slash + 1 ? dot : field.value.length);
        }, 0);
    });
}

