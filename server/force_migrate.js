
const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function forceMigrate() {
  try {
    await sql.connect(config);
    console.log('Connected. Attempting migration...');
    
    // 1. Check for constraints
    const constraints = await sql.query`
      SELECT d.name FROM sys.default_constraints d
      INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
      WHERE d.parent_object_id = OBJECT_ID('T_ESTPLA') AND c.name = 'NRO_ESTUDO'
    `;
    for (const row of constraints.recordset) {
      console.log('Dropping constraint:', row.name);
      await sql.query`ALTER TABLE T_ESTPLA DROP CONSTRAINT ${sql.raw(row.name)}`;
    }
    
    // 2. Try Alter
    console.log('Altering column...');
    await sql.query`ALTER TABLE T_ESTPLA ALTER COLUMN NRO_ESTUDO VARCHAR(100) NULL`;
    console.log('Migration successful!');
    
    const final = await sql.query`SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'NRO_ESTUDO'`;
    console.log('New Type:', final.recordset[0].DATA_TYPE);
    
    process.exit(0);
  } catch (err) {
    console.error('Migration Failed:', err.message);
    process.exit(1);
  }
}
forceMigrate();
