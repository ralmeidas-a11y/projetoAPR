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
    const result = await sql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Users_Solicitantes'
    `);
    console.log("Columns for Users_Solicitantes:");
    console.log(result.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    const userRes = await sql.query(`
      SELECT EMAIL, SAP, USUARIO, FUNCIONARIO FROM E_OPEMAN WHERE EMAIL LIKE 'ralmeida%' OR NOME LIKE 'ralmeida%'
    `);
    console.log("\nUsers in E_OPEMAN:");
    console.table(userRes.recordset);

    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
