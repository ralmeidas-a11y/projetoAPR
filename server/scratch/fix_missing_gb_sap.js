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
    const r = await sql.query(`SELECT id, gb, sap, email FROM Users_Solicitantes`);
    console.log("Users_Solicitantes:", r.recordset);
    
    // Update missing data from E_OPEMAN to Users_Solicitantes if needed
    await sql.query(`
      UPDATE U
      SET U.gb = E.USUARIO, U.sap = E.SAP
      FROM Users_Solicitantes U
      INNER JOIN E_OPEMAN E ON UPPER(U.email) = UPPER(E.EMAIL)
      WHERE (U.gb IS NULL OR U.gb = '') AND E.USUARIO IS NOT NULL
    `);
    
    const r2 = await sql.query(`SELECT id, gb, sap, email FROM Users_Solicitantes`);
    console.log("Users_Solicitantes After Update:", r2.recordset);

    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
