const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function check() {
  try {
    await sql.connect(config);
    const r = await sql.query(`
      SELECT TOP 2 U.id, U.email, 
      CASE WHEN UPPER(E.FUNCIONARIO) IN ('1', 'S', 'SIM', 'V', 'VERDADEIRO', 'TRUE') THEN 1 ELSE 0 END as isActiveE, 
      CAST(ISNULL(U.isActive, 1) as bit) as isActiveU 
      FROM Users_Solicitantes U 
      LEFT JOIN E_OPEMAN E ON UPPER(U.email) = UPPER(E.EMAIL)
    `);
    console.log("Raw SQL recordset:", r.recordset);
    
    const mapped = r.recordset.map(row => ({
      email: row.email,
      isActiveOriginalU: row.isActiveU,
      isActiveOriginalE: row.isActiveE,
      // Testing exactly what the server does:
      isActiveServerMapped: row.isActiveU === null ? (row.isActiveE === 1) : (row.isActiveU === 1),
      isActiveBoolean: Boolean(row.isActiveU === null ? (row.isActiveE === 1) : (row.isActiveU === 1)),
      isActiveUCheck: row.isActiveU === 1,
      isActiveUStrictCheck: row.isActiveU === true
    }));
    
    console.log("\nMapped response output:", mapped);

    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
