const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function check() {
  try {
    await sql.connect(config);
    console.log("Searching for 'rsalmeida' or 'ralmeida' in E_OPEMAN...");
    const r = await sql.query(`SELECT USUARIO, SAP, EMAIL, NOME FROM E_OPEMAN WHERE USUARIO LIKE '%almeida%' OR NOME LIKE '%almeida%'`);
    console.log("Results from E_OPEMAN:", r.recordset);
    
    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
