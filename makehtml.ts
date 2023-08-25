// This script will be run automatically on site update to generate HTML pages for all posts

import fs from "fs-extra";
import path from "path";
var Markdown = require("markdown-to-html").Markdown;

// relative to current working directory
const mdPath = "posts/";
const htmlOutputPath = "html/";

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
        console.log("File:", filePath);

        var md = new Markdown();
        var opts = {
          title: "File $BASENAME in $DIRNAME",
          //stylesheet: "test/style.css",
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
              "HTML content has been saved to " + htmlOutputPath + htmlFileName,
            );
          });
        });
      }
    });
  });
});
