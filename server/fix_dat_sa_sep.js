const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.js');

let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the status 210 section
const oldCode = `if (newS === '210') {
                try {
                  const studyTempo = previousRecord ? previousRecord.Tempo : null;
                  const intRecReq = new sql.Request();
                  intRecReq.input('studyNro', sql.VarChar, effectiveNro);
                  intRecReq.input('studyTempo', sql.Float, studyTempo);
                  const checkIntRec = await intRecReq.query\`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = @studyNro\`;
                  if (checkIntRec.recordset.length === 0) {
                    await intRecReq.query\`
                      INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_TER, DAT_SA_SEP, TEMPO, ATIVIDADE)
                      VALUES (@studyNro, @studyNro, GETDATE(), GETDATE(), @studyTempo, 'Generación')
                    \`;
                  } else {
                    await intRecReq.query\`
                      UPDATE I_INTREC SET DATA_TER = GETDATE(), DAT_SA_SEP = GETDATE(), TEMPO = @studyTempo
                      WHERE COD_ESTUDO = @studyNro
                    \`;
                  }
                  console.log(\`[I_INTREC] ✅ DAT_SA_SEP set for study \${effectiveNro} (status 210)\`);
                } catch (err) {
                  console.warn('[I_INTREC] Error setting DAT_SA_SEP:', err.message);
                }
              }`;

const newCode = `if (newS === '210') {
                // 1. Update T_ESTPLA
                try {
                  const updReq = new sql.Request();
                  updReq.input('id', sql.VarChar, requestId);
                  await updReq.query\`UPDATE T_ESTPLA SET DAT_SA_SEP = GETDATE() WHERE id = @id\`;
                  console.log(\`[T_ESTPLA] ✅ DAT_SA_SEP set for ID=\${requestId}\`);
                } catch (err) {
                  console.warn('[T_ESTPLA] Error setting DAT_SA_SEP:', err.message);
                }

                // 2. Update I_INTREC
                try {
                  const studyTempo = previousRecord ? previousRecord.Tempo : null;
                  const intRecReq = new sql.Request();
                  intRecReq.input('studyNro', sql.VarChar, effectiveNro);
                  intRecReq.input('studyTempo', sql.Float, studyTempo);
                  const checkIntRec = await intRecReq.query\`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = @studyNro\`;
                  if (checkIntRec.recordset.length === 0) {
                    await intRecReq.query\`INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_TER, DAT_SA_SEP, TEMPO, ATIVIDADE) VALUES (@studyNro, @studyNro, GETDATE(), GETDATE(), @studyTempo, 'Generación')\`;
                  } else {
                    await intRecReq.query\`UPDATE I_INTREC SET DATA_TER = GETDATE(), DAT_SA_SEP = GETDATE(), TEMPO = @studyTempo WHERE COD_ESTUDO = @studyNro\`;
                  }
                  console.log(\`[I_INTREC] ✅ DAT_SA_SEP set for study \${effectiveNro}\`);
                } catch (err) {
                  console.warn('[I_INTREC] Error setting DAT_SA_SEP:', err.message);
                }
              }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ File updated successfully');
} else {
  console.log('❌ Pattern not found - manual check needed');
}
