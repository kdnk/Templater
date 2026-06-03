import TemplaterPlugin from "main";
import { Templater } from "core/Templater";
import {
    EventRef,
    moment,
    normalizePath,
    TAbstractFile,
    TFile,
} from "obsidian";
import { resolve_tfile } from "utils/Utils";
import { errorWrapper } from "utils/Error";

export default class EventHandler {
    private daily_note_creation_event: EventRef | undefined;
    private processed_daily_note_keys = new Set<string>();

    constructor(
        private plugin: TemplaterPlugin,
        private templater: Templater,
    ) {}

    async setup(): Promise<void> {
        this.register_daily_note_creation_listener();

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
        const daily_note_path = this.get_todays_daily_note_path();
        if (!daily_note_path) {
            return;
        }

        const daily_note_file =
            this.plugin.app.vault.getFileByPath(daily_note_path);
        if (!daily_note_file) {
            return;
        }

        await this.process_daily_note_file(daily_note_file);
    }

    private register_daily_note_creation_listener(): void {
        if (this.daily_note_creation_event) {
            return;
        }

        this.daily_note_creation_event = this.plugin.app.vault.on(
            "create",
            (file: TAbstractFile) => {
                void this.handle_daily_note_creation(file);
            },
        );
        this.plugin.registerEvent(this.daily_note_creation_event);
    }

    private async handle_daily_note_creation(
        file: TAbstractFile,
    ): Promise<void> {
        if (!(file instanceof TFile)) {
            return;
        }

        const daily_note_path = this.get_todays_daily_note_path();
        if (daily_note_path !== file.path) {
            return;
        }

        await this.process_daily_note_file(file);
    }

    private get_todays_daily_note_path(): string | null {
        const { daily_note_template } = this.plugin.settings;
        if (!daily_note_template) {
            return null;
        }

        const open_behavior = this.plugin.app.vault.getConfig("openBehavior");
        if (open_behavior !== "daily") {
            return null;
        }

        const daily_notes_plugin =
            this.plugin.app.internalPlugins.getEnabledPluginById(
                "daily-notes",
            );
        if (!daily_notes_plugin) {
            return null;
        }

        const { folder, format } = daily_notes_plugin.options;
        return normalizePath(
            `${folder}/${moment().format(format)}.md`,
        );
    }

    private async process_daily_note_file(daily_note_file: TFile): Promise<void> {
        const daily_note_key = `${daily_note_file.path}:${daily_note_file.stat.ctime}`;
        if (this.processed_daily_note_keys.has(daily_note_key)) {
            return;
        }

        const { daily_note_template } = this.plugin.settings;
        const template_file = await errorWrapper(
            async () =>
                this.resolve_template_file(daily_note_template),
            `Couldn't find template ${daily_note_template}`,
        );
        if (!template_file) {
            return;
        }

        this.processed_daily_note_keys.add(daily_note_key);
        await this.templater.write_template_to_file(
            template_file,
            daily_note_file,
        );
    }

    private resolve_template_file(template_path: string): TFile {
        try {
            return resolve_tfile(this.plugin.app, template_path);
        } catch (error) {
            const { templates_folder } = this.plugin.settings;
            if (!templates_folder) {
                throw error;
            }

            return resolve_tfile(
                this.plugin.app,
                normalizePath(`${templates_folder}/${template_path}`),
            );
        }
    }

}
