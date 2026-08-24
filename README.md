# Blog

This is a blog. Posts are simply Markdown files named by date, and with the
title as a heading on the first line.

Site is hosted at [blog.deltaryz.com](https://blog.deltaryz.com). This site will
automatically update itself from the master branch of this repo, running
`update.sh` after pulling the changes.

Site builds HTML automatically from the Markdown files, no manual HTML editing
is necessary. Run `npm run-script build` or `deno task build` to produce the
resulting HTML.

Disclaimer: There was a point I honestly stopped caring about doing things well.
I have committed some atrocities here. It works, but, at what cost?
