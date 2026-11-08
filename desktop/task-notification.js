"use strict";

const activeNotifications = new Set();
const MAX_ACTIVE_NOTIFICATIONS = 20;

const PROMPT_TITLES = {
    question: "L’agent a une question",
    ask: "L’agent attend ta réponse",
    confirm: "Confirmation demandée",
    command: "Commande à confirmer",
    secret: "Code secret demandé"
};

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
