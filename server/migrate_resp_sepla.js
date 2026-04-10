
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Naturgy2024!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ProjetoAPR',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function migrate() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database.');

    // 1. Get all users with SAP codes
    const usersResult = await pool.request().query('SELECT EMAIL, RTRIM(LTRIM(SAP)) as SAP FROM E_OPEMAN WHERE SAP IS NOT NULL AND EMAIL IS NOT NULL');
    const userMap = new Map();
    usersResult.recordset.forEach(u => {
      userMap.set(u.EMAIL.toLowerCase().trim(), u.SAP.trim());
    });
    console.log(`Loaded ${userMap.size} users with SAP codes.`);

    // 2. Get all T_ESTPLA records
    const estplaResult = await pool.request().query('SELECT id, RESP_SEPLA FROM T_ESTPLA WHERE RESP_SEPLA LIKE \'%@%\'');
    console.log(`Found ${estplaResult.recordset.length} records in T_ESTPLA with emails in RESP_SEPLA.`);

    let updatedCount = 0;
    for (const record of estplaResult.recordset) {
      const email = record.RESP_SEPLA.toLowerCase().trim();
      const sap = userMap.get(email);

      if (sap) {
        await pool.request()
          .input('sap', sql.NVarChar, sap)
          .input('id', sql.VarChar, record.id)
          .query('UPDATE T_ESTPLA SET RESP_SEPLA = @sap WHERE id = @id');
        updatedCount++;
        if (updatedCount % 10 === 0) console.log(`Updated ${updatedCount} records...`);
      } else {
        console.warn(`Could not find SAP for email: ${email}`);
      }
    }

    console.log(`Migration complete. Total updated: ${updatedCount}`);
    await pool.close();
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
