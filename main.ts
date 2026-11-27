import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { caseForSetting, changedSpan, markSortKey, setSortKey, sortKeepSortedBlocks, sortKeyOf, wrapInMarkers } from './sort';

/** How long a file must go unmodified before its blocks are sorted. Sorting on
 *  every change reorders lines under the cursor while they are still being
 *  typed; waiting for a pause avoids that. */
const QUIET_PERIOD_MS = 5000;

interface KeepSortedSettings {
    /** Sort blocks that give no `case=` ignoring case. Off matches
     *  google/keep-sorted, where the default is case=yes. */
    ignoreCaseByDefault: boolean;
}

const DEFAULT_SETTINGS: KeepSortedSettings = { ignoreCaseByDefault: false };

export default class KeepSortedPlugin extends Plugin {
    settings: KeepSortedSettings = { ...DEFAULT_SETTINGS };
    /** Files being sorted now. Their own write fires a modify event, which is
     *  ignored rather than scheduling another pass. */
    private processing = new Set<TFile>();
    /** Keyed by TFile, whose path Obsidian updates on rename, so a file renamed
     *  during the wait is still sorted under its new name. */
    private pending = new Map<TFile, number>();

    async onload() {
        this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
        this.addSettingTab(new KeepSortedSettingTab(this.app, this));

        this.registerEvent(this.app.vault.on('modify', (file) => {
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            if (this.processing.has(file)) return;
            this.scheduleSort(file);
        }));

        this.addCommand({
            id: 'sort-all',
            name: 'Sort keep-sorted blocks in all files',
            callback: () => this.sortAllFiles()
        });

        this.addCommand({
            id: 'mark-selection',
            name: 'Mark selection',
            editorCallback: (editor: Editor) => {
                // replaceRange on the main selection, not replaceSelection, which
                // would insert the block at every cursor.
                editor.replaceRange(wrapInMarkers(editor.getSelection()), editor.getCursor('from'), editor.getCursor('to'));
            }
        });

        this.addCommand({
            id: 'mark-selection-as-sort-key',
            name: 'Mark selection as sort key',
            editorCallback: (editor: Editor) => {
                const from = editor.getCursor('from');
                const to = editor.getCursor('to');
                if (from.line !== to.line) {
                    new Notice('Keep Sorted: a sort key must lie on one line.');
                    return;
                }
                if (from.ch === to.ch) {
                    new Notice('Keep Sorted: select the text to use as the sort key.');
                    return;
                }
                const line = editor.getLine(from.line);
                // Change only the span that differs, so the caret does not jump
                // to the end of the line and undo undoes just the markers.
                const edit = changedSpan(line, markSortKey(line, from.ch, to.ch));
                editor.replaceRange(edit.text, { line: from.line, ch: edit.from }, { line: from.line, ch: edit.to });
            }
        });

        this.addCommand({
            id: 'set-sort-key',
            name: 'Set sort key',
            editorCallback: (editor: Editor) => {
                const from = editor.getCursor('from');
                const to = editor.getCursor('to');
                const line = editor.getLine(from.line);
                // The selection, when it lies on this line, is the likely key;
                // otherwise the key the line has, so it can be edited.
                const selected = from.line === to.line ? line.slice(from.ch, to.ch).trim() : '';
                new SortKeyModal(this.app, selected || sortKeyOf(line) || '', (key) => {
                    // Reread: the line may have changed while the dialog was open.
                    const now = editor.getLine(from.line);
                    const edit = changedSpan(now, setSortKey(now, key, from.ch));
                    editor.replaceRange(edit.text, { line: from.line, ch: edit.from }, { line: from.line, ch: edit.to });
                }).open();
            }
        });
    }

    /** Sort whatever is still waiting rather than dropping it, so an edit made
     *  just before Obsidian closes or the plugin is disabled is not left unsorted. */
    onunload() {
        for (const [file, timer] of this.pending) {
            window.clearTimeout(timer);
            void this.sortFile(file);
        }
        this.pending.clear();
    }

    /** Restart this file's quiet timer. */
    private scheduleSort(file: TFile) {
        const existing = this.pending.get(file);
        // window's timers, as Obsidian's guidelines ask: browser timers with
        // number handles rather than Node's Timeout objects.
        if (existing !== undefined) window.clearTimeout(existing);
        this.pending.set(file, window.setTimeout(() => {
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
            await this.app.vault.process(file, (content) =>
                sortKeepSortedBlocks(content, caseForSetting(this.settings.ignoreCaseByDefault)));
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

class KeepSortedSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: KeepSortedPlugin) {
        super(app, plugin);
    }

    display() {
        this.containerEl.empty();
        new Setting(this.containerEl)
            .setName('Ignore case by default')
            .setDesc("Sort blocks that have no case option without regard to case, so apple comes before Zebra. A case=yes or case=no on a block always wins. Blocks are sorted by this setting the next time their file is edited, and it is kept per device, so keep it the same on every device that shares a vault. Off matches Google's keep-sorted, where uppercase sorts before lowercase.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ignoreCaseByDefault)
                .onChange(async (value) => {
                    this.plugin.settings.ignoreCaseByDefault = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));
    }
}

/** Asks for a sort key. Enter or the button submits; an empty key, or one
 *  holding %%, which would end the comment early, is refused. */
class SortKeyModal extends Modal {
    constructor(app: App, private initial: string, private onSubmit: (key: string) => void) {
        super(app);
    }

    onOpen() {
        this.titleEl.setText('Set sort key');
        let value = this.initial;
        new Setting(this.contentEl).setName('Sort key').addText(text => {
            text.setValue(value).onChange(v => { value = v; });
            text.inputEl.addEventListener('keydown', (e) => {
                // Not the Enter that commits an IME composition.
                if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.submit(value); }
            });
            text.inputEl.focus();
            text.inputEl.select();
        });
        new Setting(this.contentEl).addButton(button => button.setButtonText('Set').setCta().onClick(() => this.submit(value)));
    }

    private submit(value: string) {
        const key = value.trim();
        if (key === '') { new Notice('Keep Sorted: the sort key is empty.'); return; }
        if (key.includes('%%')) { new Notice('Keep Sorted: a sort key cannot contain %%.'); return; }
        this.close();
        this.onSubmit(key);
    }

    onClose() {
        this.contentEl.empty();
    }
}
