"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { showTaskNotification } = require("../desktop/task-notification");

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
