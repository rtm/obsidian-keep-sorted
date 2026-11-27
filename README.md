# Keep Sorted

An Obsidian plugin to automatically keep marked list regions sorted in your notes.

## Usage

Wrap any list in `keep-sorted` markers using Obsidian comment syntax:

```
%% keep-sorted start %%
- Dog
- Cat
- Bird
%% keep-sorted end %%
```

The region is sorted automatically once the file has gone five seconds without changes, so lines do not move under the cursor while you type.

An ordered list keeps the number its first item had before sorting, so a list that starts at `100.` still starts at `100.`; the other items keep their own numbers, which Markdown ignores when it renders the list.

A task list can be sorted by its checkboxes instead of by its text, with `key=task-status`:

```
%% keep-sorted start key=task-status %%
- [ ] Do the thing
- [x] Already done
- [-] Cancelled item
- [ ] Another open item
%% keep-sorted end %%
```

Open tasks (`[ ]`) come first and done tasks (`[x]` or `[X]`) last. Any other status, such as `[-]` or `[/]`, sorts between them by its character, and lines with no checkbox go after those, just before the done tasks. Within a status, items sort by the text after the checkbox, as a plain list would, so `case`, `numeric` and the rest apply there, and `order=desc` reverses the whole order, statuses included. A `key` that is neither `text` nor `task-status` sorts by text and logs a warning in the developer console.

When the part of an item that should decide its place is in the middle of the line, such as a surname, mark it in the item with `start-key` and `end-key` comments:

```
%% keep-sorted start %%
- Dr. Carol %% keep-sorted start-key %%Moore%% keep-sorted end-key %%, who played at the cathedral
- [[Bob Adams]]
- Concert organist Alice %% keep-sorted start-key %%Reed%% keep-sorted end-key %%
%% keep-sorted end %%
```

The three items sort as Adams, Moore and Reed; the markers are comments, so they do not show in reading view. An item with no key is compared by its whole line, among the others. The pair must be on the item's first line, since the lines indented under an item can hold keys of their own. Only the first complete pair on a line counts, and a marker left unclosed, or a key with nothing in it, is ignored. The key is used as written, apart from link syntax and formatting, which are removed as in any item text, and the leading punctuation a plain item would skip is kept. `case`, `numeric` and `order` apply to it, and with `key=task-status` it replaces the text after the checkbox. In a table, a key in a cell is that cell's text. Not in Google's keep-sorted.

When the key cannot be wrapped, because the name sits inside a link, where a comment would break it, or is not on the line at all, give it in one comment instead:

```
%% keep-sorted start %%
- [[Carol Moore]] %% keep-sorted-key Moore %%, who played at the cathedral
- [[Mrs. Dalloway]] %% keep-sorted-key Woolf %%
- Concert organist Alice %% keep-sorted start-key %%Reed%% keep-sorted end-key %%
%% keep-sorted end %%
```

The key is everything between `keep-sorted-key` and the closing `%%`, so it may contain spaces, and it is read the same way as a marked pair. It can sit anywhere on the item's first line and wins over a pair on the same line. The first one on the line is the one read, so an empty one is ignored even if another follows, and the item sorts by its pair or its text. The comment is never part of the item's text, so an item left without a key still sorts by what it shows. Not in Google's keep-sorted.

Tables also work: the header and separator rows are recognized and stay on top. Blank lines at the start and end of a block stay put, so the table can be set off from the markers, which Obsidian needs in order to render it as a table:

```
%% keep-sorted start %%

| Name | Color |
| --- | --- |
| Dog | Brown |
| Cat | Black |
| Bird | Red |

%% keep-sorted end %%
```

Rows are sorted by their full text, which effectively sorts by the first column. To sort by another column, name it by position or by its header text, in double quotes if the header has spaces:

```
%% keep-sorted start column=Color %%
%% keep-sorted start column=2 %%
%% keep-sorted start column="Due date" numeric=yes order=desc %%
```

Cells are compared the way list items are, by the text you see; an escaped pipe (`\|`, as in an aliased wikilink) stays inside its cell. With `numeric=yes`, cells that are numbers, such as `$1,250.00`, `-3.5` or `12%`, compare by value. Rows whose cells tie are ordered by their full text, and rows with an empty cell in that column go last whichever way the table is sorted. A `column` that names no column, including a position past the last column, or is given on a block that is not a table, leaves the block unsorted and logs a warning in the developer console.

A block can sit inside another block. The inner block is sorted on its own, and, indented under a list item, it moves with that item when the outer block is sorted:

```
%% keep-sorted start %%
- Vegetables
- Fruit
    %% keep-sorted start %%
    - pear
    - apple
    %% keep-sorted end %%
%% keep-sorted end %%
```

To sort every level of an outline with one pair of markers, use `nested=yes` instead:

```
%% keep-sorted start nested=yes %%
- Vegetables
    - zucchini
    - carrot
- Fruit
    - pear
    - apple
%% keep-sorted end %%
```

## Options

Options can be added to the start marker:

```
%% keep-sorted start order=desc case=yes %%
```

| Option | Values | Default | Description |
|---|---|---|---|
| `order` | `asc`, `desc` | `asc` | Sort direction |
| `case` | `yes`, `no` | `yes`, or `no` with the setting | Case-sensitive sorting, uppercase before lowercase. Use `case=no` to ignore case. The plugin setting "Ignore case by default" makes `no` the default for blocks that give no `case`; an explicit `case=yes` or `case=no` always wins. The setting is stored per device, so keep it the same on every device that shares a vault. |
| `numeric` | `yes`, `no` | `no` | Compare runs of digits by value, so 2 sorts before 10. With `column`, cells that are numbers, such as `$1,250.00`, `-3.5` or `12%`, compare by value instead. |
| `group` | `yes`, `no` | `yes` | Move indented continuation lines with the item above them. Use `group=no` to sort every line on its own. |
| `nested` | `yes`, `no` | `no` | Also sort the items under each item, at every level, so one pair of markers sorts a whole outline. Has no effect with `group=no`, which leaves nothing under an item. Not in Google's keep-sorted. |
| `column` | a position such as `2`, or a header such as `Color` or `"Due date"` | none | Sort a table by one column instead of by each row's full text. Not in Google's keep-sorted. |
| `key` | `text`, `task-status` | `text` | What an item sorts by: its text, or its checkbox first and then its text. With `column`, the checkbox in that column's cell. Not in Google's keep-sorted. |
| `skip_lines` | number, or two numbers such as `2,-2` | none | Lines to leave unsorted: a positive number at the top, a negative one at the bottom, counted from the first and last non-blank lines. Without a top count, a table's header and separator rows are kept on top automatically; `skip_lines=0` turns that off. |

A value that is not one of those listed for `order`, `case`, `numeric`, `group`, `nested` or `key` is ignored: the option is left as it was, which is its default unless the option is repeated, and a warning is logged in the developer console.

These options, their values and their defaults match Google's [keep-sorted](https://github.com/google/keep-sorted), except `nested`, `column` and `key`, which it does not have, and the default for `case` once you turn on the "Ignore case by default" setting. Like it, the plugin compares characters by code point rather than by language, so accented letters, and punctuation inside a name, sort by their character codes. Differences: the plugin compares the text you see, without list markers, link syntax or formatting; it supports none of Google's other options, and does not remove duplicates; and `skip_lines` ignores blank lines at the edges of the block, which Obsidian needs around a table.

## Sort key extraction

Sort keys are derived by stripping the following from each line:

- List prefixes (`-`, `*`, `+`, `1.`)
- Wikilinks: `[[file|display]]` sorts by display text; `[[file]]` sorts by file
- Markdown links: `[text](url)` sorts by text
- Formatting: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`
- Everything but the key, on an item that carries a `keep-sorted-key` comment or `start-key` and `end-key` markers; a `keep-sorted-key` comment with nothing in it is dropped
- Punctuation at the front of what is left: `“Paper”` and `(Paper)` both sort as `Paper`. A number keeps its sign, a task keeps its `[ ]` or `[x]`, and a key of nothing but punctuation is left as it is.

Multi-line items (continuation lines indented deeper than the first line) are kept together as a group unless `group=no` is given.

## Commands

All commands are available from the command palette (Ctrl/Cmd+P), prefixed with "Keep Sorted:".

| Command | Description |
|---|---|
| **Sort keep-sorted blocks in all files** | Re-sort all marked blocks across the entire vault |
| **Mark selection** | Wrap the current selection with `keep-sorted` start/end markers |
| **Mark selection as sort key** | Wrap the selected text, which must lie on one line, in `start-key`/`end-key` markers, replacing the item's old key if it has one |
| **Set sort key** | Ask for the current line's sort key and put it in a `keep-sorted-key` comment, in place of the key the line has in either form, else at the end of the line, or of the cell under the cursor in a table; the selection, or the line's current key, is offered as the starting text |

## Acknowledgments

The idea and the `keep-sorted start` / `keep-sorted end` markers come from Google's [keep-sorted](https://github.com/google/keep-sorted), a language-agnostic formatter that sorts lines between two markers in any file. The options listed above take their names, values and defaults from it. This plugin brings the same convention to Obsidian notes, using Obsidian comments for the markers; it shares no code with the original.
