const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
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
app.use("/", (req, res, next) => {
    console.log("Processed response!");
    return res.status(201).json({
        "title": "base json response",
        "info": "more json info",
    })
})

// Start server
const PORT = process.env.PORT || 3030;
app.listen(PORT);

console.log("Listening on port " + PORT);