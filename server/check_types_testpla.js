require('dotenv').config({ path: __dirname + '/.env' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
  try {
    await sql.connect(config);
    console.log('--- Columns in T_ESTPLA ---');
    const res = await sql.query`SELECT TOP 0 * FROM T_ESTPLA`;
    const cols = res.recordset.columns;
    for (let name in cols) {
      console.log(`${name}: ${cols[name].type.name}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
