import { Notice, Plugin, TFile, Editor } from 'obsidian';
import { sortKeepSortedBlocks, wrapInMarkers } from './sort';

/** How long a file must go unmodified before its blocks are sorted. Sorting on
 *  every change reorders lines under the cursor while they are still being
 *  typed; waiting for a pause avoids that. */
const QUIET_PERIOD_MS = 5000;

export default class KeepSortedPlugin extends Plugin {
    /** Files being sorted now. Their own write fires a modify event, which is
     *  ignored rather than scheduling another pass. */
    private processing = new Set<TFile>();
    /** Keyed by TFile, whose path Obsidian updates on rename, so a file renamed
     *  during the wait is still sorted under its new name. */
    private pending = new Map<TFile, ReturnType<typeof setTimeout>>();

    async onload() {
        this.registerEvent(this.app.vault.on('modify', (file) => {
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            if (this.processing.has(file)) return;
            this.scheduleSort(file);
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
                editor.replaceSelection(wrapInMarkers(editor.getSelection()));
            }
        });
    }

    /** Sort whatever is still waiting rather than dropping it, so an edit made
     *  just before Obsidian closes or the plugin is disabled is not left unsorted. */
    onunload() {
        for (const [file, timer] of this.pending) {
            clearTimeout(timer);
            void this.sortFile(file);
        }
        this.pending.clear();
    }

    /** Restart this file's quiet timer. */
    private scheduleSort(file: TFile) {
        const existing = this.pending.get(file);
        if (existing) clearTimeout(existing);
        this.pending.set(file, setTimeout(() => {
            this.pending.delete(file);
            // Skip a file deleted during the wait.
            if (this.app.vault.getAbstractFileByPath(file.path) === file) void this.sortFile(file);
        }, QUIET_PERIOD_MS));
    }

    async sortFile(file: TFile) {
        if (this.processing.has(file)) return;
        this.processing.add(file);
        try {
            if (!(await this.app.vault.cachedRead(file)).includes('keep-sorted')) return;
            // process() reads and writes atomically, so text saved between a
            // separate read and write cannot be overwritten.
            await this.app.vault.process(file, sortKeepSortedBlocks);
        } catch (e) {
            console.error(`Keep Sorted: failed to sort ${file.path}`, e);
            new Notice(`Keep Sorted: failed to sort ${file.path}`);
        } finally {
            this.processing.delete(file);
        }
    }

    async sortAllFiles() {
        for (const file of this.app.vault.getMarkdownFiles()) {
            await this.sortFile(file);
        }
    }
}
