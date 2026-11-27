import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedSpan, markSortKey, setSortKey, sortKeepSortedBlocks, sortKeyOf, wrapInMarkers } from './sort.ts';

/** A block whose start marker carries the options, written as 'order=desc'. */
const block = (body: string, opts = '') =>
    `%% keep-sorted start${opts && ' ' + opts} %%\n${body}%% keep-sorted end %%`;

/** The option that leaves punctuation out of the keys, off unless given. */
const IGNORE = 'ignore_punctuation=yes';

/** The items sorted as a list, for testing what a key is made of. */
const sortedItems = (items: string[], opts = IGNORE) =>
    sortKeepSortedBlocks(block(items.map(i => `- ${i}\n`).join(''), opts)).split('\n').slice(1, -1).map(l => l.slice(2));

test('sorts a plain list', () => {
    assert.equal(sortKeepSortedBlocks(block('- b\n- a\n')), block('- a\n- b\n'));
});

test('with ignore_punctuation=yes, leading punctuation does not decide where an item sorts', () => {
    const opts = `case=no ${IGNORE}`;
    const input = block('* Quarto\n* “[Paper](https://example.com)” is unmaintained\n* \'Tis a note\n* Albus\n* "Ode" in quotes\n* (Delta) in brackets\n* — Echo\n* ¡Bravo!\n', opts);
    const expected = block('* Albus\n* ¡Bravo!\n* (Delta) in brackets\n* — Echo\n* "Ode" in quotes\n* “[Paper](https://example.com)” is unmaintained\n* Quarto\n* \'Tis a note\n', opts);
    assert.equal(sortKeepSortedBlocks(input), expected);
});

test('by default punctuation is an ordinary character: a leading quote or bracket sorts by its code', () => {
    const opts = 'case=no';
    const input = block('* Quarto\n* “[Paper](https://example.com)” is unmaintained\n* \'Tis a note\n* Albus\n* "Ode" in quotes\n* (Delta) in brackets\n* — Echo\n* ¡Bravo!\n', opts);
    // By code point: " ' ( then letters, then ¡ — “.
    const expected = block('* "Ode" in quotes\n* \'Tis a note\n* (Delta) in brackets\n* Albus\n* Quarto\n* ¡Bravo!\n* — Echo\n* “[Paper](https://example.com)” is unmaintained\n', opts);
    assert.equal(sortKeepSortedBlocks(input), expected);
});

test('by default punctuation inside, after and between words decides the order too', () => {
    assert.deepEqual(sortedItems(['Dr.', 'Dr'], ''), ['Dr', 'Dr.']);
    assert.deepEqual(sortedItems(['AT&T', 'ATM'], ''), ['AT&T', 'ATM']);
    assert.deepEqual(sortedItems(['ほげふが', 'ほげ、ふが'], ''), ['ほげ、ふが', 'ほげふが']);
    assert.deepEqual(sortedItems(['«Zeta»', 'Alpha', '「ほげ」', '(Beta)'], ''), ['(Beta)', 'Alpha', '«Zeta»', '「ほげ」']);
    assert.deepEqual(sortedItems(['a - c', 'a b'], ''), ['a - c', 'a b']);
});

test('ignore_punctuation=no is the same as leaving it out, and a bad value warns and means no', () => {
    const items = ['“b”', 'a', '(c)'];
    assert.deepEqual(sortedItems(items, 'ignore_punctuation=no'), sortedItems(items, ''));
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: string) => { warnings.push(message); };
    try {
        assert.deepEqual(sortedItems(items, 'ignore_punctuation=maybe'), sortedItems(items, ''));
        sortedItems(items, 'ignore_punctuation=maybe');
    } finally {
        console.warn = warn;
    }
    // Once, however many times the block is sorted.
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ignore_punctuation=maybe/);
});

test('leading punctuation is ignored in every script, by Unicode category', () => {
    // Each pair is the input and the order it sorts into, by the words after the punctuation.
    const cases: [string, string[], string[]][] = [
        ['Latin', ['«Zeta»', '¡Alpha!', '¿Mu?', '(Beta)'], ['¡Alpha!', '(Beta)', '¿Mu?', '«Zeta»']],
        ['Greek', ['«Ωμέγα»', ';Βήτα', '·Άλφα'], ['·Άλφα', ';Βήτα', '«Ωμέγα»']],
        ['Cyrillic', ['—Яблоко', '«Банан»', '„Арбуз“'], ['„Арбуз“', '«Банан»', '—Яблоко']],
        ['Arabic', ['،جمل', '«باب»', 'أسد'], ['أسد', '«باب»', '،جمل']],
        ['Japanese', ['「ほげ」', '『あいう』', '〜うえお', '、かきく', '・さしす'], ['『あいう』', '〜うえお', '、かきく', '・さしす', '「ほげ」']],
        ['fullwidth forms', ['！ほげ', '（あいう）', '＂うえお＂', '＃かきく', '－さしす'], ['（あいう）', '＂うえお＂', '＃かきく', '－さしす', '！ほげ']],
    ];
    for (const [script, input, expected] of cases) {
        assert.deepEqual(sortedItems(input), expected, script);
    }
});

test('every character Unicode gives category P is ignored, leading, inside or trailing, in a list and in a table cell', () => {
    const notIgnored: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
        if (cp >= 0xd800 && cp <= 0xdfff) continue;
        const ch = String.fromCodePoint(cp);
        // * and _ are formatting, which is removed before punctuation is considered.
        if (!/^\p{P}$/u.test(ch) || ch === '*' || ch === '_') continue;
        // c sorts after, and a before, the punctuation if it were part of the key.
        const inList = sortedItems([`${ch}b`, 'c', 'a']);
        const table = block(`| Name |\n| --- |\n| ${ch}b |\n| c |\n| a |\n`, `column=Name ${IGNORE}`);
        const inCell = sortKeepSortedBlocks(table).split('\n').slice(3, 6);
        // Inside and trailing: kept, the character would sort a?c before ab, or after ad, and b? after c.
        const inside = sortedItems([`a${ch}c`, 'ad', 'ab']);
        const trailing = sortedItems([`b${ch}`, 'c', 'a']);
        const wrong = inList.join() !== ['a', `${ch}b`, 'c'].join()
            || inCell.join() !== ['| a |', `| ${ch}b |`, '| c |'].join()
            || inside.join() !== ['ab', `a${ch}c`, 'ad'].join()
            || trailing.join() !== ['a', `b${ch}`, 'c'].join();
        if (wrong) {
            notIgnored.push(`U+${cp.toString(16).toUpperCase()}`);
        }
    }
    assert.deepEqual(notIgnored, []);
});

test('Japanese letters and marks that look like punctuation stay part of the key', () => {
    // ー and 々 are Lm, 〆 is Lo; each sorts after b by its code point if kept.
    assert.deepEqual(sortedItems(['ーa', 'b']), ['b', 'ーa']);
    assert.deepEqual(sortedItems(['々a', 'b']), ['b', '々a']);
    assert.deepEqual(sortedItems(['〆a', 'b']), ['b', '〆a']);
});

test('leading symbols, which Unicode does not call punctuation, still decide the order', () => {
    for (const symbol of ['～', '〒', '〓', '＋', '＝', '＄', '￥', '$', '+', '<', '=', '^', '|', '~']) {
        // Kept, it sorts by its own code point: before a, or after c.
        const item = `${symbol}b`;
        assert.deepEqual(sortedItems([item, 'c', 'a']), symbol < 'a' ? [item, 'a', 'c'] : ['a', 'c', item], symbol);
    }
});

test('punctuation inside or after the text is ignored too, in every script', () => {
    assert.deepEqual(sortedItems(['well-known b', 'wellknown a', 'well known c']), ['well known c', 'wellknown a', 'well-known b']);
    assert.deepEqual(sortedItems(['AT&T', 'ATM']), ['ATM', 'AT&T']);
    assert.deepEqual(sortedItems(['ほげ、ふが', 'ほげあ']), ['ほげあ', 'ほげ、ふが']);
    assert.deepEqual(sortedItems(['«Zeta», b', 'Zeta a']), ['Zeta a', '«Zeta», b']);    assert.deepEqual(sortedItems(['«Привет», мир', 'Привет, всем']), ['Привет, всем', '«Привет», мир']);
});

test('dropping punctuation between spaces leaves one space, not a gap', () => {
    assert.deepEqual(sortedItems(['a - c', 'a b']), ['a b', 'a - c']);
    assert.deepEqual(sortedItems(['x  y c', 'x - y b', 'x y a']), ['x y a', 'x - y b', 'x  y c']);
});

test('keys that tie once punctuation is gone keep the order they came in, in either direction', () => {
    assert.deepEqual(sortedItems(['Dr.', 'Dr']), ['Dr.', 'Dr']);
    assert.deepEqual(sortedItems(['Dr', 'Dr.']), ['Dr', 'Dr.']);
    assert.deepEqual(sortedItems(['ほげふが', 'ほげ、ふが']), ['ほげふが', 'ほげ、ふが']);
    const desc = sortKeepSortedBlocks(block('- Dr.\n- Dr\n- Zed\n', 'order=desc'));
    assert.equal(desc, block('- Zed\n- Dr.\n- Dr\n', 'order=desc'));
    // Sorting what is already sorted changes nothing.
    assert.equal(sortKeepSortedBlocks(desc), desc);
});

test('symbols are not punctuation, so they still decide the order inside a key', () => {
    assert.deepEqual(sortedItems(['a~c', 'ab']), ['ab', 'a~c']);
    assert.deepEqual(sortedItems(['a+c', 'a-b', 'a$d']), ['a$d', 'a+c', 'a-b']);
});

test('explicit keys ignore punctuation too', () => {
    const items = (...lines: string[]) => lines.map(l => `- ${l}\n`).join('');
    // The raw keys sort “c” and (a) by their opening mark; the letters say a, b, c.
    assert.equal(
        sortKeepSortedBlocks(block(items(keyed('x', '“c”'), keyed('x', 'b.'), keyed('x', '(a)')), IGNORE)),
        block(items(keyed('x', '(a)'), keyed('x', 'b.'), keyed('x', '“c”')), IGNORE));
    assert.equal(
        sortKeepSortedBlocks(block(items(commented('x', '「c」'), commented('x', 'b!'), commented('x', '¡a')), IGNORE)),
        block(items(commented('x', '¡a'), commented('x', 'b!'), commented('x', '「c」')), IGNORE));
    // An interior comma is gone, so the key compares as "Smith Jo" against "Smith Al".
    assert.equal(
        sortKeepSortedBlocks(block(items(commented('x', 'Smith, Jo'), commented('x', 'Smith Al')), IGNORE)),
        block(items(commented('x', 'Smith Al'), commented('x', 'Smith, Jo')), IGNORE));
    // By default an explicit key keeps its punctuation, so the raw keys decide.
    assert.equal(
        sortKeepSortedBlocks(block(items(keyed('x', '“a”'), keyed('x', 'b.'), keyed('x', '(c)')))),
        block(items(keyed('x', '(c)'), keyed('x', 'b.'), keyed('x', '“a”'))));
    assert.equal(
        sortKeepSortedBlocks(block(items(commented('x', 'Smith, Al'), commented('x', 'Smith Jo')))),
        block(items(commented('x', 'Smith Jo'), commented('x', 'Smith, Al'))));
});

test('table cells and task text ignore punctuation, interior included', () => {
    const table = (rows: string) => block(`| Name |\n| --- |\n${rows}`, `column=Name ${IGNORE}`);
    assert.equal(sortKeepSortedBlocks(table("| O'neil |\n| Oak |\n| Oat |\n")), table("| Oak |\n| Oat |\n| O'neil |\n"));
    const tasks = (rows: string) => block(rows, `key=task-status ${IGNORE}`);
    assert.equal(sortKeepSortedBlocks(tasks('- [ ] c.\n- [x] b\n- [ ] (a)\n')), tasks('- [ ] (a)\n- [ ] c.\n- [x] b\n'));
});

test('punctuation between digits stays, so digit runs are not fused', () => {
    const sorted = (items: string[], opts = `numeric=yes ${IGNORE}`) =>
        sortKeepSortedBlocks(block(items.map(i => `- ${i}\n`).join(''), opts)).split('\n').slice(1, -1).map(l => l.slice(2));
    // Fused, these would compare as 1210, 1102 and 110; apart, as versions.
    assert.deepEqual(sorted(['1.10.2', '1.2.10', '1.10']), ['1.2.10', '1.10', '1.10.2']);
    assert.deepEqual(sorted(['1.10.1', '1.9']), ['1.9', '1.10.1']);
    // Pre-release suffixes sort as text after the release, not as semver.
    assert.deepEqual(sorted(['v1.10.2', 'v1.2.10', 'v1.9.0-rc.1', 'v1.9.0']), ['v1.2.10', 'v1.9.0', 'v1.9.0-rc.1','v1.10.2']);
    assert.deepEqual(sorted(['10:30 b', '9:45 a', '10:5 c']), ['9:45 a', '10:5 c', '10:30 b']);
    // Without numeric the digits are characters, but v1.9 must still come before v10.0, and dates keep their dashes.
    assert.deepEqual(sorted(['v10.0', 'v1.9'], IGNORE), ['v1.9', 'v10.0']);
    assert.deepEqual(sorted(['2024-10-1', '2024-1-5'], IGNORE), ['2024-1-5', '2024-10-1']);
    // Punctuation not between digits is still dropped.
    assert.deepEqual(sorted(['(v2.1)', 'v1.12.']), ['v1.12.', '(v2.1)']);
    // A number in a table cell is read by its value, separators and all.
    const table = (rows: string) => block(`| Amount |\n| --- |\n${rows}`, `column=Amount numeric=yes ${IGNORE}`);
    assert.equal(sortKeepSortedBlocks(table('| 1,250.5 |\n| 300 |\n| 12 |\n')), table('| 12 |\n| 300 |\n| 1,250.5 |\n'));
});

test('a column name picks the header it spells exactly before one that differs in punctuation', () => {
    const table = (rows: string) => block(`| Q1. | Q1 |\n| --- | --- |\n${rows}`, 'column=Q1');
    // The exact match does not depend on the option.
    assert.equal(sortKeepSortedBlocks(table('| a | z |\n| b | y |\n')), table('| b | y |\n| a | z |\n'));
    // With no exact header, the punctuation-free spelling finds it.
    const loose = (rows: string, opts: string) => block(`| Q1. | Z |\n| --- | --- |\n${rows}`, opts);
    assert.equal(sortKeepSortedBlocks(loose('| b | 1 |\n| a | 2 |\n', `column=Q1 ${IGNORE}`)), loose('| a | 2 |\n| b | 1 |\n', `column=Q1 ${IGNORE}`));
    // Without the option the header must be spelled as it is, so the column is not found and the block is left alone.
    const unsorted = loose('| b | 1 |\n| a | 2 |\n', 'column=Q1');
    assert.equal(sortKeepSortedBlocks(unsorted), unsorted);
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
    // With ignore_punctuation=yes the separator row's dashes are gone, so it sorts as an empty row, after the others.
    const ignoring = block('| b |\n| --- |\n| a |\n', `skip_lines=0 ${IGNORE}`);
    assert.equal(sortKeepSortedBlocks(ignoring), block('| a |\n| b |\n| --- |\n', `skip_lines=0 ${IGNORE}`));
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

test('key=text is the default and sorts the text as written', () => {
    for (const opts of ['', 'key=text']) {
        const input = block('- [x] apple\n- [ ] zebra\n- [-] b\n- [ ] mango\n', opts);
        assert.equal(sortKeepSortedBlocks(input), block('- [ ] mango\n- [ ] zebra\n- [-] b\n- [x] apple\n', opts));
    }
});

test('with ignore_punctuation=yes, key=text keeps a checkbox and ignores the punctuation after it', () => {
    for (const opts of [IGNORE, `key=text ${IGNORE}`]) {
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

test('key=task-status ranks an emoji status by its character like any other', () => {
    const opts = 'key=task-status';
    // U+1F525 is two UTF-16 units, so it is a checkbox only when the pattern reads code points.
    const input = block('- [x] done\n- [\u{1F525}] hot\n- [ ] open\n- [-] cancelled\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] open\n- [-] cancelled\n- [\u{1F525}] hot\n- [x] done\n', opts));
});

test('a key that is not a sort key sorts by text', () => {
    const opts = 'key=status';
    const input = block('- [x] apple\n- [ ] zebra\n- [ ] mango\n', opts);
    assert.equal(sortKeepSortedBlocks(input), block('- [ ] mango\n- [ ] zebra\n- [x] apple\n', opts));
});

test('a block made by wrapInMarkers is found and sorted', () => {
    assert.equal(sortKeepSortedBlocks(wrapInMarkers('- b\n- a')), wrapInMarkers('- a\n- b'));
});

/** An item whose sort key is the text between the key markers. */
const keyed = (before: string, key: string, after = '') =>
    `${before}%% keep-sorted start-key %%${key}%% keep-sorted end-key %%${after}`;

test('an item sorts by its marked key rather than its whole line', () => {
    const input = block(`- ${keyed('Dr. Alice ', 'Zimmer')}, organist
- ${keyed('Bob ', 'Adams')}, organist
- ${keyed('Carol ', 'Moore')}
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${keyed('Bob ', 'Adams')}, organist
- ${keyed('Carol ', 'Moore')}
- ${keyed('Dr. Alice ', 'Zimmer')}, organist
`));
});

test('an item without a key sorts by its whole line among keyed ones', () => {
    const input = block(`- ${keyed('Zed ', 'Mallory')}
- Adams
- Zoe Brown
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- Adams
- ${keyed('Zed ', 'Mallory')}
- Zoe Brown
`));
});

test('a key is read without its link syntax, and honors case, order and numeric', () => {
    const opts = 'case=no order=desc numeric=yes';
    const input = block(`- ${keyed('', '[[Room 10]]')}
- ${keyed('', 'room 2')}
- ${keyed('', 'ROOM 1')}
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${keyed('', '[[Room 10]]')}
- ${keyed('', 'room 2')}
- ${keyed('', 'ROOM 1')}
`, opts));
});

test('the first pair on a line is its key', () => {
    const input = block(`- ${keyed('', 'b')} ${keyed('', 'z')}
- ${keyed('', 'c')}
- ${keyed('', 'a')}
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${keyed('', 'a')}
- ${keyed('', 'b')} ${keyed('', 'z')}
- ${keyed('', 'c')}
`));
});

test('an unclosed start-key leaves the whole line as the key', () => {
    const input = block('- b %% keep-sorted start-key %%a\n- c\n- a\n');
    assert.equal(sortKeepSortedBlocks(input), block('- a\n- b %% keep-sorted start-key %%a\n- c\n'));
});

test('a start-key inside another start-key does not swallow the text between', () => {
    const input = block(`- x %% keep-sorted start-key %% ${keyed('', 'm')}\n- l\n- n\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- l\n- x %% keep-sorted start-key %% ${keyed('', 'm')}\n- n\n`));
});

test('a line that begins with a key marker is not taken for a block marker', () => {
    const input = block(`${keyed('', 'b')}
${keyed('', 'a')}
`);
    assert.equal(sortKeepSortedBlocks(input), block(`${keyed('', 'a')}
${keyed('', 'b')}
`));
});

test('a marked key takes the place of the text after the checkbox with key=task-status', () => {
    const opts = 'key=task-status';
    const input = block(`- [ ] ${keyed('', 'z')}
- [x] ${keyed('', 'a')}
- [ ] ${keyed('', 'b')}
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`- [ ] ${keyed('', 'b')}
- [ ] ${keyed('', 'z')}
- [x] ${keyed('', 'a')}
`, opts));
});

test('a table cell can carry a key too', () => {
    const opts = ' column=Name';
    const input = block(`| Name |
| --- |
| ${keyed('Bob ', 'Zed')} |
| ${keyed('Al ', 'Adams')} |
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`| Name |
| --- |
| ${keyed('Al ', 'Adams')} |
| ${keyed('Bob ', 'Zed')} |
`, opts));
});

test('markSortKey wraps the selected text in the key markers', () => {
    assert.equal(markSortKey('- Alice Reed, organist', 8, 12), '- Alice %% keep-sorted start-key %%Reed%% keep-sorted end-key %%, organist');
});

test('markSortKey replaces a key the line already has, keeping its text', () => {
    const line = keyed('- Alice ', 'Reed', ', organist');
    const from = line.indexOf('organist');
    assert.equal(markSortKey(line, from, from + 'organist'.length), `- Alice Reed, ${keyed('', 'organist')}`);
});

test('markSortKey finds a selection that came before the old key', () => {
    const line = keyed('- Alice Reed ', 'organist');
    assert.equal(markSortKey(line, 2, 7), `- ${keyed('', 'Alice')} Reed organist`);
});

test('markSortKey on text inside the old key moves the key to that text', () => {
    const line = keyed('- ', 'Alice Reed');
    const from = line.indexOf('Reed');
    assert.equal(markSortKey(line, from, from + 4), `- Alice ${keyed('', 'Reed')}`);
});

test('an empty or blank key counts as absent, so the item sorts by its whole line', () => {
    const input = block(`- Zoe ${keyed('', '')}\n- Mary ${keyed('', '  ')}\n- Adams\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- Adams\n- Mary ${keyed('', '  ')}\n- Zoe ${keyed('', '')}\n`));
});

test('a marked key keeps its punctuation and list-like prefix', () => {
    const input = block(`- ${keyed('', 'a')}\n- ${keyed('', '(c)')}\n- ${keyed('', '2. b')}\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${keyed('', '(c)')}\n- ${keyed('', '2. b')}\n- ${keyed('', 'a')}\n`));
});

test('with ignore_punctuation=yes, a marked key keeps its list-like prefix as text, but loses its punctuation', () => {
    const input = block(`- ${keyed('', 'a')}\n- ${keyed('', '(c)')}\n- ${keyed('', '2. b')}\n`, IGNORE);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${keyed('', '2. b')}\n- ${keyed('', 'a')}\n- ${keyed('', '(c)')}\n`, IGNORE));
});

test('a key on a continuation line does not decide the item\'s place', () => {
    const input = block(`- x\n    ${keyed('', 'a')}\n- m\n`);
    assert.equal(sortKeepSortedBlocks(input), block(`- m\n- x\n    ${keyed('', 'a')}\n`));
});

/** An item whose sort key is given in a keep-sorted-key comment. */
const commented = (before: string, key: string, after = '') => `${before} %% keep-sorted-key ${key} %%${after}`;

test('an item sorts by the key in its keep-sorted-key comment', () => {
    const input = block(`- ${commented('[[Alice Zimmer]]', 'Zimmer', ', organist')}
- ${commented('[[Bob Adams]]', 'Adams')}
- ${commented('[[Mrs. Dalloway]]', 'Woolf')}
- [[Carol Moore]]
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${commented('[[Bob Adams]]', 'Adams')}
- [[Carol Moore]]
- ${commented('[[Mrs. Dalloway]]', 'Woolf')}
- ${commented('[[Alice Zimmer]]', 'Zimmer', ', organist')}
`));
});

test('a key comment may hold spaces, honors case, order and numeric, and is read without link syntax', () => {
    const opts = 'case=no order=desc numeric=yes';
    const input = block(`- ${commented('x', '[[Room 10]]')}
- ${commented('y', 'room 2 b')}
- ${commented('z', 'ROOM 1')}
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`- ${commented('x', '[[Room 10]]')}
- ${commented('y', 'room 2 b')}
- ${commented('z', 'ROOM 1')}
`, opts));
});

test('a key comment wins over a pair on the same line, and the first comment counts', () => {
    const input = block(`- ${commented(keyed('', 'z'), 'b')} %% keep-sorted-key y %%
- c
- a
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- a
- ${commented(keyed('', 'z'), 'b')} %% keep-sorted-key y %%
- c
`));
});

test('an empty key comment is ignored, leaves the line to its pair or its text, and is not part of that text', () => {
    const input = block(`- ${commented('zed', '')}
- ${commented(keyed('m ', 'b'), ' ')}
- c
- a
`);
    assert.equal(sortKeepSortedBlocks(input), block(`- a
- ${commented(keyed('m ', 'b'), ' ')}
- c
- ${commented('zed', '')}
`));
});

test('a key comment is not mistaken for a block marker, and keep-sorted-keyword is not a key comment', () => {
    const input = block(`%% keep-sorted-key b %% x
- %% keep-sorted-keyword a %% z
- y
`, IGNORE);
    // The first line sorts as b; the second, with no key, as its text less its
    // leading punctuation, keep-sorted-keyword.
    assert.equal(sortKeepSortedBlocks(input), block(`%% keep-sorted-key b %% x
- %% keep-sorted-keyword a %% z
- y
`, IGNORE));
});

test('a key comment replaces the text after the checkbox with key=task-status', () => {
    const opts = 'key=task-status';
    const input = block(`- [ ] ${commented('zed', 'z')}
- [x] ${commented('ann', 'a')}
- [ ] ${commented('bea', 'b')}
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`- [ ] ${commented('bea', 'b')}
- [ ] ${commented('zed', 'z')}
- [x] ${commented('ann', 'a')}
`, opts));
});

test('a table cell can carry a key comment', () => {
    const opts = ' column=Name';
    const input = block(`| Name |
| --- |
| ${commented('[[Bob Zed]]', 'Zed')} |
| ${commented('[[Al Adams]]', 'Adams')} |
`, opts);
    assert.equal(sortKeepSortedBlocks(input), block(`| Name |
| --- |
| ${commented('[[Al Adams]]', 'Adams')} |
| ${commented('[[Bob Zed]]', 'Zed')} |
`, opts));
});

test('setSortKey appends a key comment to a line without one', () => {
    assert.equal(setSortKey('- [[Alice Reed]], organist  ', ' Reed '), '- [[Alice Reed]], organist %% keep-sorted-key Reed %%');
});

test('setSortKey puts the comment in the cell under the cursor in a table row, and leaves the line alone for an empty key', () => {
    const row = '| [[Al Adams]] | 3 |';
    assert.equal(setSortKey(row, 'Adams', 4), '| [[Al Adams]] %% keep-sorted-key Adams %% | 3 |');
    assert.equal(setSortKey(row, 'three', row.indexOf('3')), '| [[Al Adams]] | 3 %% keep-sorted-key three %% |');
    assert.equal(setSortKey('| [[A\\|B]] | 3', 'x', 0), '| [[A\\|B]] %% keep-sorted-key x %% | 3');
    assert.equal(setSortKey(row, '  '), row);
    assert.equal(setSortKey('- a', ' '), '- a');
});

test('setSortKey replaces a key comment in place and a pair with its text', () => {
    assert.equal(setSortKey(commented('- [[Alice Reed]]', 'Alice', ', organist'), 'Reed'), commented('- [[Alice Reed]]', 'Reed', ', organist'));
    assert.equal(setSortKey(keyed('- Alice ', 'Reed', ', organist'), 'Alice'), '- Alice Reed %% keep-sorted-key Alice %%, organist');
});

test('markSortKey removes a key comment and still finds the selection', () => {
    const line = commented('- Alice', 'x', ' Reed, organist');
    const reed = line.indexOf('Reed');
    assert.equal(markSortKey(line, reed, reed + 4), `- Alice ${keyed('', 'Reed')}, organist`);
    const alice = line.indexOf('Alice');
    assert.equal(markSortKey(line, alice, alice + 5), `- ${keyed('', 'Alice')} Reed, organist`);
    const inside = line.indexOf('%%');
    assert.equal(markSortKey(line, inside, inside + 2), `- Alice${keyed('', '')} Reed, organist`);
});

test('sortKeyOf reads the key in either form', () => {
    assert.equal(sortKeyOf(commented('- a', 'Reed')), 'Reed');
    assert.equal(sortKeyOf(keyed('- a ', 'Moore')), 'Moore');
    assert.equal(sortKeyOf(commented(keyed('- a ', 'Moore'), 'Reed')), 'Reed');
    assert.equal(sortKeyOf('- a'), undefined);
});

test('changedSpan names the one span that differs, and applying it gives the new line', () => {
    const cases: [string, string][] = [
        ['- Alice Reed, organist', markSortKey('- Alice Reed, organist', 8, 12)],
        [keyed('- Alice ', 'Reed', ', organist'), markSortKey(keyed('- Alice ', 'Reed', ', organist'), 2, 7)],
        ['same', 'same'],
        ['', 'new'],
        ['gone', ''],
        ['aaa', 'aaaa'],
    ];
    for (const [before, after] of cases) {
        const { from, to, text } = changedSpan(before, after);
        assert.equal(before.slice(0, from) + text + before.slice(to), after);
    }
    assert.deepEqual(changedSpan('abc', 'a%%X%%bc'), { from: 1, to: 1, text: '%%X%%' });
    assert.deepEqual(changedSpan('same', 'same'), { from: 4, to: 4, text: '' });
});
