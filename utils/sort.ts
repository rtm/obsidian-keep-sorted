import { TreeNode } from "interfaces";

/**
 * Sort lines while preserving indented hierarchy
 *
 * @param {string[]} lines - Array of lines to sort
 * @returns {string[]} Sorted lines with indentation preserved
 */
export const sortWithIndentation = (lines: string[]): string[] => {
	console.log("lines", lines);
	const items: { indent: number; content: string[] }[] = [];
	let currentItem: { indent: number; content: string[] } | null = null;

	lines.forEach((line) => {
		const indentMatch = line.match(/^\s+/);
		const indentLevel = indentMatch ? indentMatch[0].length : 0;

		if (!currentItem || indentLevel <= currentItem.indent) {
			// Start a new parent item
			currentItem = { indent: indentLevel, content: [] };
			items.push(currentItem);
		}

		currentItem.content.push(line);
	});

	console.log("items", items);

	// Sort parents
	items.sort((a, b) =>
		a.content[0].trim().localeCompare(b.content[0].trim())
	);

	// Sort children of each parent separately

	// items.forEach((item) => {
	// 	if (item.content.length > 1) {
	// 		const [parent, ...children] = item.content;
	// 		children.sort((a, b) => a.trim().localeCompare(b.trim()));
	// 		item.content = [parent, ...children];
	// 	}
	// });

	const result = items.flatMap((item) => item.content);

	return result;
};
