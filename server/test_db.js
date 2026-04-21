const sql = require('mssql');
require('dotenv').config({ path: __dirname + '/.env' });
sql.connect(process.env.DB_CONNECTION_STRING).then(async () => {
    let reqR = await sql.query("SELECT TOP 5 id, NRO_ESTUDO, status FROM Requests ORDER BY createdAt DESC");
    console.log("Requests table:", reqR.recordset);
    
    let tR = await sql.query("SELECT TOP 5 id, IDSIGEP, NRO_ESTUDO, STATUS FROM T_ESTPLA ORDER BY DataCriaReg DESC");
    console.log("T_ESTPLA table:", tR.recordset);
    
    process.exit(0);
}).catch(err => {
    console.error("DB Error:", err);
    process.exit(1);
});
