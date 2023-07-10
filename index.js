// grab the posts json from the server
// (this should be automatically updated frequently)
fetch("posts.json")
  .then((response) => response.json())
  .then((data) => {
    console.log(data);
  })
  .catch((error) => {
    console.error("Error:", error);
  });
