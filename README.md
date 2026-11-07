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

Cells are compared the way list items are, by the text you see; an escaped pipe (`\|`, as in an aliased wikilink) stays inside its cell. With `numeric=yes`, cells that are numbers, such as `$1,250.00`, `-3.5` or `12%`, compare by value. Rows whose cells tie are ordered by their full text, and rows with an empty cell in that column go last whichever way the table is sorted. A `column` that names no column, or is given on a block that is not a table, leaves the block unsorted and logs a warning in the developer console.

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
| `case` | `yes`, `no` | `yes` | Case-sensitive sorting, uppercase before lowercase. Use `case=no` to ignore case. |
| `numeric` | `yes`, `no` | `no` | Compare runs of digits by value, so 2 sorts before 10. With `column`, cells that are numbers, such as `$1,250.00`, `-3.5` or `12%`, compare by value instead. |
| `group` | `yes`, `no` | `yes` | Move indented continuation lines with the item above them. Use `group=no` to sort every line on its own. |
| `nested` | `yes`, `no` | `no` | Also sort the items under each item, at every level, so one pair of markers sorts a whole outline. Has no effect with `group=no`, which leaves nothing under an item. Not in Google's keep-sorted. |
| `column` | a position such as `2`, or a header such as `Color` or `"Due date"` | none | Sort a table by one column instead of by each row's full text. Not in Google's keep-sorted. |
| `skip_lines` | number, or two numbers such as `2,-2` | none | Lines to leave unsorted: a positive number at the top, a negative one at the bottom, counted from the first and last non-blank lines. Without a top count, a table's header and separator rows are kept on top automatically; `skip_lines=0` turns that off. |

These options, their values and their defaults match Google's [keep-sorted](https://github.com/google/keep-sorted), except `nested` and `column`, which it does not have. Like it, the plugin compares characters by code point rather than by language, so accented letters, and punctuation inside a name, sort by their character codes. Differences: the plugin compares the text you see, without list markers, link syntax or formatting; it supports none of Google's other options, and does not remove duplicates; and `skip_lines` ignores blank lines at the edges of the block, which Obsidian needs around a table.

## Sort key extraction

Sort keys are derived by stripping the following from each line:

- List prefixes (`-`, `*`, `+`, `1.`)
- Wikilinks: `[[file|display]]` sorts by display text; `[[file]]` sorts by file
- Markdown links: `[text](url)` sorts by text
- Formatting: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`
- Punctuation at the front of what is left: `“Paper”` and `(Paper)` both sort as `Paper`. A number keeps its sign, a task keeps its `[ ]` or `[x]`, and a key of nothing but punctuation is left as it is.

Multi-line items (continuation lines indented deeper than the first line) are kept together as a group unless `group=no` is given.

## Commands

All commands are available from the command palette (Ctrl/Cmd+P), prefixed with "Keep Sorted:".

| Command | Description |
|---|---|
| **Sort keep-sorted blocks in all files** | Re-sort all marked blocks across the entire vault |
| **Mark selection** | Wrap the current selection with `keep-sorted` start/end markers |

## Acknowledgments

The idea and the `keep-sorted start` / `keep-sorted end` markers come from Google's [keep-sorted](https://github.com/google/keep-sorted), a language-agnostic formatter that sorts lines between two markers in any file. The options listed above take their names, values and defaults from it. This plugin brings the same convention to Obsidian notes, using Obsidian comments for the markers; it shares no code with the original.
