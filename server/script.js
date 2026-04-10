const sql = require('mssql');
require('dotenv').config({ path: '.env' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'T_ESTPLA' 
      AND DATA_TYPE IN ('float', 'real', 'datetime', 'varchar', 'nvarchar')
    `);
    
    const myDT = ['DAT_ENT_REA', 'DAT_IN_SEP', 'DAT_SA_SEP', 'dtEntregaPrevista', 'DATA_SOLIC_OPER'];
    const floats = [];
    
    result.recordset.forEach(r => {
      const col = r.COLUMN_NAME.toLowerCase();
      if (myDT.some(d => d.toLowerCase() === col) && r.DATA_TYPE !== 'datetime') {
         console.log('DATETIME INPUT -> DB TYPE:', r);
      }
      if (r.DATA_TYPE === 'float' || r.DATA_TYPE === 'real') floats.push(r.COLUMN_NAME);
    });
    
    console.log("All float columns in T_ESTPLA:", floats);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
