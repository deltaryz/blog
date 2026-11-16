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
