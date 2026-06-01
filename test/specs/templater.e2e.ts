import { browser } from "@wdio/globals";
import moment from "moment";
import { obsidianPage } from "wdio-obsidian-service";
import OpenInsertTemplateModalPage from "../page-objects/OpenInsertTemplateModal.page";
import WorkspacePage from "../page-objects/Workspace.page";
import EmptyStateViewPage from "../page-objects/EmptyStateView.page";
import VaultPage from "../page-objects/Vault.page";
import ActiveMarkdownViewPage from "../page-objects/ActiveMarkdownView.page";
import { resetVault } from "../utils/reset-vault";

describe("Templater", () => {
    it("registers file creation trigger before layout-ready callbacks when available", async () => {
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
            const originalUpdateFileMenu = plugin.event_handler.update_file_menu;
            const originalUpdateTrigger =
                plugin.event_handler.update_trigger_file_on_creation;

            app.workspace.onLayoutReadyCallbacks = callbacks;
            app.workspace.onLayoutReady = (() => {
                onLayoutReadyCalled = true;
            }) as typeof app.workspace.onLayoutReady;
            plugin.event_handler.update_syntax_highlighting = async () => {};
            plugin.event_handler.update_file_menu = () => {};
            plugin.event_handler.update_trigger_file_on_creation = () => {};

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
                plugin.event_handler.update_file_menu = originalUpdateFileMenu;
                plugin.event_handler.update_trigger_file_on_creation =
                    originalUpdateTrigger;
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
            const originalUpdateFileMenu = plugin.event_handler.update_file_menu;
            const originalUpdateTrigger =
                plugin.event_handler.update_trigger_file_on_creation;

            app.workspace.onLayoutReadyCallbacks = callbacks;
            app.workspace.onLayoutReady = (() => {}) as typeof app.workspace.onLayoutReady;
            plugin.event_handler.update_syntax_highlighting = async () => {};
            plugin.event_handler.update_file_menu = () => {};
            plugin.event_handler.update_trigger_file_on_creation = () => {};

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
                plugin.event_handler.update_file_menu = originalUpdateFileMenu;
                plugin.event_handler.update_trigger_file_on_creation =
                    originalUpdateTrigger;
            }
        });

        expect(result).toEqual({
            pluginIds: ["templater-obsidian", "other-plugin"],
            otherPluginPreserved: true,
        });
    });

    it("registers file creation trigger immediately when early layout-ready callbacks are unavailable", async () => {
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
            const originalUpdateFileMenu = plugin.event_handler.update_file_menu;
            const originalRegisterEvent = plugin.registerEvent.bind(plugin);
            const originalTriggerOnFileCreation =
                plugin.settings.trigger_on_file_creation;

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
            plugin.event_handler.update_file_menu = () => {};
            plugin.registerEvent = (() => {}) as typeof plugin.registerEvent;
            plugin.settings.trigger_on_file_creation = true;

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
                plugin.event_handler.update_file_menu = originalUpdateFileMenu;
                plugin.registerEvent = originalRegisterEvent;
                plugin.settings.trigger_on_file_creation =
                    originalTriggerOnFileCreation;
            }
        });

        expect(result).toEqual({
            createListenerRegistered: true,
            hasDeferredLayoutReadyCallback: true,
        });
    });

    it("processes today's daily note on layout ready even when no active file is available", async () => {
        const today = moment().format("YYYY-MM-DD");
        await browser.executeObsidian(async ({ plugins }) => {
            plugins.templaterObsidian.settings.trigger_on_file_creation = false;
            plugins.templaterObsidian.event_handler.update_trigger_file_on_creation();
        });
        await resetVault("test/vault", {
            [`Daily Notes/${today}.md`]: '<% tp.date.now("YYYY-MM-DD") %>',
        });

        const result = await browser.executeObsidian(async ({ app, plugins }, currentDay: string) => {
            const plugin = plugins.templaterObsidian;
            const dailyFile = app.vault.getFileByPath(`Daily Notes/${currentDay}.md`);
            if (!dailyFile) {
                throw new Error("Daily note file not found");
            }

            const originalTriggerOnFileCreation =
                plugin.settings.trigger_on_file_creation;
            const originalGetConfig = app.vault.getConfig.bind(app.vault);
            const originalGetEnabledPluginById =
                app.internalPlugins.getEnabledPluginById.bind(
                    app.internalPlugins,
                );
            const originalGetActiveFile = app.workspace.getActiveFile.bind(
                app.workspace,
            );
            const originalActiveEditor = app.workspace.activeEditor;
            const originalUpdateTrigger =
                plugin.event_handler.update_trigger_file_on_creation;

            plugin.settings.trigger_on_file_creation = true;
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
            plugin.event_handler.update_trigger_file_on_creation = () => {};

            try {
                await (
                    plugin.event_handler as unknown as {
                        handle_layout_ready(): Promise<void>;
                    }
                ).handle_layout_ready();
                return app.vault.read(dailyFile);
            } finally {
                plugin.settings.trigger_on_file_creation =
                    originalTriggerOnFileCreation;
                app.vault.getConfig = originalGetConfig;
                app.internalPlugins.getEnabledPluginById =
                    originalGetEnabledPluginById;
                app.workspace.getActiveFile = originalGetActiveFile;
                app.workspace.activeEditor = originalActiveEditor;
                plugin.event_handler.update_trigger_file_on_creation =
                    originalUpdateTrigger;
            }
        }, today);

        expect(result).toBe(today);
    });

    it("does not process the same created file concurrently", async () => {
        await browser.executeObsidian(async ({ plugins }) => {
            plugins.templaterObsidian.settings.trigger_on_file_creation = false;
            plugins.templaterObsidian.event_handler.update_trigger_file_on_creation();
        });
        await resetVault("test/vault", {
            "notes/new-note.md": '<% tp.date.now("YYYY-MM-DD") %>',
        });

        const overwriteCount = await browser.executeObsidian(async ({ app, plugins }) => {
            const plugin = plugins.templaterObsidian;
            const file = app.vault.getFileByPath("notes/new-note.md");
            if (!file) {
                throw new Error("Test note not found");
            }

            const originalOverwrite =
                plugin.templater.overwrite_file_commands.bind(plugin.templater);
            let calls = 0;

            plugin.templater.overwrite_file_commands = (async (...args) => {
                calls += 1;
                return originalOverwrite(...args);
            }) as typeof plugin.templater.overwrite_file_commands;

            const TemplaterClass = plugin.templater.constructor as unknown as {
                on_file_creation(
                    templater: unknown,
                    app: unknown,
                    file: unknown,
                ): Promise<void>;
            };

            try {
                await Promise.all([
                    TemplaterClass.on_file_creation(plugin.templater, app, file),
                    TemplaterClass.on_file_creation(plugin.templater, app, file),
                ]);
                return calls;
            } finally {
                plugin.templater.overwrite_file_commands = originalOverwrite;
            }
        });

        expect(overwriteCount).toBe(1);
    });

    it("append_template_to_active_file shows properties in live preview", async () => {
        await resetVault("test/vault", {
            "templates/template.md": "---\nkey: value\n---\nText",
        });
        await EmptyStateViewPage.clickCreateNewNote();
        await WorkspacePage.expectActiveTabToHaveText("Untitled");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await ActiveMarkdownViewPage.expectPropertiesToBeVisible();
        await VaultPage.expectFileToHaveContent(
            "Untitled.md",
            "---\nkey: value\n---\nText",
        );
    });

    it("append_template_to_active_file gracefully merges YAML primitives", async () => {
        const templateContent =
            "---\n" +
            "only_in_template: template value\n" +
            "both: template value\n" +
            "---\n";
        const targetContent =
            "---\n" +
            "only_in_target: target value\n" +
            "both: target value\n" +
            "---\n";
        const expected =
            "---\n" +
            "only_in_target: target value\n" +
            "both: template value\n" +
            "only_in_template: template value\n" +
            "---\n";
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent("notes/target.md", expected);
    });

    it("append_template_to_active_file gracefully merges YAML lists", async () => {
        const templateContent =
            "---\n" +
            "only_in_template:\n" +
            "  - template_item1\n" +
            "  - template_item2\n" +
            "both:\n" +
            "  - template_value1\n" +
            "  - template_value2\n" +
            "---\n";
        const targetContent =
            "---\n" +
            "only_in_target:\n" +
            "  - target_item1\n" +
            "  - target_item2\n" +
            "both:\n" +
            "  - target_value1\n" +
            "  - target_value2\n" +
            "---\n";
        const expected =
            "---\n" +
            "only_in_target:\n" +
            "  - target_item1\n" +
            "  - target_item2\n" +
            "both:\n" +
            "  - target_value1\n" +
            "  - target_value2\n" +
            "  - template_value1\n" +
            "  - template_value2\n" +
            "only_in_template:\n" +
            "  - template_item1\n" +
            "  - template_item2\n" +
            "---\n";
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent("notes/target.md", expected);
    });

    it("append_template_to_active_file preserves duplicate values in YAML lists that do not match", async () => {
        const templateContent =
            "---\n" +
            "template_duplicates:\n" +
            "  - duplicate_value\n" +
            "  - duplicate_value\n" +
            "  - unique_value\n" +
            "---\n";
        const targetContent =
            "---\n" +
            "target_duplicates:\n" +
            "  - another_duplicate\n" +
            "  - another_duplicate\n" +
            "  - another_unique\n" +
            "---\n";
        const expected =
            "---\n" +
            "target_duplicates:\n" +
            "  - another_duplicate\n" +
            "  - another_duplicate\n" +
            "  - another_unique\n" +
            "template_duplicates:\n" +
            "  - duplicate_value\n" +
            "  - duplicate_value\n" +
            "  - unique_value\n" +
            "---\n";
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent("notes/target.md", expected);
    });

    it("append_template_to_active_file de-duplicates duplicate values in matching YAML lists", async () => {
        const templateContent =
            "---\n" +
            "duplicates_when_merged:\n" +
            "  - template_item\n" +
            "  - shared_item\n" +
            "duplicates_pre_merge:\n" +
            "  - template_item\n" +
            "  - template_item\n" +
            "duplicates_post_merge:\n" +
            "  - template_item\n" +
            "---\n";
        const targetContent =
            "---\n" +
            "duplicates_when_merged:\n" +
            "  - target_item\n" +
            "  - shared_item\n" +
            "duplicates_pre_merge:\n" +
            "  - target_item\n" +
            "duplicates_post_merge:\n" +
            "  - target_item\n" +
            "  - target_item\n" +
            "---\n";
        const expected =
            "---\n" +
            "duplicates_when_merged:\n" +
            "  - target_item\n" +
            "  - shared_item\n" +
            "  - template_item\n" +
            "duplicates_pre_merge:\n" +
            "  - target_item\n" +
            "  - template_item\n" +
            "duplicates_post_merge:\n" +
            "  - target_item\n" +
            "  - template_item\n" +
            "---\n";
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent("notes/target.md", expected);
    });

    async function testInvalidYamlFolderTemplate(templateContent: string) {
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
        });
        await browser.executeObsidian(async ({ plugins }) => {
            plugins.templaterObsidian.settings.trigger_on_file_creation = true;
            plugins.templaterObsidian.settings.enable_folder_templates = true;
            plugins.templaterObsidian.settings.folder_templates = [
                { folder: "notes", template: "templates/template.md" },
            ];
            await plugins.templaterObsidian.save_settings();
            plugins.templaterObsidian.event_handler.update_trigger_file_on_creation();
        });
        try {
            await browser.executeObsidian(async ({ app }) => {
                await app.vault.createFolder("notes");
                await app.vault.create("notes/new-note.md", "");
            });
            await WorkspacePage.waitForAllTemplatesExecuted();
            await VaultPage.expectFileToHaveContent(
                "notes/new-note.md",
                templateContent,
            );
        } finally {
            await browser.executeObsidian(async ({ plugins }) => {
                plugins.templaterObsidian.settings.trigger_on_file_creation = false;
                await plugins.templaterObsidian.save_settings();
                plugins.templaterObsidian.event_handler.update_trigger_file_on_creation();
            });
        }
    }

    it("write_template_to_file inserts template with invalid YAML % directive via folder template trigger", async () => {
        await testInvalidYamlFolderTemplate("---\naliases:\n- %\n---\n");
    });

    it("write_template_to_file inserts template with invalid YAML # in flow sequence via folder template trigger", async () => {
        await testInvalidYamlFolderTemplate("---\ntags: [#test]\n---\n");
    });

    async function testInvalidYamlAppendToActiveFile(
        templateContent: string,
        targetContent: string,
        expectedContent: string,
    ) {
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await ActiveMarkdownViewPage.setCursorToEnd();
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent(
            "notes/target.md",
            expectedContent,
        );
    }

    it("append_template_to_active_file inserts % directive template into note with valid YAML", async () => {
        await testInvalidYamlAppendToActiveFile(
            "---\naliases:\n- %\n---\n",
            "---\ntitle: existing\n---\n",
            "---\ntitle: existing\n---\n---\naliases:\n- %\n---\n",
        );
    });

    it("append_template_to_active_file inserts % directive template into note with invalid YAML", async () => {
        await testInvalidYamlAppendToActiveFile(
            "---\naliases:\n- %\n---\n",
            "---\ntags: [#test]\n---\n",
            "---\ntags: [#test]\n---\n---\naliases:\n- %\n---\n",
        );
    });

    it("append_template_to_active_file inserts # in flow sequence template into note with valid YAML", async () => {
        await testInvalidYamlAppendToActiveFile(
            "---\ntags: [#test]\n---\n",
            "---\ntitle: existing\n---\n",
            "---\ntitle: existing\n---\n---\ntags: [#test]\n---\n",
        );
    });

    it("append_template_to_active_file inserts # in flow sequence template into note with invalid YAML", async () => {
        await testInvalidYamlAppendToActiveFile(
            "---\ntags: [#test]\n---\n",
            "---\naliases:\n- %\n---\n",
            "---\naliases:\n- %\n---\n---\ntags: [#test]\n---\n",
        );
    });

    it("append_template_to_active_file handles mixed data types for same key", async () => {
        const templateContent =
            "---\n" +
            "string_to_list:\n" +
            "  - template_item1\n" +
            "  - template_item2\n" +
            "list_to_string: template string\n" +
            "string_to_number: 42\n" +
            "list_to_boolean: true\n" +
            "---\n";
        const targetContent =
            "---\n" +
            "string_to_list: target string\n" +
            "list_to_string:\n" +
            "  - target_item1\n" +
            "  - target_item2\n" +
            "string_to_number: existing string\n" +
            "list_to_boolean:\n" +
            "  - existing_item\n" +
            "---\n";
        const expected =
            "---\n" +
            "string_to_list:\n" +
            "  - template_item1\n" +
            "  - template_item2\n" +
            "list_to_string: template string\n" +
            "string_to_number: 42\n" +
            "list_to_boolean: true\n" +
            "---\n";
        await resetVault("test/vault", {
            "templates/template.md": templateContent,
            "notes/target.md": targetContent,
        });
        await obsidianPage.openFile("notes/target.md");
        await WorkspacePage.expectActiveTabToHaveText("target");
        await OpenInsertTemplateModalPage.open();
        await OpenInsertTemplateModalPage.selectSuggestionByName("template");
        await WorkspacePage.waitForAllTemplatesExecuted();
        await VaultPage.expectFileToHaveContent("notes/target.md", expected);
    });
});
