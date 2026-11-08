"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { showTaskNotification, showPromptNotification } = require("../desktop/task-notification");

function createNotificationClass() {
    return class TestNotification {
        static supported = true;

        static isSupported() {
            return this.supported;
        }

        constructor(options) {
            this.options = options;
            TestNotification.last = this;
        }

        on(event, handler) {
            this[event] = handler;
        }

        show() {
            this.shown = true;
        }
    };
}

test("task notification plays the system sound and restores the window on click", () => {
    const Notification = createNotificationClass();
    const calls = [];
    const window = {
        isDestroyed: () => false,
        isFocused: () => false,
        isMinimized: () => true,
        restore: () => calls.push("restore"),
        show: () => calls.push("show"),
        focus: () => calls.push("focus")
    };

    assert.equal(showTaskNotification({
        Notification,
        window,
        title: "Test",
        outcome: "success"
    }), true);
    assert.deepEqual(Notification.last.options, {
        title: "Test",
        body: "Ta tâche est terminée.",
        silent: false
    });
    assert.equal(Notification.last.shown, true);

    Notification.last.click();
    assert.deepEqual(calls, ["restore", "show", "focus"]);
});

test("task notification is omitted when focused or unsupported", () => {
    const Notification = createNotificationClass();
    const focusedWindow = {
        isDestroyed: () => false,
        isFocused: () => true
    };
    assert.equal(showTaskNotification({
        Notification,
        window: focusedWindow,
        title: "Test",
        outcome: "success"
    }), false);
    assert.equal(Notification.last, undefined);

    Notification.supported = false;
    assert.equal(showTaskNotification({
        Notification,
        window: null,
        title: "Test",
        outcome: "failed"
    }), false);
});

test("an agent question notifies even when the window is focused", () => {
    const Notification = createNotificationClass();
    const calls = [];
    const window = {
        isDestroyed: () => false,
        isFocused: () => true,
        isMinimized: () => false,
        restore: () => calls.push("restore"),
        show: () => calls.push("show"),
        focus: () => calls.push("focus")
    };

    assert.equal(showPromptNotification({
        Notification,
        window,
        prompt: { kind: "question", question: "Quel style préfères-tu ?" }
    }), true);
    assert.deepEqual(Notification.last.options, {
        title: "L’agent a une question",
        body: "Quel style préfères-tu ?",
        silent: false
    });

    Notification.last.click();
    assert.deepEqual(calls, ["show", "focus"]);
});

test("every agent prompt notifies even when the window is focused", () => {
    const Notification = createNotificationClass();
    const focusedWindow = { isDestroyed: () => false, isFocused: () => true };
    const prompts = [
        ["question", "L’agent a une question"],
        ["ask", "L’agent attend ta réponse"],
        ["confirm", "Confirmation demandée"],
        ["command", "Commande à confirmer"],
        ["secret", "Code secret demandé"]
    ];

    for (const [kind, title] of prompts) {
        assert.equal(showPromptNotification({
            Notification,
            window: focusedWindow,
            prompt: { kind, question: "Réponse requise ?" }
        }), true);
        assert.equal(Notification.last.options.title, title);
        assert.equal(Notification.last.options.body, "Réponse requise ?");
        assert.equal(Notification.last.options.silent, false);
    }
});

test("a long question is shortened in the notification body", () => {
    const Notification = createNotificationClass();
    const inactiveWindow = { isDestroyed: () => false, isFocused: () => false };
    showPromptNotification({
        Notification,
        window: inactiveWindow,
        prompt: { kind: "ask", question: "  " + "détail ".repeat(80) + "\nfin  " }
    });
    const body = Notification.last.options.body;
    assert.ok(body.length <= 180);
    assert.match(body, /détail détail/);
    assert.match(body, /…$/);
});
