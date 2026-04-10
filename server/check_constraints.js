
const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Amovoces7@',
  server: 'localhost',
  database: 'ProjetoAPR',
  options: { encrypt: true, trustServerCertificate: true }
};

async function checkConstraints() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT 
          OBJECT_NAME(parent_object_id) AS TableName,
          name AS ConstraintName,
          type_desc AS ConstraintType
      FROM sys.objects
      WHERE parent_object_id = OBJECT_ID('T_ESTPLA')
      AND type_desc LIKE '%CONSTRAINT%'
    `;
    console.log('Constraints:', result.recordset);
    
    const indexes = await sql.query`
      SELECT 
          i.name AS IndexName,
          c.name AS ColumnName
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('T_ESTPLA')
      AND c.name = 'NRO_ESTUDO'
    `;
    console.log('Indexes on NRO_ESTUDO:', indexes.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkConstraints();
