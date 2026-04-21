const sql = require('mssql');
require('dotenv').config();

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(sqlConfig);
    console.log('Connected to SQL Server');

    console.log('--- E_DEFECT ---');
    const defects = await sql.query(`SELECT * FROM E_DEFECT ORDER BY CODIGO`);
    console.log(JSON.stringify(defects.recordset, null, 2));

    console.log('--- E_STACHK ---');
    const status = await sql.query(`SELECT * FROM E_STACHK`);
    console.log(JSON.stringify(status.recordset, null, 2));
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
