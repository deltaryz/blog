// this script will be run automatically on site update to generate JSON metadata for all posts
// this is used to construct the front page's list of posts

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const removeMarkdown = require('remove-markdown');

// relative to current working directory
// this string is also used to construct a public github URL
const directoryPath = 'posts/';

// this is used by the frontend to display blog posts
const jsonFilePath = './posts.json';

class BlogPost {
    private date: Date;
    private title: string;
    private text: string;
    private url: string;

    constructor(dateString: string, title: string, text: string, file: string) {
        const [year, month, day] = dateString.split('-');
        this.date = new Date(Number(year), Number(month) - 1, Number(day));
        this.title = title;
        this.text = text;
        this.url = "";

        // get the github URL from the local directory
        try {
            const output = execSync("git remote get-url origin").toString().trim().replace(".git", "");

            // direct link to github's preview of the file
            this.url = output + "/blob/main/" + directoryPath + file.replace(/ /g, "%20");
        } catch (error) {
            console.error(error);
        }
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
        return this.url;
    }
}

// comparator function for sorting based on Date field
function compareBlogPostsByDate(a: BlogPost, b: BlogPost): number {
    return b.getDate().getTime() - a.getDate().getTime();
}

// array of all blog posts (populated as files are read)
let posts: BlogPost[] = [];

// this is a promise so we can make sure to execute something after it finishes
function readFile(filePath: string, file: string): Promise<BlogPost> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let firstLine = '';
        let text = '';

        fileStream.on('data', (chunk: string) => {
            // array of each line
            const lines = chunk.split('\n');

            // Read the first line from the file
            firstLine = lines[0];

            // remove the first line
            lines.shift();

            // combine everything back together minus the first line
            text = lines.join('\n').trim();
        });

        fileStream.on('close', () => {
            let dateString = file.split(' ')[0];
            let title = file.substring(file.indexOf(' ') + 1).replace(".md", "");
            let trimmedText = text.replace(/^\n+/, '');

            // create a new BlogPost object with all the data we gathered
            let currentPost = new BlogPost(dateString, title, removeMarkdown(trimmedText), file);

            // i promise ill give u this blog post uwu
            resolve(currentPost);

        });

        fileStream.on('error', (err: Error) => {
            console.error(`Error reading file ${file}:`, err);
            reject(err);
        });
    });
}

fs.readdir(directoryPath, async (err: NodeJS.ErrnoException | null, files: string[]) => {
    if (err) {
        console.error('Error reading directory:', err);
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
        fs.writeFile(jsonFilePath, jsonPosts, (err: Error) => {
            if (err) {
                console.error('Error writing JSON file: ', err);
                return;
            }
            console.log('JSON file saved successfully!');
        });


        console.log(posts);

    } catch (err) {
        console.error('Error reading files:', err);
    }
});