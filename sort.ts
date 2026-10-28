// Options follow google/keep-sorted (https://github.com/google/keep-sorted):
// the same names, values and defaults, so a block behaves the same in both.
interface SortOptions {
    case: 'yes' | 'no';
    order: 'asc' | 'desc';
    numeric: boolean;
    /** Lines held in place at the top and bottom of the block. Absent when
     *  skip_lines is not given, which lets table detection decide. */
    skipLines?: { head: number; tail: number };
}

function parseOptions(str: string): SortOptions {
    const opts: SortOptions = { case: 'yes', order: 'asc', numeric: false };
    for (const [, key, val] of str.matchAll(/(\w+)=(\S+)/g)) {
        if (key === 'case') opts.case = val as 'yes' | 'no';
        else if (key === 'order') opts.order = val as 'asc' | 'desc';
        else if (key === 'numeric') opts.numeric = val === 'yes';
        else if (key === 'skip_lines') opts.skipLines = parseSkipLines(val);
    }
    return opts;
}

/** "2" skips two lines at the top; "-2" two at the bottom; "2,-2" both. */
function parseSkipLines(val: string): { head: number; tail: number } {
    const skip = { head: 0, tail: 0 };
    for (const part of val.split(',')) {
        const n = parseInt(part, 10) || 0;
        if (n > 0) skip.head = n;
        else if (n < 0) skip.tail = -n;
    }
    return skip;
}

/** Compares by character code, as google/keep-sorted does, rather than by
 *  locale, so uppercase sorts before lowercase. With numeric, runs of digits
 *  compare by value: PROGRESS_5 before PROGRESS_10. */
function compareKeys(a: string, b: string, numeric: boolean): number {
    const ordinal = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
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
    if (p.length !== q.length) return p.length - q.length;
    return p < q ? -1 : p > q ? 1 : 0;
}

function extractSortKey(line: string, options: SortOptions): string {
    let s = line;
    // Strip list prefix: "- ", "* ", "+ ", or "N. "
    s = s.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
    // Wikilink: [[file|display]] → display, [[file]] → file
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, file, display) => display ?? file);
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

    // skip_lines counts from the markers, blank lines included, as in
    // google/keep-sorted.
    const { head, tail } = options.skipLines ?? { head: 0, tail: 0 };
    const end = Math.max(head, lines.length - tail);
    const top = lines.slice(0, head);
    const bottom = lines.slice(end);
    const middle = lines.slice(head, end);

    // Blank lines at the edges of what is left stay where they are. Markdown
    // needs them to separate a table from the markers, and sorting would
    // otherwise carry them into the middle of the block.
    let lead = 0;
    while (lead < middle.length && isBlank(middle[lead])) lead++;
    let trail = middle.length;
    while (trail > lead && isBlank(middle[trail - 1])) trail--;
    const leading = middle.slice(0, lead);
    const trailing = middle.slice(trail);
    const content = middle.slice(lead, trail);

    // Without skip_lines, a table's header and separator rows stay on top
    // without being asked for; an explicit skip_lines, even 0, turns this off.
    const isTable = content.length >= 2 && content[0].includes('|') && isSeparatorRow(content[1]);
    const tableHead = options.skipLines === undefined && isTable ? 2 : 0;
    const skipped = content.slice(0, tableHead);
    const toSort = content.slice(tableHead);

    const groups = splitIntoGroups(toSort);

    groups.sort((a, b) => {
        const keyA = extractSortKey(a[0], options);
        const keyB = extractSortKey(b[0], options);
        const cmp = compareKeys(keyA, keyB, options.numeric);
        return options.order === 'desc' ? -cmp : cmp;
    });

    const sorted = groups.flat();

    // Ensure ordered lists start from 1 after sorting
    if (sorted.length > 0) {
        sorted[0] = sorted[0].replace(/^(\s*)\d+\.\s/, '$11. ');
    }

    const sortedLines = [...top, ...leading, ...skipped, ...sorted, ...trailing, ...bottom];
    return sortedLines.join('\n') + (hasTrailingNewline ? '\n' : '');
}

/** Wraps text in start and end markers. The marker syntax lives in this file,
 *  beside the pattern that reads it. */
export function wrapInMarkers(text: string): string {
    return `%% keep-sorted start %%
${text}
%% keep-sorted end %%`;
}

export function sortKeepSortedBlocks(content: string): string {
    const regex = /(%%\s*keep-sorted\s+start(.*?)%%[ \t]*\n)([\s\S]*?)(%%\s*keep-sorted\s+end\s*%%)/g;
    return content.replace(regex, (_match, startMarker, optStr, body, endMarker) => {
        const opts = parseOptions(optStr);
        const sorted = sortBlock(body, opts);
        return startMarker + sorted + endMarker;
    });
}
