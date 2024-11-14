/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MyPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// utils/sort.ts
var sortWithIndentation = (lines) => {
  console.log("lines", lines);
  const items = [];
  let currentItem = null;
  lines.forEach((line) => {
    const indentMatch = line.match(/^\s+/);
    const indentLevel = indentMatch ? indentMatch[0].length : 0;
    if (!currentItem || indentLevel <= currentItem.indent) {
      currentItem = { indent: indentLevel, content: [] };
      items.push(currentItem);
    }
    currentItem.content.push(line);
  });
  console.log("items", items);
  items.sort(
    (a, b) => a.content[0].trim().localeCompare(b.content[0].trim())
  );
  const result = items.flatMap((item) => item.content);
  return result;
};

// main.ts
var DEFAULT_SETTINGS = {
  mySetting: "default"
};
var MyPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    console.log("Loading keep-sorted Plugin...");
    this.registerMarkdownPostProcessor((element, context) => {
      console.log("element", element);
      let codeblocks = element.findAll("code");
      codeblocks = codeblocks.filter(
        (item) => item.hasClass("language-keep-sorted")
      );
      for (let codeblock of codeblocks) {
        const text = codeblock.innerText.trim();
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        const sortedContent = sortWithIndentation(lines);
        codeblock.replaceWith(sortedContent.join("\n"));
      }
    });
  }
  onunload() {
    console.log("Unloading keep-sorted Plugin...");
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJ1dGlscy9zb3J0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHNvcnRXaXRoSW5kZW50YXRpb24gfSBmcm9tIFwidXRpbHNcIjtcblxuLy8gUmVtZW1iZXIgdG8gcmVuYW1lIHRoZXNlIGNsYXNzZXMgYW5kIGludGVyZmFjZXMhXG5cbmludGVyZmFjZSBNeVBsdWdpblNldHRpbmdzIHtcblx0bXlTZXR0aW5nOiBzdHJpbmc7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE15UGx1Z2luU2V0dGluZ3MgPSB7XG5cdG15U2V0dGluZzogXCJkZWZhdWx0XCIsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNeVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdHNldHRpbmdzOiBNeVBsdWdpblNldHRpbmdzO1xuXG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Y29uc29sZS5sb2coXCJMb2FkaW5nIGtlZXAtc29ydGVkIFBsdWdpbi4uLlwiKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoKGVsZW1lbnQsIGNvbnRleHQpID0+IHtcblx0XHRcdGNvbnNvbGUubG9nKFwiZWxlbWVudFwiLCBlbGVtZW50KTtcblx0XHRcdGxldCBjb2RlYmxvY2tzID0gZWxlbWVudC5maW5kQWxsKFwiY29kZVwiKTtcblx0XHRcdGNvZGVibG9ja3MgPSBjb2RlYmxvY2tzLmZpbHRlcigoaXRlbSkgPT5cblx0XHRcdFx0aXRlbS5oYXNDbGFzcyhcImxhbmd1YWdlLWtlZXAtc29ydGVkXCIpXG5cdFx0XHQpO1xuXHRcdFx0Zm9yIChsZXQgY29kZWJsb2NrIG9mIGNvZGVibG9ja3MpIHtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coXCJjb2RlYmxvY2tcIiwgY29kZWJsb2NrLmlubmVySFRNTCk7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBjb2RlYmxvY2suaW5uZXJUZXh0LnRyaW0oKTtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coXCJ0ZXh0XCIsIHRleHQpO1xuXG5cdFx0XHRcdGNvbnN0IGxpbmVzID0gdGV4dFxuXHRcdFx0XHRcdC5zcGxpdChcIlxcblwiKVxuXHRcdFx0XHRcdC5maWx0ZXIoKGxpbmUpID0+IGxpbmUudHJpbSgpICE9PSBcIlwiKTtcblxuXHRcdFx0XHRjb25zdCBzb3J0ZWRDb250ZW50ID0gc29ydFdpdGhJbmRlbnRhdGlvbihsaW5lcyk7XG5cblx0XHRcdFx0Y29kZWJsb2NrLnJlcGxhY2VXaXRoKHNvcnRlZENvbnRlbnQuam9pbihcIlxcblwiKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zb2xlLmxvZyhcIlVubG9hZGluZyBrZWVwLXNvcnRlZCBQbHVnaW4uLi5cIik7XG5cdH1cblxuXHRhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oXG5cdFx0XHR7fSxcblx0XHRcdERFRkFVTFRfU0VUVElOR1MsXG5cdFx0XHRhd2FpdCB0aGlzLmxvYWREYXRhKClcblx0XHQpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuXHRcdGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG5cdH1cbn1cbiIsICJpbXBvcnQgeyBUcmVlTm9kZSB9IGZyb20gXCJpbnRlcmZhY2VzXCI7XG5cbi8qKlxuICogU29ydCBsaW5lcyB3aGlsZSBwcmVzZXJ2aW5nIGluZGVudGVkIGhpZXJhcmNoeVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nW119IGxpbmVzIC0gQXJyYXkgb2YgbGluZXMgdG8gc29ydFxuICogQHJldHVybnMge3N0cmluZ1tdfSBTb3J0ZWQgbGluZXMgd2l0aCBpbmRlbnRhdGlvbiBwcmVzZXJ2ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IHNvcnRXaXRoSW5kZW50YXRpb24gPSAobGluZXM6IHN0cmluZ1tdKTogc3RyaW5nW10gPT4ge1xuXHRjb25zb2xlLmxvZyhcImxpbmVzXCIsIGxpbmVzKTtcblx0Y29uc3QgaXRlbXM6IHsgaW5kZW50OiBudW1iZXI7IGNvbnRlbnQ6IHN0cmluZ1tdIH1bXSA9IFtdO1xuXHRsZXQgY3VycmVudEl0ZW06IHsgaW5kZW50OiBudW1iZXI7IGNvbnRlbnQ6IHN0cmluZ1tdIH0gfCBudWxsID0gbnVsbDtcblxuXHRsaW5lcy5mb3JFYWNoKChsaW5lKSA9PiB7XG5cdFx0Y29uc3QgaW5kZW50TWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKy8pO1xuXHRcdGNvbnN0IGluZGVudExldmVsID0gaW5kZW50TWF0Y2ggPyBpbmRlbnRNYXRjaFswXS5sZW5ndGggOiAwO1xuXG5cdFx0aWYgKCFjdXJyZW50SXRlbSB8fCBpbmRlbnRMZXZlbCA8PSBjdXJyZW50SXRlbS5pbmRlbnQpIHtcblx0XHRcdC8vIFN0YXJ0IGEgbmV3IHBhcmVudCBpdGVtXG5cdFx0XHRjdXJyZW50SXRlbSA9IHsgaW5kZW50OiBpbmRlbnRMZXZlbCwgY29udGVudDogW10gfTtcblx0XHRcdGl0ZW1zLnB1c2goY3VycmVudEl0ZW0pO1xuXHRcdH1cblxuXHRcdGN1cnJlbnRJdGVtLmNvbnRlbnQucHVzaChsaW5lKTtcblx0fSk7XG5cblx0Y29uc29sZS5sb2coXCJpdGVtc1wiLCBpdGVtcyk7XG5cblx0Ly8gU29ydCBwYXJlbnRzXG5cdGl0ZW1zLnNvcnQoKGEsIGIpID0+XG5cdFx0YS5jb250ZW50WzBdLnRyaW0oKS5sb2NhbGVDb21wYXJlKGIuY29udGVudFswXS50cmltKCkpXG5cdCk7XG5cblx0Ly8gU29ydCBjaGlsZHJlbiBvZiBlYWNoIHBhcmVudCBzZXBhcmF0ZWx5XG5cblx0Ly8gaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuXHQvLyBcdGlmIChpdGVtLmNvbnRlbnQubGVuZ3RoID4gMSkge1xuXHQvLyBcdFx0Y29uc3QgW3BhcmVudCwgLi4uY2hpbGRyZW5dID0gaXRlbS5jb250ZW50O1xuXHQvLyBcdFx0Y2hpbGRyZW4uc29ydCgoYSwgYikgPT4gYS50cmltKCkubG9jYWxlQ29tcGFyZShiLnRyaW0oKSkpO1xuXHQvLyBcdFx0aXRlbS5jb250ZW50ID0gW3BhcmVudCwgLi4uY2hpbGRyZW5dO1xuXHQvLyBcdH1cblx0Ly8gfSk7XG5cblx0Y29uc3QgcmVzdWx0ID0gaXRlbXMuZmxhdE1hcCgoaXRlbSkgPT4gaXRlbS5jb250ZW50KTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBdUI7OztBQ1FoQixJQUFNLHNCQUFzQixDQUFDLFVBQThCO0FBQ2pFLFVBQVEsSUFBSSxTQUFTLEtBQUs7QUFDMUIsUUFBTSxRQUFpRCxDQUFDO0FBQ3hELE1BQUksY0FBNEQ7QUFFaEUsUUFBTSxRQUFRLENBQUMsU0FBUztBQUN2QixVQUFNLGNBQWMsS0FBSyxNQUFNLE1BQU07QUFDckMsVUFBTSxjQUFjLGNBQWMsWUFBWSxDQUFDLEVBQUUsU0FBUztBQUUxRCxRQUFJLENBQUMsZUFBZSxlQUFlLFlBQVksUUFBUTtBQUV0RCxvQkFBYyxFQUFFLFFBQVEsYUFBYSxTQUFTLENBQUMsRUFBRTtBQUNqRCxZQUFNLEtBQUssV0FBVztBQUFBLElBQ3ZCO0FBRUEsZ0JBQVksUUFBUSxLQUFLLElBQUk7QUFBQSxFQUM5QixDQUFDO0FBRUQsVUFBUSxJQUFJLFNBQVMsS0FBSztBQUcxQixRQUFNO0FBQUEsSUFBSyxDQUFDLEdBQUcsTUFDZCxFQUFFLFFBQVEsQ0FBQyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDO0FBQUEsRUFDdEQ7QUFZQSxRQUFNLFNBQVMsTUFBTSxRQUFRLENBQUMsU0FBUyxLQUFLLE9BQU87QUFFbkQsU0FBTztBQUNSOzs7QURyQ0EsSUFBTSxtQkFBcUM7QUFBQSxFQUMxQyxXQUFXO0FBQ1o7QUFFQSxJQUFxQixXQUFyQixjQUFzQyx1QkFBTztBQUFBLEVBRzVDLE1BQU0sU0FBUztBQUNkLFVBQU0sS0FBSyxhQUFhO0FBRXhCLFlBQVEsSUFBSSwrQkFBK0I7QUFFM0MsU0FBSyw4QkFBOEIsQ0FBQyxTQUFTLFlBQVk7QUFDeEQsY0FBUSxJQUFJLFdBQVcsT0FBTztBQUM5QixVQUFJLGFBQWEsUUFBUSxRQUFRLE1BQU07QUFDdkMsbUJBQWEsV0FBVztBQUFBLFFBQU8sQ0FBQyxTQUMvQixLQUFLLFNBQVMsc0JBQXNCO0FBQUEsTUFDckM7QUFDQSxlQUFTLGFBQWEsWUFBWTtBQUVqQyxjQUFNLE9BQU8sVUFBVSxVQUFVLEtBQUs7QUFHdEMsY0FBTSxRQUFRLEtBQ1osTUFBTSxJQUFJLEVBQ1YsT0FBTyxDQUFDLFNBQVMsS0FBSyxLQUFLLE1BQU0sRUFBRTtBQUVyQyxjQUFNLGdCQUFnQixvQkFBb0IsS0FBSztBQUUvQyxrQkFBVSxZQUFZLGNBQWMsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUMvQztBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFdBQVc7QUFDVixZQUFRLElBQUksaUNBQWlDO0FBQUEsRUFDOUM7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNwQixTQUFLLFdBQVcsT0FBTztBQUFBLE1BQ3RCLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLEtBQUssU0FBUztBQUFBLElBQ3JCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ3BCLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ2xDO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
