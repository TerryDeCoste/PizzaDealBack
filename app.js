const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({path: __dirname + '/process.env'}) //load process.env variables

// Create and configure app
const app = express();

app.use(express.static(path.join(__dirname, './front_build/')));

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Routes
app.post("/providers", require("./routes/providers.js"));
app.post("/topdeals", require("./routes/topdeals.js"));
app.post("/search", require("./routes/search.js"));
app.post("/location", require("./routes/location.js"));
app.post("/itemoptions", require("./routes/itemoptions.js"));
app.post("/searchbychain", require("./routes/search_by_chain.js"));

app.get("/", (req, res, next) => {
  res.sendFile(path.join(__dirname, './front_build/index.html'));
});

app.use("/", (req, res, next) => {
    res.status(301).redirect("/");
    // no 404 page, just routes to the index page.
});

module.exports = app; //for testing