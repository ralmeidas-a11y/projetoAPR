const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'pages', 'TechnicalExecutionPanel.tsx');
let content = fs.readFileSync(file, 'utf8');

const target1 = `  const revisionHistory = useMemo(() => {
    if (!data.studyNumber) return [];
    const cleanCode = data.studyNumber.replace('PROV-', '');
    const revMatch = cleanCode.match(/(.+)-REV\\d+$/i);
    const baseCode = revMatch ? revMatch[1] : cleanCode;
    return allRequests.filter(r =>
      r.id !== data.id &&
      (r.studyNumber.replace('PROV-', '').startsWith(baseCode) || (r.previousStudy && r.previousStudy.replace('PROV-', '').startsWith(baseCode)))
    ).sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }, [allRequests, data.id, data.studyNumber]);`;

const rep1 = `  const revisionHistory = useMemo(() => {
    if (!data.studyNumber) return [];
    const cleanCode = data.studyNumber.replace('PROV-', '');
    
    let baseCode = cleanCode;
    const revMatch = cleanCode.match(/(.+)-REV\\d+$/i);
    if (revMatch) {
      baseCode = revMatch[1];
    } else if (cleanCode.length >= 8 && /^\\d+$/.test(cleanCode.substring(0, 8))) {
      baseCode = cleanCode.substring(0, 8);
    }

    return allRequests.filter(r => {
      if (r.id === data.id) return false;
      const rCleanCode = (r.studyNumber || '').replace('PROV-', '');
      const rPrevCode = (r.previousStudy || '').replace('PROV-', '');
      let rBaseCode = rCleanCode;
      const rRevMatch = rCleanCode.match(/(.+)-REV\\d+$/i);
      if (rRevMatch) {
         rBaseCode = rRevMatch[1];
      } else if (rCleanCode.length >= 8 && /^\\d+$/.test(rCleanCode.substring(0, 8))) {
         rBaseCode = rCleanCode.substring(0, 8);
      }
      return rBaseCode === baseCode || (rPrevCode.length >= 8 && rPrevCode.startsWith(baseCode));
    }).sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }, [allRequests, data.id, data.studyNumber]);`;

const target2 = `    const getPreviousStudy = (studyNumber: string | undefined) => {
      if (!studyNumber) return '-';
      const match = studyNumber.match(/-REV(\\d+)$/i);
      if (match) {
        const currentRev = parseInt(match[1], 10);
        if (currentRev > 0) {
          return studyNumber.replace(/-REV\\d+$/i, \`-REV\${currentRev - 1}\`).replace('PROV-', '');
        }
      }
      return '-';
    };`;

const rep2 = `    const getPreviousStudy = (studyNumber: string | undefined) => {
      if (data.previousStudy) {
        return data.previousStudy.replace('PROV-', '');
      }
      if (!studyNumber) return '-';
      const match = studyNumber.match(/-REV(\\d+)$/i);
      if (match) {
        const currentRev = parseInt(match[1], 10);
        if (currentRev > 0) {
          return studyNumber.replace(/-REV\\d+$/i, \`-REV\${currentRev - 1}\`).replace('PROV-', '');
        }
      }
      return '-';
    };`;

content = content.replace(target1, rep1);
content = content.replace(target2, rep2);

fs.writeFileSync(file, content);
console.log('done');
