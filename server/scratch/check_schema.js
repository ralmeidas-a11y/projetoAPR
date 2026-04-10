const sql = require('mssql');
require('dotenv').config();

async function check() {
  try {
    await sql.connect(process.env.DATABASE_URL || {
      user: 'sa',
      password: 'sa',
      server: 'localhost',
      database: 'ProjetoAPR',
      options: { encrypt: false, trustServerCertificate: true }
    });

    console.log('--- Users_Solicitantes columns ---');
    const res1 = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users_Solicitantes'");
    console.table(res1.recordset);

    console.log('--- E_OPEMAN columns ---');
    const res2 = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'E_OPEMAN'");
    console.table(res2.recordset);

    const res3 = await sql.query("SELECT TOP 5 CREATED_AT FROM E_OPEMAN");
    console.log('E_OPEMAN.CREATED_AT samples:', res3.recordset);

    const res4 = await sql.query("SELECT TOP 5 createdAt FROM Users_Solicitantes");
    console.log('Users_Solicitantes.createdAt samples:', res4.recordset);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
