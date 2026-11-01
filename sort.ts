// Options follow google/keep-sorted (https://github.com/google/keep-sorted):
// the same names, values and defaults, so a block behaves the same in both.
interface SortOptions {
    case: 'yes' | 'no';
    order: 'asc' | 'desc';
    numeric: boolean;
    skipLines: SkipLines;
    /** Whether indented continuation lines move with the item above them. */
    group: 'yes' | 'no';
    /** Whether the items under each item are sorted too, at every level. Not
     *  in google/keep-sorted, which relies on nested blocks instead. */
    nested: 'yes' | 'no';
    /** The table column to sort by. Not in google/keep-sorted, which has no
     *  table support. */
    column?: Column;
}

/** Lines held in place at the top and bottom of the block. head is absent
 *  unless skip_lines gives it, which lets table detection decide. */
type SkipLines = { head?: number; tail: number };

/** A column named by its 1-based position or by its header text. */
type Column = { position: number } | { name: string };

function parseOptions(str: string): SortOptions {
    const opts: SortOptions = { case: 'yes', order: 'asc', numeric: false, skipLines: { tail: 0 }, group: 'yes', nested: 'no' };
    // A value with spaces, such as a header name, is written in double quotes.
    for (const [, key, raw] of str.matchAll(/(\w+)=("[^"]*"|\S+)/g)) {
        const quoted = raw.startsWith('"');
        const val = quoted ? raw.slice(1, -1) : raw;
        if (key === 'case') opts.case = val as 'yes' | 'no';
        else if (key === 'order') opts.order = val as 'asc' | 'desc';
        else if (key === 'numeric') opts.numeric = val === 'yes';
        else if (key === 'skip_lines') opts.skipLines = parseSkipLines(val);
        else if (key === 'group') opts.group = val as 'yes' | 'no';
        else if (key === 'nested') opts.nested = val as 'yes' | 'no';
        // A header that is literally a number is quoted to tell it from a position.
        else if (key === 'column') opts.column = !quoted && /^\d+$/.test(val) ? { position: parseInt(val, 10) } : { name: val };
    }
    return opts;
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

function extractSortKey(line: string, options: SortOptions): string {
    let s = line;
    // Strip list prefix: "- ", "* ", "+ ", or "N. "
    s = s.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
    // Wikilink: [[file|display]] → display, [[file]] → file
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_: string, file: string, display: string | undefined) => display ?? file);
    // Markdown link: [text](url) → text
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // Markdown formatting: **, __, ~~, *, _, `
    s = s.replace(/\*\*|__|~~|[*_`]/g, '');
    if (options.case !== 'yes') s = s.toLowerCase();
    return s.trim();
}

const indentOf = (s: string) => s.search(/\S/);
const isBlank = (s: string) => s.trim() === '';
/** An ordered list item's prefix: indent, number, the space after the dot. */
const ORDERED_PREFIX = /^(\s*)(\d+)\.(\s)/;
/** The markers, each alone on its line. A trailing \r is tolerated so a
 *  CRLF file still sorts. */
const START_MARKER = /^\s*%%\s*keep-sorted\s+start(.*?)%%[ \t]*\r?$/;
const END_MARKER = /^\s*%%\s*keep-sorted\s+end\s*%%/;

/** A Markdown table's separator row: cells of dashes, optionally colon-aligned. */
function isSeparatorRow(line: string): boolean {
    if (!line.includes('|') && !/^\s*:?-{3,}:?\s*$/.test(line)) return false;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    return cells.every(c => /^\s*:?-+:?\s*$/.test(c));
}

/** A table row's cells, trimmed. Only an unescaped pipe divides cells: an
 *  aliased wikilink in a table is written [[Note\|Alias]]. */
function splitCells(row: string): string[] {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
}

/** The 0-based index of the column, or undefined with the reason it was not
 *  found. A name matches a header after formatting is stripped, ignoring case. */
function findColumn(column: Column, header: string, options: SortOptions): number | string {
    if ('position' in column) {
        return column.position >= 1 ? column.position - 1 : `column=${column.position} is not a position`;
    }
    const fold = (s: string) => extractSortKey(s, { ...options, case: 'no' });
    const idx = splitCells(header).map(fold).indexOf(fold(column.name));
    return idx >= 0 ? idx : `no column is headed "${column.name}"`;
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
function splitIntoGroups(lines: string[], group: 'yes' | 'no'): string[][] {
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
        const column = isTable ? findColumn(options.column, content[0], options) : 'column= needs a table';
        if (typeof column === 'string') {
            warnOnce(`${column}; the block was left unsorted`);
            return lines;
        }
        sorted = sortRows(region.content, options, column);
    } else {
        // Held lines above start the list, so its numbering is left alone.
        sorted = sortItems(region.content, options, top.length === 0);
    }

    return [...leading, ...top, ...region.leading, ...sorted, ...region.trailing, ...bottom, ...trailing];
}

/** Sorts table rows by one column. Rows whose cells tie are ordered by their
 *  full text, so the result depends only on the table's content. A missing or
 *  empty cell sorts last whichever way the table is ordered, as in a
 *  spreadsheet, so unfilled rows collect at the bottom. */
function sortRows(rows: string[], options: SortOptions, column: number): string[] {
    const keyed = rows.map(row => ({
        row,
        cell: extractSortKey(splitCells(row)[column] ?? '', options),
        full: extractSortKey(row, options),
    }));
    keyed.sort((a, b) => {
        if ((a.cell === '') !== (b.cell === '')) return a.cell === '' ? 1 : -1;
        const cmp = compareCells(a.cell, b.cell, options.numeric) || compareKeys(a.full, b.full, options.numeric);
        return options.order === 'desc' ? -cmp : cmp;
    });
    return keyed.map(k => k.row);
}

/** Sorts a list's items, and with nested=yes the items under each of them.
 *  With keepStart, the number that led an ordered list before sorting leads
 *  it after, since Markdown takes the list's start from its first item. */
function sortItems(lines: string[], options: SortOptions, keepStart: boolean): string[] {
    // Each key is computed once, not on every comparison.
    const keyed = splitIntoGroups(lines, options.group)
        .map(group => ({ group: sortUnder(group, options), key: extractSortKey(group[0], options) }));
    keyed.sort((a, b) => {
        const cmp = compareKeys(a.key, b.key, options.numeric);
        return options.order === 'desc' ? -cmp : cmp;
    });

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
