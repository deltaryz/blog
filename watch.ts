// rebuilds the site whenever a post, image, or top-level html/css/js file changes
// (five server then live reloads the regenerated html on its own)
// generated output (p/, posts.json, :::redirect folders) is deliberately not watched,
// and dotfiles are ignored so makehtml's .spoilertmp files can't retrigger a build

const DEBOUNCE_MS = 300;
const WATCHED_DIRS = ["posts", "img"];
const TOP_LEVEL_EXT = /\.(html|css|js)$/;

const root = Deno.cwd();

function relevant(abs: string): boolean {
  const rel = abs.startsWith(root + "/") ? abs.slice(root.length + 1) : abs;
  const parts = rel.split("/");
  if (parts.some((p) => p.startsWith("."))) return false; // dotfiles + dot dirs
  if (WATCHED_DIRS.includes(parts[0])) return true;
  return parts.length === 1 && TOP_LEVEL_EXT.test(parts[0]);
}

let timer: number | undefined;
let building = false;
let pending = false;

async function build() {
  if (building) {
    pending = true; // something changed mid-build, go again once it finishes
    return;
  }
  building = true;
  console.log(`[watch] building...`);
  const { code } = await new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  console.log(code === 0 ? `[watch] done` : `[watch] build failed (exit ${code})`);
  building = false;
  if (pending) {
    pending = false;
    build();
  }
}

console.log(`[watch] watching posts/, img/ and top-level html/css/js`);
for await (const event of Deno.watchFs(root, { recursive: true })) {
  const hit = event.paths.find(relevant);
  if (!hit) continue;
  console.log(`[watch] ${event.kind}: ${hit.slice(root.length + 1)}`);
  clearTimeout(timer);
  timer = setTimeout(build, DEBOUNCE_MS);
}
