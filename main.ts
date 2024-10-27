import { App, Modal, Plugin, PluginSettingTab, Setting } from "obsidian";
import { sortWithIndentation } from "utils";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		console.log("Loading keep-sorted Plugin...");

		this.registerMarkdownPostProcessor((element, context) => {
			let codeblocks = element.findAll("code");
			codeblocks = codeblocks.filter((item) =>
				item.hasClass("language-keep-sorted")
			);
			for (let codeblock of codeblocks) {
				console.log("codeblock", codeblock);
				const text = codeblock.innerText.trim();
				console.log("text", text);

				const lines = text
					.split("\n")
					.filter((line) => line.trim() !== "");

				const sortedContent = sortWithIndentation(lines);

				codeblock.replaceWith(sortedContent.join("\n"));
			}
		});
	}

	onunload() {
		console.log("Unloading keep-sorted Plugin...");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
