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

    const result = await sql.query`UPDATE E_OPEMAN SET SAP = '00805217' WHERE USUARIO = 'rsalmeida'`;
    console.log('Update result:', result.rowsAffected);
    
    // Verify
    const verify = await sql.query`SELECT USUARIO, email, NOME, SAP FROM E_OPEMAN WHERE USUARIO = 'rsalmeida'`;
    console.log('Verification:', verify.recordset);

    await sql.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
