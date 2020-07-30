const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({path: __dirname + '/process.env'}) //load process.env variables
//const multer = require('multer'); //no installed, not sure if needed

// Create and configure app
const app = express();

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
// const thisroute = require("./folder/file.js")
app.post("/providers", require("./routes/providers.js"));
app.post("/topdeals", require("./routes/topdeals.js"));
app.post("/search", require("./routes/search.js"));
app.post("/location", require("./routes/location.js"));
app.post("/itemoptions", require("./routes/itemoptions.js"));

app.use("/", (req, res, next) => {
    return res.status(404).json({
        error: true,
        message: 'Invalid path',
    });
})

module.exports = app; //for testing