// this script will be run automatically on site update to generate JSON metadata for all posts
// this is used to construct the front page's list of posts

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import removeMarkdown from "remove-markdown";

// relative to current working directory
// this string is also used to construct a public github URL
const directoryPath = "posts/";
const htmlPath = "p/";

// this is used by the frontend to display blog posts
const jsonFilePath = "./posts.json";

class BlogPost {
  private date: Date;
  private title: string;
  private text: string;
  private github: string;
  private url: string;
  private cut: boolean; // true if the preview was cut early with a %%% line

  constructor(
    dateString: string,
    title: string,
    text: string,
    file: string,
    cut = false,
  ) {
    const [year, month, day] = dateString.split("-");
    this.date = new Date(Number(year), Number(month) - 1, Number(day));
    this.title = title;
    this.github = "";
    this.url = "";
    this.text = text;
    this.cut = cut;

    // get the github URL from the local directory
    try {
      const output = execSync("git remote get-url origin").toString().trim()
        .replace(".git", "");

      // direct link to github's preview of the file
      this.github = output + "/blob/main/" + directoryPath +
        file.replace(/ /g, "%20");
    } catch (error) {
      console.error(error);
    }

    this.url = htmlPath + file.replace(/ /g, "_").replace(".md", ".html");
  }

  getDate(): Date {
    return this.date;
  }

  getTitle(): string {
    return this.title;
  }

  getText(): string {
    return this.text;
  }

  getUrl(): string {
    return this.github;
  }
}

// comparator function for sorting based on Date field
function compareBlogPostsByDate(a: BlogPost, b: BlogPost): number {
  return b.getDate().getTime() - a.getDate().getTime();
}

// array of all blog posts (populated as files are read)
let posts: BlogPost[] = [];

// a line containing only %%% marks where the front page preview should stop
const previewCutRegex = /^[ \t]*%%%[ \t]*\r?$/m;

// this is a promise so we can make sure to execute something after it finishes
function readFile(filePath: string, file: string): Promise<BlogPost> {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
    let raw = "";

    // collect the whole file first -- streams hand it over in 64KB chunks,
    // so parsing per chunk would only keep the last piece of long posts
    fileStream.on("data", (chunk: string | Buffer) => {
      raw += chunk.toString();
    });

    fileStream.on("close", () => {
      // array of each line
      const lines = raw.split("\n");

      // remove the first line
      lines.shift();

      // combine everything back together minus the first line
      let text = lines.join("\n").trim();

      // cut the preview at a %%% line if there is one
      const cutMatch = previewCutRegex.exec(text);
      const cut = cutMatch !== null;
      if (cutMatch) {
        text = text.substring(0, cutMatch.index).trim();
      }

      let dateString = file.split(" ")[0];
      let title = file.substring(file.indexOf(" ") + 1).replace(".md", "");
      let trimmedText = text.replace(/^\n+/, "");

      // create a new BlogPost object with all the data we gathered
      let currentPost = new BlogPost(
        dateString,
        title,
        removeMarkdown(trimmedText),
        file,
        cut,
      );

      // i promise ill give u this blog post uwu
      resolve(currentPost);
    });

    fileStream.on("error", (err: Error) => {
      console.error(`Error reading file ${file}:`, err);
      reject(err);
    });
  });
}

fs.readdir(
  directoryPath,
  async (err: NodeJS.ErrnoException | null, files: string[]) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    const filePromises = files
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const filePath = path.join(directoryPath, file);
        return readFile(filePath, file);
      });

    try {
      // this will be an array of BlogPosts
      const results = await Promise.all(filePromises);

      // sort by most recent
      posts = results.sort(compareBlogPostsByDate);

      // convert to JSON
      const jsonPosts = JSON.stringify(posts);

      // write json to file
      fs.writeFile(jsonFilePath, jsonPosts, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          console.error("Error writing JSON file: ", err);
          return;
        }
        console.log("JSON file saved successfully!");
      });

      console.log(posts);
    } catch (err) {
      console.error("Error reading files:", err);
    }
  },
);
