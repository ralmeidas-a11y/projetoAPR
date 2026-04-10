require('dotenv').config({ path: __dirname + '/.env' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true }
};

async function dumpTable(tableName) {
  try {
    const res = await sql.query(`SELECT * FROM ${tableName}`);
    console.log(`--- ${tableName} ---`);
    console.log(JSON.stringify(res.recordset, null, 2));
  } catch (err) {
    console.error(`Error dumping ${tableName}:`, err.message);
  }
}

(async () => {
  try {
    await sql.connect(config);
    const tables = ['E_GRADIF', 'E_GRUESP', 'E_TPESES', 'E_TIPGAS'];
    for (const table of tables) {
      await dumpTable(table);
    }
    process.exit(0);
  } catch (err) {
    console.error('Connection Error:', err.message);
    process.exit(1);
  }
})();
