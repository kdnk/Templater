import { Plugin } from "obsidian";

import {
    DEFAULT_SETTINGS,
    Settings,
    TemplaterSettingTab,
} from "settings/Settings";
import { Templater } from "core/Templater";
import EventHandler from "handlers/EventHandler";

export default class TemplaterPlugin extends Plugin {
    public settings: Settings;
    public templater: Templater;
    public event_handler: EventHandler;

    async onload(): Promise<void> {
        await this.load_settings();

        this.templater = new Templater(this);
        await this.templater.setup();

        this.event_handler = new EventHandler(
            this,
            this.templater,
        );
        await this.event_handler.setup();

        this.addSettingTab(new TemplaterSettingTab(this));
    }

    async onExternalSettingsChange() {
        await this.load_settings();
    }

    onunload(): void {
        // Failsafe in case teardown doesn't happen immediately after template execution
        void this.templater.functions_generator.teardown();
    }

    async save_settings(): Promise<void> {
        await this.saveData(this.settings);
    }

    async load_settings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData() as Partial<Settings>
        );
    }
}
