let postsContainer = document.getElementById("posts");
let copyright = document.getElementById("copyright");

copyright.innerHTML = "© 2023 - " + new Date().getFullYear() + " Cameron Seid";

// grab the posts json from the server
// (this should be automatically updated frequently)
fetch("posts.json")
  .then((response) => response.json())
  .then((data) => {
    // iterate through each entry
    data.forEach((element) => {
      // create panel element
      let panelDiv = document.createElement("div");
      panelDiv.className = "mui-panel";

      // create title element
      let title = document.createElement("h1");
      title.textContent = element.title;

      // create date element
      let date = document.createElement("h3");
      date.textContent = element.date.slice(0, 10);

      // create preview of content
      let preview = document.createElement("p");

      // trim to only a few sentences
      const sentenceRegex = /[^.!?]+[.!?]+/g;
      const sentences = element.text.match(sentenceRegex);
      preview.textContent = sentences.slice(0, 10).join(" ");

      // create button element
      let a = document.createElement("a");
      a.href = element.url;
      let button = document.createElement("button");
      button.className = "mui-btn mui-btn--primary mui-btn--raised";
      button.textContent = "Read More";
      a.appendChild(button);

      // put it all together
      panelDiv.appendChild(title);
      panelDiv.appendChild(date);
      panelDiv.appendChild(preview);
      panelDiv.appendChild(a);
      postsContainer.appendChild(panelDiv);
    });
  })
  .catch((error) => {
    console.error("Error:", error);
  });
