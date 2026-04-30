const fs = require('fs');
const path = require('path');

// 1. Update App.tsx to fetch ID if 0
const appFile = path.join(__dirname, 'src', 'App.tsx');
let appContent = fs.readFileSync(appFile, 'utf8');

const appTarget = `        if (isRevision) {
          // É uma revisão - Pedir próxima revisão ao servidor
          const baseRef = newRequest.previousStudy!;
          const nextNumResult = await StorageService.getNextStudyNumber('revision', baseRef);
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            previousStudy: baseRef,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        } else {
          // Novo estudo - Pedir próximo número global ao servidor
          const nextNumResult = await StorageService.getNextStudyNumber('new');
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        }`;

const appRep = `        // Assegurar ID válido para novos estudos e revisões
        const nextId = await StorageService.getNextId();

        if (isRevision) {
          // É uma revisão - Pedir próxima revisão ao servidor
          const baseRef = newRequest.previousStudy!;
          const nextNumResult = await StorageService.getNextStudyNumber('revision', baseRef);
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            id: String(newRequest.id) === '0' ? nextId : newRequest.id,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            previousStudy: baseRef,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        } else {
          // Novo estudo - Pedir próximo número global ao servidor
          const nextNumResult = await StorageService.getNextStudyNumber('new');
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            id: String(newRequest.id) === '0' ? nextId : newRequest.id,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        }`;

appContent = appContent.replace(appTarget, appRep);
fs.writeFileSync(appFile, appContent);

// 2. Update server/index.js to remove DAT_SA_SEP from I_INTREC queries
const serverFile = path.join(__dirname, 'server', 'index.js');
let serverContent = fs.readFileSync(serverFile, 'utf8');

const serverTarget1 = `                      INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_TER, DAT_SA_SEP, TEMPO, ATIVIDADE)
                      VALUES (@studyNro, @studyNro, GETDATE(), GETDATE(), @studyTempo, 'Generación')`;
const serverRep1 = `                      INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_TER, TEMPO, ATIVIDADE)
                      VALUES (@studyNro, @studyNro, GETDATE(), @studyTempo, 'Generación')`;

const serverTarget2 = `                      UPDATE I_INTREC SET DATA_TER = GETDATE(), DAT_SA_SEP = GETDATE(), TEMPO = @studyTempo
                      WHERE COD_ESTUDO = @studyNro`;
const serverRep2 = `                      UPDATE I_INTREC SET DATA_TER = GETDATE(), TEMPO = @studyTempo
                      WHERE COD_ESTUDO = @studyNro`;

serverContent = serverContent.replace(serverTarget1, serverRep1);
serverContent = serverContent.replace(serverTarget2, serverRep2);
fs.writeFileSync(serverFile, serverContent);

console.log('done');
