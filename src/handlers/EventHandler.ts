import TemplaterPlugin from "main";
import { Templater } from "core/Templater";
import {
    Menu,
    MenuItem,
    moment,
    normalizePath,
    TFile,
    TFolder,
} from "obsidian";
import { resolve_tfile } from "utils/Utils";
import { errorWrapper } from "utils/Error";

export default class EventHandler {
    constructor(
        private plugin: TemplaterPlugin,
        private templater: Templater,
    ) {}

    async setup(): Promise<void> {
        if (Array.isArray(this.plugin.app.workspace.onLayoutReadyCallbacks)) {
            this.remove_layout_ready_callbacks();
            this.plugin.app.workspace.onLayoutReadyCallbacks.unshift({
                pluginId: this.plugin.manifest.id,
                callback: () => {
                    void this.handle_layout_ready();
                },
            });
        } else {
            this.plugin.app.workspace.onLayoutReady(() => {
                void this.handle_layout_ready();
            });
        }
        await this.update_syntax_highlighting();
        this.update_file_menu();
    }

    private remove_layout_ready_callbacks(): void {
        const callbacks = this.plugin.app.workspace.onLayoutReadyCallbacks;
        if (!Array.isArray(callbacks)) {
            return;
        }

        for (let i = callbacks.length - 1; i >= 0; i--) {
            if (callbacks[i].pluginId === this.plugin.manifest.id) {
                callbacks.splice(i, 1);
            }
        }
    }

    private async handle_layout_ready(): Promise<void> {
        const { daily_note_template } = this.plugin.settings;
        if (!daily_note_template) {
            return;
        }

        const open_behavior = this.plugin.app.vault.getConfig("openBehavior");
        if (open_behavior !== "daily") {
            return;
        }

        const daily_notes_plugin =
            this.plugin.app.internalPlugins.getEnabledPluginById(
                "daily-notes",
            );
        if (!daily_notes_plugin) {
            return;
        }

        const { folder, format } = daily_notes_plugin.options;
        const daily_note_path = normalizePath(
            `${folder}/${moment().format(format)}.md`,
        );
        const daily_note_file =
            this.plugin.app.vault.getFileByPath(daily_note_path);
        if (!daily_note_file) {
            return;
        }

        const template_file = await errorWrapper(
            async () =>
                resolve_tfile(this.plugin.app, daily_note_template),
            `Couldn't find template ${daily_note_template}`,
        );
        if (!template_file) {
            return;
        }

        await this.templater.write_template_to_file(
            template_file,
            daily_note_file,
        );
    }

    async update_syntax_highlighting(): Promise<void> {
        const desktopShouldHighlight =
            this.plugin.editor_handler.desktopShouldHighlight();
        const mobileShouldHighlight =
            this.plugin.editor_handler.mobileShouldHighlight();

        if (desktopShouldHighlight || mobileShouldHighlight) {
            await this.plugin.editor_handler.enable_highlighter();
        } else {
            await this.plugin.editor_handler.disable_highlighter();
        }
    }

    update_file_menu(): void {
        this.plugin.registerEvent(
            this.plugin.app.workspace.on(
                "file-menu",
                (menu: Menu, file: TFile) => {
                    if (file instanceof TFolder) {
                        menu.addItem((item: MenuItem) => {
                            item.setTitle("Create new note from template")
                                .setIcon("templater-icon")
                                .onClick(() => {
                                    this.plugin.fuzzy_suggester.create_new_note_from_template(
                                        file,
                                    );
                                });
                        });
                    }
                },
            ),
        );
    }
}
