// This script will be run automatically on site update to generate HTML pages for all posts
// This is possibly one of the dirtiest and most cursed things I've written.

import fs from "fs-extra";
import path from "path";
import md from "markdown-to-html";
const Markdown = md.Markdown;

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

          var md = new Markdown();
          var opts = {
            title: "∆•RYZ - " + postTitle,
            stylesheet: "../index.css",
          };
          md.render(filePath, opts, function (err) {
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

    <link rel='stylesheet' href='index.css'>

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
