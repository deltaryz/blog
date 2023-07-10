let postsContainer = document.getElementById("posts");

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

      // create preview of content
      let preview = document.createElement("p");
      preview.textContent = element.text;

      // create button element
      let button = document.createElement("button");
      button.className = "mui-btn mui-btn--primary mui-btn--raised";
      button.textContent = "Read More";
      button.onclick = function () {
        window.location.href = element.url;
      };

      // put it all together
      panelDiv.appendChild(title);
      panelDiv.appendChild(preview);
      panelDiv.appendChild(button);
      postsContainer.appendChild(panelDiv);
    });
  })
  .catch((error) => {
    console.error("Error:", error);
  });
