
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
    const result = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'T_ESTPLA'
    `;
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Connection Error:', err.message);
    process.exit(1);
  }
}

check();
