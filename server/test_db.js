require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE || 'ProjetoAPR',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

async function test() {
  const pool = await sql.connect(dbConfig);
  const t_est = await pool.request().query("SELECT TOP 20 id, IDSIGEP, NRO_ESTUDO, STATUS FROM T_ESTPLA ORDER BY DataCriaReg DESC");
  console.log('=== T_ESTPLA TABLE LATEST 20 ===');
  console.log(t_est.recordset);
  
  await sql.close();
}
test().catch(console.error);
