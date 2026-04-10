
const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function checkPK() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT 
          KU.COLUMN_NAME,
          KU.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE KU
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS TC ON KU.CONSTRAINT_NAME = TC.CONSTRAINT_NAME
      WHERE TC.TABLE_NAME = 'T_ESTPLA' AND TC.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `;
    console.log('PK Columns:', result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkPK();
