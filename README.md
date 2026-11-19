# Blog

This is a blog. Posts are simply Markdown files named by date, and with the
title as a heading on the first line.

Site is hosted at [blog.deltaryz.com](https://blog.deltaryz.com). This site will
automatically update itself from the master branch of this repo, running
`update.sh` after pulling the changes.

Site builds HTML automatically from the Markdown files, no manual HTML editing
is necessary. Run `npm run-script build` or `deno task build` to produce the
resulting HTML.

---

Several custom syntax extensions have been added to allow our Markdown files to declare certain reusable  features with minimal typing required.

**Spoiler sections**
```
:::spoiler Title displayed when rolled up
spoiler content
:::
```
Collapsed by default, click the title to expand. Spoilers can be nested inside each other.

**Tabs**
```
:::tabs category1
alskdjfaksdlf
:::tabs category2
kasdjkfldjakf
:::
```
Each `:::tabs Name` line starts a new tab in the same group, and a single `:::` closes the group.

The first tab is selected by default.

**Quote Blocks**

Spoilers and tabs both also work inside `>` quote blocks, as long as every line (including the `:::` lines) keeps its `> ` prefix:
```
> :::tabs NES
> NES content
> :::tabs SNES
> SNES content
> :::
```
**End main page preview early**
```
%%%
```
Must be alone on its own line. Stops a main page preview at the specified location instead of the normal length.

**File upload**
```
:::upload any_name_here
```
Use this name to create unique handling for each instance of the file upload. (HTML/CSS reused, JS logic per-use)

The handler for each name lives in the `uploadHandlers` table in `post.js`.

**Video**
```
:::video ../img/folder/clip.mp4
:::video ../img/folder/clip.mp4 ../img/folder/thumbnail.png
```
Click-to-play video with native controls. Nothing downloads until play is pressed, no autoplay.

The poster/thumbnail defaults to the same path with `.jpg` (e.g. `clip.jpg` next to `clip.mp4`); a second path overrides it.

It fills the column and takes its height from the poster. `.webm` files get the webm type, everything else is treated as mp4.

Works inside quotes, spoilers and tabs.

**Comment**
```
:::comment some side note here
```
Centered, semitransparent line of text. Inline markdown (bold, italics, `code`, links) still works inside it.

Must be alone on its own line. Works inside quotes, spoilers and tabs.

**Redirect**
```
:::redirect brickfix
:::redirect example1 example2
```
Makes `blog.deltaryz.com/brickfix` (and `/example1`, `/example2`) forward to this post. Several names can go on one line. The line is removed from the post and the front page preview.

More than one `:::redirect` line in the same post still works (all names get merged), but the build log prints a warning with the line numbers.

Each name becomes a top-level folder with a generated `index.html`; the build deletes and regenerates them every time. Names that clash with a real file/folder or with another post's redirect are skipped with a warning. Allowed characters: letters, numbers, `.`, `_`, `-`.

---
**AI Usage Disclaimer**

This repository is a mixture of my own hand-written code, and features implemented by AI. Each commit is credited to either me or a specific AI model via `user.name`, such as `deepseek-v4.1-flash`.

Honestly, my own code here was already terrible before AI got involved.