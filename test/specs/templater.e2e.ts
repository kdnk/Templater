import { browser } from "@wdio/globals";
import moment from "moment";
import { resetVault } from "../utils/reset-vault";

describe("Templater", () => {
    it("registers daily note processing as an early layout-ready callback when available", async () => {
        const result = await browser.executeObsidian(async ({ app, plugins }) => {
            const plugin = plugins.templaterObsidian;
            const callbacks: { pluginId: string; callback: () => void }[] = [];
            let onLayoutReadyCalled = false;

            const originalCallbacks = app.workspace.onLayoutReadyCallbacks;
            const originalOnLayoutReady = app.workspace.onLayoutReady.bind(
                app.workspace,
            );
            const originalUpdateSyntax =
                plugin.event_handler.update_syntax_highlighting;

            app.workspace.onLayoutReadyCallbacks = callbacks;
            app.workspace.onLayoutReady = (() => {
                onLayoutReadyCalled = true;
            }) as typeof app.workspace.onLayoutReady;
            plugin.event_handler.update_syntax_highlighting = async () => {};

            try {
                await plugin.event_handler.setup();
                return {
                    callbacksLength: callbacks.length,
                    firstPluginId: callbacks[0]?.pluginId ?? null,
                    onLayoutReadyCalled,
                };
            } finally {
                app.workspace.onLayoutReadyCallbacks = originalCallbacks;
                app.workspace.onLayoutReady = originalOnLayoutReady;
                plugin.event_handler.update_syntax_highlighting =
                    originalUpdateSyntax;
            }
        });

        expect(result).toEqual({
            callbacksLength: 1,
            firstPluginId: "templater-obsidian",
            onLayoutReadyCalled: false,
        });
    });

    it("replaces stale layout-ready callbacks for this plugin", async () => {
        const result = await browser.executeObsidian(async ({ app, plugins }) => {
            const plugin = plugins.templaterObsidian;
            const otherPluginCallback = () => {};
            const callbacks: { pluginId: string; callback: () => void }[] = [
                {
                    pluginId: "templater-obsidian",
                    callback: () => {},
                },
                {
                    pluginId: "other-plugin",
                    callback: otherPluginCallback,
                },
                {
                    pluginId: "templater-obsidian",
                    callback: () => {},
                },
            ];

            const originalCallbacks = app.workspace.onLayoutReadyCallbacks;
            const originalOnLayoutReady = app.workspace.onLayoutReady.bind(
                app.workspace,
            );
            const originalUpdateSyntax =
                plugin.event_handler.update_syntax_highlighting;

            app.workspace.onLayoutReadyCallbacks = callbacks;
            app.workspace.onLayoutReady = (() => {}) as typeof app.workspace.onLayoutReady;
            plugin.event_handler.update_syntax_highlighting = async () => {};

            try {
                await plugin.event_handler.setup();
                return {
                    pluginIds: callbacks.map((callback) => callback.pluginId),
                    otherPluginPreserved:
                        callbacks.find(
                            (callback) => callback.pluginId === "other-plugin",
                        )?.callback === otherPluginCallback,
                };
            } finally {
                app.workspace.onLayoutReadyCallbacks = originalCallbacks;
                app.workspace.onLayoutReady = originalOnLayoutReady;
                plugin.event_handler.update_syntax_highlighting =
                    originalUpdateSyntax;
            }
        });

        expect(result).toEqual({
            pluginIds: ["templater-obsidian", "other-plugin"],
            otherPluginPreserved: true,
        });
    });

    it("uses standard layout-ready registration when early callbacks are unavailable", async () => {
        const result = await browser.executeObsidian(async ({ app, plugins }) => {
            const plugin = plugins.templaterObsidian;
            let createListenerRegistered = false;
            let layoutReadyCallback: (() => void) | null = null;

            const originalCallbacks = app.workspace.onLayoutReadyCallbacks;
            const originalOnLayoutReady = app.workspace.onLayoutReady.bind(
                app.workspace,
            );
            const originalVaultOn = app.vault.on.bind(app.vault);
            const originalUpdateSyntax =
                plugin.event_handler.update_syntax_highlighting;
            const originalRegisterEvent = plugin.registerEvent.bind(plugin);

            app.workspace.onLayoutReadyCallbacks = undefined;
            app.workspace.onLayoutReady = ((callback: () => void) => {
                layoutReadyCallback = callback;
            }) as typeof app.workspace.onLayoutReady;
            app.vault.on = ((name: string, callback: unknown) => {
                if (name === "create") {
                    createListenerRegistered = true;
                }
                return originalVaultOn(name as "create", callback as never);
            }) as typeof app.vault.on;
            plugin.event_handler.update_syntax_highlighting = async () => {};
            plugin.registerEvent = (() => {}) as typeof plugin.registerEvent;

            try {
                await plugin.event_handler.setup();
                return {
                    createListenerRegistered,
                    hasDeferredLayoutReadyCallback: layoutReadyCallback !== null,
                };
            } finally {
                app.workspace.onLayoutReadyCallbacks = originalCallbacks;
                app.workspace.onLayoutReady = originalOnLayoutReady;
                app.vault.on = originalVaultOn;
                plugin.event_handler.update_syntax_highlighting =
                    originalUpdateSyntax;
                plugin.registerEvent = originalRegisterEvent;
            }
        });

        expect(result).toEqual({
            createListenerRegistered: false,
            hasDeferredLayoutReadyCallback: true,
        });
    });

    it("processes today's daily note template on layout ready even when no active file is available", async () => {
        const today = moment().format("YYYY-MM-DD");
        await resetVault("test/vault", {
            "templates/daily.md": '<% tp.date.now("YYYY-MM-DD") %>',
        });
        await browser.executeObsidian(async ({ app }, currentDay: string) => {
            await app.vault.createFolder("Daily Notes");
            await app.vault.create(`Daily Notes/${currentDay}.md`, "");
        }, today);

        const result = await browser.executeObsidian(async ({ app, plugins }, currentDay: string) => {
            const plugin = plugins.templaterObsidian;
            const dailyFile = app.vault.getFileByPath(`Daily Notes/${currentDay}.md`);
            if (!dailyFile) {
                throw new Error("Daily note file not found");
            }

            const originalDailyNoteTemplate = plugin.settings.daily_note_template;
            const originalGetConfig = app.vault.getConfig.bind(app.vault);
            const originalGetEnabledPluginById =
                app.internalPlugins.getEnabledPluginById.bind(
                    app.internalPlugins,
                );
            const originalGetActiveFile = app.workspace.getActiveFile.bind(
                app.workspace,
            );
            const originalActiveEditor = app.workspace.activeEditor;

            plugin.settings.daily_note_template = "templates/daily.md";
            app.vault.getConfig = ((key: string) => {
                if (key === "openBehavior") {
                    return "daily";
                }
                return originalGetConfig(key);
            }) as typeof app.vault.getConfig;
            app.internalPlugins.getEnabledPluginById = ((id: string) => {
                if (id === "daily-notes") {
                    return {
                        options: {
                            folder: "Daily Notes",
                            format: "YYYY-MM-DD",
                        },
                    };
                }
                return originalGetEnabledPluginById(id);
            }) as typeof app.internalPlugins.getEnabledPluginById;
            app.workspace.getActiveFile = (() => null) as typeof app.workspace.getActiveFile;
            app.workspace.activeEditor = null;

            try {
                await (
                    plugin.event_handler as unknown as {
                        handle_layout_ready(): Promise<void>;
                    }
                ).handle_layout_ready();
                return app.vault.read(dailyFile);
            } finally {
                plugin.settings.daily_note_template = originalDailyNoteTemplate;
                app.vault.getConfig = originalGetConfig;
                app.internalPlugins.getEnabledPluginById =
                    originalGetEnabledPluginById;
                app.workspace.getActiveFile = originalGetActiveFile;
                app.workspace.activeEditor = originalActiveEditor;
            }
        }, today);

        expect(result).toBe(today);
    });

    it("processes today's daily note template on layout ready using the daily note as target file", async () => {
        const today = moment().format("YYYY-MM-DD");
        const yesterday = moment().add(-1, "days").format("YYYY-MM-DD");
        await resetVault("test/vault", {
            "templates/daily.md": "<% tp.date.yesterday() %>",
            "notes/active.md": "active note",
        });
        await browser.executeObsidian(async ({ app }, currentDay: string) => {
            await app.vault.createFolder("Daily Notes");
            await app.vault.create(`Daily Notes/${currentDay}.md`, "");
        }, today);

        const result = await browser.executeObsidian(async ({ app, plugins }, currentDay: string) => {
            const plugin = plugins.templaterObsidian;
            const dailyFile = app.vault.getFileByPath(`Daily Notes/${currentDay}.md`);
            const activeFile = app.vault.getFileByPath("notes/active.md");
            if (!dailyFile || !activeFile) {
                throw new Error("Test files not found");
            }

            const originalDailyNoteTemplate = plugin.settings.daily_note_template;
            const originalGetConfig = app.vault.getConfig.bind(app.vault);
            const originalGetEnabledPluginById =
                app.internalPlugins.getEnabledPluginById.bind(
                    app.internalPlugins,
                );
            const originalGetActiveFile = app.workspace.getActiveFile.bind(
                app.workspace,
            );
            const originalActiveEditor = app.workspace.activeEditor;

            plugin.settings.daily_note_template = "templates/daily.md";
            app.vault.getConfig = ((key: string) => {
                if (key === "openBehavior") {
                    return "daily";
                }
                return originalGetConfig(key);
            }) as typeof app.vault.getConfig;
            app.internalPlugins.getEnabledPluginById = ((id: string) => {
                if (id === "daily-notes") {
                    return {
                        options: {
                            folder: "Daily Notes",
                            format: "YYYY-MM-DD",
                        },
                    };
                }
                return originalGetEnabledPluginById(id);
            }) as typeof app.internalPlugins.getEnabledPluginById;
            app.workspace.getActiveFile = (() => activeFile) as typeof app.workspace.getActiveFile;
            app.workspace.activeEditor = null;

            try {
                await (
                    plugin.event_handler as unknown as {
                        handle_layout_ready(): Promise<void>;
                    }
                ).handle_layout_ready();
                return app.vault.read(dailyFile);
            } finally {
                plugin.settings.daily_note_template = originalDailyNoteTemplate;
                app.vault.getConfig = originalGetConfig;
                app.internalPlugins.getEnabledPluginById =
                    originalGetEnabledPluginById;
                app.workspace.getActiveFile = originalGetActiveFile;
                app.workspace.activeEditor = originalActiveEditor;
            }
        }, today);

        expect(result).toBe(yesterday);
    });
});
