
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function checkTable() {
  try {
    await sql.connect(config);
    const result = await sql.query('SELECT TOP 10 * FROM G_MUNEST');
    console.log(JSON.stringify(result.recordset, null, 2));
    await sql.close();
  } catch (err) {
    console.error(err);
  }
}

checkTable();
