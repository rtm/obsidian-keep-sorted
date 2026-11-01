import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortKeepSortedBlocks, wrapInMarkers } from './sort.ts';

const block = (body: string, opts = '') =>
    `%% keep-sorted start${opts} %%\n${body}%% keep-sorted end %%`;

test('sorts a plain list', () => {
    assert.equal(sortKeepSortedBlocks(block('- b\n- a\n')), block('- a\n- b\n'));
});

test('a trailing blank line does not travel with the last item', () => {
    assert.equal(sortKeepSortedBlocks(block('- a\n- c\n- b\n\n')), block('- a\n- b\n- c\n\n'));
});

test('a table keeps its header and separator on top with no option', () => {
    const input = block('\n| Z header |\n| --- |\n| b |\n| a |\n\n');
    assert.equal(sortKeepSortedBlocks(input), block('\n| Z header |\n| --- |\n| a |\n| b |\n\n'));
});

test('a table with aligned columns is detected', () => {
    const input = block('| Z | Y |\n| :--- | ---: |\n| b | 1 |\n| a | 2 |\n');
    assert.equal(sortKeepSortedBlocks(input), block('| Z | Y |\n| :--- | ---: |\n| a | 2 |\n| b | 1 |\n'));
});

test('skip_lines counts from the first non-blank line', () => {
    const input = block('\nkeep me\n- b\n- a\n', ' skip_lines=1');
    assert.equal(sortKeepSortedBlocks(input), block('\nkeep me\n- a\n- b\n', ' skip_lines=1'));
});

test('skip_lines=2,-2 holds the header and footer of a table set off by blank lines', () => {
    const opts = ' skip_lines=2,-2';
    const input = block('\nItem | Cost\n--- | ---\nPear | 2\nApple | 1\n--- | ---\nTotal | 3\n\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('\nItem | Cost\n--- | ---\nApple | 1\nPear | 2\n--- | ---\nTotal | 3\n\n', opts));
});

test('a footer-only skip_lines keeps table detection for the header', () => {
    const opts = ' skip_lines=-1';
    const input = block('| Item |\n| --- |\n| b |\n| a |\n| Total |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Item |\n| --- |\n| a |\n| b |\n| Total |\n', opts));
});

test('a skip_lines value that is not a number is ignored', () => {
    const opts = ' skip_lines=abc';
    const input = block('| Item |\n| --- |\n| b |\n| a |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Item |\n| --- |\n| a |\n| b |\n', opts));
});

test('characters outside the BMP sort by code point, as UTF-8 bytes do', () => {
    // U+1F600 is above U+FF61 by code point, though below it in UTF-16 units.
    assert.equal(sortKeepSortedBlocks(block('- \u{1F600}\n- ｡\n')), block('- ｡\n- \u{1F600}\n'));
});

test('skip_lines=0 turns table detection off', () => {
    const input = block('| b |\n| --- |\n| a |\n', ' skip_lines=0');
    assert.equal(sortKeepSortedBlocks(input), block('| --- |\n| a |\n| b |\n', ' skip_lines=0'));
});

test('a table without outer pipes is detected', () => {
    const input = block('Name | Color\n--- | ---\nDog | Brown\nCat | Black\n');
    assert.equal(sortKeepSortedBlocks(input), block('Name | Color\n--- | ---\nCat | Black\nDog | Brown\n'));
});

test('a negative skip_lines holds lines at the bottom', () => {
    assert.equal(sortKeepSortedBlocks(block('- c\n- b\n- a\n', ' skip_lines=-1')), block('- b\n- c\n- a\n', ' skip_lines=-1'));
});

test('skip_lines=2,-2 holds a table header and footer', () => {
    const input = block('Item | Cost\n--- | ---\nPear | 2\nApple | 1\n--- | ---\nTotal | 3\n', ' skip_lines=2,-2');
    assert.equal(sortKeepSortedBlocks(input), block('Item | Cost\n--- | ---\nApple | 1\nPear | 2\n--- | ---\nTotal | 3\n', ' skip_lines=2,-2'));
});

test('sorting is case-sensitive by default, uppercase first', () => {
    assert.equal(sortKeepSortedBlocks(block('- alpha\n- Bravo\n- charlie\n- Delta\n')), block('- Bravo\n- Delta\n- alpha\n- charlie\n'));
});

test('case=no sorts case-insensitively', () => {
    const opts = ' case=no';
    assert.equal(sortKeepSortedBlocks(block('- Bravo\n- alpha\n- Delta\n- charlie\n', opts)), block('- alpha\n- Bravo\n- charlie\n- Delta\n', opts));
});

test('numeric=yes compares runs of digits by value', () => {
    const opts = ' numeric=yes';
    const input = block('- PROGRESS_100\n- PROGRESS_10\n- PROGRESS_1\n- PROGRESS_50\n- PROGRESS_5\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- PROGRESS_1\n- PROGRESS_5\n- PROGRESS_10\n- PROGRESS_50\n- PROGRESS_100\n', opts));
});

test('without numeric, digits compare as characters', () => {
    assert.equal(sortKeepSortedBlocks(block('- a10\n- a9\n- a1\n')), block('- a1\n- a10\n- a9\n'));
});

test('blank lines between held lines and the sorted items stay in place', () => {
    const opts = ' skip_lines=1 order=desc';
    assert.equal(sortKeepSortedBlocks(block('Heading\n\n- a\n- b\n', opts)), block('Heading\n\n- b\n- a\n', opts));
    const foot = ' skip_lines=-1';
    assert.equal(sortKeepSortedBlocks(block('- c\n- b\n\nTotal\n', foot)), block('- b\n- c\n\nTotal\n', foot));
});

test('skip_lines accepts a leading plus sign', () => {
    assert.equal(sortKeepSortedBlocks(block('keep\n- b\n- a\n', ' skip_lines=+1')), block('keep\n- a\n- b\n', ' skip_lines=+1'));
});

test('a held first item is not renumbered away', () => {
    const opts = ' skip_lines=1';
    assert.equal(sortKeepSortedBlocks(block('1. intro\n3. c\n2. b\n', opts)), block('1. intro\n2. b\n3. c\n', opts));
});

test('an ordered list keeps its starting number; the other numbers travel with their items', () => {
    assert.equal(sortKeepSortedBlocks(block('100. c\n101. a\n102. b\n')), block('100. a\n102. b\n100. c\n'));
});

test('the item that moves to the top takes the number that led the list', () => {
    assert.equal(sortKeepSortedBlocks(block('1. c\n2. a\n3. b\n')), block('1. a\n3. b\n1. c\n'));
});

test('indented lines move with the item above them', () => {
    assert.equal(sortKeepSortedBlocks(block('- b\n    - z\n- a\n    - y\n')), block('- a\n    - y\n- b\n    - z\n'));
});

test('group=no sorts every line on its own', () => {
    const opts = ' group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n    - z\n- a\n    - y\n', opts)), block('- a\n- b\n    - y\n    - z\n', opts));
});

test('group=no sorts a prose continuation line as an item of its own', () => {
    const opts = ' group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n  more about b\n- a\n', opts)), block('- a\n- b\n  more about b\n', opts));
});

test('with group=no a blank line stays with the line above it', () => {
    const opts = ' group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n\n- a\n', opts)), block('- a\n- b\n\n', opts));
});

test('a block nested inside another sorts on its own and moves with its item', () => {
    const inner = '    %% keep-sorted start %%\n    - pear\n    - apple\n    %% keep-sorted end %%\n';
    const innerSorted = '    %% keep-sorted start %%\n    - apple\n    - pear\n    %% keep-sorted end %%\n';
    const input = block(`- Zucchini\n- Fruit\n${inner}- Carrot\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- Carrot\n- Fruit\n${innerSorted}- Zucchini\n`));
});

test('two blocks in one file are sorted separately', () => {
    const input = `${block('- b\n- a\n')}\ntext\n${block('- d\n- c\n', ' order=desc')}\n`;
    assert.equal(sortKeepSortedBlocks(input), `${block('- a\n- b\n')}\ntext\n${block('- d\n- c\n', ' order=desc')}\n`);
});

test('a start marker without an end marker leaves the text alone', () => {
    const input = '%% keep-sorted start %%\n- b\n- a\n';
    assert.equal(sortKeepSortedBlocks(input), input);
});

test('a block made by wrapInMarkers is found and sorted', () => {
    assert.equal(sortKeepSortedBlocks(wrapInMarkers('- b\n- a')), wrapInMarkers('- a\n- b'));
});
