import * as fs from 'fs';
import * as path from 'path';

const directoryPath = './'; // Replace with your directory path

class BlogPost {
    private date: Date;
    private title: string;
    private text: string;

    constructor(dateString: string, title: string, text: string) {
        const [year, month, day] = dateString.split('-');
        this.date = new Date(Number(year), Number(month) - 1, Number(day));
        this.title = title;
        this.text = text;
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
            let dateString = file.replace(".md", "");
            let title = firstLine.replace("# ", "");
            let trimmedText = text.replace(/^\n+/, '');

            let currentPost = new BlogPost(dateString, title, trimmedText);

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