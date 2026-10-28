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
| `case` | `yes`, `no` | `no` | Case-sensitive sorting |
| `numeric` | `yes`, `no` | `no` | Numeric-aware sorting (e.g. 2 before 10) |
| `skip_lines` | number | `0` | Number of lines at the top of the block to leave unsorted, counted from the first non-blank line. Tables need none; `skip_lines=0` turns table detection off. Blocks that counted a leading blank line in `skip_lines` should drop it by one. |

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

The idea and the `keep-sorted start` / `keep-sorted end` markers come from Google's [keep-sorted](https://github.com/google/keep-sorted), a language-agnostic formatter that sorts lines between two markers in any file. Some option names, such as `case`, `numeric` and `skip_lines`, are borrowed from it, but their defaults and details can differ; the options listed above are the ones this plugin supports. This plugin brings the same convention to Obsidian notes, using Obsidian comments for the markers; it shares no code with the original.
