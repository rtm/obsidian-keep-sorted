interface SortOptions {
    case: 'yes' | 'no';
    order: 'asc' | 'desc';
    numeric: boolean;
    skipLines: number;
}

function parseOptions(str: string): SortOptions {
    const opts: SortOptions = { case: 'no', order: 'asc', numeric: false, skipLines: 0 };
    for (const [, key, val] of str.matchAll(/(\w+)=(\S+)/g)) {
        if (key === 'case') opts.case = val as 'yes' | 'no';
        else if (key === 'order') opts.order = val as 'asc' | 'desc';
        else if (key === 'numeric') opts.numeric = val === 'yes';
        else if (key === 'skip_lines') opts.skipLines = parseInt(val, 10) || 0;
    }
    return opts;
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

function splitIntoGroups(lines: string[]): string[][] {
    const baseIndent = Math.min(...lines.filter(l => l.trim()).map(indentOf));
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

    const skipped = lines.slice(0, options.skipLines);
    const toSort = lines.slice(options.skipLines);

    const groups = splitIntoGroups(toSort);

    groups.sort((a, b) => {
        const keyA = extractSortKey(a[0], options);
        const keyB = extractSortKey(b[0], options);
        const cmp = keyA.localeCompare(keyB, undefined, options.numeric ? { numeric: true } : undefined);
        return options.order === 'desc' ? -cmp : cmp;
    });

    const sorted = groups.flat();

    // Ensure ordered lists start from 1 after sorting
    if (sorted.length > 0) {
        sorted[0] = sorted[0].replace(/^(\s*)\d+\.\s/, '$11. ');
    }

    const sortedLines = [...skipped, ...sorted];
    return sortedLines.join('\n') + (hasTrailingNewline ? '\n' : '');
}

export function sortKeepSortedBlocks(content: string): string {
    const regex = /(%%\s*keep-sorted\s+start(.*?)%%[ \t]*\n)([\s\S]*?)(%%\s*keep-sorted\s+end\s*%%)/g;
    return content.replace(regex, (_match, startMarker, optStr, body, endMarker) => {
        const opts = parseOptions(optStr);
        const sorted = sortBlock(body, opts);
        return startMarker + sorted + endMarker;
    });
}
