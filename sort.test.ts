import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortKeepSortedBlocks, wrapInMarkers } from './sort.ts';

/** A block whose start marker carries the options, written as 'order=desc'. */
const block = (body: string, opts = '') =>
    `%% keep-sorted start${opts && ' ' + opts} %%\n${body}%% keep-sorted end %%`;

test('sorts a plain list', () => {
    assert.equal(sortKeepSortedBlocks(block('- b\n- a\n')), block('- a\n- b\n'));
});

test('leading punctuation does not decide where an item sorts', () => {
    const input = block('* Quarto\n* “[Paper](https://example.com)” is unmaintained\n* \'Tis a note\n* Albus\n* "Ode" in quotes\n* (Delta) in brackets\n* — Echo\n* ¡Bravo!\n', ' case=no');
    const expected = block('* Albus\n* ¡Bravo!\n* (Delta) in brackets\n* — Echo\n* "Ode" in quotes\n* “[Paper](https://example.com)” is unmaintained\n* Quarto\n* \'Tis a note\n', ' case=no');
    assert.equal(sortKeepSortedBlocks(input), expected);
});

test('checked and unchecked tasks stay apart', () => {
    const input = block('- [x] apple\n- [ ] zebra\n- [ ] mango\n- [x] banana\n');
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] mango\n- [ ] zebra\n- [x] apple\n- [x] banana\n'));
});

test('a cell of only punctuation still sorts as that punctuation', () => {
    const opts = ' column=Note order=desc';
    const input = block('| Item | Note |\n| --- | --- |\n| a | z |\n| b | — |\n| c | y |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Item | Note |\n| --- | --- |\n| b | — |\n| a | z |\n| c | y |\n', opts));
});

test('column headers made of punctuation are told apart', () => {
    const opts = ' column=%';
    const input = block('| # | % |\n| --- | --- |\n| 1 | 9 |\n| 2 | 3 |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| # | % |\n| --- | --- |\n| 2 | 3 |\n| 1 | 9 |\n', opts));
});

test('a negative number keeps its sign when a numeric column is sorted', () => {
    const input = block('| Item | Amount |\n| --- | --- |\n| a | 3 |\n| b | -5 |\n| c | -$2 |\n', ' column=Amount numeric=yes');
    const expected = block('| Item | Amount |\n| --- | --- |\n| b | -5 |\n| c | -$2 |\n| a | 3 |\n', ' column=Amount numeric=yes');
    assert.equal(sortKeepSortedBlocks(input), expected);
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
    const input = block('\nkeep me\n- b\n- a\n', 'skip_lines=1');
    assert.equal(sortKeepSortedBlocks(input), block('\nkeep me\n- a\n- b\n', 'skip_lines=1'));
});

test('skip_lines=2,-2 holds the header and footer of a table set off by blank lines', () => {
    const opts = 'skip_lines=2,-2';
    const input = block('\nItem | Cost\n--- | ---\nPear | 2\nApple | 1\n--- | ---\nTotal | 3\n\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('\nItem | Cost\n--- | ---\nApple | 1\nPear | 2\n--- | ---\nTotal | 3\n\n', opts));
});

test('a footer-only skip_lines keeps table detection for the header', () => {
    const opts = 'skip_lines=-1';
    const input = block('| Item |\n| --- |\n| b |\n| a |\n| Total |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Item |\n| --- |\n| a |\n| b |\n| Total |\n', opts));
});

test('a skip_lines value that is not a number is ignored', () => {
    const opts = 'skip_lines=abc';
    const input = block('| Item |\n| --- |\n| b |\n| a |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Item |\n| --- |\n| a |\n| b |\n', opts));
});

test('characters outside the BMP sort by code point, as UTF-8 bytes do', () => {
    // U+1F600 is above U+FF61 by code point, though below it in UTF-16 units.
    assert.equal(sortKeepSortedBlocks(block('- \u{1F600}\n- ｡\n')), block('- ｡\n- \u{1F600}\n'));
});

test('skip_lines=0 turns table detection off', () => {
    const input = block('| b |\n| --- |\n| a |\n', 'skip_lines=0');
    assert.equal(sortKeepSortedBlocks(input), block('| --- |\n| a |\n| b |\n', 'skip_lines=0'));
});

test('a table without outer pipes is detected', () => {
    const input = block('Name | Color\n--- | ---\nDog | Brown\nCat | Black\n');
    assert.equal(sortKeepSortedBlocks(input), block('Name | Color\n--- | ---\nCat | Black\nDog | Brown\n'));
});

test('a negative skip_lines holds lines at the bottom', () => {
    assert.equal(sortKeepSortedBlocks(block('- c\n- b\n- a\n', 'skip_lines=-1')), block('- b\n- c\n- a\n', 'skip_lines=-1'));
});

test('skip_lines=2,-2 holds a table header and footer', () => {
    const input = block('Item | Cost\n--- | ---\nPear | 2\nApple | 1\n--- | ---\nTotal | 3\n', 'skip_lines=2,-2');
    assert.equal(sortKeepSortedBlocks(input), block('Item | Cost\n--- | ---\nApple | 1\nPear | 2\n--- | ---\nTotal | 3\n', 'skip_lines=2,-2'));
});

test('sorting is case-sensitive by default, uppercase first', () => {
    assert.equal(sortKeepSortedBlocks(block('- alpha\n- Bravo\n- charlie\n- Delta\n')), block('- Bravo\n- Delta\n- alpha\n- charlie\n'));
});

test('case=no sorts case-insensitively', () => {
    const opts = 'case=no';
    assert.equal(sortKeepSortedBlocks(block('- Bravo\n- alpha\n- Delta\n- charlie\n', opts)), block('- alpha\n- Bravo\n- charlie\n- Delta\n', opts));
});

test('numeric=yes compares runs of digits by value', () => {
    const opts = 'numeric=yes';
    const input = block('- PROGRESS_100\n- PROGRESS_10\n- PROGRESS_1\n- PROGRESS_50\n- PROGRESS_5\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- PROGRESS_1\n- PROGRESS_5\n- PROGRESS_10\n- PROGRESS_50\n- PROGRESS_100\n', opts));
});

test('without numeric, digits compare as characters', () => {
    assert.equal(sortKeepSortedBlocks(block('- a10\n- a9\n- a1\n')), block('- a1\n- a10\n- a9\n'));
});

test('blank lines between held lines and the sorted items stay in place', () => {
    const opts = 'skip_lines=1 order=desc';
    assert.equal(sortKeepSortedBlocks(block('Heading\n\n- a\n- b\n', opts)), block('Heading\n\n- b\n- a\n', opts));
    const foot = 'skip_lines=-1';
    assert.equal(sortKeepSortedBlocks(block('- c\n- b\n\nTotal\n', foot)), block('- b\n- c\n\nTotal\n', foot));
});

test('skip_lines accepts a leading plus sign', () => {
    assert.equal(sortKeepSortedBlocks(block('keep\n- b\n- a\n', 'skip_lines=+1')), block('keep\n- a\n- b\n', 'skip_lines=+1'));
});

test('a held first item is not renumbered away', () => {
    const opts = 'skip_lines=1';
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
    const opts = 'group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n    - z\n- a\n    - y\n', opts)), block('- a\n- b\n    - y\n    - z\n', opts));
});

test('group=no sorts a prose continuation line as an item of its own', () => {
    const opts = 'group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n  more about b\n- a\n', opts)), block('- a\n- b\n  more about b\n', opts));
});

test('with group=no a blank line stays with the line above it', () => {
    const opts = 'group=no';
    assert.equal(sortKeepSortedBlocks(block('- b\n\n- a\n', opts)), block('- a\n- b\n\n', opts));
});

test('a block nested inside another sorts on its own and moves with its item', () => {
    const inner = '    %% keep-sorted start %%\n    - pear\n    - apple\n    %% keep-sorted end %%\n';
    const innerSorted = '    %% keep-sorted start %%\n    - apple\n    - pear\n    %% keep-sorted end %%\n';
    const input = block(`- Zucchini\n- Fruit\n${inner}- Carrot\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- Carrot\n- Fruit\n${innerSorted}- Zucchini\n`));
});

test('an inner block at the same indent as the items stays with the item before it', () => {
    const inner = '%% keep-sorted start %%\n- pear\n- apple\n%% keep-sorted end %%\n';
    const innerSorted = '%% keep-sorted start %%\n- apple\n- pear\n%% keep-sorted end %%\n';
    const input = block(`- Zucchini\n${inner}- Carrot\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- Carrot\n- Zucchini\n${innerSorted}`));
});

test('blocks nest three deep', () => {
    const level3 = '        %% keep-sorted start %%\n        - z\n        - y\n        %% keep-sorted end %%\n';
    const level3Sorted = '        %% keep-sorted start %%\n        - y\n        - z\n        %% keep-sorted end %%\n';
    const input = block(`- b\n- a\n    %% keep-sorted start %%\n    - d\n    - c\n${level3}    %% keep-sorted end %%\n`);
    const expected = block(`- a\n    %% keep-sorted start %%\n    - c\n${level3Sorted}    - d\n    %% keep-sorted end %%\n- b\n`);
    assert.equal(sortKeepSortedBlocks(input), expected);
});

test('a marker mentioned inside an item is not a marker', () => {
    const input = block('- b: `%% keep-sorted start %%`\n- a: `%% keep-sorted end %%`\n');
    assert.equal(sortKeepSortedBlocks(input), block('- a: `%% keep-sorted end %%`\n- b: `%% keep-sorted start %%`\n'));
});

test('a file with CRLF line endings is sorted and keeps them', () => {
    const input = '%% keep-sorted start %%\r\n- b\r\n- a\r\n%% keep-sorted end %%\r\n';
    assert.equal(sortKeepSortedBlocks(input), '%% keep-sorted start %%\r\n- a\r\n- b\r\n%% keep-sorted end %%\r\n');
});

test('two blocks in one file are sorted separately', () => {
    const input = `${block('- b\n- a\n')}\ntext\n${block('- d\n- c\n', 'order=desc')}\n`;
    assert.equal(sortKeepSortedBlocks(input), `${block('- a\n- b\n')}\ntext\n${block('- d\n- c\n', 'order=desc')}\n`);
});

test('a start marker without an end marker leaves the text alone', () => {
    const input = '%% keep-sorted start %%\n- b\n- a\n';
    assert.equal(sortKeepSortedBlocks(input), input);
});

test('nested=yes sorts the items under each item at every level', () => {
    const opts = 'nested=yes';
    const input = block('- Vegetables\n    - zucchini\n    - carrot\n- Fruit\n    - pear\n    - apple\n        - honeycrisp\n        - fuji\n', opts);
    const expected = block('- Fruit\n    - apple\n        - fuji\n        - honeycrisp\n    - pear\n- Vegetables\n    - carrot\n    - zucchini\n', opts);
    assert.equal(sortKeepSortedBlocks(input), expected);
});

test('nested=yes keeps the starting number of each ordered sublist', () => {
    const opts = 'nested=yes';
    const input = block('- b\n    5. z\n    6. y\n- a\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- a\n- b\n    5. y\n    5. z\n', opts));
});

test('nested=yes leaves an inner block to its own options', () => {
    const opts = 'nested=yes';
    const inner = '    %% keep-sorted start order=desc %%\n    - apple\n    - pear\n    %% keep-sorted end %%\n';
    const innerSorted = '    %% keep-sorted start order=desc %%\n    - pear\n    - apple\n    %% keep-sorted end %%\n';
    const input = block(`- Vegetables\n- Fruit\n${inner}`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`- Fruit\n${innerSorted}- Vegetables\n`, opts));
});

test('nested=yes applies order=desc at every level', () => {
    const opts = 'nested=yes order=desc';
    assert.equal(sortKeepSortedBlocks(block('- a\n    - y\n    - z\n- b\n', opts)), block('- b\n- a\n    - z\n    - y\n', opts));
});

test('nested=yes keeps a prose continuation line with its item', () => {
    const opts = 'nested=yes';
    const input = block('- b\n  about b\n    - z\n    - y\n- a\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- a\n- b\n  about b\n    - y\n    - z\n', opts));
});

test('without nested, sub-items keep their order', () => {
    assert.equal(sortKeepSortedBlocks(block('- b\n    - z\n    - y\n- a\n')), block('- a\n- b\n    - z\n    - y\n'));
});

const table = (rows: string, opts = '') => block(`\n| Name | Color |\n| --- | --- |\n${rows}\n`, opts);

test('column=N sorts a table by the Nth cell', () => {
    const opts = 'column=2';
    assert.equal(sortKeepSortedBlocks(table('| Dog | Brown |\n| Cat | Black |\n| Bird | Red |', opts)),
        table('| Cat | Black |\n| Dog | Brown |\n| Bird | Red |', opts));
});

test('column=Name finds the header, ignoring case and formatting', () => {
    const opts = 'column=color';
    const input = block(`\n| Name | **Color** |\n| --- | ---: |\n| Dog | Brown |\n| Cat | Black |\n`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`\n| Name | **Color** |\n| --- | ---: |\n| Cat | Black |\n| Dog | Brown |\n`, opts));
});

test('a quoted column name may contain spaces', () => {
    const opts = 'column="Due date"';
    const input = block(`| Task | Due date |\n| --- | --- |\n| b | 2026-02-01 |\n| a | 2026-01-01 |\n`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`| Task | Due date |\n| --- | --- |\n| a | 2026-01-01 |\n| b | 2026-02-01 |\n`, opts));
});

test('column with case=no folds the cells', () => {
    const opts = 'column=2 case=no';
    assert.equal(sortKeepSortedBlocks(table('| a | beta |\n| b | Alpha |\n| c | Gamma |', opts)),
        table('| b | Alpha |\n| a | beta |\n| c | Gamma |', opts));
});

test('a header that matches twice picks the first column', () => {
    const opts = 'column=Name';
    const input = block('| Name | Name |\n| --- | --- |\n| b | x |\n| a | y |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Name | Name |\n| --- | --- |\n| a | y |\n| b | x |\n', opts));
});

test('column respects an explicit skip_lines', () => {
    const opts = 'column=2 skip_lines=2,-1';
    const input = table('| b | y |\n| a | x |\n| Total | 2 |', opts);
    assert.equal(sortKeepSortedBlocks(input), table('| a | x |\n| b | y |\n| Total | 2 |', opts));
});

test('an unterminated quote is taken literally and leaves the block as it is', () => {
    const input = table('| b | x |\n| a | y |', 'column="Due date');
    assert.equal(sortKeepSortedBlocks(input), input);
});

test('an escaped pipe does not split a cell', () => {
    const opts = 'column=3 numeric=yes order=desc';
    const rows = '| Faucet | [[Ferguson]] | $1,250.00 |\n| Valve | [[Ferguson\\|Ferguson Plumbing]] | $89.50 |\n| Sink | Floor & Decor | |\n| Drain | Home Depot | $212 |';
    const input = block(`\n| Item | Vendor | Price |\n| --- | --- | ---: |\n${rows}\n\n`, opts);
    const sorted = '| Faucet | [[Ferguson]] | $1,250.00 |\n| Drain | Home Depot | $212 |\n| Valve | [[Ferguson\\|Ferguson Plumbing]] | $89.50 |\n| Sink | Floor & Decor | |';
    assert.equal(sortKeepSortedBlocks(input), block(`\n| Item | Vendor | Price |\n| --- | --- | ---: |\n${sorted}\n\n`, opts));
});

test('numeric=yes orders signed, decimal and percent cells by value', () => {
    const opts = 'column=2 numeric=yes';
    const input = table('| a | 12% |\n| b | -3.5 |\n| c | 1.25 |\n| d | 1.5 |\n| e | v10 |\n| f | v2 |', opts);
    assert.equal(sortKeepSortedBlocks(input), table('| b | -3.5 |\n| c | 1.25 |\n| d | 1.5 |\n| a | 12% |\n| f | v2 |\n| e | v10 |', opts));
});

test('tied cells are ordered by the full row, whatever order they came in', () => {
    const opts = 'column=2';
    const expected = table('| a | x |\n| b | x |\n| c | y |', opts);
    assert.equal(sortKeepSortedBlocks(table('| b | x |\n| c | y |\n| a | x |', opts)), expected);
    assert.equal(sortKeepSortedBlocks(table('| c | y |\n| a | x |\n| b | x |', opts)), expected);
});

test('empty and missing cells sort last in both directions', () => {
    const asc = 'column=2';
    assert.equal(sortKeepSortedBlocks(table('| a | |\n| b |\n| c | x |', asc)), table('| c | x |\n| a | |\n| b |', asc));
    const desc = 'column=2 order=desc';
    assert.equal(sortKeepSortedBlocks(table('| a | |\n| c | x |\n| d | y |', desc)), table('| d | y |\n| c | x |\n| a | |', desc));
});

test('a bad column leaves the block as it is', () => {
    for (const opts of ['column=0', 'column=3', 'column=Weight', 'column=1.5']) {
        const input = table('| b | x |\n| a | y |', opts);
        assert.equal(sortKeepSortedBlocks(input), input);
    }
    const list = block('- b\n- a\n', 'column=1');
    assert.equal(sortKeepSortedBlocks(list), list);
});

test('key=task-status puts open tasks first, done tasks last and other statuses between by character', () => {
    const opts = 'key=task-status';
    const input = block('- [x] done\n- [/] in progress\n- [ ] open\n- [X] also done\n- [-] cancelled\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] open\n- [-] cancelled\n- [/] in progress\n- [X] also done\n- [x] done\n', opts));
});

test('key=task-status falls back to the text within a status, without the checkbox', () => {
    const opts = 'key=task-status';
    const input = block('- [x] banana\n- [ ] zebra\n- [-] b\n- [ ] mango\n- [x] apple\n- [-] a\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] mango\n- [ ] zebra\n- [-] a\n- [-] b\n- [x] apple\n- [x] banana\n', opts));
});

test('key=task-status respects case and numeric when comparing the text', () => {
    const opts = 'key=task-status case=no numeric=yes';
    const input = block('- [ ] Task 10\n- [ ] task 9\n- [x] b\n- [x] A\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] task 9\n- [ ] Task 10\n- [x] A\n- [x] b\n', opts));
});

test('key=task-status with order=desc reverses the statuses and the text', () => {
    const opts = 'key=task-status order=desc';
    const input = block('- [ ] a\n- [x] a\n- [-] a\n- [ ] b\n- [x] b\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [x] b\n- [x] a\n- [-] a\n- [ ] b\n- [ ] a\n', opts));
});

test('key=task-status sorts lines without a checkbox after the other statuses and before done tasks', () => {
    const opts = 'key=task-status';
    const input = block('- [x] done\n- plain b\n- [ ] open\n- plain a\n- [-] cancelled\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] open\n- [-] cancelled\n- plain a\n- plain b\n- [x] done\n', opts));
});

test('key=text is the default and leaves the current ordering alone', () => {
    for (const opts of ['', 'key=text']) {
        const input = block('- [x] apple\n- [ ] zebra\n- [-] b\n- [ ] mango\n', opts);
        assert.equal(sortKeepSortedBlocks(input), block('- [ ] mango\n- [ ] zebra\n- [x] apple\n- [-] b\n', opts));
    }
});

test('key=task-status composes with skip_lines and nested=yes', () => {
    const opts = 'key=task-status skip_lines=1 nested=yes';
    const input = block('Heading\n- [x] b\n    - [x] y\n    - [ ] z\n- [ ] a\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('Heading\n- [ ] a\n- [x] b\n    - [ ] z\n    - [x] y\n', opts));
});

test('key=task-status sorts a table by the checkboxes in a column', () => {
    const opts = 'column=Done key=task-status';
    const input = block('| Task | Done |\n| --- | --- |\n| b | [x] |\n| c | |\n| a | [ ] |\n| d | [x] |\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('| Task | Done |\n| --- | --- |\n| a | [ ] |\n| b | [x] |\n| d | [x] |\n| c | |\n', opts));
});

test('a block made by wrapInMarkers is found and sorted', () => {
    assert.equal(sortKeepSortedBlocks(wrapInMarkers('- b\n- a')), wrapInMarkers('- a\n- b'));
});
