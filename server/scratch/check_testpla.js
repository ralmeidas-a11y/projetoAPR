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
    const result = await sql.query`SELECT TOP 0 * FROM T_ESTPLA`;
    console.log('Columns in T_ESTPLA:', Object.keys(result.recordset.columns));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.close();
  }
}

checkColumns();
