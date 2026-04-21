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
    const r = await sql.query(`SELECT USUARIO, SAP, EMAIL FROM E_OPEMAN WHERE EMAIL LIKE '%ralmeida%'`);
    console.log("E_OPEMAN:", r.recordset);
    
    // Check what we have for Analistas generally
    const r2 = await sql.query(`SELECT TOP 5 USUARIO, SAP, EMAIL, NATIVE_ROLE FROM E_OPEMAN WHERE NATIVE_ROLE = 'Analista'`);
    console.log("Other Analistas in E_OPEMAN:", r2.recordset);

    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
