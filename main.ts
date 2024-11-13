import { Plugin } from "obsidian";
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
			console.log("element", element);
			let codeblocks = element.findAll("code");
			codeblocks = codeblocks.filter((item) =>
				item.hasClass("language-keep-sorted")
			);
			for (let codeblock of codeblocks) {
				// console.log("codeblock", codeblock.innerHTML);
				const text = codeblock.innerText.trim();
				// console.log("text", text);

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
