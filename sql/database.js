require('dotenv').config({path: __dirname + '/../process.env'}) //load process.env variables
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // max number of clients in the pool
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {console.log("Connection ERROR", err)});

module.exports = {
    query: (text, params) => pool.query(text, params),
    close: () => pool.end(),
}