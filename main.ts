import { Plugin, MarkdownPostProcessorContext } from "obsidian";

// Remember to rename these classes and interfaces!

interface KeepSortedPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: KeepSortedPluginSettings = {
	mySetting: "default",
};

function normalize(s: string | null) {
	return s?.trim().toLowerCase() ?? "";
}

function sortFunc(a: HTMLElement, b: HTMLElement) {
	return normalize(a.textContent).localeCompare(normalize(b.textContent));
}

export default class KeepSortedPlugin extends Plugin {
	settings: KeepSortedPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor(
			async (element: HTMLElement, context: MarkdownPostProcessorContext) => {
				const lists = element.querySelectorAll("ul,ol");

				for (const list of Array.from(lists)) {
					const maybeComment = list.previousSibling;
					if (
						maybeComment?.nodeType !== Node.COMMENT_NODE ||
						!maybeComment?.nodeValue?.match(/s+keep-sorted\s+/i)
					)
						continue;
					list.prepend(...Array.from(list.children).sort(sortFunc));
				}
			},
		);
	}

	onunload() {
		console.log("Unloading keep-sorted Plugin...");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
