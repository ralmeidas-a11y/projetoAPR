const sql = require('mssql');
require('dotenv').config();

sql.connect({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  options: { encrypt: true, trustServerCertificate: true }
}).then(async pool => {
  const res = await pool.query("SELECT * FROM Requests");
  let columns = Object.keys(res.recordset[0] || {});
  console.log('Columns in Requests:', columns.join(', '));
  
  let found = false;
  res.recordset.forEach(r => {
    let jsonStr = r.data || r.meta_data;
    if(!jsonStr) return;
    try {
      let m = JSON.parse(jsonStr);
      for (let k in m) {
        if (typeof m[k] === 'string' && (m[k].includes('PROV-2026') || m[k] === '0,00' || m[k] === '0.00')) {
          console.log('Key:', k, '=>', m[k], '| in record NRO:', r.NRO_ESTUDO || r.studyNumber);
          found = true;
        }
      }
    } catch(e){}
  });
  if(!found) console.log("Not found in JSON exactly.");
  process.exit(0);
}).catch(console.error);
