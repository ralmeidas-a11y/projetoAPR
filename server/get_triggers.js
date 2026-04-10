const sql = require('mssql');
require('dotenv').config();

sql.connect({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: { encrypt: true, trustServerCertificate: true }
}).then(async pool => {
  const r = await pool.query("SELECT name, is_disabled, object_definition(object_id) as definition FROM sys.triggers WHERE parent_id = OBJECT_ID('T_ESTPLA')");
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
}).catch(console.error);
