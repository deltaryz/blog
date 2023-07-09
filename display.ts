const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// relative to current working directory
// this is used to construct a URL
const directoryPath = 'posts/';

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

        try {
            const output = execSync("git remote get-url origin").toString().trim();
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

let posts: BlogPost[] = [];

function readFile(filePath: string, file: string): Promise<BlogPost> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let firstLine = '';
        let text = '';

        fileStream.on('data', (chunk: string) => {
            // Read the first line from the file
            const lines = chunk.split('\n');
            firstLine = lines[0];
            lines.shift();
            text = lines.join('\n');
        });

        fileStream.on('close', () => {
            let dateString = file.split(' ')[0];
            let title = file.substring(file.indexOf(' ') + 1).replace(".md", "");
            let trimmedText = text.replace(/^\n+/, '');

            let currentPost = new BlogPost(dateString, title, trimmedText, file);
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

        const results = await Promise.all(filePromises);
        posts = results.sort(compareBlogPostsByDate);
        console.log(posts);

    } catch (err) {
        console.error('Error reading files:', err);
    }
});