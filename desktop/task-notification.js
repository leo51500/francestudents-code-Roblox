"use strict";

const activeNotifications = new Set();
const MAX_ACTIVE_NOTIFICATIONS = 20;

function showTaskNotification({ Notification, window, title, outcome }) {
    if (!Notification?.isSupported?.()) return false;
    if (window && !window.isDestroyed() && window.isFocused()) return false;

    const body = outcome === "success"
        ? "Ta tâche est terminée."
        : outcome === "interrupted"
            ? "La tâche a été interrompue."
            : "La tâche s’est terminée avec une erreur.";
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

module.exports = { showTaskNotification };
