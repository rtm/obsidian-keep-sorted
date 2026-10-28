import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortKeepSortedBlocks } from './sort.ts';

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

test('skip_lines counts from the marker, blank lines included', () => {
    const input = block('\nkeep me\n- b\n- a\n', ' skip_lines=2');
    assert.equal(sortKeepSortedBlocks(input), block('\nkeep me\n- a\n- b\n', ' skip_lines=2'));
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
