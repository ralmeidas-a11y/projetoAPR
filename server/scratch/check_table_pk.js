const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: true, trustServerCertificate: true }
};

async function run() {
  const tableName = process.argv[2] || 'T_CHKLST';
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT 
          KU.COLUMN_NAME,
          KU.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE KU
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS TC ON KU.CONSTRAINT_NAME = TC.CONSTRAINT_NAME
      WHERE TC.TABLE_NAME = '${tableName}' AND TC.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);
    console.log(`PK Columns for ${tableName}:`, result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
