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

test('an explicit skip_lines still wins, counted from the first non-blank line', () => {
    const input = block('\nkeep me\n- b\n- a\n', ' skip_lines=1');
    assert.equal(sortKeepSortedBlocks(input), block('\nkeep me\n- a\n- b\n', ' skip_lines=1'));
});
