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

async function checkColumns() {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Requests'
    `);
    console.log("Columns for Requests:");
    console.log(result.recordset.map(c => c.COLUMN_NAME).join(', '));
    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkColumns();
