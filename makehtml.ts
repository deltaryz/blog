// This script will be run automatically on site update to generate HTML pages for all posts

// TODO: Discord rich embeds (Might need extra fields of metadata?)

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

          var md = new Markdown();
          var opts = {
            title: "File $BASENAME in $DIRNAME",
            stylesheet: "../index.css",
          };
          md.render(filePath, opts, function (err) {
            if (err) {
              console.error(">>>" + err);
              process.exit();
            }

            let htmlFileName = file.replace(".md", "") + ".html";

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

                  // Add script to the end
                  let modifiedHtml = data.replace(
                    "</body>",
                    `
                    <br/><br/>
                    <div id="copyright">© 2023 - ` + new Date().getFullYear() +
                      ` Cameron Seid</div><br/><br/>
                    <script src='../post.js'></script></body>
                    `,
                  );

                  // Add header to the beginning
                  modifiedHtml = modifiedHtml.replace(
                    "<body>",
                    "<body>" + headerString,
                  );

                  // Metadata
                  modifiedHtml = modifiedHtml.replace(
                    "</head>",
                    `
    <meta charset='utf-8'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <meta name='theme-color' content='#5B2A9C' />
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
