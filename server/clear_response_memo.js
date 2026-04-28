// Script para limpar responseMemo das solicitações em CQ ou Concluído
// Execute via: node clear_response_memo.js

const sql = require('mssql');

const sqlConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'Naturgy_APR',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function clearResponseMemos() {
  try {
    console.log('Conectando ao banco...');
    await sql.connect(sqlConfig);
    console.log('Conectado!');
    
    // Verificar quantos registros serão afetados primeiro
    const check = await sql.query`
      SELECT COUNT(*) as cnt FROM Requests 
      WHERE STATUS IN ('205', '280') 
      AND responseMemo IS NOT NULL 
      AND LEN(responseMemo) > 0
    `;
    console.log('Registros encontrados na Requests:', check.recordset[0].cnt);
    
    if (check.recordset[0].cnt > 0) {
      // Atualizar
      await sql.query`
        UPDATE Requests 
        SET responseMemo = '' 
        WHERE STATUS IN ('205', '280') 
        AND responseMemo IS NOT NULL 
        AND LEN(responseMemo) > 0
      `;
      console.log('Registros atualizados!');
    }
    
    console.log('Concluído!');
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

clearResponseMemos();