/** An option written yes or no. */
type Flag = 'yes' | 'no';

/** What an item sorts by: its text, or with task-status its checkbox first
 *  and its text second. */
type SortKey = 'text' | 'task-status';

// Options follow google/keep-sorted (https://github.com/google/keep-sorted):
// the same names, values and defaults, so a block behaves the same in both.
interface SortOptions {
    case: Flag;
    order: 'asc' | 'desc';
    numeric: boolean;
    skipLines: SkipLines;
    /** Whether indented continuation lines move with the item above them. */
    group: Flag;
    /** Whether the items under each item are sorted too, at every level. Not
     *  in google/keep-sorted, which relies on nested blocks instead. */
    nested: Flag;
    /** The table column to sort by. Not in google/keep-sorted, which has no
     *  table support. */
    column?: Column;
    /** What an item sorts by. Not in google/keep-sorted, which has no tasks. */
    key: SortKey;
}

/** Lines held in place at the top and bottom of the block. head is absent
 *  unless skip_lines gives it, which lets table detection decide. */
type SkipLines = { head?: number; tail: number };

/** A column named by its 1-based position or by its header text. */
type Column = { position: number } | { name: string };

function parseOptions(str: string): SortOptions {
    const opts: SortOptions = { case: 'yes', order: 'asc', numeric: false, skipLines: { tail: 0 }, group: 'yes', nested: 'no', key: 'text' };
    // A value with spaces, such as a header name, is written in double quotes.
    for (const [, key, raw] of str.matchAll(/(\w+)=("[^"]*"|\S+)/g)) {
        // An unterminated quote is taken literally, so the warning shows what was written.
        const quoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
        const val = quoted ? raw.slice(1, -1) : raw;
        if (key === 'case') opts.case = val as Flag;
        else if (key === 'order') opts.order = val as 'asc' | 'desc';
        else if (key === 'numeric') opts.numeric = val === 'yes';
        else if (key === 'skip_lines') opts.skipLines = parseSkipLines(val);
        else if (key === 'group') opts.group = val as Flag;
        else if (key === 'nested') opts.nested = val as Flag;
        else if (key === 'key') opts.key = parseKey(val);
        // A header that is literally a number is quoted to tell it from a position.
        else if (key === 'column') opts.column = !quoted && /^\d+$/.test(val) ? { position: parseInt(val, 10) } : { name: val };
    }
    return opts;
}

/** A value that is not a sort key warns and sorts by text, so a typo does
 *  not pass for the feature doing nothing. */
function parseKey(val: string): SortKey {
    if (val === 'text' || val === 'task-status') return val;
    warnOnce(`key=${val} is not a sort key; the block is sorted by text`);
    return 'text';
}

/** "2" skips two lines at the top; "-2" two at the bottom; "2,-2" both.
 *  Parts that are not integers are ignored. */
function parseSkipLines(val: string): SkipLines {
    const skip: SkipLines = { tail: 0 };
    for (const part of val.split(',')) {
        if (!/^\s*[+-]?\d+\s*$/.test(part)) continue;
        const n = parseInt(part, 10);
        if (n >= 0) skip.head = n;
        else skip.tail = -n;
    }
    return skip;
}

/** Compares by code point, which orders the same as google/keep-sorted's
 *  byte comparison of UTF-8; plain < on strings compares UTF-16 code units,
 *  which misorders emoji and other characters outside the BMP. */
function ordinal(x: string, y: string): number {
    let i = 0;
    while (i < x.length && i < y.length) {
        const a = x.codePointAt(i)!;
        const b = y.codePointAt(i)!;
        if (a !== b) return a - b;
        i += a > 0xffff ? 2 : 1;
    }
    return x.length - y.length;
}

/** Compares by character, as google/keep-sorted does, rather than by locale,
 *  so uppercase sorts before lowercase. With numeric, runs of digits compare
 *  by value: PROGRESS_5 before PROGRESS_10. */
function compareKeys(a: string, b: string, numeric: boolean): number {
    if (!numeric) return ordinal(a, b);
    const runsA = a.match(/\d+|\D+/g) ?? [];
    const runsB = b.match(/\d+|\D+/g) ?? [];
    for (let i = 0; i < Math.min(runsA.length, runsB.length); i++) {
        const [x, y] = [runsA[i], runsB[i]];
        const cmp = /^\d/.test(x) && /^\d/.test(y) ? compareDigits(x, y) : ordinal(x, y);
        if (cmp !== 0) return cmp;
    }
    return runsA.length - runsB.length;
}

/** Compares digit strings by value without overflow: fewer significant
 *  digits is smaller. */
function compareDigits(x: string, y: string): number {
    const [p, q] = [x.replace(/^0+/, ''), y.replace(/^0+/, '')];
    return p.length !== q.length ? p.length - q.length : ordinal(p, q);
}

/** A number as a table cell writes it: an optional sign and currency symbol,
 *  digits with optional thousands commas, an optional decimal part, an
 *  optional trailing percent sign. Anything else is undefined. */
function parseNumber(s: string): number | undefined {
    if (!/^[-+]?[$€£¥]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(s)) return undefined;
    return parseFloat(s.replace(/[$€£¥,%]/g, ''));
}

/** Compares two cells. With numeric, cells that are both numbers compare by
 *  value, so $89.50 sorts before $212; otherwise as keys do. */
function compareCells(a: string, b: string, numeric: boolean): number {
    if (numeric) {
        const [x, y] = [parseNumber(a), parseNumber(b)];
        if (x !== undefined && y !== undefined) return x - y;
    }
    return compareKeys(a, b, numeric);
}

/** A comparison in the block's order: reversed for order=desc. */
function directed(cmp: number, order: SortOptions['order']): number {
    return order === 'desc' ? -cmp : cmp;
}

/** The options that decide what text a key is made of. */
type KeyOptions = Pick<SortOptions, 'case' | 'numeric'>;

/** The text a line sorts by: what the reader sees, lowercased when the case
 *  option is no, and without punctuation. */
function extractSortKey(line: string, options: KeyOptions): string {
    return ignorePunctuation(visibleText(line.replace(LIST_PREFIX, ''), options.case).trim(), options);
}

/** Text as the reader sees it: link syntax and formatting removed, and
 *  lowercased when the case option is no. */
function visibleText(text: string, keepCase: Flag): string {
    let s = text;
    // Wikilink: [[file|display]] → display, [[file]] → file
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_: string, file: string, display: string | undefined) => display ?? file);
    // Markdown link: [text](url) → text
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // Markdown formatting: **, __, ~~, *, _, `
    s = s.replace(/\*\*|__|~~|[*_`]/g, '');
    return keepCase !== 'yes' ? s.toLowerCase() : s;
}

/** Punctuation is not part of a name, wherever it stands and in any script:
 *  every character Unicode gives General Category P is dropped, so “Paper”,
 *  (Paper) and Paper sort alike, as do Dr. Smith and Dr Smith. Symbols (category
 *  S, such as $ + ~) are not punctuation and stay. The words left are joined
 *  by single spaces, so dropping a dash between two spaces leaves no gap.
 *  Three things keep theirs: a number its sign and separators, a task its
 *  checkbox, so checked and unchecked tasks stay apart, and a key of nothing
 *  but punctuation, so a dash placeholder still sorts as a dash rather than
 *  as an empty cell. Punctuation between two digits stays too, whatever the
 *  numeric option: dropping the dots would fuse 1.9 into 19, which sorts
 *  after 10.0 as 100, and 1.2.10 into 1210. */
function ignorePunctuation(s: string, options: KeyOptions): string {
    if (parseNumber(s) !== undefined) return s;
    const box = /^\[[ x]\]/i.exec(s)?.[0] ?? '';
    const rest = s.slice(box.length);
    const name = rest
        .replace(/\p{P}+/gu, (run, at: number) => /\d/.test(rest[at - 1] ?? '') && /\d/.test(rest[at + run.length] ?? '') ? run : '')
        .replace(/\s+/g, ' ').trim();
    if (name === '') return s;
    return box === '' ? name : `${box} ${name}`;
}

/** A list item's prefix: indent, "-", "*", "+" or "N.", and the space after. */
const LIST_PREFIX_SOURCE = String.raw`\s*(?:[-*+]|\d+\.)\s+`;
const LIST_PREFIX = new RegExp(`^${LIST_PREFIX_SOURCE}`);
/** A task's checkbox, after the list prefix if there is one, with the
 *  character inside it and the space after it. */
const CHECKBOX = new RegExp(`^(${LIST_PREFIX_SOURCE})?\\[(.)\\](?:\\s+|$)`, 'u');

/** What an item or cell sorts by: the rank of its status, then its text. */
interface ItemKey { rank: string; text: string }

/** The ranks statuses sort in, compared by ordinal: open tasks first, done
 *  tasks last, every other status between them by its character, and items
 *  with no checkbox after those, so a mixed list still sorts. Without
 *  key=task-status every item has no checkbox, so the text decides. */
const OPEN = '0', NO_CHECKBOX = '2', DONE = '3';
function statusRank(status: string | undefined): string {
    if (status === undefined) return NO_CHECKBOX;
    if (status === ' ') return OPEN;
    if (status.toLowerCase() === 'x') return DONE;
    return `1${status}`;
}

/** An item's own sort key, marked inline: the text between a start-key and an
 *  end-key comment. The three groups are the opening marker, the key and the
 *  closing marker. A key cannot contain %%, so a marker left unclosed, or
 *  another opened inside it, never swallows the text after it. Not in
 *  google/keep-sorted. */
const SORT_KEY_OPEN = '%% keep-sorted start-key %%';
const SORT_KEY_CLOSE = '%% keep-sorted end-key %%';
const SORT_KEY = /(%%\s*keep-sorted\s+start-key\s*%%)((?:(?!%%)[^])*)(%%\s*keep-sorted\s+end-key\s*%%)/;

/** An item's sort key given in one comment, %% keep-sorted-key KEY %%, for a
 *  key the pair cannot enclose: a name inside a link, which a comment would
 *  break, or text the line does not show at all. The key is what follows the
 *  marker word up to the closing %%, so it may hold spaces but not %%. The
 *  first group is the whitespace before the comment, which goes with it when
 *  the comment is removed; the second is the key. Not in google/keep-sorted. */
const KEY_COMMENT = /(\s*)%%\s*keep-sorted-key(?![-\w])((?:(?!%%)[^])*)%%/;
const keyComment = (key: string) => `%% keep-sorted-key ${key} %%`;

/** The key of an item or cell. A marked sort key, read as written apart from
 *  link syntax and formatting, is the text: the one in a keep-sorted-key
 *  comment, else the one between a start-key and end-key pair; an empty one
 *  counts as absent. Otherwise the text is the whole item, less any key
 *  comment, which is never content. With key=task-status the checkbox is
 *  split off as the status, and a marked key then replaces only the text that
 *  follows it. */
function itemKey(s: string, options: SortOptions): ItemKey {
    const box = options.key === 'task-status' ? CHECKBOX.exec(s) : null;
    const marked = KEY_COMMENT.exec(s)?.[2].trim() || SORT_KEY.exec(s)?.[2].trim();
    const rest = (box ? s.replace(CHECKBOX, '$1') : s).replace(KEY_COMMENT, '');
    const text = marked ? ignorePunctuation(visibleText(marked, options.case).trim(), options) : extractSortKey(rest, options);
    return { rank: statusRank(box?.[2]), text };
}

/** Compares two items: by status, then by text. */
function compareItems(a: ItemKey, b: ItemKey, compareText: (x: string, y: string) => number): number {
    return ordinal(a.rank, b.rank) || compareText(a.text, b.text);
}

const indentOf = (s: string) => s.search(/\S/);
const isBlank = (s: string) => s.trim() === '';
/** An ordered list item's prefix: indent, number, the space after the dot. */
const ORDERED_PREFIX = /^(\s*)(\d+)\.(\s)/;
/** The markers, each alone on its line. A trailing \r is tolerated so a
 *  CRLF file still sorts. */
const START_MARKER = /^\s*%%\s*keep-sorted\s+start(?![-\w])(.*?)%%[ \t]*\r?$/;
const END_MARKER = /^\s*%%\s*keep-sorted\s+end\s*%%/;

/** A Markdown table's separator row: cells of dashes, optionally colon-aligned. */
function isSeparatorRow(line: string): boolean {
    if (!line.includes('|') && !/^\s*:?-{3,}:?\s*$/.test(line)) return false;
    return splitCells(line).every(c => /^:?-+:?$/.test(c));
}

/** A table row's cells, trimmed. Only an unescaped pipe divides cells: an
 *  aliased wikilink in a table is written [[Note\|Alias]]. */
function splitCells(row: string): string[] {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
}

/** The 0-based index of the column, or the reason it was not found. A name
 *  matches a header after formatting is stripped, ignoring case; the first
 *  match wins. */
function findColumn(column: Column, header: string): { index: number } | { error: string } {
    if ('position' in column) {
        const count = splitCells(header).length;
        if (column.position < 1) return { error: `column=${column.position} is not a position` };
        if (column.position > count) return { error: `column=${column.position} is past the table's last column, ${count}` };
        return { index: column.position - 1 };
    }
    const headers = splitCells(header);
    // Headers that differ only in punctuation (Q1 and Q1.) are told apart by
    // an exact match, ignoring case and formatting, before the looser one.
    const exact = (s: string) => visibleText(s, 'no').trim();
    const loose = (s: string) => extractSortKey(s, { case: 'no', numeric: false });
    let index = headers.map(exact).indexOf(exact(column.name));
    if (index < 0) index = headers.map(loose).indexOf(loose(column.name));
    return index >= 0 ? { index } : { error: `no column is headed "${column.name}"` };
}

const warned = new Set<string>();
/** Warns once per message. The sorter runs after every pause in typing, so a
 *  bad option would otherwise fill the console. */
function warnOnce(message: string): void {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`Keep Sorted: ${message}`);
}

/** Splits off the blank lines at either end, which stay where they are. */
function trimBlankEdges(lines: string[]): { leading: string[]; content: string[]; trailing: string[] } {
    let lead = 0;
    while (lead < lines.length && isBlank(lines[lead])) lead++;
    let trail = lines.length;
    while (trail > lead && isBlank(lines[trail - 1])) trail--;
    return { leading: lines.slice(0, lead), content: lines.slice(lead, trail), trailing: lines.slice(trail) };
}

/** Each line with the lines indented under it. With group=no, every line
 *  stands alone, as in google/keep-sorted. Either way a blank line stays
 *  with the line above it rather than sorting as an empty item, and a
 *  nested block, markers and all, stays with the item before it whatever
 *  its indentation. */
function splitIntoGroups(lines: string[], group: Flag): string[][] {
    const baseIndent = Math.min(...lines.filter(l => !isBlank(l)).map(indentOf));
    const groups: string[][] = [];
    let depth = 0;
    for (const line of lines) {
        const isMarker = START_MARKER.test(line);
        const inBlock = depth > 0 || isMarker;
        if (isMarker) depth++;
        else if (depth > 0 && END_MARKER.test(line)) depth--;
        const ind = indentOf(line);
        const startsItem = !inBlock && ind >= 0 && (group === 'no' || ind <= baseIndent);
        if (groups.length === 0 || startsItem) {
            groups.push([line]);
        } else {
            groups[groups.length - 1].push(line);
        }
    }
    return groups;
}

/** Sorts the lines between a pair of markers. */
function sortBlock(lines: string[], options: SortOptions): string[] {
    // Blank lines at the edges of the block stay where they are. Markdown
    // needs them to separate a table from the markers, and sorting would
    // otherwise carry them into the middle of the block.
    const { leading, content, trailing } = trimBlankEdges(lines);

    // skip_lines counts from the first and last non-blank lines. In
    // google/keep-sorted it counts from the markers, which is the same
    // unless blank lines border the block; here they always do around a table.
    // Without a positive or zero skip_lines, a table's header and separator
    // rows stay on top without being asked for.
    const isTable = content.length >= 2 && content[0].includes('|') && isSeparatorRow(content[1]);
    const head = options.skipLines.head ?? (isTable ? 2 : 0);
    const end = Math.max(head, content.length - options.skipLines.tail);
    const top = content.slice(0, head);
    const bottom = content.slice(end);

    // Blank lines between the held lines and the rest stay in place too.
    const region = trimBlankEdges(content.slice(head, end));

    let sorted: string[];
    if (options.column) {
        // A bad column must never scramble the table, so the block is left as it is.
        const column = isTable ? findColumn(options.column, content[0]) : { error: 'column= needs a table' };
        if ('error' in column) {
            // The first line tells the blocks apart, so each bad block warns.
            warnOnce(`${column.error}; the block starting "${content[0] ?? ''}" was left unsorted`);
            return lines;
        }
        sorted = sortRows(region.content, options, column.index);
    } else {
        // Held lines above start the list, so its numbering is left alone.
        sorted = sortItems(region.content, options, top.length === 0);
    }

    return [...leading, ...top, ...region.leading, ...sorted, ...region.trailing, ...bottom, ...trailing];
}

/** Sorts table rows by one column. Rows whose cells tie are ordered by their
 *  full text, so the result depends only on the table's content, except that
 *  rows differing only in punctuation tie there too and keep their order. A missing or
 *  empty cell sorts last whichever way the table is ordered, as in a
 *  spreadsheet, so unfilled rows collect at the bottom. */
function sortRows(rows: string[], options: SortOptions, column: number): string[] {
    const keyed = rows.map(row => ({
        row,
        cell: itemKey(splitCells(row)[column] ?? '', options),
        full: extractSortKey(row, options),
    }));
    // A cell of only a checkbox is not empty: its status is its content.
    const isEmpty = (k: ItemKey) => k.rank === NO_CHECKBOX && k.text === '';
    keyed.sort((a, b) => {
        if (isEmpty(a.cell) !== isEmpty(b.cell)) return isEmpty(a.cell) ? 1 : -1;
        const byCell = compareItems(a.cell, b.cell, (x, y) => compareCells(x, y, options.numeric));
        return directed(byCell || compareKeys(a.full, b.full, options.numeric), options.order);
    });
    return keyed.map(k => k.row);
}

/** Sorts a list's items, and with nested=yes the items under each of them.
 *  With keepStart, the number that led an ordered list before sorting leads
 *  it after, since Markdown takes the list's start from its first item. */
function sortItems(lines: string[], options: SortOptions, keepStart: boolean): string[] {
    // Each key is computed once, not on every comparison.
    const keyed = splitIntoGroups(lines, options.group)
        .map(group => ({ group: sortUnder(group, options), key: itemKey(group[0], options) }));
    keyed.sort((a, b) => directed(compareItems(a.key, b.key, (x, y) => compareKeys(x, y, options.numeric)), options.order));

    const sorted = keyed.flatMap(k => k.group);
    const start = lines[0]?.match(ORDERED_PREFIX)?.[2];
    if (keepStart && start !== undefined) {
        sorted[0] = sorted[0].replace(ORDERED_PREFIX, `$1${start}.$3`);
    }
    return sorted;
}

/** An item with the lines under it sorted as a list of their own, when
 *  nested=yes asks for it. A nested block is left as it is: sortBlocksIn
 *  has already sorted it by its own options. */
function sortUnder(group: string[], options: SortOptions): string[] {
    if (options.nested !== 'yes' || group.length < 2 || START_MARKER.test(group[0])) return group;
    return [group[0], ...sortItems(group.slice(1), options, true)];
}

/** Wraps text in start and end markers. The marker syntax lives in this file,
 *  beside the pattern that reads it. */
export function wrapInMarkers(text: string): string {
    return `%% keep-sorted start %%\n${text}\n%% keep-sorted end %%`;
}

/** Marks text on a line as its item's sort key: the characters from `from` to
 *  `to` get the key markers around them. A key the line already has is
 *  replaced, since only the first counts: a key comment goes, and a pair's
 *  markers go while the text they enclosed stays. */
export function markSortKey(line: string, from: number, to: number): string {
    const comment = KEY_COMMENT.exec(line);
    if (comment) {
        // Offsets after the comment move up by its length; one inside it
        // lands where it was.
        const unmarked = (p: number) => Math.max(Math.min(p, comment.index), p - comment[0].length);
        [from, to] = [unmarked(from), unmarked(to)];
        line = line.replace(KEY_COMMENT, '');
    }
    const old = SORT_KEY.exec(line);
    if (old) {
        const [whole, open, key, close] = old;
        // Offsets after the old markers are gone. One inside a marker lands at
        // the nearest edge of the key.
        const unmarked = (p: number) =>
            p <= old.index ? p
            : p >= old.index + whole.length ? p - open.length - close.length
            : Math.min(Math.max(p - open.length, old.index), old.index + key.length);
        [from, to] = [unmarked(from), unmarked(to)];
        line = line.replace(SORT_KEY, '$2');
    }
    return `${line.slice(0, from)}${SORT_KEY_OPEN}${line.slice(from, to)}${SORT_KEY_CLOSE}${line.slice(to)}`;
}

/** Gives a line's item the key, in a keep-sorted-key comment: in place of the
 *  comment it already has, else after a start-key and end-key pair, whose
 *  markers come off, else at the end of the line, or, in a table row, at the
 *  end of the cell at `at`, since a comment after the last pipe would be a
 *  cell of its own. An empty key changes nothing. */
export function setSortKey(line: string, key: string, at = line.length): string {
    if (key.trim() === '') return line;
    const comment = keyComment(key.trim());
    if (KEY_COMMENT.test(line)) return line.replace(KEY_COMMENT, (_, space: string) => `${space}${comment}`);
    if (SORT_KEY.test(line)) return line.replace(SORT_KEY, (_, __, text: string) => `${text} ${comment}`);
    const end = isTableRow(line) ? cellEnd(line, at) : line.length;
    return `${line.slice(0, end).trimEnd()} ${comment}${end < line.length ? ' ' : ''}${line.slice(end)}`;
}

/** Whether a line is a table row: it starts with a pipe and has another. */
function isTableRow(line: string): boolean {
    return /^\s*\|/.test(line) && splitCells(line).length > 1;
}

/** The offset of the unescaped pipe that closes the cell holding `at`, or
 *  the line's end if the row has no pipe after it. */
function cellEnd(line: string, at: number): number {
    const pipe = /(?<!\\)\|/g;
    pipe.lastIndex = Math.max(at, 1);
    const m = pipe.exec(line);
    return m ? m.index : line.length;
}

/** The key a line's item has, in either form, or undefined. */
export function sortKeyOf(line: string): string | undefined {
    return KEY_COMMENT.exec(line)?.[2].trim() || SORT_KEY.exec(line)?.[2].trim() || undefined;
}

/** The smallest edit that turns one line into another: replace the characters
 *  from `from` up to `to` in the old line with `text`. Lets an editor change
 *  only that span, so the caret and the undo step stay local. */
export function changedSpan(before: string, after: string): { from: number; to: number; text: string } {
    let from = 0;
    while (from < before.length && from < after.length && before[from] === after[from]) from++;
    let tail = 0;
    while (tail < before.length - from && tail < after.length - from && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
    return { from, to: before.length - tail, text: after.slice(from, after.length - tail) };
}

/** The line of the end marker that closes the block opened just before
 *  `from`, skipping over any blocks nested inside it; -1 if there is none. */
function findBlockEnd(lines: string[], from: number): number {
    let depth = 1;
    for (let i = from; i < lines.length; i++) {
        if (START_MARKER.test(lines[i])) depth++;
        else if (END_MARKER.test(lines[i]) && --depth === 0) return i;
    }
    return -1;
}

/** Sorts every block in the lines. A block inside another is sorted first,
 *  and then moves with the item it is indented under when the outer block
 *  is sorted. A start marker with no end marker leaves the rest untouched. */
function sortBlocksIn(lines: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const start = START_MARKER.exec(lines[i]);
        if (!start) {
            out.push(lines[i]);
            continue;
        }
        const end = findBlockEnd(lines, i + 1);
        if (end < 0) {
            out.push(lines[i]);
            continue;
        }
        const body = sortBlocksIn(lines.slice(i + 1, end));
        out.push(lines[i], ...sortBlock(body, parseOptions(start[1])), lines[end]);
        i = end;
    }
    return out;
}

export function sortKeepSortedBlocks(content: string): string {
    return sortBlocksIn(content.split('\n')).join('\n');
}
