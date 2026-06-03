import TemplaterPlugin from "main";
import { Templater } from "core/Templater";
import {
    moment,
    normalizePath,
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

}
