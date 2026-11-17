// This script will be appended to each post page

let contentDiv = document.getElementById("content");

// Get all <code> elements inside <pre> elements and add the class "highlight" to them
document.querySelectorAll('pre code').forEach(function(codeElement) {
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
        hint: "Fully clientside JS patcher, all ROMs below supported",
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
