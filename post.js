// This script will be appended to each post page

let contentDiv = document.getElementById("content");

// Get all <code> elements inside <pre> elements and add the class "highlight" to them
document.querySelectorAll('pre code').forEach(function(codeElement) {
    codeElement.classList.add('highlight');
});

microlight.reset("highlight");