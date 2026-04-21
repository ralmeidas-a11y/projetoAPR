const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function sync() {
  try {
    await sql.connect(config);
    
    // Find missing GB/SAP in Users_Solicitantes using E_OPEMAN as source
    // Match by email first
    await sql.query(`
      UPDATE U
      SET U.gb = ISNULL(NULLIF(U.gb, ''), E.USUARIO),
          U.sap = ISNULL(NULLIF(U.sap, ''), E.SAP)
      FROM Users_Solicitantes U
      INNER JOIN E_OPEMAN E ON UPPER(LTRIM(RTRIM(U.email))) = UPPER(LTRIM(RTRIM(E.EMAIL)))
      WHERE (U.gb IS NULL OR U.gb = '' OR U.sap IS NULL OR U.sap = '')
    `);
    
    // Match by name as fallback for Analistas
    await sql.query(`
      UPDATE U
      SET U.gb = ISNULL(NULLIF(U.gb, ''), E.USUARIO),
          U.sap = ISNULL(NULLIF(U.sap, ''), E.SAP)
      FROM Users_Solicitantes U
      INNER JOIN E_OPEMAN E ON UPPER(LTRIM(RTRIM(U.name))) = UPPER(LTRIM(RTRIM(E.NOME)))
      WHERE (U.gb IS NULL OR U.gb = '' OR U.sap IS NULL OR U.sap = '')
      AND U.role IN ('Analista', 'ADM', 'Administrador')
    `);

    console.log("Database Sync Completed.");
    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

sync();
