const sql = require('mssql');
require('dotenv').config();

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(sqlConfig);
    console.log('Connected to SQL Server');

    const tables = ['T_CHKLST', 'E_DEFECT', 'E_STACHK'];
    
    for (const table of tables) {
        try {
            const result = await sql.query(`SELECT TOP 1 * FROM ${table}`);
            if (result.recordset.length > 0) {
                console.log(`Columns in ${table}:`, Object.keys(result.recordset[0]));
            } else {
                console.log(`Table ${table} is empty, but exists.`);
                // Get schema instead
                const schema = await sql.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'`);
                console.log(`Schema columns for ${table}:`, schema.recordset.map(r => r.COLUMN_NAME));
            }
        } catch (e) {
            console.log(`Error listing ${table}:`, e.message);
        }
    }
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
