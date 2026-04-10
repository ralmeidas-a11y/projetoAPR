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

async function test() {
  try {
    await sql.connect(config);
    const r = await sql.query(`
      SELECT ID, assignedTo, analystName, analystGB, analystCompany, analystRole 
      FROM Requests 
      WHERE ID = 3
    `);
    console.log(JSON.stringify(r.recordset, null, 2));
    await sql.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
