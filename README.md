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
**Tabs**
```
:::tabs category1
alskdjfaksdlf
:::tabs category2
kasdjkfldjakf
:::
```

**End main page preview early**
```
%%%
```

**File upload**
```
:::upload any_name_here
```
Use this name to create unique handling for each instance of the file upload. (HTML/CSS reused, JS logic per-use)

---

**AI Usage Disclaimer**

This repository is a mixture of my own hand-written code, and features implemented by AI. Each commit is credited to either me or a specific AI model via `user.name`, such as `deepseek-v4.1-flash`.

Honestly, my own code here was already terrible before AI got involved.