
const sql = require('mssql');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'your_password',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'ProjetoAPR',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        console.log('Connecting to database...');
        await sql.connect(config);
        console.log('Connected.');

        console.log('Updating T_ESTPLA...');
        const res1 = await sql.query`UPDATE T_ESTPLA SET RESP_SEPLA = '00805217' WHERE RESP_SEPLA = '805217'`;
        console.log(`Updated T_ESTPLA: ${res1.rowsAffected} rows affected.`);

        console.log('Updating Requests...');
        const res2 = await sql.query`UPDATE Requests SET meta_data = JSON_MODIFY(meta_data, '$.assignedTo', '00805217') WHERE JSON_VALUE(meta_data, '$.assignedTo') = '805217'`;
        const res3 = await sql.query`UPDATE Requests SET meta_data = JSON_MODIFY(meta_data, '$.respSepla', '00805217') WHERE JSON_VALUE(meta_data, '$.respSepla') = '805217'`;
        console.log(`Updated Requests meta_data: ${res2.rowsAffected + res3.rowsAffected} changes.`);

        console.log('Success.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

run();
