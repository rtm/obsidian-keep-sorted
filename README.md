# obsidian-keep-sorted

An Obsidian plug-in to keep lines in a code block sorted

Place the content to be sorted between HTML comments as follows:

Example:

```
<!-- keep-sorted start -->

* Dog
    * Cat
* Rabbit

<!-- keep-sorted being -->
```

In this initial version, there is no way to control the sort order. And there is
no way to give a different sort key to individual items. Sorting is based on the
alphabetic content of the elements within the content, with case folding.
