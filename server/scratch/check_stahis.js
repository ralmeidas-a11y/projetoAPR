const sql = require('mssql');
require('dotenv').config({ path: 'server/.env' });

async function run() {
  try {
    await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      server: process.env.DB_SERVER,
      options: { encrypt: true, trustServerCertificate: true }
    });
    const r = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'S_STAHIS'");
    console.log(JSON.stringify(r.recordset, null, 2));
    
    console.log("\nSample data:");
    const r2 = await sql.query("SELECT TOP 5 * FROM S_STAHIS ORDER BY DATA_M DESC");
    console.log(JSON.stringify(r2.recordset, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
