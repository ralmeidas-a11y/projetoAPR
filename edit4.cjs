const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server', 'index.js');
let serverContent = fs.readFileSync(serverFile, 'utf8');

const target1 = `            const studyTypeStrForRev = String(data.studyType || '').toLowerCase();
            const isRevision = studyTypeStrForRev === 'revisão técnica' || studyTypeStrForRev === 'revisão de estudo' || studyTypeStrForRev.includes('revis');
            sqlReq.input('nroAn', sql.VarChar, isRevision ? (data.previousStudy || '') : (effectiveNro || '')); // NRO_EST_AN = previousStudy ou próprio studyNumber`;

const rep1 = `            // Confiar explicitamente na presenca de previousStudy para assinalar NRO_EST_AN
            const isRevision = !!data.previousStudy;
            sqlReq.input('nroAn', sql.VarChar, isRevision ? (data.previousStudy || '') : (effectiveNro || '')); // NRO_EST_AN = previousStudy ou próprio studyNumber`;

serverContent = serverContent.replace(target1, rep1);

// Tem outro lugar com isRevision?
// let's check
fs.writeFileSync(serverFile, serverContent);
console.log('done');
