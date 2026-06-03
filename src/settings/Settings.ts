import TemplaterPlugin from "main";
import { PluginSettingTab, Setting } from "obsidian";
import { FileSuggest, FileSuggestMode } from "./suggesters/FileSuggester";
import { FolderSuggest } from "./suggesters/FolderSuggester";
import { IntellisenseRenderOption } from "./RenderSettings/IntellisenseRenderOption";

export const DEFAULT_SETTINGS: Settings = {
    command_timeout: 5,
    templates_folder: "",
    daily_note_template: "",
    templates_pairs: [["", ""]],
    auto_jump_to_cursor: false,
    enable_system_commands: false,
    shell_path: "",
    user_scripts_folder: "",
    syntax_highlighting: true,
    syntax_highlighting_mobile: false,
    enabled_templates_hotkeys: [""],
    intellisense_render:
        IntellisenseRenderOption.RenderDescriptionParameterReturn,
};

export interface Settings {
    command_timeout: number;
    templates_folder: string;
    daily_note_template: string;
    templates_pairs: Array<[string, string]>;
    auto_jump_to_cursor: boolean;
    enable_system_commands: boolean;
    shell_path: string;
    user_scripts_folder: string;
    syntax_highlighting: boolean;
    syntax_highlighting_mobile: boolean;
    enabled_templates_hotkeys: Array<string>;
    intellisense_render: number;
}

export class TemplaterSettingTab extends PluginSettingTab {
    icon = "templater-icon";

    constructor(private plugin: TemplaterPlugin) {
        super(plugin.app, plugin);
    }

    display(): void {
        this.containerEl.empty();

        this.add_template_folder_setting();
        this.add_daily_note_template_setting();
    }

    add_template_folder_setting(): void {
        new Setting(this.containerEl)
            .setName("Template folder location")
            .setDesc("Files in this folder will be available as templates.")
            .addSearch((cb) => {
                new FolderSuggest(this.app, cb.inputEl);
                cb.setPlaceholder("Example: folder1/folder2")
                    .setValue(this.plugin.settings.templates_folder)
                    .onChange(async (new_folder) => {
                        new_folder = new_folder.trim();
                        new_folder = new_folder.replace(/\/$/, "");

                        this.plugin.settings.templates_folder = new_folder;
                        await this.plugin.save_settings();
                    });
                cb.containerEl.addClass("templater_search");
            });
    }

    add_daily_note_template_setting(): void {
        new Setting(this.containerEl)
            .setName("Daily note template")
            .setDesc("Template to apply to today's daily note on startup.")
            .addSearch((cb) => {
                new FileSuggest(
                    cb.inputEl,
                    this.plugin,
                    FileSuggestMode.TemplateFiles,
                );
                cb.setPlaceholder("Example: folder1/template_file")
                    .setValue(this.plugin.settings.daily_note_template)
                    .onChange(async (new_template) => {
                        this.plugin.settings.daily_note_template = new_template;
                        await this.plugin.save_settings();
                    });
                cb.containerEl.addClass("templater_search");
            });
    }
}
