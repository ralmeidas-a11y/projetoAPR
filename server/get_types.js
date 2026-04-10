const sql = require('mssql');
require('dotenv').config();

sql.connect({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 30000
}).then(async pool => {
  const r = await pool.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME IN ('id', 'NRO_ESTUDO', 'NRO_EST_AN', 'IDSIGEP')");
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
}).catch(console.error);
