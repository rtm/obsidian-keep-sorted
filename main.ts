import { Plugin, TFile, Editor } from 'obsidian';
import { sortKeepSortedBlocks } from './sort';

/** How long a file must go unmodified before its blocks are sorted. Sorting on
 *  every change reorders lines under the cursor while they are still being
 *  typed; waiting for a pause avoids that. */
const QUIET_PERIOD_MS = 5000;

export default class KeepSortedPlugin extends Plugin {
    private processing = new Set<string>();
    private pending = new Map<string, ReturnType<typeof setTimeout>>();

    async onload() {
        this.registerEvent(this.app.vault.on('modify', (file) => {
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            this.scheduleSort(file.path);
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

    onunload() {
        for (const timer of this.pending.values()) clearTimeout(timer);
        this.pending.clear();
    }

    /** Restart this file's quiet timer. The write sortFile makes will itself
     *  fire a modify event and schedule one more pass, which finds the content
     *  already sorted and writes nothing, so it settles after one extra run.
     *  Tracked by path, not TFile, because the file may be renamed or deleted
     *  during the wait. */
    private scheduleSort(path: string) {
        const existing = this.pending.get(path);
        if (existing) clearTimeout(existing);
        this.pending.set(path, setTimeout(() => {
            this.pending.delete(path);
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) void this.sortFile(file);
        }, QUIET_PERIOD_MS));
    }

    async sortFile(file: TFile) {
        if (this.processing.has(file.path)) return;
        this.processing.add(file.path);
        try {
            const content = await this.app.vault.read(file);
            if (!content.includes('keep-sorted')) return;
            const sorted = sortKeepSortedBlocks(content);
            if (sorted !== content) await this.app.vault.modify(file, sorted);
        } catch (e) {
            console.error(`Keep Sorted: failed to sort ${file.path}`, e);
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
