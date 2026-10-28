// Options follow google/keep-sorted (https://github.com/google/keep-sorted):
// the same names, values and defaults, so a block behaves the same in both.
interface SortOptions {
    case: 'yes' | 'no';
    order: 'asc' | 'desc';
    numeric: boolean;
    skipLines: SkipLines;
}

/** Lines held in place at the top and bottom of the block. head is absent
 *  unless skip_lines gives it, which lets table detection decide. */
type SkipLines = { head?: number; tail: number };

function parseOptions(str: string): SortOptions {
    const opts: SortOptions = { case: 'yes', order: 'asc', numeric: false, skipLines: { tail: 0 } };
    for (const [, key, val] of str.matchAll(/(\w+)=(\S+)/g)) {
        if (key === 'case') opts.case = val as 'yes' | 'no';
        else if (key === 'order') opts.order = val as 'asc' | 'desc';
        else if (key === 'numeric') opts.numeric = val === 'yes';
        else if (key === 'skip_lines') opts.skipLines = parseSkipLines(val);
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

/** A Markdown table's separator row: cells of dashes, optionally colon-aligned. */
function isSeparatorRow(line: string): boolean {
    if (!line.includes('|') && !/^\s*:?-{3,}:?\s*$/.test(line)) return false;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    return cells.every(c => /^\s*:?-+:?\s*$/.test(c));
}

/** Splits off the blank lines at either end, which stay where they are. */
function trimBlankEdges(lines: string[]): { leading: string[]; content: string[]; trailing: string[] } {
    let lead = 0;
    while (lead < lines.length && isBlank(lines[lead])) lead++;
    let trail = lines.length;
    while (trail > lead && isBlank(lines[trail - 1])) trail--;
    return { leading: lines.slice(0, lead), content: lines.slice(lead, trail), trailing: lines.slice(trail) };
}

function splitIntoGroups(lines: string[]): string[][] {
    const baseIndent = Math.min(...lines.filter(l => !isBlank(l)).map(indentOf));
    const groups: string[][] = [];
    for (const line of lines) {
        const ind = indentOf(line);
        if (groups.length === 0 || (ind >= 0 && ind <= baseIndent)) {
            groups.push([line]);
        } else {
            groups[groups.length - 1].push(line);
        }
    }
    return groups;
}

function sortBlock(body: string, options: SortOptions): string {
    const hasTrailingNewline = body.endsWith('\n');
    const lines = body.split('\n');
    if (hasTrailingNewline && lines[lines.length - 1] === '') lines.pop();

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

    // Each key is computed once, not on every comparison.
    // Blank lines between the held lines and the rest stay in place too.
    const region = trimBlankEdges(content.slice(head, end));
    const keyed = splitIntoGroups(region.content)
        .map(group => ({ group, key: extractSortKey(group[0], options) }));
    keyed.sort((a, b) => {
        const cmp = compareKeys(a.key, b.key, options.numeric);
        return options.order === 'desc' ? -cmp : cmp;
    });

    const sorted = keyed.flatMap(k => k.group);

    // Ensure ordered lists start from 1 after sorting, unless held lines above
    // start the list.
    if (sorted.length > 0 && top.length === 0) {
        sorted[0] = sorted[0].replace(/^(\s*)\d+\.\s/, '$11. ');
    }

    const sortedLines = [...leading, ...top, ...region.leading, ...sorted, ...region.trailing, ...bottom, ...trailing];
    return sortedLines.join('\n') + (hasTrailingNewline ? '\n' : '');
}

/** Wraps text in start and end markers. The marker syntax lives in this file,
 *  beside the pattern that reads it. */
export function wrapInMarkers(text: string): string {
    return `%% keep-sorted start %%\n${text}\n%% keep-sorted end %%`;
}

export function sortKeepSortedBlocks(content: string): string {
    const regex = /(%%\s*keep-sorted\s+start(.*?)%%[ \t]*\n)([\s\S]*?)(%%\s*keep-sorted\s+end\s*%%)/g;
    return content.replace(regex, (_match: string, startMarker: string, optStr: string, body: string, endMarker: string) => {
        const opts = parseOptions(optStr);
        const sorted = sortBlock(body, opts);
        return startMarker + sorted + endMarker;
    });
}
