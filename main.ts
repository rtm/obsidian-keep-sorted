import { Plugin, TFile, Editor } from 'obsidian';
import { sortKeepSortedBlocks } from './sort';

export default class KeepSortedPlugin extends Plugin {
    private processing = new Set<string>();

    async onload() {
        this.registerEvent(this.app.vault.on('modify', async (file) => {
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            if (this.processing.has(file.path)) return;
            await this.sortFile(file);
        }));

        this.addCommand({
            id: 'sort-all-keep-sorted-blocks',
            name: 'Sort keep-sorted blocks in all files',
            callback: () => this.sortAllFiles()
        });

        this.addCommand({
            id: 'mark-selection',
            name: 'Mark selection',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection();
                const from = editor.getCursor('from');
                const to = editor.getCursor('to');
                const replacement = `%% keep-sorted start %%\n${selection}\n%% keep-sorted end %%`;
                editor.replaceRange(replacement, from, to);
            }
        });
    }

    async sortFile(file: TFile) {
        const content = await this.app.vault.read(file);
        if (!content.includes('keep-sorted')) return;
        const sorted = sortKeepSortedBlocks(content);
        if (sorted === content) return;
        this.processing.add(file.path);
        try {
            await this.app.vault.modify(file, sorted);
        } finally {
            this.processing.delete(file.path);
        }
    }

    async sortAllFiles() {
        for (const file of this.app.vault.getMarkdownFiles()) {
            await this.sortFile(file);
        }
    }
}
