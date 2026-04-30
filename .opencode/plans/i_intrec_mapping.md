# Plano: Mapear dados T_ESTPLA para I_INTREC

## Mapping necessário

| Dado T_ESTPLA | Coluna I_INTREC |
|---------------|----------------|
| NRO_ESTUDO | COD_ESTUDO |
| NRO_ESTUDO | IDSIGEP |
| DATA_INI (transição 200→205) | DATA_INI |
| DATA_TER (= DAT_SA_SEP) | DATA_TER |
| TotalExecutionTime | TEMPO |
| 'Generación' (fixo) | ATIVIDADE |
| DAT_SA_SEP (status 210) | DAT_SA_SEP |

## Implementação

Adicionar lógica em index.js, linhas 2147-2149:

```javascript
if (normalizedOld !== normalizedNew) {
  changes.push({ field: 'status', old: oldS, new: newS, type: 'STATUS_CHANGE' });

  // I_INTREC Sync: Detect status transitions 200 -> 205 and 210
  if (oldS === '200' && newS === '205') {
    try {
      const checkIntRec = await sql.query`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = ${effectiveNro}`;
      if (checkIntRec.recordset.length === 0) {
        await sql.query`
          INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_INI, ATIVIDADE)
          VALUES (@effectiveNro, @effectiveNro, GETDATE(), 'Generación')
        `;
        console.log(`[I_INTREC] ✅ DATA_INI set for study ${effectiveNro}`);
      }
    } catch (err) {
      console.warn('[I_INTREC] Error setting DATA_INI:', err.message);
    }
  }

  if (newS === '210') {
    try {
      const checkIntRec = await sql.query`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = ${effectiveNro}`;
      if (checkIntRec.recordset.length === 0) {
        await sql.query`
          INSERT INTO I_INTREC (COD_ESTUDO, IDSIGEP, DATA_TER, DAT_SA_SEP, ATIVIDADE)
          VALUES (@effectiveNro, @effectiveNro, GETDATE(), GETDATE(), 'Generación')
        `;
      } else {
        await sql.query`
          UPDATE I_INTREC SET DATA_TER = GETDATE(), DAT_SA_SEP = GETDATE()
          WHERE COD_ESTUDO = ${effectiveNro}
        `;
      }
      console.log(`[I_INTREC] ✅ DAT_SA_SEP set for study ${effectiveNro} (status 210)`);
    } catch (err) {
      console.warn('[I_INTREC] Error setting DAT_SA_SEP:', err.message);
    }
  }
}
```