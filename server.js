//separated server.js file for jest testing

//start app
const app = require("./app");

// Start server
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log("Listening on port " + PORT);
});
