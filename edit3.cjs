const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server', 'index.js');
let serverContent = fs.readFileSync(serverFile, 'utf8');

const target1 = `          const isNewStudy = !data.studyNumber || data.studyNumber === '';
          const changes = [];
          if (isNewStudy && !previousRecord) {
            if (data.previousStudy) {
              changes.push({ field: 'revisão', old: data.previousStudy, new: effectiveNro, type: 'REVISION_REQUEST' });
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'STATUS_CHANGE' });
            } else {
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'CREATE' });
            }
          } else if (previousRecord) {`;

const rep1 = `          const changes = [];
          if (!previousRecord) {
            if (data.previousStudy) {
              changes.push({ field: 'revisão', old: data.previousStudy, new: effectiveNro, type: 'REVISION_REQUEST' });
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'STATUS_CHANGE' });
            } else {
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'CREATE' });
            }
          } else if (previousRecord) {`;

serverContent = serverContent.replace(target1, rep1);

fs.writeFileSync(serverFile, serverContent);
console.log('done');
