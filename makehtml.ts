// This script will be run automatically on site update to generate HTML pages for all posts
// This is possibly one of the dirtiest and most cursed things I've written.

import fs from "fs-extra";
import path from "node:path";
import md from "markdown-to-html";
import marked from "npm:marked@0.3.2"; // same version markdown-to-html itself uses internally
const Markdown = md.Markdown;

// ==========================================================
// spoiler syntax preprocessing (runs on RAW markdown, not the
// rendered html -- markdown-to-html sets `breaks: true` on marked,
// so lines without a blank line between them collapse into one <p>
// joined by <br>, which makes post-render regex matching unreliable.
// instead we pull spoiler blocks out of the source before marked
// ever sees them, render each one's body independently (with the
// same marked options as the rest of the pipeline), and swap in a
// placeholder token that gets replaced with the real html after
// normal rendering. a real stack (not a single regex) is used so
// nested spoilers resolve correctly by depth.
//
// syntax:
// :::spoiler Title Here
// hidden content, markdown works fine in here
// :::spoiler nested title
// this can nest arbitrarily deep
// :::
// :::
//
// tabbed containers use the same machinery. each :::tabs line starts a new
// tab in the current group, one ::: closes the whole group:
// :::tabs NES
// content of the first tab
// :::tabs SNES
// content of the second tab
// :::
// a tab group can go inside a spoiler and vice versa, but a :::tabs line
// directly inside an open tab always means "next tab", not a nested group.
// ==========================================================
function extractSpoilers(text: string): { text: string; spoilers: string[] } {
  const lines = text.split("\n");
  const spoilers: string[] = [];
  const output: string[] = [];

  // one stack for both block types so a ":::" always closes the innermost
  // open block, whichever kind it is. `prefix` is the "> " quote prefix the
  // opening line had: it is stripped from body lines and put back on the
  // placeholder, so blocks also work inside > quotes.
  type Spoiler = { kind: "spoiler"; prefix: string; title: string; bodyLines: string[] };
  type Tabs = { kind: "tabs"; prefix: string; tabs: { title: string; bodyLines: string[] }[] };
  const stack: (Spoiler | Tabs)[] = [];

  const currentBody = (): string[] | null => {
    const top = stack[stack.length - 1];
    if (!top) return null;
    return top.kind === "spoiler" ? top.bodyLines : top.tabs[top.tabs.length - 1].bodyLines;
  };

  const pushToCurrent = (line: string) => {
    const body = currentBody();
    if (body) body.push(line);
    else output.push(line);
  };

  const stripPrefix = (line: string, prefix: string) =>
    prefix && line.startsWith(prefix.trimEnd())
      ? line.substring(prefix.trimEnd().length).replace(/^ /, "")
      : line;

  const renderBody = (bodyLines: string[], prefix: string) => {
    marked.setOptions({
      gfm: true,
      breaks: true,
      tables: true,
      sanitize: true,
    });
    return marked(bodyLines.map((l) => stripPrefix(l, prefix)).join("\n"));
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    // optional quote prefix ("> ", "> > ", ...) before the ::: syntax
    const m = line.match(/^((?:>[ \t]?)*)(:::.*)$/);
    const prefix = m ? m[1] : "";
    const directive = m ? m[2] : "";
    const spoilerOpen = directive.match(/^:::spoiler(?:[ \t]+(.*))?$/);
    const tabOpen = directive.match(/^:::tabs(?:[ \t]+(.*))?$/);
    const close = /^:::[ \t]*$/.test(directive);
    const top = stack[stack.length - 1];

    if (spoilerOpen) {
      stack.push({
        kind: "spoiler",
        prefix,
        title: (spoilerOpen[1] || "Spoiler").trim(),
        bodyLines: [],
      });
    } else if (tabOpen) {
      const title = (tabOpen[1] || "Tab").trim();
      if (top && top.kind === "tabs") {
        // another :::tabs line inside an open tab group starts the next tab
        top.tabs.push({ title, bodyLines: [] });
      } else {
        stack.push({ kind: "tabs", prefix, tabs: [{ title, bodyLines: [] }] });
      }
    } else if (close && stack.length > 0) {
      const finished = stack.pop()!;
      let html: string;
      if (finished.kind === "spoiler") {
        html = `<details class="spoiler"><summary>${finished.title}</summary>${
          renderBody(finished.bodyLines, finished.prefix)
        }</details>`;
      } else {
        // first tab starts active so the group reads fine even without post.js
        const buttons = finished.tabs.map((t, i) =>
          `<button type="button" class="tab-button${i === 0 ? " active" : ""}">${t.title}</button>`
        ).join("");
        const panels = finished.tabs.map((t, i) =>
          `<div class="tab-panel${i === 0 ? " active" : ""}">${
            renderBody(t.bodyLines, finished.prefix)
          }</div>`
        ).join("");
        html = `<div class="tabs"><div class="tab-buttons">${buttons}</div>${panels}</div>`;
      }
      const idx = spoilers.length;
      spoilers.push(html);
      // pad so marked always isolates the placeholder into its own
      // standalone <p>, regardless of surrounding content or the
      // breaks:true line-joining behavior. inside a quote the padding has
      // to be bare ">" lines, a truly blank line would end the quote.
      const pad = finished.prefix.trimEnd();
      pushToCurrent(pad);
      pushToCurrent(`${finished.prefix}%%%SPOILER_${idx}%%%`);
      pushToCurrent(pad);
    } else {
      pushToCurrent(line);
    }
  }

  return { text: output.join("\n"), spoilers };
}

// ==========================================================
// upload box syntax: a line containing only
// :::upload someName
// becomes a drag-and-drop file box. post.js finds it by name and runs the
// matching handler from its uploadHandlers table. like spoilers, the line is
// swapped for a placeholder before marked runs (padded with blank lines so it
// always lands in its own <p>), then replaced with the real html afterwards.
// this runs before extractSpoilers, so upload boxes also work inside spoilers.
// ==========================================================
function extractUploads(text: string): { text: string; uploads: string[] } {
  const uploads: string[] = [];
  const out = text.replace(
    /^:::upload[ \t]+(\S+)[ \t]*\r?$/gm,
    (_line: string, name: string) => {
      const idx = uploads.length;
      uploads.push(name);
      return `\n%%%UPLOAD_${idx}%%%\n`;
    },
  );
  return { text: out, uploads };
}

function uploadBoxHtml(name: string): string {
  const safeName = name.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // post.js fills in the title/hint/status text for each handler
  return `<div class="upload-drop" data-upload="${safeName}" tabindex="0" role="button">` +
    `<span class="upload-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span>` +
    `<div class="upload-title">Drop a file here</div>` +
    `<small class="upload-hint"></small>` +
    `<input type="file" hidden>` +
    `<div class="upload-status">Drop or click to choose a file</div>` +
    `</div>`;
}

// ==========================================================
// video syntax: a line containing only
// :::video path/to/clip.mp4 [path/to/poster.jpg]
// becomes a click-to-play <video>. nothing downloads until play is pressed,
// and the poster (default: same path with .jpg) sizes the box until then, so
// no resolution is needed. same placeholder trick as uploads, and a leading
// "> " quote prefix is kept so it also works inside quote blocks.
// ==========================================================
function extractVideos(text: string): { text: string; videos: string[][] } {
  const videos: string[][] = [];
  const out = text.replace(
    /^((?:>[ \t]?)*):::video[ \t]+(\S+)(?:[ \t]+(\S+))?[ \t]*\r?$/gm,
    (_line: string, quote: string, src: string, poster?: string) => {
      const idx = videos.length;
      videos.push([src, poster || src.replace(/\.[^./]+$/, "") + ".jpg"]);
      const q = quote.trimEnd();
      return `${q}\n${quote}%%%VIDEO_${idx}%%%\n${q}`;
    },
  );
  return { text: out, videos };
}

function videoHtml(src: string, poster: string): string {
  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return `<video class="post-video" controls preload="none" playsinline poster="${esc(poster)}">` +
    `<source src="${esc(src)}" type="video/${/\.webm$/i.test(src) ? "webm" : "mp4"}"></video>`;
}

// ==========================================================
// comment syntax: a line containing only
// :::comment some text here
// becomes a centered, semitransparent line of text (inline markdown like
// **bold**, `code` and links still works). same placeholder trick as videos,
// including the "> " quote prefix handling.
// ==========================================================
function extractComments(text: string): { text: string; comments: string[] } {
  const comments: string[] = [];
  const out = text.replace(
    /^((?:>[ \t]?)*):::comment[ \t]+(.*?)[ \t]*\r?$/gm,
    (_line: string, quote: string, body: string) => {
      const idx = comments.length;
      comments.push(body);
      // keep a space after the ">" on the padding lines: marked 0.3.2 only
      // treats a line as quoted if something follows the ">", so a bare ">"
      // would render as a literal &gt; paragraph
      const q = quote ? quote.trimEnd() + " " : "";
      return `${q}\n${q}%%%COMMENT_${idx}%%%\n${q}`;
    },
  );
  return { text: out, comments };
}

function commentHtml(body: string): string {
  marked.setOptions({ gfm: true, breaks: true, tables: true, sanitize: true });
  // render as a paragraph, then drop marked's own <p> wrapper for ours
  const inner = marked(body).trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");
  return `<p class="post-comment">${inner}</p>`;
}

// ==========================================================
// redirect syntax: a line containing only
// :::redirect brickfix
// :::redirect example1 example2
// makes blog.deltaryz.com/brickfix (etc) forward to this post. each name
// becomes a top-level folder holding a tiny index.html that redirects to
// p/<post>.html. the line itself is removed from the post. several names can
// share one line; if a post has more than one :::redirect line they all get
// merged, with a warning listing the line numbers.
// generated folders are marked with REDIRECT_MARKER so each build can delete
// the previous build's redirects without ever touching a real folder, and each
// one carries its own .gitignore ("*") so build output never shows up in git.
// ==========================================================
const REDIRECT_MARKER = "<!-- generated by makehtml.ts from :::redirect -->";
const redirectOwners = new Map<string, string>(); // name -> post file, to catch clashes

function extractRedirects(text: string, file: string): { text: string; names: string[] } {
  const names: string[] = [];
  const lineNumbers: number[] = [];
  text.split("\n").forEach((line, i) => {
    const m = line.match(/^[ \t]*:::redirect[ \t]+(.*?)[ \t]*\r?$/);
    if (!m) return;
    lineNumbers.push(i + 1);
    for (const name of m[1].split(/[ \t]+/)) {
      if (name && !names.includes(name)) names.push(name);
    }
  });
  if (lineNumbers.length > 1) {
    console.warn(
      `WARNING: ${file} has ${lineNumbers.length} :::redirect lines ` +
        `(lines ${lineNumbers.join(", ")}), merging them: ${names.join(" ")}`,
    );
  }
  return { text: text.replace(/^[ \t]*:::redirect\b.*\r?$\n?/gm, ""), names };
}

// delete every folder a previous build generated (identified by the marker)
function clearOldRedirects() {
  for (const entry of fs.readdirSync(".", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const index = path.join(entry.name, "index.html");
    let contents: string[];
    try {
      contents = fs.readdirSync(entry.name);
    } catch {
      continue;
    }
    const generated = contents.every((f) => f === "index.html" || f === ".gitignore");
    if (
      generated && contents.includes("index.html") &&
      fs.readFileSync(index, "utf8").startsWith(REDIRECT_MARKER)
    ) {
      fs.removeSync(entry.name);
    }
  }
}

function writeRedirects(names: string[], file: string, htmlFileName: string, embedMeta: string) {
  const target = "/" + htmlOutputPath + encodeURIComponent(htmlFileName);
  for (const name of names) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
      console.warn(`WARNING: ${file}: skipping redirect "${name}", only letters, numbers, . _ - allowed`);
      continue;
    }
    const owner = redirectOwners.get(name);
    if (owner && owner !== file) {
      console.warn(`WARNING: redirect "${name}" is used by both ${owner} and ${file}, keeping ${owner}`);
      continue;
    }
    if (!owner && fs.existsSync(name)) {
      console.warn(`WARNING: ${file}: skipping redirect "${name}", a real file/folder with that name already exists`);
      continue;
    }
    redirectOwners.set(name, file);
    fs.mkdirSync(name, { recursive: true });
    fs.writeFileSync(path.join(name, ".gitignore"), "# generated by makehtml.ts (:::redirect)\n*\n");
    fs.writeFileSync(
      path.join(name, "index.html"),
      REDIRECT_MARKER + "\n" +
        `<!DOCTYPE html><html><head><meta charset="utf-8">` +
        // crawlers (discord etc) don't follow the redirect, they read these
        `<meta name='theme-color' content='#5B2A9C' />` + embedMeta +
        `<meta http-equiv="refresh" content="0; url=${target}">` +
        `<link rel="canonical" href="${target}">` +
        `<script>location.replace(${JSON.stringify(target)});</script>` +
        `</head><body><a href="${target}">${target}</a></body></html>\n`,
    );
    console.log(`Redirect: /${name} -> ${target}`);
  }
}

// ==========================================================
// table of contents: every # (h1) and ## (h2) heading after the post title
// becomes a link in a nested list, h2s under the h1 before them. the list goes
// right after the title. links are plain #id anchors (the ids marked already
// puts on headings), so clicking scrolls there and leaves a permalink in the
// url. posts with no headings besides the title get no box.
// ==========================================================
function insertToc(html: string): string {
  const heads = [...html.matchAll(/<h([12]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)];
  if (heads.length < 2) return html; // just the title (or nothing)
  const [title, ...rest] = heads;
  let toc = '<nav class="toc"><ul>';
  let open = false; // is there an h1 <li> with a nested <ul> waiting to close
  let row = 0; // rows counted in reading order across both levels, for finder-style striping
  for (const [, level, id, inner] of rest) {
    const text = inner.replace(/<[^>]*>/g, "").trim();
    const li = row++ % 2 ? '<li class="toc-alt">' : "<li>";
    const link = `<a href="#${id}">${text}</a>`;
    if (level === "1") {
      if (open) toc += "</ul></li>";
      toc += `${li}${link}<ul>`;
      open = true;
    } else {
      toc += `${li}${link}</li>`;
    }
  }
  if (open) toc += "</ul></li>";
  toc = toc.replace(/<ul><\/ul>/g, "") + "</ul></nav>"; // drop empty sublists
  const at = (title.index ?? 0) + title[0].length;
  return html.slice(0, at) + "\n" + toc + html.slice(at);
}

// front page previews from makejson.ts (deno task build runs it first), used
// for the embed description of posts that set their own %%% cutoff
let frontPagePreviews: { url: string; text: string; cut?: boolean }[] = [];
try {
  frontPagePreviews = JSON.parse(fs.readFileSync("posts.json", "utf8"));
} catch {
  console.warn("WARNING: posts.json missing, run makejson.ts first for %%% embed previews");
}

// relative to current working directory
const mdPath = "posts/";
const htmlOutputPath = "p/";

// pull header
fs.readFile("header.html", "utf8", (err, data) => {
  if (err) {
    console.error(`Error reading the HTML file: ${err}`);
    return;
  }

  // we have the header
  let headerString = data;

  // Check if the directory exists
  if (!fs.existsSync(htmlOutputPath)) {
    // Directory doesn't exist, so create it
    fs.mkdirSync(htmlOutputPath, { recursive: true });
    console.log("Directory created:", htmlOutputPath);
  } else {
    console.log("Directory already exists:", htmlOutputPath);

    // Directory exists, so remove its contents
    fs.emptyDirSync(htmlOutputPath);
    console.log("Contents of directory removed:", htmlOutputPath);
  }

  clearOldRedirects();

  fs.readdir(mdPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(mdPath, file);

      fs.stat(filePath, (statErr, stats) => {
        if (statErr) {
          console.error("Error getting file stats:", statErr);
          return;
        }

        if (stats.isFile()) {
          console.log("Reading file:", filePath);

          let postTitle = file.replace(".md", "").substring(
            file.indexOf(" ") + 1,
          );

          // a line containing only %%% is the front page preview cutoff
          // (see makejson.ts), it should not show up in the post itself
          const { text: noRedirectMd, names: redirectNames } = extractRedirects(
            fs.readFileSync(filePath, "utf8"),
            file,
          );
          const rawMd = noRedirectMd
            .replace(/^[ \t]*%%%[ \t]*\r?$\n?/gm, "");
          const { text: videoMd, videos } = extractVideos(rawMd);
          const { text: commentMd, comments } = extractComments(videoMd);
          const { text: uploadMd, uploads } = extractUploads(commentMd);
          const { text: processedMd, spoilers } = extractSpoilers(uploadMd);

          // write the preprocessed markdown to a temp file IN THE SAME
          // DIRECTORY so relative image/video paths in the post still
          // resolve correctly
          const tempPath = path.join(mdPath, "." + file + ".spoilertmp");
          fs.writeFileSync(tempPath, processedMd, "utf8");

          var md = new Markdown();
          var opts = {
            title: "∆•RYZ - " + postTitle,
            stylesheet: "../index.css",
          };
          md.render(tempPath, opts, function (err) {
            if (err) {
              console.error(">>>" + err);
              process.exit();
            }

            let htmlFileName = file.replace(".md", "").replaceAll(" ", "_") +
              ".html";

            const outputStream = fs.createWriteStream(
              htmlOutputPath + htmlFileName,
            );
            md.pipe(outputStream);

            // done writing
            outputStream.on("finish", () => {
              console.log(
                "HTML content has been saved to " + htmlOutputPath +
                  htmlFileName,
              );

              // temp file no longer needed
              fs.unlink(tempPath, () => {});

              fs.readFile(
                htmlOutputPath + htmlFileName,
                "utf8",
                (err, data) => {
                  if (err) {
                    console.error(`Error reading the HTML file: ${err}`);
                    return;
                  }

                  // construct a preview for the embed
                  const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
                  const match = bodyRegex.exec(data);
                  let bodyContent = "";
                  if (match && match.length >= 2) {
                    bodyContent = match[1];
                  }

                  bodyContent = bodyContent.substring(
                    bodyContent.indexOf("\n") + 1,
                  );

                  bodyContent = bodyContent.substring(
                    bodyContent.indexOf("\n") + 1,
                  ).replace(/<[^>]*>/g, "")
                    .replace(/%%%[A-Z]+_\d+%%%/g, "") // spoiler/upload/video/comment placeholders
                    .replaceAll(
                    "\n",
                    " ",
                  ).substring(0, 420);

                  // if the post has a %%% cutoff line, the embed uses exactly the
                  // front page's preview text (makejson.ts, built just before this)
                  // instead of the first 420 characters of the rendered post
                  const preview = frontPagePreviews.find((p) =>
                    p.url === htmlOutputPath + htmlFileName
                  );
                  if (preview && preview.cut) {
                    bodyContent = preview.text.replaceAll("\n", " ");
                  }

                  bodyContent =
                    "Music producer, DJ, developer, artist, graphic designer, weird autistic internet animal. \n\n" +
                    bodyContent;

                  let htmlLink = "https://blog.deltaryz.com/" +
                    htmlOutputPath + htmlFileName.replaceAll(" ", "%20");

                  console.log(htmlLink);

                  // embed tags, shared with the :::redirect pages so a
                  // short link unfurls on discord exactly like the full url
                  // escape quotes so a title like 'The Truth About "Super Mario
                  // All-Stars"...' doesn't end the content="" attribute early
                  const attr = (v: string) =>
                    v.replace(/&(?!#?\w+;)/g, "&amp;").replace(/"/g, "&quot;");
                  const embedTitle = attr(postTitle);
                  const embedText = attr(bodyContent);
                  const embedUrl = htmlLink.replaceAll('"', "%22");
                  const embedMeta = `    <!-- discord/twitter embeds -->
    <meta property="og:title" content="∆•RYZ - ` + embedTitle + `">
    <meta property="og:description"
      content="` + embedText + `">
    <meta property="og:image" content="https://blog.deltaryz.com/android-chrome-512x512.png">
    <meta property="og:url" content="` + embedUrl + `">
    <meta property="og:type" content="website">

    <!-- Twitter Card meta tags -->
    <meta name="twitter:title" content="∆•RYZ - ` + embedTitle + `">
    <meta name="twitter:description"
    content="` + embedText + `">
    <meta name="twitter:image" content="https://blog.deltaryz.com/android-chrome-512x512.png">
    <meta name="twitter:url" content="` + embedUrl + `">
`;

                  writeRedirects(redirectNames, file, htmlFileName, embedMeta);

                  // Add script to the end
                  let modifiedHtml = data.replace(
                    "</body>",
                    `
<br/>
</div></div>
<br/>
<div id="copyright">© 2023 - ` + new Date().getFullYear() +
                      ` Cameron Seid
  <br/>me @ deltaryz.com</div><br/><br/>
<script src='../post.js'></script></body>

                    `,
                  );

                  // Add header to the beginning
                  modifiedHtml = modifiedHtml.replace(
                    "<body>",
                    "<body>" + headerString +
                      "<div id='contentFrame'><div id='content'>",
                  );

                  // markdown has no native video syntax, so we abuse image
                  // syntax instead: ![caption](something.mp4) renders as
                  // <img src="something.mp4" alt="caption">, which we swap
                  // for a real <video> tag here. playsinline is required or
                  // ios safari force-fullscreens the autoplay.
                  modifiedHtml = modifiedHtml.replace(
                    /<img src="([^"]+\.mp4)" alt="([^"]*)"[^>]*>/g,
                    '<video src="$1" autoplay muted loop playsinline title="$2"></video>',
                  );

                  // restore real spoiler html in place of the placeholders.
                  // MUST go in reverse (outermost/highest index first) --
                  // a nested spoiler's placeholder is embedded INSIDE its
                  // parent's stored html string until the parent itself
                  // gets spliced into modifiedHtml, so resolving parents
                  // before children is what actually surfaces the child
                  // placeholder text for this same loop to catch.
                  for (let idx = spoilers.length - 1; idx >= 0; idx--) {
                    modifiedHtml = modifiedHtml.replace(
                      `<p>%%%SPOILER_${idx}%%%</p>`,
                      spoilers[idx],
                    );
                  }

                  // upload boxes go in after spoilers, so any that were
                  // inside a spoiler have been surfaced by now
                  uploads.forEach((name, idx) => {
                    modifiedHtml = modifiedHtml.replace(
                      `<p>%%%UPLOAD_${idx}%%%</p>`,
                      uploadBoxHtml(name),
                    );
                  });

                  // videos, same as upload boxes
                  videos.forEach(([src, poster], idx) => {
                    modifiedHtml = modifiedHtml.replace(
                      `<p>%%%VIDEO_${idx}%%%</p>`,
                      videoHtml(src, poster),
                    );
                  });

                  // comments, same as videos
                  comments.forEach((body, idx) => {
                    modifiedHtml = modifiedHtml.replace(
                      `<p>%%%COMMENT_${idx}%%%</p>`,
                      commentHtml(body),
                    );
                  });

                  // table of contents, last so headings inside spoilers/tabs count too
                  modifiedHtml = insertToc(modifiedHtml);

                  // Metadata
                  modifiedHtml = modifiedHtml.replace(
                    "</head>",
                    `
    <meta charset='utf-8'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#bb74ec">
    <meta name="msapplication-TileColor" content="#da532c">
    <meta name='theme-color' content='#5B2A9C' />

    <!-- Prevent caching -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">

` + embedMeta + `
    <!-- load MUI -->
    <link href='//cdn.muicss.com/mui-0.10.3/css/mui.min.css' rel='stylesheet' type='text/css' />
    <script src='//cdn.muicss.com/mui-0.10.3/js/mui.min.js'></script>

    <script src="../microlight.js"></script>

</head>
                  `,
                  );

                  fs.writeFile(
                    htmlOutputPath + htmlFileName,
                    modifiedHtml,
                    "utf8",
                    (err) => {
                      if (err) {
                        console.error(`Error writing the HTML file: ${err}`);
                      } else {
                        console.log("Script appended to " + htmlFileName);
                      }
                    },
                  );
                },
              );
            });
          });
        }
      });
    });
  });
});
