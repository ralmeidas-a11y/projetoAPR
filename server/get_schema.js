const sql = require('mssql');
require('dotenv').config();
const fs = require('fs');

sql.connect({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: { encrypt: true, trustServerCertificate: true }
}).then(async pool => {
  const res = await pool.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA'");
  fs.writeFileSync('db_schema.txt', JSON.stringify(res.recordset, null, 2), 'utf8');
  console.log('Done');
  process.exit(0);
}).catch(console.error);
