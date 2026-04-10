const sql = require('mssql');
require('dotenv').config();

async function test() {
  try {
    console.log('[Debug] Connecting...');
    await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      server: process.env.DB_SERVER,
      options: { encrypt: true, trustServerCertificate: true }
    });
    console.log('[Debug] Connected.');

    console.log('[Debug] Testing Requests query...');
    try {
      const q1 = `SELECT TOP 1 id, user_id, formType, meta_data, NRO_ESTUDO as studyNumber, STATUS as status, SOL_RESPON as requesterName, SOL_ORGAO as requesterArea, TITULO as studyTitle, LOCALIZ as address, Municipio as city, EmailContato as email, TEL_SOL as phone, createdAt, updatedAt FROM Requests`;
      await sql.query(q1);
      console.log('[Debug] Requests query: SUCCESS');
    } catch (e) {
      console.error('[Debug] Requests query: FAILED -', e.message);
    }

    console.log('[Debug] Testing T_ESTPLA query...');
    try {
      const q2 = `SELECT TOP 1 id, user_id, FK_MODELO as formType, meta_data, CAST(NRO_ESTUDO as varchar(100)) as studyNumber, STATUS as status, SOL_RESPON as requesterName, SOL_ORGAO as requesterArea, TITULO as studyTitle, LOCALIZ as address, Municipio as city, EmailContato as email, TEL_SOL as phone, DataCriaReg as createdAt, DataCriaReg as updatedAt FROM T_ESTPLA`;
      await sql.query(q2);
      console.log('[Debug] T_ESTPLA query: SUCCESS');
    } catch (e) {
      console.error('[Debug] T_ESTPLA query: FAILED -', e.message);
    }

  } catch (err) {
    console.error('[Debug] Fatal Error:', err.message);
  } finally {
    process.exit();
  }
}

test();
