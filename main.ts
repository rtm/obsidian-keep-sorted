import {
	Plugin,
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface KeepSortedPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: KeepSortedPluginSettings = {
	mySetting: "default",
};

export default class KeepSortedPlugin extends Plugin {
	settings: KeepSortedPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor(
			async (
				element: HTMLElement,
				{ sourcePath }: MarkdownPostProcessorContext,
			) => {
				const codeBlocks = element.querySelectorAll("pre > code");

				for (const codeBlock of Array.from(codeBlocks)) {
					if (!codeBlock.hasClass("language-keep-sorted")) continue;

					const preElement = codeBlock.parentElement;
					if (!preElement) continue;

					const src = codeBlock.textContent ?? "";

					preElement.classList.add("keep-sorted-block");

					const el = document.createElement("div");
					el.className = "keep-sorted-container";

					await MarkdownRenderer.render(this.app, src, el, sourcePath, this);
					const sorted = Array.from(el.children).sort(
						(a: Element, b: Element) =>
							(a.textContent ?? "").localeCompare(b.textContent ?? ""),
					);

					console.log("sorted elements are", sorted);
					for (const elt of sorted) el.appendChild(elt);

					preElement.replaceWith(el);
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
