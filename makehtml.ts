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
// ==========================================================
function extractSpoilers(text: string): { text: string; spoilers: string[] } {
  const lines = text.split("\n");
  const spoilers: string[] = [];
  const output: string[] = [];
  const stack: { title: string; bodyLines: string[] }[] = [];

  const pushToCurrent = (line: string) => {
    if (stack.length > 0) {
      stack[stack.length - 1].bodyLines.push(line);
    } else {
      output.push(line);
    }
  };

  for (const line of lines) {
    const openMatch = line.match(/^:::spoiler(?:[ \t]+(.*))?$/);
    const closeMatch = line.match(/^:::[ \t]*$/);

    if (openMatch) {
      stack.push({
        title: (openMatch[1] || "Spoiler").trim(),
        bodyLines: [],
      });
    } else if (closeMatch && stack.length > 0) {
      const finished = stack.pop()!;
      const bodyText = finished.bodyLines.join("\n");
      marked.setOptions({
        gfm: true,
        breaks: true,
        tables: true,
        sanitize: true,
      });
      const bodyHtml = marked(bodyText);
      const idx = spoilers.length;
      spoilers.push(
        `<details class="spoiler"><summary>${finished.title}</summary>${bodyHtml}</details>`,
      );
      // pad with blank lines so marked always isolates the placeholder
      // into its own standalone <p>, regardless of surrounding content
      // or the breaks:true line-joining behavior
      pushToCurrent("");
      pushToCurrent(`%%%SPOILER_${idx}%%%`);
      pushToCurrent("");
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
          const rawMd = fs.readFileSync(filePath, "utf8")
            .replace(/^[ \t]*%%%[ \t]*\r?$\n?/gm, "");
          const { text: uploadMd, uploads } = extractUploads(rawMd);
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
                  ).replace(/<[^>]*>/g, "").replaceAll(
                    "\n",
                    " ",
                  ).substring(0, 420);

                  bodyContent =
                    "Music producer, DJ, developer, artist, graphic designer, weird autistic internet animal. \n\n" +
                    bodyContent;

                  let htmlLink = "https://blog.deltaryz.com/" +
                    htmlOutputPath + htmlFileName.replaceAll(" ", "%20");

                  console.log(htmlLink);

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

    <!-- discord/twitter embeds -->
    <meta property="og:title" content="∆•RYZ - ` + postTitle + `">
    <meta property="og:description"
      content="` + bodyContent + `">
    <meta property="og:image" content="https://blog.deltaryz.com/android-chrome-512x512.png">
    <meta property="og:url" content="` + htmlLink + `">
    <meta property="og:type" content="website">

    <!-- Twitter Card meta tags -->
    <meta name="twitter:title" content="∆•RYZ - ` + postTitle + `">
    <meta name="twitter:description"
    content="` + bodyContent + `">
    <meta name="twitter:image" content="https://blog.deltaryz.com/android-chrome-512x512.png">
    <meta name="twitter:url" content="` + htmlLink + `">

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
