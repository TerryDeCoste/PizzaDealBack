require('dotenv').config({path: __dirname + '/../process.env'}) //load process.env variables
const { Pool } = require('pg');
if (!process.env.DATABASE_URL){
  throw new Error("No DATABASE_URL from " + __dirname + '/../process.env');
}
console.log("Using DATABASE_URL: " + process.env.DATABASE_URL);
const sslConnect = process.env.DEVELOPMENT_SSL ? false: { rejectUnauthorized: false, };

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // max number of clients in the pool
    idleTimeoutMillis: 30000,
    ssl: sslConnect,
});

pool.on('error', (err) => {console.log("Connection ERROR", err)});

module.exports = {
    query: (text, params) => pool.query(text, params),
    close: () => pool.end(),
}