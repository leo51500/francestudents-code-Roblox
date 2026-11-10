"use strict";

const activeNotifications = new Set();
const MAX_ACTIVE_NOTIFICATIONS = 20;

// Windows fait clignoter l'icône de la barre des tâches en rouge/orange pour
// réclamer l'attention. Electron et le shell le déclenchent parfois quand un
// toast est affiché, même si la fenêtre est déjà au premier plan. La
// notification reste affichée et sonore : on annule seulement ce clignotement.
const FLASH_CANCEL_DELAYS = [0, 200, 600, 1200, 2500];

const PROMPT_TITLES = {
    question: "L’agent a une question",
    ask: "L’agent attend ta réponse",
    confirm: "Confirmation demandée",
    command: "Commande à confirmer",
    secret: "Code secret demandé"
};

function cancelAttentionFlash(window) {
    if (!window || typeof window.flashFrame !== "function") return;
    const stop = () => {
        try {
            if (!window.isDestroyed?.()) window.flashFrame(false);
        } catch {
            // Fenêtre déjà fermée : rien à annuler.
        }
    };
    for (const delay of FLASH_CANCEL_DELAYS) {
        if (delay === 0) {
            stop();
            continue;
        }
        const timer = setTimeout(stop, delay);
        timer.unref?.();
    }
    // Si la fenêtre revient au premier plan, le clignotement n'a plus de raison
    // d'être : on l'annule aussi à ce moment-là.
    if (typeof window.once === "function") window.once("focus", stop);
}

function clipBody(value, limit = 180) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function present({ Notification, window, title, body, force = false }) {
    if (!Notification?.isSupported?.()) return false;
    if (!force && window && !window.isDestroyed() && window.isFocused()) return false;

    const notification = new Notification({ title, body, silent: false });
    activeNotifications.add(notification);
    notification.on("close", () => activeNotifications.delete(notification));
    if (activeNotifications.size > MAX_ACTIVE_NOTIFICATIONS) {
        activeNotifications.delete(activeNotifications.values().next().value);
    }

    if (window) {
        notification.on("click", () => {
            if (window.isDestroyed()) return;
            if (window.isMinimized()) window.restore();
            window.show();
            window.focus();
        });
    }

    notification.show();
    cancelAttentionFlash(window);
    return true;
}

function showTaskNotification({ Notification, window, title, outcome, force = false }) {
    const body = outcome === "success"
        ? "Ta tâche est terminée."
        : outcome === "interrupted"
            ? "La tâche a été interrompue."
            : "La tâche s’est terminée avec une erreur.";
    return present({ Notification, window, title, body, force });
}

function showPromptNotification({ Notification, window, prompt }) {
    const kind = String(prompt?.kind || "ask");
    const title = PROMPT_TITLES[kind] || "L’agent a besoin de toi";
    const body = clipBody(prompt?.question) || "Ouvre France-Students-code-Roblox pour répondre.";
    return present({
        Notification,
        window,
        title,
        body,
        force: true
    });
}

module.exports = { showTaskNotification, showPromptNotification };
