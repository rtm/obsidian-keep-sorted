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

Rows are sorted by their full text, which effectively sorts by the first column.

## Options

Options can be added to the start marker:

```
%% keep-sorted start order=desc case=yes %%
```

| Option | Values | Default | Description |
|---|---|---|---|
| `order` | `asc`, `desc` | `asc` | Sort direction |
| `case` | `yes`, `no` | `yes` | Case-sensitive sorting, uppercase before lowercase. Use `case=no` to ignore case. |
| `numeric` | `yes`, `no` | `no` | Compare runs of digits by value, so 2 sorts before 10 |
| `skip_lines` | number, or two numbers such as `2,-2` | none | Lines to leave unsorted, counted from the markers with blank lines included: a positive number at the top, a negative one at the bottom. Without it, a table's header and separator rows are kept on top automatically; any `skip_lines`, even `0`, turns that off. |

These options, their values and their defaults match Google's [keep-sorted](https://github.com/google/keep-sorted), so a block sorts the same way in both. Like it, the plugin compares characters by code rather than by language, so punctuation and accented letters sort by their character codes.

## Sort key extraction

Sort keys are derived by stripping the following from each line:

- List prefixes (`-`, `*`, `+`, `1.`)
- Wikilinks: `[[file|display]]` sorts by display text; `[[file]]` sorts by file
- Markdown links: `[text](url)` sorts by text
- Formatting: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`

Multi-line items (continuation lines indented deeper than the first line) are kept together as a group.

## Commands

All commands are available from the command palette (Ctrl/Cmd+P), prefixed with "Keep Sorted:".

| Command | Description |
|---|---|
| **Sort keep-sorted blocks in all files** | Re-sort all marked blocks across the entire vault |
| **Mark selection** | Wrap the current selection with `keep-sorted` start/end markers |

## Acknowledgments

The idea and the `keep-sorted start` / `keep-sorted end` markers come from Google's [keep-sorted](https://github.com/google/keep-sorted), a language-agnostic formatter that sorts lines between two markers in any file. The options listed above take their names, values and defaults from it. This plugin brings the same convention to Obsidian notes, using Obsidian comments for the markers; it shares no code with the original.
