
const sql = require('mssql');
const fs = require('fs');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function dump() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'T_ESTPLA'
      ORDER BY COLUMN_NAME
    `;
    fs.writeFileSync('t_estpla_schema.json', JSON.stringify(result.recordset, null, 2));
    console.log('Schema dumped to t_estpla_schema.json');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
dump();
