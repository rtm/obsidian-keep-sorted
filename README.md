# obsidian-keep-sorted

An Obsidian plug-in to keep lines in a code block sorted

To the developer: Please start off by writing this README describing how the plugin works and some of its features, as a way of ensuring we are aligned on what it is supposed to do. Once you've done that, remove this note.

Note that if the contents of the `keep-sorted` block contain nested items, those items should be kept under their parents in the new order.
Do you have any good ideas about how to specify a custom sort order or sort key, so that for instance a line saying "Bob Myers" could be sorted using the key "Myers, Bob"?

## How to use

-   Clone this repo.
-   Make sure your NodeJS is at least v16 (`node --version`).
-   `npm i` or `yarn` to install dependencies.
-   `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

-   Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## API Documentation

See https://github.com/obsidianmd/obsidian-api
