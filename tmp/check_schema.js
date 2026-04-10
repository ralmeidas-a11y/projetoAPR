const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(config);
    console.log("--- T_ESTPLA ---");
    const tEstpla = await sql.query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA'");
    console.log(JSON.stringify(tEstpla.recordset, null, 2));

    console.log("\n--- Requests ---");
    const requests = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Requests'");
    console.log(JSON.stringify(requests.recordset, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await sql.close();
  }
}

run();
