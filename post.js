// This script will be appended to each post page

let contentDiv = document.getElementById("content");

// ```diff blocks: each line becomes its own row (red background for -, green for +), and the
// code after the marker is highlighted separately, so the normal syntax colors still apply
document.querySelectorAll('pre code.lang-diff').forEach(function (code) {
    var lines = code.textContent.replace(/\n$/, "").split("\n");
    code.textContent = "";
    lines.forEach(function (line) {
        var kind = line[0] === "+" ? "diff-add" : line[0] === "-" ? "diff-del" : "diff-ctx";
        var row = document.createElement("span");
        row.className = "diff-line " + kind;
        var marker = document.createElement("span");
        marker.className = "diff-marker";
        marker.textContent = line.slice(0, 1) || " ";
        var rest = document.createElement("span");
        rest.className = "highlight";
        rest.textContent = line.slice(1) || " ";
        row.append(marker, rest);
        code.append(row);
    });
});

// microlight only knows //, /* */ and # comments, so in Lua (and SQL) a "--" comment got
// tokenized like code, and an apostrophe in it started a bogus string. split those blocks into
// code runs (highlighted as usual) and comment runs (styled like microlight's own comments)
document.querySelectorAll('pre code.lang-lua, pre code.lang-sql').forEach(function (code) {
    var text = code.textContent, out = [], start = 0, i = 0, quote = null, blockEnd = null;
    function flush(end, comment) {
        if (end > start) out.push([text.slice(start, end), comment]);
        start = end;
    }
    while (i < text.length) {
        var c = text[i];
        if (blockEnd) { // inside --[[ ... ]] or a -- line comment
            var end = text.indexOf(blockEnd, i);
            if (end === -1) end = text.length; else if (blockEnd !== "\n") end += blockEnd.length;
            i = end; flush(i, true); blockEnd = null; continue;
        }
        if (quote) { if (c === "\\") i++; else if (c === quote || c === "\n") quote = null; i++; continue; }
        if (c === '"' || c === "'") { quote = c; i++; continue; }
        if (c === "-" && text[i + 1] === "-") {
            flush(i, false);
            blockEnd = text.slice(i + 2, i + 4) === "[[" ? "]]" : "\n";
            continue;
        }
        i++;
    }
    flush(text.length, false);
    code.textContent = "";
    out.forEach(function (part) {
        var span = document.createElement("span");
        span.className = part[1] ? "dash-comment" : "highlight";
        span.textContent = part[0];
        code.append(span);
    });
});

// Get all <code> elements inside <pre> elements and add the class "highlight" to them
document.querySelectorAll('pre code:not(.lang-diff):not(.lang-lua):not(.lang-sql)').forEach(function(codeElement) {
    codeElement.classList.add('highlight');
});

microlight.reset("highlight");
// Stretch tables that take up most of their container to full width; leave narrow ones as-is.
// Tables wider than the container keep sideways scrolling instead.
function stretchWideTables() {
    document.querySelectorAll('#content table').forEach(function(table) {
        table.classList.remove('wide');
        var available = table.parentElement.clientWidth;
        if (table.scrollWidth > 0.8 * available && table.scrollWidth <= available) {
            table.classList.add('wide');
        }
    });
}
stretchWideTables();
window.addEventListener('load', stretchWideTables);
window.addEventListener('resize', stretchWideTables);

// Center images that take up most of their container; leave narrow ones left-aligned.
// Only repositions, never scales anything up.
function centerWideImages() {
    document.querySelectorAll('#content img').forEach(function(img) {
        img.classList.remove('wide');
        var available = img.parentElement.clientWidth;
        if (img.offsetWidth > 0.8 * available) {
            img.classList.add('wide');
        }
    });
}
document.querySelectorAll('#content img').forEach(function(img) {
    img.addEventListener('load', centerWideImages);
});
centerWideImages();
window.addEventListener('load', centerWideImages);
window.addEventListener('resize', centerWideImages);

// ==========================================================
// upload boxes (":::upload name" in a post, see makehtml.ts)
// each box looks up uploadHandlers[name]. a handler gets the chosen File and
// a ui object, and runs entirely in the browser -- nothing is uploaded.
// ==========================================================

// standard CRC32, used to identify files (works without https, unlike crypto.subtle)
var crc32Table = null;
function crc32(bytes) {
    if (!crc32Table) {
        crc32Table = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            crc32Table[n] = c >>> 0;
        }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function hex8(n) {
    return n.toString(16).toUpperCase().padStart(8, "0");
}

// hand a Uint8Array to the user as a file download
function downloadBytes(bytes, fileName) {
    var url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

// SMAS brick delay fix. each entry is a clean headerless ROM + the bytes to write
// (same data as the .ips files). patchedCrc is checked after patching.
var brickFixRoms = [
    {
        name: "Super Mario All-Stars (Europe)",
        size: 2097152,
        crc: 0x925FFA69,
        patchedCrc: 0xA8BB35A3,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1C027, "02"],
            [0x1C10A, "2280FF00EA"],
            [0x6BDC9, "02"],
            [0x6BEB1, "2280FF00EA"],
        ],
    },
    {
        name: "Super Mario All-Stars (USA)",
        size: 2097152,
        crc: 0x925637C7,
        patchedCrc: 0x844CDFFD,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1BFA5, "02"],
            [0x1C088, "2280FF00EA"],
            [0x6BD93, "02"],
            [0x6BE7B, "2280FF00EA"],
        ],
    },
    {
        name: "Super Mario All-Stars + Super Mario World (USA)",
        size: 2621440,
        crc: 0xF84305B1,
        patchedCrc: 0x4F83F41C,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1BFAD, "02"],
            [0x1C090, "2280FF00EA"],
            [0x6BD93, "02"],
            [0x6BE7B, "2280FF00EA"],
        ],
    },
    {
        name: "Super Mario All-Stars and Super Mario World (Europe)",
        size: 2621440,
        crc: 0x303205D8,
        patchedCrc: 0x6E4A5339,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1C027, "02"],
            [0x1C10A, "2280FF00EA"],
            [0x6BDC9, "02"],
            [0x6BEB1, "2280FF00EA"],
        ],
    },
    {
        name: "Super Mario Collection (Japan) (Rev 1)",
        size: 2097152,
        crc: 0x91B28D56,
        patchedCrc: 0x29D57213,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1BFAD, "02"],
            [0x1C090, "2280FF00EA"],
            [0x6BD72, "02"],
            [0x6BE5A, "2280FF00EA"],
        ],
    },
    {
        name: "Super Mario Collection (Japan)",
        size: 2097152,
        crc: 0x232BB5B8,
        patchedCrc: 0xEFD8C0BB,
        patch: [
            [0x07F80, "BDEE03F008C902F0016BDEEE03C220A30118691D008301E2206B"],
            [0x1BFA5, "02"],
            [0x1C088, "2280FF00EA"],
            [0x6BD72, "02"],
            [0x6BE5A, "2280FF00EA"],
        ],
    },
];

var uploadHandlers = {
    brickfix: {
        title: "Patch your ROM",
        hint: "All ROMs below supported",
        accept: ".sfc,.smc",
        handle: function (file, ui) {
            ui.status("Reading " + file.name + "...");
            file.arrayBuffer().then(function (buf) {
                var rom = new Uint8Array(buf);
                // strip a 512-byte copier header if there is one
                if (rom.length % 1024 === 512) rom = rom.slice(512);
                var crc = crc32(rom);
                var entry = brickFixRoms.find(function (r) { return r.crc === crc && r.size === rom.length; });
                if (!entry) {
                    var patched = brickFixRoms.find(function (r) { return r.patchedCrc === crc; });
                    if (patched) return ui.fail("This is already a patched " + patched.name + " ROM.");
                    return ui.fail("Unrecognized ROM (CRC32 " + hex8(crc) + "). Supported: " +
                        brickFixRoms.map(function (r) { return r.name; }).join(", ") + ".");
                }
                var out = rom.slice();
                entry.patch.forEach(function (rec) {
                    for (var i = 0; i < rec[1].length / 2; i++) {
                        out[rec[0] + i] = parseInt(rec[1].substr(i * 2, 2), 16);
                    }
                });
                if (crc32(out) !== entry.patchedCrc) {
                    return ui.fail("Patching produced an unexpected result, nothing was downloaded. Please report this!");
                }
                var outName = entry.name + " [Brick Delay Fix].sfc";
                downloadBytes(out, outName);
                ui.done("Detected " + entry.name);
            }).catch(function (err) {
                ui.fail("Could not read the file: " + err);
            });
        },
    },
};

document.querySelectorAll("#content .upload-drop").forEach(function (zone) {
    var name = zone.getAttribute("data-upload");
    var handler = uploadHandlers[name];
    var input = zone.querySelector("input[type=file]");
    var status = zone.querySelector(".upload-status");
    var ui = {
        status: function (text) { zone.classList.remove("done", "bad"); status.textContent = text; },
        done: function (text) { zone.classList.remove("bad"); zone.classList.add("done"); status.textContent = text; },
        fail: function (text) { zone.classList.remove("done"); zone.classList.add("bad"); status.textContent = text; },
    };

    if (!handler) {
        ui.fail('No upload handler named "' + name + '"');
        return;
    }
    if (handler.title) zone.querySelector(".upload-title").textContent = handler.title;
    if (handler.hint) zone.querySelector(".upload-hint").innerHTML = handler.hint;
    if (handler.accept) input.accept = handler.accept;

    function run(file) {
        if (file) handler.handle(file, ui);
    }
    input.addEventListener("change", function () {
        run(input.files[0]);
        input.value = ""; // so picking the same file again still fires change
    });
    zone.addEventListener("click", function (e) { if (e.target !== input) input.click(); });
    zone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("dragover"); });
    zone.addEventListener("drop", function (e) {
        e.preventDefault();
        zone.classList.remove("dragover");
        run(e.dataTransfer.files[0]);
    });
});

// ==========================================================
// tabbed containers (":::tabs Name" in a post, see makehtml.ts)
// clicking a tab button shows its panel and hides the others in that group
// ==========================================================
document.querySelectorAll("#content .tabs").forEach(function (group) {
    var buttons = Array.prototype.filter.call(group.children[0].children, function (el) {
        return el.classList.contains("tab-button");
    });
    var panels = Array.prototype.filter.call(group.children, function (el) {
        return el.classList.contains("tab-panel");
    });
    buttons.forEach(function (button, i) {
        button.addEventListener("click", function () {
            buttons.forEach(function (b, j) { b.classList.toggle("active", i === j); });
            panels.forEach(function (p, j) { p.classList.toggle("active", i === j); });
        });
    });
});


// ==========================================================
// external links in posts always open in a new tab
// (same-tab navigation to github etc. breaks inside framed previews)
// ==========================================================
document.querySelectorAll("#content a[href]").forEach(function (a) {
    if (a.host && a.host !== location.host) {
        a.target = "_blank";
        a.rel = "noopener";
    }
});

// ==========================================================
// long unbroken inline code (hashes etc) wraps with a visible hyphen:
// soft hyphens go between every character of words 16+ chars long, and are
// stripped again on copy so pasted hashes stay exact
// ==========================================================
document.querySelectorAll("#content :not(pre) > code").forEach(function (code) {
    if (code.children.length) return;
    var text = code.textContent;
    if (!/\S{16,}/.test(text)) return;
    code.textContent = text.replace(/\S{16,}/g, function (word) { return word.split("").join("\u00AD"); });
});
document.addEventListener("copy", function (e) {
    var text = String(window.getSelection());
    if (text.indexOf("\u00AD") === -1) return;
    e.clipboardData.setData("text/plain", text.replace(/\u00AD/g, ""));
    e.preventDefault();
});

// top shadow (body::before in index.css) only shows once the header bar is completely off screen
var appbar = document.querySelector(".mui-appbar");
if (appbar && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
        document.documentElement.classList.toggle("header-gone", !entries[0].isIntersecting);
    }).observe(appbar);
}

// ==========================================================
// twinkling background stars: round soft dots (1-3px, mostly small) on a
// canvas fixed to the viewport (they don't scroll with the page). each star
// lives for one slow fade in + out (3-9s, never brighter than 60%), drifting
// in a straight line at its own constant speed and direction the whole time,
// then respawns somewhere new with a new heading. on wide screens the side
// margins get denser toward the screen edges (up to 5x). the canvas sits between the
// body's gradient and the content (see body.twinkle in index.css). static,
// non-moving dots if the reader prefers reduced motion.
// ==========================================================
(function () {
    var canvas = document.createElement("canvas");
    canvas.id = "twinkle";
    document.body.prepend(canvas);
    document.body.classList.add("twinkle");
    var ctx = canvas.getContext("2d");
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stars = [], w = 0, h = 0, dpr = 1, left = 0, right = 0, wide = false;

    // star density multiplier at screen x: 1 normally; on wide screens (room for 2+ content
    // columns) it ramps from 1x at the content's edge up to 5x at the screen edge
    function density(x) {
        if (!wide) return 1;
        if (x < left) return 1 + 4 * (left - x) / left;
        if (x > right) return 1 + 4 * (x - right) / (w - right);
        return 1;
    }

    // (re)roll everything about a star except its timing
    function spawn(s, born) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 0.5 + Math.random() * 5.5; // css px per second, very slow (max 6)
        do { s.x = Math.random() * w; } while (Math.random() * 5 > density(s.x)); // weighted toward dense edges
        s.y = Math.random() * h;
        s.vx = Math.cos(angle) * speed / 1000; // per ms
        s.vy = Math.sin(angle) * speed / 1000;
        s.born = born;
        s.peak = 0.23 + Math.random() * 0.37; // max opacity 23-60%
        s.size = 1 + 2 * Math.pow(Math.random(), 3); // 1-3px across, mostly near 1
    }

    function setup(now) {
        dpr = window.devicePixelRatio || 1;
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        var frame = document.getElementById("contentFrame") || document.getElementById("content");
        var box = frame ? frame.getBoundingClientRect() : { left: 0, right: w, width: w };
        left = box.left; right = box.right;
        wide = box.width > 0 && w >= 2 * box.width && left > 0 && right < w;
        stars = [];
        // ~1 star per 3100px² over the content (double that on screens too narrow for the ramp),
        // plus the extra in the ramped margins
        var count = Math.round(0.64 * h * (wide ? w + 2 * left + 2 * (w - right) : 2 * w) / 2000);
        for (var i = 0; i < count; i++) {
            var s = { period: 3000 + Math.random() * 6000 }; // one life = one fade in + out, 3-9s
            s.offset = Math.random() * s.period; // stagger so they don't all blink together
            s.life = Math.floor((now + s.offset) / s.period);
            spawn(s, now);
            stars.push(s);
        }
    }

    function draw(t) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(function (s) {
            var k = 0.6, x = s.x, y = s.y;
            if (!still) {
                var life = Math.floor((t + s.offset) / s.period);
                if (life !== s.life) { s.life = life; spawn(s, t); } // invisible at this point, safe to jump
                k = 0.5 - 0.5 * Math.cos(((t + s.offset) % s.period) / s.period * 2 * Math.PI); // 0..1..0
                x = s.x + s.vx * (t - s.born);
                y = s.y + s.vy * (t - s.born);
            }
            // round soft dot: solid core, fading to nothing at the edge
            var cx = x * dpr, cy = y * dpr, r = s.size * dpr / 2 + 0.5;
            var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, "rgba(255,255,255,1)");
            g.addColorStop(0.6, "rgba(255,255,255,1)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            // brightness: 1.8x over the content column and on narrow screens (boosted while testing
            // the frosted glass), easing to 1.75x at the screen edge, all scaled by 0.886 (0.77 + 15%)
            ctx.globalAlpha = 0.886 * Math.min(1, s.peak * k * (1.8 - 0.05 * ((density(x) - 1) / 4)));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    var last = 0;
    function loop(t) {
        if (t - last > 33) { draw(t); last = t; } // ~30fps keeps the slow drift smooth
        requestAnimationFrame(loop);
    }

    setup(performance.now());
    window.addEventListener("resize", function () { var now = performance.now(); setup(now); draw(now); });
    if (still) draw(0); else requestAnimationFrame(loop);
})();
