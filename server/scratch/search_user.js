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

    const result = await sql.query`SELECT * FROM E_OPEMAN WHERE NOME LIKE '%rsalmeida%' OR LOGIN LIKE '%rsalmeida%'`;
    console.log('User search result:', result.recordset);
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
