import TemplaterPlugin from "main";
import { PluginSettingTab, Setting } from "obsidian";

export const DEFAULT_SETTINGS: Settings = {
    command_timeout: 5,
    daily_note_template: "",
};

export interface Settings {
    command_timeout: number;
    daily_note_template: string;
}

export class TemplaterSettingTab extends PluginSettingTab {
    icon = "templater-icon";

    constructor(private plugin: TemplaterPlugin) {
        super(plugin.app, plugin);
    }

    display(): void {
        this.containerEl.empty();

        this.add_daily_note_template_setting();
    }

    add_daily_note_template_setting(): void {
        new Setting(this.containerEl)
            .setName("Daily note template")
            .setDesc("Template to apply to today's daily note on startup.")
            .addText((cb) => {
                cb.setPlaceholder("Example: templates/daily.md")
                    .setValue(this.plugin.settings.daily_note_template)
                    .onChange(async (new_template) => {
                        this.plugin.settings.daily_note_template =
                            new_template.trim();
                        await this.plugin.save_settings();
                    });
            });
    }
}
