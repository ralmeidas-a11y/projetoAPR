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
    const result = await sql.query("SELECT TOP 20 SOL_ORGAO, COUNT(*) as qty FROM T_ESTPLA GROUP BY SOL_ORGAO ORDER BY qty DESC");
    console.log(JSON.stringify(result.recordset, null, 2));
    
    const sample = await sql.query("SELECT TOP 5 SOL_ORGAO, SOL_RESPON, TITULO FROM T_ESTPLA WHERE SOL_ORGAO IS NOT NULL");
    console.log("Samples:", JSON.stringify(sample.recordset, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await sql.close();
  }
}

run();
