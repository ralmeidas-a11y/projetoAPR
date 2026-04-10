const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE || 'ProjetoAPR',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// --- MAPPINGS REPLICATED FROM server/index.js ---
const textToStatusCode = {
  'Pendente': 330,
  'Rascunho': 330,
  'Em Análise': 330,
  'Em Analise': 330,
  'Validado': 200,
  'Aguardando Execução': 200,
  'Aberto': 200,
  'Em Execução': 205,
  'Aguardando Informações': 240,
  'Controle de Qualidade': 280,
  'Aprovado pelo CQ': 215,
  'Reprovado pelo CQ': 290,
  'Enviado sem CQ': 215,
  'Concluído': 210,
  'Rejeitado': 220,
  'Cancelado': 220,
};

const areaMapping = {
  "GESEC-S - Gerência de Serviços Técnicos Capital": "921",
  "GEST-I - Gerência de Serviços Técnicos Interior": "922",
  "GESET - Gerência de Serviços Técnicos Rio": "924",
  "Planificação da Expansão": "948"
};

const gniTypeMapping = {
  "Residencial/Comercial - Estudo de Viabilidade Técnica": 1,
  "Winflow": 2,
  "Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica": 3,
  "Planificação de Novos municípios": 4
};

const formMapping = {
  'PE.00492-FO.01': 1,
  'PE.00492-FO.02': 2,
  'PE.00492-FO.03': 3,
  'PE.00492-FO.04': 4
};

const difficultyMapping = {
  "FACIL": 1, "Fácil": 1, "MEDIO": 2, "Médio": 2, "DIFICIL": 3, "Difícil": 3
};

const studyGroupMapping = {
  "Expansão de Rede": "100", "Renovação de Rede": "110", "Operação de Rede": "120"
};

// --- HELPERS ---
const addBusinessDays = (startDate, days) => {
  let d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
};

const calculateDeadline = (requestDate, formType) => {
  if (!requestDate) return '';
  let d;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(requestDate)) {
    const [day, month, year] = requestDate.split('/').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(requestDate);
  }
  if (isNaN(d.getTime())) return '';

  let deadlineDate;
  if (formType === 'PE.00492-FO.02') {
    deadlineDate = new Date(d);
    deadlineDate.setDate(deadlineDate.getDate() + 7);
  } else {
    deadlineDate = addBusinessDays(d, 5);
  }
  return deadlineDate.toISOString().split('T')[0];
};

const dateToOADate = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const epoch = new Date(1899, 11, 30);
  return (dateObj.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24);
};

const safeFloat = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const p = parseFloat(String(val).replace(',', '.').trim());
  return isNaN(p) ? null : p;
};

const safeInt = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const p = parseInt(String(val).replace(/[^0-9]/g, '').trim());
  return isNaN(p) ? 0 : p;
};

// --- MIGRATION RUNNER ---
async function migrate() {
  console.log('🚀 Starting Data Synchronization Migration...');
  try {
    await sql.connect(config);
    console.log('✅ Connected to SQL Server');

    const result = await sql.query`SELECT id, meta_data, formType, status, requestDate FROM Requests`;
    const requests = result.recordset;
    console.log(`📊 Found ${requests.length} requests to process`);

    for (const reqRow of requests) {
      let data;
      try {
        data = JSON.parse(reqRow.meta_data || '{}');
      } catch (e) {
        console.error(`❌ Error parsing JSON for ID ${reqRow.id}`);
        continue;
      }

      let modified = false;

      // 1. FO.02 Aggregation
      if (reqRow.formType === 'PE.00492-FO.02' && data.gridDataFO02) {
        let numRes = 0; let flowRes = 0;
        let numCom = 0; let flowCom = 0;

        Object.entries(data.gridDataFO02).forEach(([segment, gridItem]) => {
          const rowSum = (Number(gridItem.atuais) || 0) + (Number(gridItem.y2) || 0) + (Number(gridItem.y5) || 0) + (Number(gridItem.y20) || 0);
          const rowFlow = Number(gridItem.totalQ) || 0;

          if (segment.toLowerCase().includes('residencial')) {
            numRes += rowSum; flowRes += rowFlow;
          } else {
            numCom += rowSum; flowCom += rowFlow;
          }
        });

        if (data.numClientsRes !== numRes || data.totalFlowRes !== flowRes) {
          data.numClientsRes = numRes;
          data.totalFlowRes = flowRes;
          data.numClientsCom = numCom;
          data.totalFlowCom = flowCom;
          modified = true;
          console.log(`  [FO.02] Updated totals for ID ${reqRow.id}`);
        }
      }

      // 2. Deadline Correction (1970 check)
      const currentDeadline = data.estimatedDeliveryDate || '';
      const is1970 = currentDeadline.startsWith('1970');
      if (!currentDeadline || is1970) {
        const newDeadline = calculateDeadline(data.requestDate || reqRow.requestDate, reqRow.formType);
        if (newDeadline && newDeadline !== currentDeadline) {
          data.estimatedDeliveryDate = newDeadline;
          modified = true;
          console.log(`  [Deadline] Fixed 1970/missing date for ID ${reqRow.id} -> ${newDeadline}`);
        }
      }

      // 3. Update Tables
      const statusVal = textToStatusCode[data.status] || 330;
      const mappedForm = formMapping[reqRow.formType] || 1;
      const mappedArea = areaMapping[data.requesterArea] || '';
      
      const sqlReq = new sql.Request();
      sqlReq.input('id', sql.VarChar, String(reqRow.id));
      sqlReq.input('meta', sql.NVarChar, JSON.stringify(data));
      sqlReq.input('status', sql.VarChar, String(statusVal));
      sqlReq.input('numE', sql.Int, safeInt(data.numClientsRes || 0));
      sqlReq.input('vazS', sql.Float, safeFloat((mappedForm == 2) ? (data.totalFlowRes || 0) : (data.totalFlow || data.peakFlow || 0)));
      sqlReq.input('numE2', sql.Int, safeInt(data.numClientsCom || 0));
      sqlReq.input('vazS2', sql.Float, safeFloat(data.totalFlowCom || 0));
      sqlReq.input('dtEntrega', sql.Float, data.estimatedDeliveryDate ? dateToOADate(new Date(data.estimatedDeliveryDate)) : null);

      // Update Requests first
      await sqlReq.query`UPDATE Requests SET meta_data = @meta, status = @status WHERE id = @id`;

      // Update T_ESTPLA if it exists there
      const checkT = await sql.query`SELECT 1 FROM T_ESTPLA WHERE id = ${String(reqRow.id)}`;
      if (checkT.recordset.length > 0) {
        await sqlReq.query`
          UPDATE T_ESTPLA SET 
            meta_data = @meta, 
            STATUS = @status,
            NUMECONOMIAS = @numE,
            VAZAOSOL = @vazS,
            NumEconomiasComIndEtc = @numE2,
            VazaoSolComIndEtc = @vazS2,
            dtEntregaPrevista = @dtEntrega
          WHERE id = @id
        `;
        console.log(`  [Sync] Synced ID ${reqRow.id} with T_ESTPLA`);
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await sql.close();
  }
}

migrate();
