const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Naturgy2024!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ProjetoAPR',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function checkColumns() {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT TOP 1 * FROM E_OPEMAN`;
    console.log('Columns in E_OPEMAN:', Object.keys(result.recordset.columns));
    console.log('Sample Data:', result.recordset[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.close();
  }
}

checkColumns();
