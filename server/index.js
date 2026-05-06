const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const serverStartTime = new Date();

// Helper for legacy OA Date format (used by S_STAHIS)
function dateToOADate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0));
  return (dateObj.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24);
}

// Helper to parse DD/MM/YYYY dates (Brazil timezone UTC-3)
function parseDateBR(dateStr) {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Convert OADate to ISO string in Brazil timezone (UTC-3)
function oaDateToISOString(oaDate) {
  if (!oaDate || oaDate === null) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0));
  const jsDate = new Date(epoch.getTime() + oaDate * 86400 * 1000);
  const year = jsDate.getUTCFullYear();
  const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jsDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to resolve analyst name from SAP/ID
async function resolveAnalystName(id) {
  if (!id || id === 'ADRSIS' || id === 'SISTEMA') return id || 'SISTEMA';
  try {
    const cleanId = String(id).trim();
    const paddedId = (/^\d+$/.test(cleanId) && cleanId.length < 8) ? cleanId.padStart(8, '0') : cleanId;

    const result = await sql.query(`SELECT TOP 1 NomeCompleto FROM E_OPEMAN WHERE LTRIM(RTRIM(SAP)) = '${cleanId}' OR LTRIM(RTRIM(SAP)) = '${paddedId}'`);

    return result.recordset.length > 0 ? result.recordset[0].NomeCompleto : id;
  } catch (err) {
    console.warn(`[AnalystLookup] Error resolving name for ${id}:`, err.message);
    return id;
  }
}

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// SQL Server Config
const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// Connect to DB and start server
async function startServer() {
  try {
    console.log('[Server] Connecting to SQL Server...');
    await sql.connect(sqlConfig);
    console.log('[Server] Connected to SQL Server successfully');

    // Utility: Convert string to Title Case
    const toTitleCase = (str) => {
      if (!str) return '';
      return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    };

    // Utility: Fetch analyst names mapping
    const getSapToNameMap = async () => {
      const usersRes = await sql.query("SELECT SAP as sap, NOME as name FROM E_OPEMAN WHERE SAP IS NOT NULL");
      const sapToNameMap = {};
      usersRes.recordset.forEach(u => {
        if (u.sap) {
          const normalizedSap = String(u.sap).trim().replace(/^0+/, '');
          if (normalizedSap) sapToNameMap[normalizedSap] = u.name;
        }
      });
      return sapToNameMap;
    };

    // 1. Auto Create Solicitantes Table
    console.log('[Server] Checking Users_Solicitantes table...');
    await sql.query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users_Solicitantes' and xtype='U')
      CREATE TABLE Users_Solicitantes (
        [id] [varchar](100) PRIMARY KEY,
        [email] [varchar](255) NOT NULL,
        [name] [varchar](255) NOT NULL,
        [role] [varchar](50) NOT NULL,
        [password] [varchar](255) NULL,
        [department] [varchar](100) NULL,
        [company] [varchar](255) NULL,
        [roleDescription] [varchar](255) NULL,
        [gb] [varchar](100) NULL,
        [profileComplete] [bit] DEFAULT 0,
        [requiresPasswordChange] [bit] DEFAULT 0,
        [createdAt] [datetime] DEFAULT GETDATE()
      )
    `;

    // Ensure columns exist if table already existed
    await sql.query`
      IF COL_LENGTH('Users_Solicitantes', 'company') IS NULL
          ALTER TABLE Users_Solicitantes ADD [company] VARCHAR(255) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'roleDescription') IS NULL
          ALTER TABLE Users_Solicitantes ADD [roleDescription] VARCHAR(255) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'gb') IS NULL
          ALTER TABLE Users_Solicitantes ADD [gb] VARCHAR(100) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'phone') IS NULL
          ALTER TABLE Users_Solicitantes ADD [phone] VARCHAR(50) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'area') IS NULL
          ALTER TABLE Users_Solicitantes ADD [area] VARCHAR(100) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'naturgyUnit') IS NULL
          ALTER TABLE Users_Solicitantes ADD [naturgyUnit] VARCHAR(100) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'sap') IS NULL
          ALTER TABLE Users_Solicitantes ADD [sap] VARCHAR(100) NULL;
      IF COL_LENGTH('Users_Solicitantes', 'isActive') IS NULL
          ALTER TABLE Users_Solicitantes ADD [isActive] BIT DEFAULT 1;
    `;

    // 1b. Create T_AUDIT Table if not exists
    console.log('[Server] Checking T_AUDIT table...');
    await sql.query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='T_AUDIT' and xtype='U')
      CREATE TABLE T_AUDIT (
        [ID] [int] IDENTITY(1,1) PRIMARY KEY,
        [StudyNumber] [varchar](100) NULL,
        [ActionType] [varchar](50) NOT NULL,
        [FieldChanged] [varchar](100) NULL,
        [OldValue] [nvarchar](max) NULL,
        [NewValue] [nvarchar](max) NULL,
        [UserId] [varchar](100) NULL,
        [UserName] [nvarchar](200) NULL,
        [Timestamp] [datetime] DEFAULT GETDATE()
      )
    `;

    // 1.2 Auto Create SystemConfig Table
    console.log('[Server] Checking SystemConfig table...');
    await sql.query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SystemConfig' and xtype='U')
      CREATE TABLE SystemConfig (
        [configKey] [varchar](100) PRIMARY KEY,
        [configValue] [nvarchar](max) NULL,
        [createdAt] [datetime] DEFAULT GETDATE(),
        [updatedAt] [datetime] DEFAULT GETDATE()
      )
    `;

    // --- ONE-TIME DATA MIGRATION: Padding Analyst ID 805217 (Completed) ---

    console.log('[Server] Verificando e criando colunas nativas na E_OPEMAN...');
    await sql.query`
      -- 1. Criação e Expansão das Colunas Físicas
      ALTER TABLE E_OPEMAN ALTER COLUMN SAP VARCHAR(255) NULL;

      IF COL_LENGTH('E_OPEMAN', 'PASSWORD') IS NULL
          ALTER TABLE E_OPEMAN ADD PASSWORD VARCHAR(255) NULL;

      IF COL_LENGTH('E_OPEMAN', 'PERMISSOES') IS NULL
          ALTER TABLE E_OPEMAN ADD PERMISSOES VARCHAR(255) NULL;
          
      IF COL_LENGTH('E_OPEMAN', 'NATIVE_ROLE') IS NULL
          ALTER TABLE E_OPEMAN ADD NATIVE_ROLE VARCHAR(50) NULL;

      IF COL_LENGTH('E_OPEMAN', 'DEPARTMENT') IS NULL
          ALTER TABLE E_OPEMAN ADD DEPARTMENT VARCHAR(100) NULL;

      IF COL_LENGTH('E_OPEMAN', 'PROFILE_COMPLETE') IS NULL
          ALTER TABLE E_OPEMAN ADD PROFILE_COMPLETE BIT NULL;

      IF COL_LENGTH('E_OPEMAN', 'REQUIRES_PASSWORD_CHANGE') IS NULL
          ALTER TABLE E_OPEMAN ADD REQUIRES_PASSWORD_CHANGE BIT NULL;

      IF COL_LENGTH('E_OPEMAN', 'CREATED_AT') IS NULL
          ALTER TABLE E_OPEMAN ADD CREATED_AT DATETIME NULL;
      ELSE
          -- Ensure it is DATETIME even if it existed as VARCHAR
          BEGIN TRY
            ALTER TABLE E_OPEMAN ALTER COLUMN CREATED_AT DATETIME;
          END TRY
          BEGIN CATCH
            -- If data is incompatible, we just leave it for now but the TRY_CAST in use will handle it
          END CATCH

      IF COL_LENGTH('E_OPEMAN', 'EMPRESA') IS NULL
          ALTER TABLE E_OPEMAN ADD EMPRESA VARCHAR(255) NULL;

      IF COL_LENGTH('E_OPEMAN', 'CARGO') IS NULL
          ALTER TABLE E_OPEMAN ADD CARGO VARCHAR(255) NULL;
    `;

    // 2. T_ESTPLA Schema Migration (INT -> VARCHAR for UUID compatibility)
    console.log('[Server] Migrating T_ESTPLA ID type if needed...');
    const idTypeRes = await sql.query`
      SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'id'
    `;
    if (idTypeRes.recordset[0]?.DATA_TYPE === 'int') {
      console.log('[Server] Converting T_ESTPLA.id to VARCHAR(100)...');
      try {
        const pkRes = await sql.query`SELECT name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('T_ESTPLA')`;
        if (pkRes.recordset[0]) {
          await sql.query`ALTER TABLE T_ESTPLA DROP CONSTRAINT ${sql.raw(pkRes.recordset[0].name)}`;
        }
        await sql.query`ALTER TABLE T_ESTPLA ALTER COLUMN id VARCHAR(100) NOT NULL`;
        await sql.query`ALTER TABLE T_ESTPLA ADD CONSTRAINT PK_T_ESTPLA PRIMARY KEY (id)`;
        console.log('[Server] T_ESTPLA id migration successful');
      } catch (err) {
        console.error('[Server] Failed to migrate T_ESTPLA ID:', err.message);
      }
    }

    // NRO_ESTUDO Migration (Ensures legacy INT column becomes VARCHAR to support "PROV-" prefix)
    console.log('[Server] Checking T_ESTPLA NRO_ESTUDO type...');
    const nroTypeRes = await sql.query`
      SELECT DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'NRO_ESTUDO'
    `;
    if (nroTypeRes.recordset[0]?.DATA_TYPE === 'int') {
      console.log('[Server] Converting T_ESTPLA.NRO_ESTUDO to VARCHAR(100)...');
      try {
        // Drop any potential default constraint first to avoid blocking the alter
        const defConstraintRes = await sql.query`
          SELECT d.name FROM sys.default_constraints d
          INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
          WHERE d.parent_object_id = OBJECT_ID('T_ESTPLA') AND c.name = 'NRO_ESTUDO'
        `;
        if (defConstraintRes.recordset[0]) {
          await sql.query`ALTER TABLE T_ESTPLA DROP CONSTRAINT ${sql.raw(defConstraintRes.recordset[0].name)}`;
        }

        // Use NULL allowed for easier migration if data exists
        await sql.query`ALTER TABLE T_ESTPLA ALTER COLUMN NRO_ESTUDO VARCHAR(100) NULL`;
        console.log('[Server] T_ESTPLA NRO_ESTUDO migration successful');
      } catch (err) {
        console.error('[Server] CRITICAL: Failed to migrate T_ESTPLA NRO_ESTUDO:', err.message);
      }
    }

    // 3. Ensure Requests table exists and matches T_ESTPLA schema
    console.log('[Server] Synchronizing Requests table schema with T_ESTPLA...');

    await sql.query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' and xtype='U')
      CREATE TABLE Requests (
        [id] VARCHAR(100) PRIMARY KEY,
        [user_id] VARCHAR(100) NULL,
        [formType] VARCHAR(50) NULL,
        [meta_data] NVARCHAR(MAX) NULL,
        
        -- Mirroring T_ESTPLA columns 100%
        [NRO_ESTUDO] VARCHAR(100) NULL,
        [FK_MODELO] NVARCHAR(50) NULL,
        [STATUS] VARCHAR(50) NULL,
        [SOL_RESPON] NVARCHAR(100) NULL,
        [SOL_ORGAO] VARCHAR(50) NULL,
        [TITULO] NVARCHAR(MAX) NULL,
        [NOME_CLIENTE] NVARCHAR(MAX) NULL,
        [LOCALIZ] NVARCHAR(MAX) NULL,
        [Bairro] NVARCHAR(100) NULL,
        [Municipio] NVARCHAR(100) NULL,
        [EmailContato] NVARCHAR(255) NULL,
        [TEL_SOL] NVARCHAR(50) NULL,
        [EMPRESA] NVARCHAR(100) NULL,
        [DAT_EN_SEP] VARCHAR(50) NULL,
        [NRO_EST_AN] VARCHAR(100) NULL,
        [PRESSAO] NVARCHAR(50) NULL,
        [RESP_SEPLA] NVARCHAR(100) NULL,
        [OBSERVS] NVARCHAR(MAX) NULL,
        [TPGASS] NVARCHAR(50) NULL,
        [PRESGAS] NVARCHAR(50) NULL,
        [NumEconomias] INT NULL,
        [VazaoSol] FLOAT NULL,
        [ConsMens] INT NULL,
        [IDSIGEP] BIGINT NULL,
        [GRUPO_EST] NVARCHAR(50) NULL,
        [TIPO_EST] NVARCHAR(50) NULL,
        [TIP_ES] NVARCHAR(50) NULL,
        [GrauDificult] NVARCHAR(50) NULL,
        [CROQUI] NVARCHAR(20) DEFAULT 'FALSO',
        [EstudoRelevante] NVARCHAR(20) DEFAULT 'FALSO',
        [UnidSol] NVARCHAR(20) DEFAULT 'm³/h',
        [dtEntregaPrevista] VARCHAR(50) NULL,
        
        -- Mandatory columns with defaults for legacy triggers
        [RegulardoSN] NVARCHAR(10) DEFAULT 'NAO',
        [EMAIL_ENVIADO] NVARCHAR(10) DEFAULT 'NAO',
        [SIGEP] NVARCHAR(10) DEFAULT 'NAO',
        [BAIXA_SIGEP] NVARCHAR(10) DEFAULT 'NAO',
        
        [createdAt] DATETIME DEFAULT GETDATE(),
        [updatedAt] DATETIME DEFAULT GETDATE(),
        [STATUS_TEXT] NVARCHAR(100) NULL,  -- For UI fallback
        [requestDate] DATETIME NULL
      );
      
      -- Add missing column to existing table if needed
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RequestAttachments' and xtype='U')
    CREATE TABLE RequestAttachments (
      id INT PRIMARY KEY IDENTITY(1,1),
      requestId VARCHAR(100) NOT NULL,
      fileName NVARCHAR(255) NOT NULL,
      fileContent VARBINARY(MAX) NOT NULL,
      fileType NVARCHAR(100) NULL,
      category NVARCHAR(50) NULL,
      createdAt DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (requestId) REFERENCES Requests(id) ON DELETE CASCADE
    );

    -- Add missing column to existing table if needed
      IF COL_LENGTH('Requests', 'requestDate') IS NULL
          ALTER TABLE Requests ADD requestDate DATETIME NULL;
      IF COL_LENGTH('Requests', 'formType') IS NULL
          ALTER TABLE Requests ADD formType VARCHAR(50) NULL;
      IF COL_LENGTH('Requests', 'naturgyUnit') IS NULL
          ALTER TABLE Requests ADD naturgyUnit NVARCHAR(50) NULL;
      IF COL_LENGTH('Requests', 'lastModifiedBy') IS NULL
          ALTER TABLE Requests ADD lastModifiedBy NVARCHAR(200) NULL;
      IF COL_LENGTH('Requests', 'userId') IS NULL
          ALTER TABLE Requests ADD userId NVARCHAR(200) NULL;
    `;

    // Ensure T_ESTPLA also has metadata column if it doesn't
    await sql.query`
      IF COL_LENGTH('T_ESTPLA', 'meta_data') IS NULL
          ALTER TABLE T_ESTPLA ADD [meta_data] NVARCHAR(MAX) NULL;
      IF COL_LENGTH('T_ESTPLA', 'user_id') IS NULL
          ALTER TABLE T_ESTPLA ADD [user_id] VARCHAR(100) NULL;
      IF COL_LENGTH('T_ESTPLA', 'EmailContato') IS NULL
          ALTER TABLE T_ESTPLA ADD [EmailContato] NVARCHAR(255) NULL;
      IF COL_LENGTH('T_ESTPLA', 'TEL_SOL') IS NULL
          ALTER TABLE T_ESTPLA ADD [TEL_SOL] NVARCHAR(50) NULL;
          
      -- Mandatory legacy columns defaults for T_ESTPLA compatibility
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'RegulardoSN') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_RegulardoSN DEFAULT 'NAO' FOR RegulardoSN;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'EMAIL_ENVIADO') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_EMAIL_ENVIADO DEFAULT 'NAO' FOR EMAIL_ENVIADO;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'CROQUI') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_CROQUI DEFAULT 'NAO' FOR CROQUI;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'SIGEP') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_SIGEP DEFAULT 'NAO' FOR SIGEP;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'BAIXA_SIGEP') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_BAIXA_SIGEP DEFAULT 'NAO' FOR BAIXA_SIGEP;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'IDSIGEP') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_IDSIGEP DEFAULT 0 FOR IDSIGEP;
      IF (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'T_ESTPLA' AND COLUMN_NAME = 'EstudoRelevante') IS NULL
          ALTER TABLE T_ESTPLA ADD CONSTRAINT DF_EstudoRelevante DEFAULT 'NAO' FOR EstudoRelevante;
    `;

    // 4. Novas colunas para Sincronização Plena (FO03, FO04 e Resposta Técnica)
    console.log('[Server] Verificando colunas para sincronização plena...');
    const newColumns = [
      // Columns from requests.json that may be missing in legacy T_ESTPLA or staging Requests
      // Columns from requests.json that may be missing in legacy T_ESTPLA or staging Requests
      ['NOME_CLIENTE', 'NVARCHAR(MAX)'],
      ['MEMORANDO', 'NVARCHAR(255)'], ['MEMO_NUM', 'NVARCHAR(100)'], ['MEMO_DATA', 'NVARCHAR(100)'],
      ['OPERADOR_M', 'NVARCHAR(100)'], ['DATA_M', 'NVARCHAR(100)'],
      ['DAT_ENT_REA', 'DATETIME'], ['DAT_SA_SEP', 'DATETIME'],
      ['PresSolMax', 'FLOAT'], ['PresSolMin', 'FLOAT'], ['PresSol', 'NVARCHAR(50)'],
      ['HorOpeIni', 'NVARCHAR(50)'], ['HorOpeFin', 'NVARCHAR(50)'], ['DiaOpeMes', 'INT'],
      ['ObsEstudSol', 'NVARCHAR(MAX)'],
      ['PresClieMax', 'NVARCHAR(50)'], ['PresClieMin', 'NVARCHAR(50)'], ['PresClieGarant', 'NVARCHAR(50)'],
      ['CODCARSEP', 'NVARCHAR(50)'], ['StatusEntrega', 'NVARCHAR(100)'],
      ['ObservaResp', 'NVARCHAR(MAX)'], ['RegulardoSN', 'NVARCHAR(50)'], ['ReguladroVazao', 'INT'],
      ['CriadorRegistro', 'NVARCHAR(100)'], ['DataCriaReg', 'NVARCHAR(100)'],
      ['PressaoResposta', 'NVARCHAR(100)'], ['CustoRegulador', 'INT'],
      ['PressaoEntrada', 'NVARCHAR(50)'], ['unidPresEnt', 'NVARCHAR(50)'],
      ['PressaoSaida', 'INT'], ['unidPresSai', 'NVARCHAR(50)'],
      ['VazaoFutura', 'INT'], ['PRESCALC', 'NVARCHAR(50)'],
      ['fd', 'FLOAT'], ['fp', 'FLOAT'], ['vu', 'FLOAT'], ['Diversificar', 'FLOAT'],
      ['carta_sepla', 'NVARCHAR(100)'], ['DAT_PREN_INI_OP', 'NVARCHAR(100)'], ['EMAIL_ENVIADO', 'NVARCHAR(100)'],
      ['PRAZ_EST_CONST', 'NVARCHAR(50)'], ['CONSUMO_ESTIMADO', 'INT'],
      ['PRESSAO_INICIAL', 'FLOAT'], ['PRESSAO_FINAL', 'INT'],
      ['PRESSAO_ABSOLUTA', 'FLOAT'], ['PRESSAO_ATM', 'INT'], ['CODIGO_PASTA', 'NVARCHAR(50)'],
      ['FK_MODELO', 'NVARCHAR(50)'], ['GRUPORED', 'INT'], ['SIGEP', 'NVARCHAR(100)'], ['BAIXA_SIGEP', 'NVARCHAR(100)'],
      ['TIP_ES', 'INT'], ['GRUPO_EST', 'NVARCHAR(100)'], ['TIPO_EST', 'NVARCHAR(100)'],
      ['GrauDificult', 'INT'],
      ['Preparacion', 'FLOAT'], ['Simulacao', 'FLOAT'], ['Supervision', 'FLOAT'],
      ['Tempo', 'FLOAT'], ['TempoEstimado', 'FLOAT'],
      ['RedeExtTotal', 'INT'], ['OperadorConta', 'NVARCHAR(100)'],
      ['IDSIGEPVINC', 'INT'], ['ESTRERERIDO', 'INT'],
      ['NumEconomiasComIndEtc', 'INT'], ['VazaoSolComIndEtc', 'FLOAT'], ['UnidSolComIndEtc', 'NVARCHAR(50)'],
      ['REGGNV', 'INT'],
      // Existing technical columns
      ['VazaoInsta', 'FLOAT'], ['QDC', 'INT'], ['HoraFunciona', 'INT'],
      ['UF', 'NVARCHAR(50)'],
      ['meta_data', 'NVARCHAR(MAX)'], ['user_id', 'VARCHAR(100)'],
      ['EmailContato', 'NVARCHAR(255)'], ['TEL_SOL', 'NVARCHAR(50)'],
      ['MEMO_RESPOSTA', 'NVARCHAR(MAX)'], ['NRO_EST_AN', 'NVARCHAR(50)'],
      ['TPGASS', 'NVARCHAR(50)'], ['PRESGASS', 'NVARCHAR(50)'],
      ['CROQUI', 'NVARCHAR(20)'], ['ESTUDO_RELEV', 'NVARCHAR(20)'],
      ['DATA_SOLIC_OPER', 'DATETIME'],
      ['VAZ_MEDIA', 'FLOAT'], ['VAZ_PICO', 'FLOAT']
    ];

    for (const [col, type] of newColumns) {
      await sql.query(`
        IF COL_LENGTH('Requests', '${col}') IS NULL
            ALTER TABLE Requests ADD [${col}] ${type} NULL;
        IF COL_LENGTH('T_ESTPLA', '${col}') IS NULL
            ALTER TABLE T_ESTPLA ADD [${col}] ${type} NULL;
      `);
    }

    // Fix existing undersized columns (UF was NVARCHAR(10), now needs NVARCHAR(50))
    try {
      await sql.query`ALTER TABLE Requests ALTER COLUMN [UF] NVARCHAR(50) NULL`;
      await sql.query`ALTER TABLE T_ESTPLA ALTER COLUMN [UF] NVARCHAR(50) NULL`;
    } catch (e) { /* Column may not exist yet or already correct size */ }

    console.log('[Server] Populando colunas recém-criadas e corrigindo status de perfil...');
    await sql.query`
      -- 1. Marcar Analistas e Admins legados como perfil completo
      UPDATE E_OPEMAN 
      SET 
        NATIVE_ROLE = CASE 
                        WHEN RTRIM(LTRIM(EMAIL)) IN ('prgc@naturgy.com', 'solon@naturgy.com') THEN 'Administrador' 
                        ELSE ISNULL(NATIVE_ROLE, 'Analista')
                      END,
        DEPARTMENT = ISNULL(DEPARTMENT, 'APR'),
        PROFILE_COMPLETE = 1,
        REQUIRES_PASSWORD_CHANGE = CASE 
                                     WHEN [PASSWORD] IS NOT NULL AND [PASSWORD] LIKE '$2%' THEN 0 
                                     ELSE 1 
                                   END,
        CREATED_AT = ISNULL(CREATED_AT, GETDATE())
      WHERE EMAIL IS NOT NULL;

      -- 2. Marcar Solicitantes com dados preenchidos como perfil completo
      UPDATE Users_Solicitantes
      SET profileComplete = 1
      WHERE name IS NOT NULL AND area IS NOT NULL AND profileComplete = 0;
    `;

    // Migration logic for Password Encryption (Javascript side)
    const userRes = await sql.query('SELECT EMAIL, SAP, [PASSWORD] FROM E_OPEMAN WHERE EMAIL IS NOT NULL');
    for (const u of userRes.recordset) {
      const email = u.EMAIL;
      const sap = String(u.SAP || '').trim();
      const pwd = u.PASSWORD;

      const isHashed = pwd && (pwd.startsWith('$2a$') || pwd.startsWith('$2b$') || pwd.startsWith('$2y$'));
      if (!isHashed) {
        const passwordToHash = pwd || sap || '123456';
        const hashedPassword = bcrypt.hashSync(passwordToHash, 10);
        const updateReq = new sql.Request();
        updateReq.input('email', sql.VarChar, email);
        updateReq.input('hashed', sql.VarChar, hashedPassword);
        await updateReq.query('UPDATE E_OPEMAN SET [PASSWORD] = @hashed WHERE EMAIL = @email');
        console.log(`[Security] Migrated user ${email} to encrypted password.`);
      }
    }

    // 2. Testing Route
    app.get('/api/status', async (req, res) => {
      try {
        const result = await sql.query`SELECT 1 as isAlive, GETDATE() as systemDate`;
        res.json({
          status: 'online',
          databaseAccess: 'success',
          uptime: Math.floor(process.uptime()) + 's',
          startedAt: serverStartTime.toLocaleString('pt-BR'),
          data: result.recordset[0]
        });
      } catch (err) {
        console.error('SQL test query error:', err);
        res.status(500).json({ error: 'Database query failed' });
      }
    });

    // 2.1 System Configuration Routes
    const SYSTEM_CONFIG_KEY = 'system_config';
    let systemConfigCache = { folderBasePath: '' };

    app.get('/api/config', async (req, res) => {
      try {
        const request = new sql.Request();
        request.input('configKey', sql.VarChar, SYSTEM_CONFIG_KEY);
        const result = await request.query`
          SELECT configValue FROM SystemConfig WHERE configKey = @configKey
        `;

        if (result.recordset.length > 0) {
          const configData = JSON.parse(result.recordset[0].configValue);
          systemConfigCache = configData;
          res.json(configData);
        } else {
          res.json(systemConfigCache);
        }
      } catch (err) {
        console.error('[Config] Error fetching config:', err);
        res.json(systemConfigCache);
      }
    });

    // 2.2 E_TIPESP - Mapeamento de sub-tipos de estudo para modelos de carta
    app.get('/api/tipesp', async (req, res) => {
      try {
        const request = new sql.Request();
        const result = await request.query`SELECT DESCRICAO, GRUPO1 FROM E_TIPESP`;
        res.json(result.recordset);
      } catch (err) {
        console.error('[E_TIPESP] Error fetching:', err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/config', async (req, res) => {
      try {
        const { folderBasePath } = req.body;

        systemConfigCache = { folderBasePath: folderBasePath || '' };

        const request = new sql.Request();
        request.input('configKey', sql.VarChar, SYSTEM_CONFIG_KEY);
        request.input('configValue', sql.VarChar, JSON.stringify(systemConfigCache));

        await request.query`
          MERGE INTO SystemConfig AS target
          USING (SELECT @configKey as configKey) AS source
          ON target.configKey = source.configKey
          WHEN MATCHED THEN
            UPDATE SET configValue = @configValue, updatedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (configKey, configValue, createdAt, updatedAt)
            VALUES (@configKey, @configValue, GETDATE(), GETDATE());
        `;

        res.json({ success: true, ...systemConfigCache });
      } catch (err) {
        console.error('[Config] Error saving config:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // 3. GET All Users (Híbrido: Users_Solicitantes + E_OPEMAN)
    app.get('/api/users', async (req, res) => {
      try {
        const result = await sql.query`
          SELECT 
            U.[id], U.[email], U.[name], U.[role], U.[password], U.[department], U.[company], U.[roleDescription],
            -- Use ISNULL/COALESCE to pull from legacy if modern is empty
            ISNULL(NULLIF(RTRIM(LTRIM(U.[gb])), ''), RTRIM(LTRIM(E.USUARIO))) as [gb],
            ISNULL(NULLIF(RTRIM(LTRIM(U.[sap])), ''), RTRIM(LTRIM(E.SAP))) as [sap],
            U.[phone], U.[area], U.[naturgyUnit],
            CAST(ISNULL(U.[isActive], 1) as bit) as isActive,
            CAST(U.[profileComplete] as bit) as profileComplete, 
            CAST(U.[requiresPasswordChange] as bit) as requiresPasswordChange, 
            CONVERT(VARCHAR(30), U.[createdAt], 120) as [createdAt],
            E.PERMISSOES as [permissionsRaw]
          FROM Users_Solicitantes U
          LEFT JOIN E_OPEMAN E ON UPPER(LTRIM(RTRIM(U.email))) = UPPER(LTRIM(RTRIM(E.EMAIL)))
          
          UNION ALL

          SELECT 
            RTRIM(LTRIM(CAST(EMAIL as varchar(100)))) as [id], 
            RTRIM(LTRIM(EMAIL)) as [email], 
            RTRIM(LTRIM(NOME)) as [name],  
            RTRIM(LTRIM(NATIVE_ROLE)) as [role], 
            ISNULL(RTRIM(LTRIM(CAST([PASSWORD] as varchar(255)))), RTRIM(LTRIM(CAST(SAP as varchar(255))))) as [password], 
            RTRIM(LTRIM(DEPARTMENT)) as [department], 
            RTRIM(LTRIM(EMPRESA)) as [company],
            RTRIM(LTRIM(CARGO)) as [roleDescription],
            RTRIM(LTRIM(USUARIO)) as [gb],
            RTRIM(LTRIM(SAP)) as [sap],
            NULL as [phone],
            RTRIM(LTRIM(DEPARTMENT)) as [area],
            RTRIM(LTRIM(EMPRESA)) as [naturgyUnit],
            CAST(CASE 
              WHEN UPPER(LTRIM(RTRIM(CAST(FUNCIONARIO as varchar(50))))) IN ('1', 'S', 'SIM', 'V', 'VERDADEIRO', 'TRUE') THEN 1 
              ELSE 0 
            END as bit) as isActive,
            CAST(ISNULL(PROFILE_COMPLETE, 0) as bit) as profileComplete, 
            CAST(CASE WHEN [PASSWORD] IS NULL OR [PASSWORD] = '' THEN 1 ELSE 0 END as bit) as requiresPasswordChange, 
            CONVERT(VARCHAR(30), TRY_CAST(CREATED_AT AS DATETIME), 120) as [createdAt],
            PERMISSOES as [permissionsRaw]
          FROM E_OPEMAN
          WHERE EMAIL IS NOT NULL AND LTRIM(RTRIM(EMAIL)) <> '' 
            AND UPPER(LTRIM(RTRIM(EMAIL))) NOT IN (SELECT UPPER(EMAIL) FROM Users_Solicitantes WHERE EMAIL IS NOT NULL)
        `;

        const finalUsers = result.recordset.map(u => ({
          ...u,
          isActive: u.isActive === null ? false : Boolean(u.isActive),
          profileComplete: !!u.profileComplete,
          requiresPasswordChange: !!u.requiresPasswordChange,
          permissions: (u.permissionsRaw && typeof u.permissionsRaw === 'string') ? u.permissionsRaw.split(',').map(p => p.trim()) : []
        }));

        res.json(finalUsers);
      } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    // 4. POST Upsert User
    app.post('/api/users', async (req, res) => {
      try {
        const { id, email, name, role, password, department, profileComplete, requiresPasswordChange, permissions, company, roleDescription, gb, sap, phone, area, naturgyUnit, isActive } = req.body;

        const request = new sql.Request();
        request.input('id', sql.VarChar, id || '');
        request.input('email', sql.VarChar, email || '');
        request.input('name', sql.VarChar, name || '');
        request.input('role', sql.VarChar, role || '');
        request.input('department', sql.VarChar, department || '');
        request.input('company', sql.VarChar, company || '');
        request.input('roleDescription', sql.VarChar, roleDescription || '');
        request.input('gb', sql.VarChar, gb || '');
        request.input('sap', sql.VarChar, sap || '');
        request.input('phone', sql.VarChar, phone || '');
        request.input('area', sql.VarChar, area || '');
        request.input('naturgyUnit', sql.VarChar, naturgyUnit || '');
        request.input('profileComplete', sql.Bit, profileComplete ? 1 : 0);
        request.input('reqPassReset', sql.Bit, requiresPasswordChange ? 1 : 0);
        request.input('isActiveBit', sql.Bit, (isActive === undefined || isActive === true) ? 1 : 0);
        request.input('isActiveLegacy', sql.VarChar, (isActive === undefined || isActive === true) ? 'VERDADEIRO' : 'FALSO');
        request.input('permissions', sql.VarChar, permissions ? permissions.join(',') : '');

        const isHashed = password && (password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$'));
        const finalPwd = (password && !isHashed) ? bcrypt.hashSync(password, 10) : password;
        request.input('finalPwd', sql.VarChar, finalPwd || '');

        const r = role ? role.toLowerCase() : '';
        if (r === 'analista' || r === 'adm' || r === 'administrador') {
          const sapValueToUpdate = sap || gb || '';
          console.log(`[UserMgmt] 💾 Updating E_OPEMAN for ${email}. SAP: ${sapValueToUpdate}, GB: ${gb}, Active: ${isActive}`);

          await request.input('sapUpdateFinal', sql.VarChar, sapValueToUpdate).query`
              UPDATE E_OPEMAN 
              SET [PASSWORD] = @finalPwd,
                  PERMISSOES = @permissions,
                  DEPARTMENT = @department,
                  EMPRESA = @company,
                  CARGO = @roleDescription,
                  SAP = @sapUpdateFinal,
                  USUARIO = @gb,
                  PROFILE_COMPLETE = @profileComplete,
                  REQUIRES_PASSWORD_CHANGE = @reqPassReset,
                  FUNCIONARIO = @isActiveLegacy
              WHERE EMAIL = @email
            `;
          // Notice: We purposefully don't return early here anymore. We must update Users_Solicitantes as well!
        }

        await request.query`
          IF EXISTS (SELECT 1 FROM Users_Solicitantes WHERE id = @id)
          BEGIN
             UPDATE Users_Solicitantes SET 
                email = @email, name = @name, role = @role, 
                password = @finalPwd, department = @department,
                company = @company, roleDescription = @roleDescription, gb = @gb, sap = @sap,
                phone = @phone, area = @area, naturgyUnit = @naturgyUnit,
                profileComplete = @profileComplete, requiresPasswordChange = @reqPassReset,
                isActive = @isActiveBit
             WHERE id = @id
          END
          ELSE
          BEGIN
             INSERT INTO Users_Solicitantes 
                (id, email, name, role, password, department, company, roleDescription, gb, sap, phone, area, naturgyUnit, profileComplete, requiresPasswordChange, isActive)
             VALUES 
                (@id, @email, @name, @role, @finalPwd, @department, @company, @roleDescription, @gb, @sap, @phone, @area, @naturgyUnit, @profileComplete, @reqPassReset, @isActiveBit)
END
        `;

        res.status(200).json(req.body);
      } catch (err) {
        console.error('Error saving user:', err);
        res.status(500).json({ error: 'Failed to save user' });
      }
    });

    // === Status Translation Mappings (Per User JSON) ===
    const statusTextToCode = {
      'Pendente': '330',              // Pré-Cadastro
      'Em Análise': '330',            // Em Análise (Requests only)
      'Validado': '200',              // Aberto
      'Aguardando Execução': '200',    // Aberto
      'Em Execução': '205',           // Em andamento
      'Aguardando Informações': '240', // Aguardando Informações
      'Controle de Qualidade': '280',  // Controle de Qualidade
      'Aprovado pelo CQ': '215',       // Pronto (Estudo Pronto)
      'Reprovado pelo CQ': '290',      // Rever Estudo CQ
      'Enviado sem CQ': '225',         // Enviado sem CQ
      'Concluído': '210',              // Concluído (Enviado)
      'Rejeitado': '220',              // Cancelado
      'Cancelado': '220'               // Cancelado
    };

    // === Study Group Mappings (GRUPO_EST) ===
    const studyGroupToCode = {
      'Expansão de Rede': '100',
      'Renovação de Rede': '110',
      'Operação de Rede': '120',
      'Confiabilidade da Rede': '140',
      'Conversão GN': '150',
      'Outra': '160',
      'Solicitação Gerencial': '170',
      'Saturação': '180',
      'Modelos de Cálculo': '190',
      'Reforço': '200',
      'Remanejamento': '210',
      'Incremento de Vazão': '220',
      'Definir': '0',
      'GNNC': '230',
      'Setorização ERDs': '240',
      'Expansão GNV': '250'
    };

    const studySubTypeToCode = {
      'Comercial': '300', 'Residencial': '310', 'Industrial': '315', 'Climatização': '320',
      'Termogeração': '325', 'GNV': '330', 'MECOM': '335', 'Gaseificação Total': '340',
      'Emergencial': '345', 'Programado': '350', 'Simulação': '355', 'Cogeração': '360',
      'Mapas Temático': '365', 'Gaseificação Parcial': '370', 'Levantamento de Dados': '380',
      'Consulta Avulsas': '390', 'Grande Comércio': '400', 'GNC': '410', 'Infra-estrutura': '420',
      'Renovação': '430', 'GNV Frota': '440', 'Geração': '450', 'Geração de Emergência': '460',
      'Reforço': '470', 'Remanejamento': '480', 'Residencial/Comercial': '490',
      'Industrial/Geração Continua': '491', 'Definir': '0', 'Geração de Ponta': '492',
      'Geração Contínua': '493', 'Análise de Pressões e Vazões': '500',
      'Setorização ERDs': '510', 'Expansão GNV': '520', 'Estação de Liquefação - GNL': '530'
    };

    const studySubTypeToLetterTemplate = {
      'Comercial': 'rlt_carta_sepla_RESCOM',
      'Residencial': 'rlt_carta_sepla_RESCOM',
      'Industrial': 'rlt_carta_sepla_INDUSTRIAL',
      'Climatização': 'rlt_carta_sepla_INDUSTRIAL',
      'GNV': 'rlt_carta_sepla_INDUSTRIAL',
      'GNC': 'rlt_carta_sepla_INDUSTRIAL',
      'Termogeração': 'rlt_carta_sepla_TermoEletrico',
      'MECOM': 'rlt_carta_sepla_GASEIFICA',
      'Gaseificação Total': 'rlt_carta_sepla_GASEIFICA',
      'Gaseificação Parcial': 'rlt_carta_sepla_GASEIFICA_PARC',
      'Renovação': 'rlt_carta_sepla_RENOVACAOn',
      'Simulação': 'rlt_carta_sepla_RENOVACAOn',
      'Programado': 'rlt_carta_sepla_RENOVACAOn',
      'Infra-estrutura': 'rlt_carta_sepla_RENOVACAOn',
      'Cogeração': 'rlt_carta_sepla_INDUSTRIAL',
      'Grande Comércio': 'rlt_carta_sepla_RESCOM',
      'Residencial/Comercial': 'rlt_carta_sepla_RESCOM',
      'Industrial/Geração Continua': 'rlt_carta_sepla_INDUSTRIAL',
      'Geração de Ponta': 'rlt_carta_sepla_INDUSTRIAL',
      'Geração Contínua': 'rlt_carta_sepla_INDUSTRIAL',
      'Reforço': 'rlt_carta_sepla_RENOVACAOn',
      'Remanejamento': 'rlt_carta_sepla_RENOVACAOn',
      'Análise de Pressões e Vazões': 'rlt_carta_sepla_GENERICO',
      ' Setorização ERDs': 'rlt_carta_sepla_INDUSTRIAL',
      'Expansão GNV': 'rlt_carta_sepla_INDUSTRIAL',
      'Estação de Liquefação - GNL': 'rlt_carta_sepla_INDUSTRIAL',
      'Levantamento de Dados': 'rlt_carta_sepla_GENERICO',
      'Consulta Avulsas': 'rlt_carta_sepla_GENERICO',
      'Emergencial': 'rlt_carta_sepla_GENERICO',
      'Mapas Temático': 'rlt_carta_sepla_GENERICO',
      'GNV Frota': 'rlt_carta_sepla_INDUSTRIAL',
      'Geração': 'rlt_carta_sepla_INDUSTRIAL',
      'Geração de Emergência': 'rlt_carta_sepla_INDUSTRIAL',
      'Definir': 'rlt_carta_sepla_GENERICO'
    };

    const gniTypeToCode = {
      'Elaboração/Revisão de Modelos Matemáticos Winflow': '2',
      'Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica': '3',
      'Planificação de Novos municípios (Elaboração/Revisão)': '4',
      'Planificação Reforços/Religamento MP/BP (Elaboração/Revisão)': '5',
      'Planificação Reforços/Religamento AP (Elaboração/Revisão)': '6',
      'Abastecimento Novos Municípios GNC': '7',
      'Estudes Especiais (Propostas Expansão GNV, Levantamento de Dados, etc)': '8',
      'Estudos GNNC / Manobras': '9',
      'Residencial/Comercial - Estudo de Viabilidade Técnica': '1'
    };

    const statusCodeToText = {
      '200': 'Aguardando Execução',
      '205': 'Em Execução',
      '210': 'Concluído',
      '211': 'Errata de Estudo',
      '215': 'Aprovado pelo CQ',
      '220': 'Cancelado',
      '225': 'Enviado sem CQ',
      '230': 'Adiado',
      '240': 'Aguardando Informações',
      '250': 'Concluído - Cliente Não Contratado',
      '260': 'Substituido',
      '270': 'Em Vigor',
      '280': 'Controle de Qualidade',
      '290': 'Reprovado pelo CQ',
      '300': 'Em Uso',
      '310': 'Demada Solicitada',
      '320': 'Vencido',
      '325': 'Contratado',
      '330': 'Em Análise'
    };

    const areaCodeToText = {
      "230": "GGC-Gerência de Grandes Clientes", "921": "Delegação Leste", "922": "Delegação Oeste",
      "923": "GENE - Gerência de Novas Edificações", "924": "GESET - Gerência de Serviços Técnicos Rio",
      "925": "GERAT-Regulação e Aprovisionamento de Tarifas", "926": "GESET-LE - Gerência de Serviços Técnicos LESTE",
      "927": "Delegação Sul Fluminense e Baixada", "928": "Delegação Comercial Lagos e Zona Fluminense",
      "929": "Delegação Centro Sul", "930": "Delegação Norte",
      "931": "Operacional - SPS", "932": "GNF/SPS - Vendas Industriais", "933": "Operações Centrais de Rede",
      "934": "Delegação Norte Fluminense Litorânea", "935": "Delegação Leste Flitorânea",
      "936": "Coordenação de Mercado Termoelétrico", "938": "Delegação Leste Fluminense Serrana",
      "940": "Gerência de Gestão de Ativos", "941": "Grandes Clientes e Soluções Energéticas Sul",
      "942": "ADR-Análise e Dimensionamento de Rede", "943": "CCAU - Centro de Controle e Atendimento a Urgência",
      "944": "GGCSPS - Grandes Clientes", "945": "Soluções de Mobilidade",
      "947": "CCR NovaDutra", "948": "Planificação da Expansão",
      "950": "ST Zona Metropolitana RJ", "952": "CCOR-Centro de Controle e Operação da Rede",
      "953": "Gestão de Energia", "954": "PMI – Planificação da Manutenção e Integridade",
      "955": "BDG - Balanço de Gás", "829": "Gerência Comercial - GNSPS"
    };

    const unitCodeToText = {
      "1": "Capital", "2": "Interior", "3": "SPS"
    };

    // 5. Helper to map database rows to Frontend FormData common structure
    const mapStudyRow = (row, sapToNameMap, statusCodeToText, areaCodeToText, unitCodeToText) => {
      let meta = {};
      try {
        meta = row.meta_data ? JSON.parse(row.meta_data) : {};
      } catch (e) {
        console.error('Error parsing meta_data for row:', row.id, e.message);
      }

      const trimmedStatus = String(row.status || '').trim();
      // Priority: 1) STATUS column from database (most recent), 2) statusCodeToText mapping, 3) meta.status as fallback
      let displayStatus = statusCodeToText[trimmedStatus] || trimmedStatus || meta.status;
      if (!displayStatus || displayStatus === 'undefined') displayStatus = 'Em Análise';

      const sapCode = String(row.respSepla || '').trim();
      // Prioritize respSepla as the ID for assignedTo, and map it to a name
      // Try mapping with padding or without to find the most accurate user name
      let analystName = sapToNameMap[sapCode] || sapToNameMap[sapCode.replace(/^0+/, '')] || sapCode || 'ADRSis - SISTEMA';
      if (sapCode.toUpperCase() === 'ADRSIS' || !sapCode) analystName = 'ADRSis - SISTEMA';

      const numType = parseInt(row.formType) || 0;
      const displayType = (numType > 0 && numType < 100) ? `PE.00492-FO.${String(numType).padStart(2, '0')}` : row.formType;

      const getField = (rowKey, metaKey) => {
        const val = row[rowKey];
        return (val !== null && val !== undefined && val !== '') ? val : meta[metaKey || rowKey];
      };

      const rawArea = getField('requesterArea');
      const displayArea = areaCodeToText[String(rawArea).trim()] || rawArea;

      const rawUnit = row.RESP_UNID || meta.empresa || meta.naturgyUnit || '';
      const displayUnit = unitCodeToText[String(rawUnit).trim()] || rawUnit;

      return {
        ...meta,
        originalInputs: meta,
        id: String(row.id),
        user_id: row.user_id,
        formType: displayType,
        studyNumber: row.studyNumber,
        // The source of truth for the assigned analyst is always RESP_SEPLA from T_ESTPLA (mapped as respSepla)
        assignedTo: sapCode || 'ADRSis - SISTEMA',
        analystName: analystName,
        assignedToName: analystName,
        requesterName: getField('requesterName'),
        requesterArea: displayArea,
        naturgyUnit: displayUnit,
        empresa: displayUnit,
        studyTitle: getField('studyTitle'),
        address: getField('address'),
        city: toTitleCase(getField('city')),
        email: getField('email'),
        phone: getField('phone'),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        requestDate: row.requestDate || meta.requestDate || meta.DAT_IN_SEP,
        estimatedDeliveryDate: row.estimatedDeliveryDate || meta.estimatedDeliveryDate || (row.rawDeliveryDate ? oaDateToISOString(row.rawDeliveryDate) : meta.dtEntregaPrevista) || meta.deliveryDeadline || null,
        previousStudy: getField('previousStudy', 'previousStudy'),

        rejectionReason: getField('MOTIVO_REJEICAO', 'rejectionReason'),
        holdReason: getField('MOTIVO_PAUSA', 'holdReason'),
        holdResponse: getField('RESPOSTA_PAUSA', 'holdResponse'),
        mapLocation: getField('LINK_MAPA', 'mapLocation'),
        fileType: getField('TIPO_ARQUIVO', 'fileType'),
        state: getField('UF', 'state'),
        gasificationType: getField('TIPO_GASIFICACAO', 'gasificationType'),
        clientName: getField('NOME_CLIENTE', 'clientName'),
        deliveryPoint: getField('PONTO_ENTREGA', 'deliveryPoint'),
        consumptionIncrement: getField('INCREMENTO_CONSUMO', 'consumptionIncrement'),
        workDaysPerWeek: getField('DIAS_TRABALHO_SEMANA', 'workDaysPerWeek'),
        totalPredictedFlow: getField('VAZAO_TOTAL_PREVISTA', 'totalPredictedFlow'),
        minPressure: getField('PRESSAO_MINIMA', 'minPressure'),
        sapIsuCode: getField('CODIGO_SAP_ISU', 'sapIsuCode'),
        industryName: getField('NOME_INDUSTRIA', 'industryName'),
        currentConsumption: getField('CONSUMO_ATUAL', 'currentConsumption'),
        contractualPressure: getField('PRESSAO_CONTRATUAL', 'contractualPressure'),
        currentPressureRange: getField('FAIXA_PRESSAO_ATUAL', 'currentPressureRange'),
        uteName: getField('NOME_UTE', 'uteName') || getField('TITULO', 'studyTitle'),

        pressMaxUTE: getField('PRESS_MAX_UTE', 'pressMaxUTE'),
        pressMinUTE: getField('PRESS_MIN_UTE', 'pressMinUTE'),
        pressMaxUPGN: getField('PRESS_MAX_UPGN', 'pressMaxUPGN'),
        pressMinUPGN: getField('PRESS_MIN_UPGN', 'pressMinUPGN'),
        responseMaxPo: getField('RESP_MAX_PO', 'responseMaxPo'),
        responseMin: getField('RESP_MIN', 'responseMin'),
        responseGarantia: getField('RESP_GARANTIA', 'responseGarantia'),
        analystCompany: getField('ANALISTA_EMPRESA', 'analystCompany'),
        analystRole: getField('ANALISTA_CARGO', 'analystRole'),
        analystGB: getField('ANALISTA_GB', 'analystGB'),
        responseMemo: getField('MEMO_RESPOSTA', 'responseMemo'),
        marketCategory: getField('CATEGORIA_MERCADO', 'marketCategory'),
        responseUnit: getField('RESP_UNID', 'responseUnit'),
        instantFlow: getField('VazaoInsta', 'instantFlow'),
        VazaoInsta: getField('VazaoInsta'),
        qdc: getField('QDC', 'qdc'),
        QDC: getField('QDC'),
        workHours: getField('HoraFunciona', 'workHours'),
        HoraFunciona: getField('HoraFunciona'),

        gasPressureLevel: getField('PRESSAO', 'gasPressureLevel'),
        operationStartDate: getField('DATA_SOLIC_OPER', 'operationStartDate'),
        averageFlow: getField('VAZ_MEDIA', 'averageFlow'),
        peakFlow: getField('VAZ_PICO', 'peakFlow'),
        neighborhood: getField('BAIRRO', 'neighborhood'),

        // Study sub-type and letter template mapping
        studySubType: getField('studySubType') || meta.studySubType || '',
        letterTemplate: getField('letterTemplate') || meta.letterTemplate || studySubTypeToLetterTemplate[meta.studySubType] || studySubTypeToLetterTemplate[String(meta.studySubType).trim()] || studySubTypeToLetterTemplate[getField('studySubType')] || 'rlt_carta_sepla_GENERICO'
      };
    };

    // 6. GET All Requests (Hybrid: Requests + T_ESTPLA) - Sequential queries
    app.get('/api/requests', async (req, res) => {
      try {
        const { userId, area, role } = req.query;


        // Resolve area name for fallback query in Requests table
        let areaName = area;
        if (area && !isNaN(parseInt(area))) {
          areaName = areaCodeToText[area] || area;
        }

        // --- Query 1: Active Requests (status is APP text) ---
        const sqlReq1 = new sql.Request();
        let wherePart1 = '';
        if (role === 'Solicitante') {
          sqlReq1.input('uid', sql.VarChar, userId || '');
          sqlReq1.input('areaCode', sql.VarChar, area || '');
          sqlReq1.input('areaName', sql.VarChar, areaName || '');
          wherePart1 = ` WHERE (user_id = @uid OR UPPER(LTRIM(RTRIM(SOL_ORGAO))) = UPPER(@areaCode) OR UPPER(LTRIM(RTRIM(SOL_ORGAO))) = UPPER(@areaName)) `;
        }
        // For ADM and Analyst, no WHERE filter - get all requests
        //console.log('[API] GET /api/requests - role:', role, 'userId:', userId, 'area:', area);
        const resReq = await sqlReq1.query(`
          SELECT 
            id, user_id, formType, meta_data,
            NRO_ESTUDO as studyNumber, STATUS as status, SOL_RESPON as requesterName, SOL_ORGAO as requesterArea,
            TITULO as studyTitle, LOCALIZ as address, Municipio as city, EmailContato as email, TEL_SOL as phone,
            createdAt, updatedAt, ISNULL(requestDate, createdAt) as requestDate,
            dtEntregaPrevista as estimatedDeliveryDate,
            MOTIVO_REJEICAO, MOTIVO_PAUSA, RESPOSTA_PAUSA, LINK_MAPA, TIPO_ARQUIVO, UF, TIPO_GASIFICACAO,
            NOME_CLIENTE, PONTO_ENTREGA, INCREMENTO_CONSUMO, DIAS_TRABALHO_SEMANA, VAZAO_TOTAL_PREVISTA,
            PRESSAO_MINIMA, CODIGO_SAP_ISU, NOME_INDUSTRIA, CONSUMO_ATUAL, PRESSAO_CONTRATUAL, FAIXA_PRESSAO_ATUAL,
            NOME_UTE, PRESS_MAX_UTE, PRESS_MIN_UTE, PRESS_MAX_UPGN, PRESS_MIN_UPGN,
            RESP_SEPLA as respSepla,
            VazaoInsta, QDC, HoraFunciona, CATEGORIA_MERCADO, RESP_UNID,
            NRO_EST_AN as previousStudy,
            NRO_EST_AN as nroEstAn
          FROM Requests
          ${wherePart1}
          ORDER BY createdAt DESC
        `);

        // --- Query 2: Legacy T_ESTPLA (status is numeric code) ---
        const sqlReq2 = new sql.Request();
        let wherePart2 = '';
        if (role === 'Solicitante') {
          sqlReq2.input('uid', sql.VarChar, userId || '');
          sqlReq2.input('areaCode', sql.VarChar, area || '');
          sqlReq2.input('areaName', sql.VarChar, areaName || '');
          wherePart2 = ` WHERE (user_id = @uid OR UPPER(LTRIM(RTRIM(SOL_ORGAO))) = UPPER(@areaCode) OR UPPER(LTRIM(RTRIM(SOL_ORGAO))) = UPPER(@areaName)) `;
        }
        // Pre-fetch users for name mapping
        const sapToNameMap = await getSapToNameMap();

        const resLeg = await sqlReq2.query(`
          SELECT TOP 50000
            CAST(T.id as varchar(100)) as id, T.user_id, T.FK_MODELO as formType, T.meta_data,
            LTRIM(RTRIM(ISNULL(CAST(T.NRO_ESTUDO as varchar(100)), CAST(T.IDSIGEP as varchar(100))))) as studyNumber, 
            CAST(T.STATUS as varchar(50)) as status,
            T.SOL_RESPON as requesterName, LTRIM(RTRIM(CAST(T.SOL_ORGAO as varchar(50)))) as requesterArea,
            T.TITULO as studyTitle, T.LOCALIZ as address, T.Municipio as city, T.EmailContato as email, T.TEL_SOL as phone,
            ISNULL((SELECT TOP 1 createdAt FROM Requests WHERE id = CAST(T.id as varchar(100))), T.DataCriaReg) as createdAt, 
            T.DataCriaReg as updatedAt, LTRIM(RTRIM(CAST(T.RESP_SEPLA as varchar(50)))) as respSepla,
            T.DAT_IN_SEP as requestDate, T.dtEntregaPrevista as rawDeliveryDate,
            NULL as MOTIVO_REJEICAO, NULL as MOTIVO_PAUSA, NULL as RESPOSTA_PAUSA, NULL as LINK_MAPA, NULL as TIPO_ARQUIVO, T.UF, NULL as TIPO_GASIFICACAO,
            T.NOME_CLIENTE, NULL as PONTO_ENTREGA, NULL as INCREMENTO_CONSUMO, NULL as DIAS_TRABALHO_SEMANA, NULL as VAZAO_TOTAL_PREVISTA,
            NULL as PRESSAO_MINIMA, NULL as CODIGO_SAP_ISU, NULL as NOME_INDUSTRIA, NULL as CONSUMO_ATUAL, NULL as PRESSAO_CONTRATUAL, NULL as FAIXA_PRESSAO_ATUAL,
            NULL as NOME_UTE, NULL as PRESS_MAX_UTE, NULL as PRESS_MIN_UTE, NULL as PRESS_MAX_UPGN, NULL as PRESS_MIN_UPGN,
            NULL as RESP_MAX_PO, NULL as RESP_MIN, NULL as RESP_GARANTIA, NULL as ANALISTA_EMPRESA, NULL as ANALISTA_CARGO, NULL as ANALISTA_GB, NULL as MEMO_RESPOSTA,
            T.VazaoInsta, T.QDC, T.HoraFunciona, NULL as CATEGORIA_MERCADO, NULL as RESP_UNID,
            T.NRO_EST_AN as previousStudy,
            T.NRO_EST_AN as nroEstAn
          FROM T_ESTPLA T
          ${wherePart2}
          ORDER BY T.IDSIGEP DESC
        `);

        const combinedMap = new Map();

        // 1. First Pass: Legacy T_ESTPLA (Official studies)
        resLeg.recordset.forEach(row => {
          combinedMap.set(String(row.id), row);
        });

        // 2. Second Pass: Requests Staging (Only if ID not already in map)
        resReq.recordset.forEach(row => {
          const id = String(row.id);
          if (!combinedMap.has(id)) {
            combinedMap.set(id, row);
          }
        });

        const combined = Array.from(combinedMap.values()).map(row =>
          mapStudyRow(row, sapToNameMap, statusCodeToText, areaCodeToText, unitCodeToText)
        );


        // Sort by studyNumber descending (highest to lowest)
        combined.sort((a, b) => {
          const numA = a.studyNumber || '';
          const numB = b.studyNumber || '';
          return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
        });

        res.json(combined);
      } catch (err) {
        console.error('[Server] Fatal Error fetching requests:', err.message);
        res.status(500).json({ error: 'Failed to fetch requests', details: err.message });
      }
    });

    // 7b. GET Full Study Details by Number
    app.get('/api/requests/study/:studyNumber', async (req, res) => {
      try {
        const { studyNumber } = req.params;
        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber);

        // Fetch from both tables (Requests and Legacy T_ESTPLA)
        // Requests uses NRO_ESTUDO (aliased to studyNumber in lists)
        const r1 = await sqlReq.query`
          SELECT *, NRO_ESTUDO as studyNumber 
          FROM Requests 
          WHERE NRO_ESTUDO = @studyNumber
        `;

        // T_ESTPLA uses NRO_ESTUDO or IDSIGEP
        const r2 = await sqlReq.query`
          SELECT *, 
            LTRIM(RTRIM(ISNULL(CAST(NRO_ESTUDO as varchar(100)), CAST(IDSIGEP as varchar(100))))) as studyNumber 
          FROM T_ESTPLA 
          WHERE NRO_ESTUDO = @studyNumber 
             OR CAST(IDSIGEP as varchar(100)) = @studyNumber
             OR NRO_EST_AN = @studyNumber
        `;

        const row = r1.recordset[0] || r2.recordset[0];

        if (!row) {
          return res.status(404).json({ error: 'Study not found' });
        }

        // We need the maps for the helper
        const sapToNameMap = await getSapToNameMap();
        const mapped = mapStudyRow(row, sapToNameMap, statusCodeToText, areaCodeToText, unitCodeToText);

        res.json(mapped);
      } catch (err) {
        console.error('Error fetching full study:', err);
        res.status(500).json({ error: 'Failed' });
      }
    });

    // 8. GET Next Study Number / Duplicate CheckID (matching T_ESTPLA numeric pattern)
    app.get('/api/requests/next-id', async (req, res) => {
      try {
        const r1 = await sql.query`SELECT MAX(CAST(id as int)) as maxId FROM T_ESTPLA WHERE ISNUMERIC(id) = 1`;
        const r2 = await sql.query`SELECT MAX(CAST(id as int)) as maxId FROM Requests WHERE ISNUMERIC(id) = 1`;
        const max1 = r1.recordset[0]?.maxId || 0;
        const max2 = r2.recordset[0]?.maxId || 0;
        const nextId = Math.max(max1, max2) + 1;
        res.json({ nextId: String(nextId) });
      } catch (err) {
        console.error('Error generating next ID:', err.message);
        res.status(500).json({ error: 'Failed to generate ID' });
      }
    });

    // 8b. GET QC History for a Study
    app.get('/api/qc-history/:studyNumber', async (req, res) => {
      console.log('[QCHistory] Received request for studyNumber:', req.params.studyNumber);
      try {
        const { studyNumber } = req.params;
        console.log('[QCHistory] Querying for studyNumber:', studyNumber);
        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber);

        const result = await sqlReq.query`
          SELECT 
            IDCHKLST,
            FK_T_ESTPLA,
            STATUSCHK,
            OPERADOR_VALIDACAO,
            COMENTARIOS,
            DATA_SOLICITACAO,
            DATA_VALIDACAO,
            QT_DEFCTO1, QT_DEFCTO2, QT_DEFCTO3, QT_DEFCTO4, QT_DEFCTO5, QT_DEFCTO6,
            QT_DEFCTO7, QT_DEFCTO8, QT_DEFCTO9, QT_DEFCTO10, QT_DEFCTO11, QT_DEFCTO12,
            QT_DEFCTO13, QT_DEFCTO14, QT_DEFCTO15
          FROM T_CHKLST 
          WHERE FK_T_ESTPLA = @studyNumber
          ORDER BY DATA_VALIDACAO DESC
        `;

        console.log('[QCHistory] Query returned rows:', result.recordset.length);

        const excelToJSDate = (excelDate) => {
          if (!excelDate) return null;
          return new Date((excelDate - 25569) * 86400 * 1000).toISOString();
        };

        const history = result.recordset.map(row => ({
          id: row.IDCHKLST,
          studyNumber: row.FK_T_ESTPLA,
          status: row.STATUSCHK === 200 ? 'Reprovado' : row.STATUSCHK === 300 ? 'Aprovado' : row.STATUSCHK === 400 ? 'Aprovado com Ressalvas' : 'Pendente',
          reviewer: row.OPERADOR_VALIDACAO,
          comments: row.COMENTARIOS,
          requestDate: excelToJSDate(row.DATA_SOLICITACAO),
          validationDate: excelToJSDate(row.DATA_VALIDACAO),
          criticalFailures: {
            1: row.QT_DEFCTO1, 2: row.QT_DEFCTO2, 3: row.QT_DEFCTO3, 4: row.QT_DEFCTO4,
            5: row.QT_DEFCTO5, 6: row.QT_DEFCTO6, 7: row.QT_DEFCTO7, 8: row.QT_DEFCTO8,
            9: row.QT_DEFCTO9, 10: row.QT_DEFCTO10, 11: row.QT_DEFCTO11, 12: row.QT_DEFCTO12
          },
          secondaryFailures: {
            13: row.QT_DEFCTO13, 14: row.QT_DEFCTO14, 15: row.QT_DEFCTO15
          }
        }));

        res.json(history);
      } catch (err) {
        console.error('[QCHistory] Error fetching QC history:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch QC history', details: err.message });
      }
    });

    // 9. POST - Create Audit Log Entry
    app.post('/api/audit', async (req, res) => {
      console.log('[Audit] Received request to create audit log:', req.body);
      try {
        const { studyNumber, actionType, fieldChanged, oldValue, newValue, userId, userName } = req.body;

        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber || null);
        sqlReq.input('actionType', sql.VarChar, actionType);
        sqlReq.input('fieldChanged', sql.VarChar, fieldChanged || null);
        sqlReq.input('oldValue', sql.NVarChar(sql.MAX), oldValue || null);
        sqlReq.input('newValue', sql.NVarChar(sql.MAX), newValue || null);
        sqlReq.input('userId', sql.VarChar, userId || null);
        sqlReq.input('userName', sql.NVarChar(200), userName || null);
        sqlReq.input('timestamp', sql.DateTime, new Date());

        const result = await sqlReq.query`
          INSERT INTO T_AUDIT (StudyNumber, ActionType, FieldChanged, OldValue, NewValue, UserId, UserName, Timestamp)
          VALUES (@studyNumber, @actionType, @fieldChanged, @oldValue, @newValue, @userId, @userName, @timestamp)
        `;

        console.log('[Audit] Audit log created successfully');
        res.json({ success: true, message: 'Audit log created' });
      } catch (err) {
        console.error('[Audit] Error creating audit log:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to create audit log', details: err.message });
      }
    });

    // 9c. GET - Fetch Interconnections (I_ESTPLA)
    app.get('/api/interconnections/:studyNumber', async (req, res) => {
      try {
        const { studyNumber } = req.params;
        console.log('[I_ESTPLA] Fetching connections for study:', studyNumber);

        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber || '');

        const result = await sqlReq.query`
          SELECT OID, IDSIGEP, NRO_ESTUDO, PRESSAO, MATERIAL, DIAMETRO, LOGRADOURO, INDICACAO
          FROM I_ESTPLA 
          WHERE NRO_ESTUDO = @studyNumber OR CAST(IDSIGEP AS VARCHAR) = @studyNumber
          ORDER BY OID
        `;

        console.log('[I_ESTPLA] Found:', result.recordset.length, 'connections');
        res.json({ success: true, data: result.recordset });
      } catch (err) {
        console.error('[I_ESTPLA] Error:', err.message);
        res.status(500).json({ error: 'Erro ao buscar interconexões', details: err.message });
      }
    });

    // 9d. GET - Fetch QC History (T_CHKLST)
    app.get('/api/qc-history/:studyNumber', async (req, res) => {
      try {
        const { studyNumber } = req.params;
        console.log('[T_CHKLST] Fetching QC history for study:', studyNumber);

        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber || '');

        const result = await sqlReq.query`
          SELECT IDCHKLST, FK_T_ESTPLA, STATUSCHK, OPERADOR_VALIDACAO, COMENTARIOS, DataValidacao
          FROM T_CHKLST 
          WHERE FK_T_ESTPLA = @studyNumber
          ORDER BY DataValidacao DESC
        `;

        console.log('[T_CHKLST] Found:', result.recordset.length, 'records');
        res.json({ success: true, data: result.recordset });
      } catch (err) {
        console.error('[T_CHKLST] Error:', err.message);
        res.status(500).json({ error: 'Erro ao buscar histórico de QC', details: err.message });
      }
    });

    // 9b. GET - Fetch Audit Logs
    app.get('/api/audit', async (req, res) => {
      console.log('[Audit] Received request to fetch audit logs', req.query);
      try {
        const { studyNumber, actionType, userId, limit = 100 } = req.query;

        console.log('[Audit] Filters - studyNumber:', studyNumber, 'actionType:', actionType, 'userId:', userId);

        // Join com E_OPEMAN para obter email do usuário
        let query = `
          SELECT TOP(@limit) 
            A.ID, A.StudyNumber, A.ActionType, A.FieldChanged, A.OldValue, A.NewValue,
            A.UserId, A.UserName, A.Timestamp, 
            COALESCE(E.EMAIL, U.EMAIL) as UserEmail
          FROM T_AUDIT A
          LEFT JOIN E_OPEMAN E ON UPPER(LTRIM(RTRIM(A.UserName))) = UPPER(LTRIM(RTRIM(E.NOME)))
          LEFT JOIN Users_Solicitantes U ON A.UserId = U.id
          WHERE 1=1
        `;
        const params = [];

        if (studyNumber) {
          query += ' AND A.StudyNumber = @studyNumber';
          params.push({ name: 'studyNumber', type: sql.VarChar, value: studyNumber });
        }
        if (actionType) {
          query += ' AND A.ActionType = @actionType';
          params.push({ name: 'actionType', type: sql.VarChar, value: actionType });
        }
        if (userId) {
          query += ' AND A.UserId = @userId';
          params.push({ name: 'userId', type: sql.VarChar, value: userId });
        }

        query += ' ORDER BY A.Timestamp DESC';
        params.push({ name: 'limit', type: sql.Int, value: parseInt(limit) });

        const sqlReq = new sql.Request();
        params.forEach(p => sqlReq.input(p.name, p.type, p.value));

        const result = await sqlReq.query(query);

        console.log('[Audit] Query result records:', result.recordset.length);
        console.log('[Audit] Sample records:', result.recordset.slice(0, 3).map(r => ({
          ID: r.ID,
          StudyNumber: r.StudyNumber,
          ActionType: r.ActionType,
          UserName: r.UserName,
          UserEmail: r.UserEmail
        })));

        console.log('[Audit] Fetched audit logs:', result.recordset.length);
        res.json(result.recordset);
      } catch (err) {
        console.error('[Audit] Error fetching audit logs:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
      }
    });

    // 9c. GET - Fetch Audit Log for specific study
    app.get('/api/audit/study/:studyNumber', async (req, res) => {
      console.log('[Audit] Received request for study audit:', req.params.studyNumber);
      try {
        const { studyNumber } = req.params;

        const sqlReq = new sql.Request();
        sqlReq.input('studyNumber', sql.VarChar, studyNumber);

        const result = await sqlReq.query`
          SELECT * FROM T_AUDIT 
          WHERE StudyNumber = @studyNumber
          ORDER BY Timestamp DESC
        `;

        console.log('[Audit] Fetched study audit logs:', result.recordset.length);
        res.json(result.recordset);
      } catch (err) {
        console.error('[Audit] Error fetching study audit logs:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch study audit logs', details: err.message });
      }
    });

    // 6. POST Upsert Request with Move logic + Full T_ESTPLA mapping
    const textToStatusCode = {
      'Pendente': 330,
      'Rascunho': 330,
      'Em Análise': 330,
      'Em Analise': 330,
      'Validado': 200,                // Aberto
      'Aguardando Execução': 200,     // Aberto
      'Aberto': 200,
      'Em Execução': 205,             // Em andamento
      'Aguardando Informações': 240,  // Aguardando Informações
      'Controle de Qualidade': 280,   // Controle de Qualidade
      'Aprovado pelo CQ': 215,        // Aprovado pelo CQ
      'Reprovado pelo CQ': 290,       // Reprovado pelo CQ
      'Enviado sem CQ': 225,          // Enviado sem CQ
      'Concluído': 210,               // Concluído
      'Rejeitado': 220,               // Cancelado
      'Cancelado': 220,               // Cancelado
    };

    const requestLocks = new Set();

    app.post('/api/requests', async (req, res) => {
      console.log(`[Server] 📥 Received POST /api/requests - ID: ${req.body?.id}, Status: ${req.body?.status}, StudyNumber: ${req.body?.studyNumber}`);
      console.log(`[Server] 👤 User fields: userId="${req.body?.userId}", user_id="${req.body?.user_id}", lastModifiedBy="${req.body?.lastModifiedBy}", requesterName="${req.body?.requesterName}", assignedTo="${req.body?.assignedTo}"`);
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Dados ausentes' });
      }

      if (!data.user_id && !data.userId) {
        return res.status(400).json({ error: 'Usuário não identificado' });
      }

      const lockKey = 'global_save_lock';
      while (requestLocks.has(lockKey)) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      requestLocks.add(lockKey);

      try {

        let numericStatus;
        if (data.status && !isNaN(data.status)) {
          numericStatus = parseInt(data.status);
          console.log(`[Server] 🔢 Status is already numeric: ${data.status} -> ${numericStatus}`);
        } else {
          numericStatus = textToStatusCode[data.status] || 330;
          console.log(`[Server] 🔍 textToStatusCode lookup: "${data.status}" -> ${numericStatus}`);
        }

        // --- Status Override for Quality Control (T_CHKLST -> T_ESTPLA Synchronization) ---
        // Rule: Derive technical status from QC results ONLY when the status being sent is a QC result
        // PRIORITY: Check if sending to QC (new request) first, before checking existing QC results

        // Primeiro, verificar se o status sendo enviado é um status de CQ (resultado)
        const isQCResultStatus = ['Controle de Qualidade', 'Aprovado pelo CQ', 'Reprovado pelo CQ', 'Em Execução'].includes(data.status);

        if (data.status === 'Controle de Qualidade') {
          // Se o status sendo enviado é "Controle de Qualidade" (nova revisão), garantir 280
          numericStatus = 280;
        } else if (data.status === 'Em Execução') {
          // Em Execução deve ser 205, não 290 - IGNORAR qcData da revisão anterior
          numericStatus = 205;
        } else if ((data.status === 'Aprovado pelo CQ' || data.status === 'Reprovado pelo CQ') && data.qcData && data.qcData.qcStatusCQ) {
          // Apenas substituir se o status sendo enviado é Aprovado/Reprovado E tem resultado de QC
          const qcResult = data.qcData.qcStatusCQ;
          if (qcResult === 'Reprovado') {
            numericStatus = 290;
          } else if (qcResult === 'Aprovado') {
            numericStatus = 215;
          }
        } else if (data.qcData && data.qcData.qcStatusCQ && !isQCResultStatus) {
          // Se tem qcData mas o status NÃO é um status de CQ, IGNORAR o qcData e usar o status enviado
          // Isso evita que dados de revisões anteriores sobrescrevam o status atual
          // numericStatus já tem o valor correto de textToStatusCode
        }

        // Explicit override for "Em Análise" or "Pendente" to ensure 330
        // Only apply if the status is actually "Em Análise" or "Pendente", not "Aguardando Execução"
        if ((data.status === 'Em Análise' || data.status === 'Em Analise' || data.status === 'Pendente') &&
          !data.status.includes('Aguardando') && !data.status.includes('Exec')) {
          numericStatus = 330;
        }

        // Rule: Move to T_ESTPLA if status is validated (2xx-2xx except 220 rejected) OR if it ALREADY exists there (Sync corrections)
        // Exclude 220 (Rejected/Canceled) from T_ESTPLA
        let shouldMoveToT_ESTPLA = numericStatus >= 200 && numericStatus < 300 && numericStatus !== 220;

        // Check if it already exists in T_ESTPLA to ensure status sync for corrections (Status 330)
        if (!shouldMoveToT_ESTPLA && data.id) {
          try {
            const checkRes = await sql.query`SELECT 1 FROM T_ESTPLA WHERE id = ${String(data.id)}`;
            if (checkRes.recordset.length > 0) {
              console.log(`[StatusSync] 🔄 ID ${data.id} existing in T_ESTPLA. Enabling sync for status ${numericStatus}.`);
              shouldMoveToT_ESTPLA = true;
            }
          } catch (err) {
            console.warn('[StatusSync] Error checking T_ESTPLA existence', err.message);
          }
        }

        console.log(`[StatusSync] 🔄 Incoming: "${data.status}" -> Code: ${numericStatus} | shouldMoveToT_ESTPLA: ${shouldMoveToT_ESTPLA} | ID: ${data.id}`);

        const statusVal = numericStatus;
        const now = new Date();
        // Always use current date for submissions/edits as requested by the user
        const effectiveRequestDate = now;

        // Formatting Helpers
        const toTitleCase = (str) => {
          if (!str) return '';
          return String(str)
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        };

        // Field Mappings for Legacy T_ESTPLA persistence
        const areaMapping = {
          "ADR-Análise e Dimensionamento de Rede": "942",
          "BDG - Balanço de Gás": "955",
          "CCAU - Centro de Controle e Atendimento a Urgência": "943",
          "CCOR-Centro de Controle e Operação da Rede": "952",
          "CCR NovaDutra": "947",
          "Coordenação de Mercado Termoelétrico": "936",
          "Delegação Centro Sul": "929",
          "Delegação Comercial Lagos e Zona Fluminense": "928",
          "Delegação Leste": "921",
          "Delegação Leste Fluminense Litorânea": "935",
          "Delegação Leste Fluminense Serrana": "938",
          "Delegação Norte": "930",
          "Delegação Norte Fluminense Litorânea": "934",
          "Delegação Oeste": "922",
          "Delegação Sul Fluminense e Baixada": "927",
          "GENE - Gerência de Novas Edificações": "923",
          "GERAT-Regulação e Aprovisionamento de Tarifas": "925",
          "Gerência Comercial - GNSPS": "829",
          "Gerência de Gestão de Ativos": "940",
          "GESET - Gerência de Serviços Técnicos Rio": "924",
          "GESET-LE - Gerência de Serviços Técnicos LESTE": "926",
          "Gestão de Energia": "953",
          "GGC-Gerência de Grandes Clientes": "230",
          "GGCSPS - Grandes Clientes": "944",
          "GNF/SPS - Vendas Industriais": "932",
          "Grandes Clientes e Soluções Energéticas Sul": "941",
          "Operacional - SPS": "931",
          "Operacional - SPS": "931",
          "Operações Centrais de Rede": "933",
          "PMI – Planificação da Manutenção e Integridade": "954",
          "Planificação da Expansão": "948",
          "ST Zona Metropolitana RJ": "950",
          "Soluções de Mobilidade": "945"
        };

        const difficultyMapping = {
          "FACIL": 1, "Fácil": 1, "Facil": 1,
          "MEDIO": 2, "Médio": 2, "Medio": 2,
          "DIFICIL": 3, "Difícil": 3, "Dificil": 3
        };

        const studyGroupMapping = {
          "Expansão de Rede": "100", "Expansão": "100",
          "Renovação de Rede": "110", "Renovação": "110",
          "Operação de Rede": "120",
          "Confiabilidade da Rede": "140",
          "Conversão GN": "150",
          "Solicitação Gerencial": "170",
          "Saturação": "180",
          "Modelos de Cálculo": "190",
          "Reforço": "200",
          "Remanejamento": "210",
          "Incremento de Vazão": "220",
          "GNNC": "230",
          "Setorização ERDs": "240",
          "Expansão GNV": "250",
          "Outra": "160"
        };

        const studySubTypeMapping = {
          "Comercial": "300",
          "Residencial": "310",
          "Industrial": "315",
          "Climatização": "320",
          "Termogeração": "325",
          "GNV": "330",
          "MECOM": "335",
          "Gaseificação Total": "340",
          "Gaseificação Parcial": "370",
          "Emergencial": "345",
          "Programado": "350",
          "Simulação": "355",
          "Cogeração": "360",
          "Levantamento de Dados": "380",
          "Consulta Avulsas": "390",
          "Grande Comércio": "400",
          "GNC": "410",
          "Infra-estrutura": "420",
          "Renovação": "430",
          "GNV Frota": "440",
          "Geração": "450",
          "Geração de Emergência": "460",
          "Reforço": "470",
          "Remanejamento": "480",
          "Residencial/Comercial": "490",
          "Industrial/Geração Continua": "491",
          "Geração de Ponta": "492",
          "Geração Contínua": "493"
        };

        const gasTypeMapping = {
          "GN": "GN", "Gás Natural": "GN",
          "GLP": "GP", "GP": "GP",
          "GNL": "GL",
          "GNC": "GC"
        };

        const gniTypeMapping = {
          "Residencial/Comercial - Estudo de Viabilidade Técnica": 1,
          "Winflow": 2, "Actualización Red y consumos": 2,
          "Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica": 3,
          "Planificação de Novos municípios": 4,
          "Planificação Reforços/Religamento MP/BP": 5,
          "Planificação Reforços/Religamento AP": 6,
          "Abastecimento Novos Municípios GNC": 7,
          "Estudos Especiais": 8,
          "Estudos GNNC / Manobras": 9
        };

        const formMapping = {
          'PE.00492-FO.01': 1,
          'PE.00492-FO.02': 2,
          'PE.00492-FO.03': 3,
          'PE.00492-FO.04': 4
        };

        const unitMapping = {
          "CEG": 1, "Capital": 1,
          "CEG RIO": 2, "Interior": 2,
          "SPS": 3, "CEG SPS": 3
        };

        const mappedArea = areaMapping[data.requesterArea] || data.requesterArea || '';
        const mappedForm = formMapping[data.formType] || data.formType || '';
        const mappedCity = data.city ? toTitleCase(data.city).trim() : '';

        // Buscar EMPRESA de G_MUNEST conforme município/cidade escolhido
        let empresaFromMunest = '';
        try {
          if (mappedCity) {
            const munestRes = await sql.query`
              SELECT TOP 1 RTRIM(LTRIM(EMPRESA)) as emp 
              FROM G_MUNEST 
              WHERE NOME = ${mappedCity} OR RTRIM(LTRIM(NOME)) = ${mappedCity}
            `;
            if (munestRes.recordset.length > 0) {
              empresaFromMunest = munestRes.recordset[0].emp || '';
            }
          }
        } catch (munestErr) {
          console.warn('[T_ESTPLA] Error fetching EMPRESA from G_MUNEST:', munestErr.message);
        }

        // Se encontró EMPRESA en G_MUNEST, usar; sino usar mapeamento tradicional
        const mappedUnit = empresaFromMunest
          ? empresaFromMunest
          : (unitMapping[data.empresa || data.naturgyUnit] || data.empresa || data.naturgyUnit || '');

        try {
          // Helper to handle legacy FLOAT dates (OADate format)
          const dateToOADate = (dateObj) => {
            if (!dateObj || isNaN(dateObj.getTime())) return null;
            const epoch = new Date(1899, 11, 30);
            return (dateObj.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24);
          };

          // Robust Numeric Parsing Helpers
          const safeParseFloat = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'number') return val;
            const clean = String(val).replace(',', '.').trim();
            const p = parseFloat(clean);
            return isNaN(p) ? null : p;
          };

          const safeParseInt = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return Math.floor(val);
            const clean = String(val).replace(/[^0-9]/g, '').trim();
            const p = parseInt(clean);
            return isNaN(p) ? 0 : p;
          };

          const safeFloat = safeParseFloat;
          const safeInt = safeParseInt;

          // 1. Resolve Analyst ID (SAP lookup)
          let respSeplaValue = String(data.assignedTo || '');
          if (respSeplaValue) {
            try {
              console.log(`[SAP Lookup] 🔍 Attempting to resolve SAP for: ${respSeplaValue}`);
              const cleanId = respSeplaValue.trim();
              const paddedId = (/^\d+$/.test(cleanId) && cleanId.length < 8) ? cleanId.padStart(8, '0') : cleanId;

              const sapReq = new sql.Request();
              sapReq.input('cleanId', sql.VarChar, cleanId);
              sapReq.input('upperCleanId', sql.VarChar, cleanId.toUpperCase());
              sapReq.input('paddedId', sql.VarChar, paddedId);

              const userSapResult = await sapReq.query(`
            SELECT TOP 1 RTRIM(LTRIM(SAP)) as SAP, NomeCompleto 
            FROM E_OPEMAN 
            WHERE UPPER(LTRIM(RTRIM(Email))) = @upperCleanId
               OR UPPER(LTRIM(RTRIM(NomeCompleto))) = @upperCleanId
               OR UPPER(LTRIM(RTRIM(NOME))) = @upperCleanId
               OR UPPER(LTRIM(RTRIM(USUARIO))) = @upperCleanId
               OR LTRIM(RTRIM(SAP)) = @cleanId
               OR LTRIM(RTRIM(SAP)) = @paddedId
          `);
              if (userSapResult.recordset.length > 0 && userSapResult.recordset[0].SAP) {
                respSeplaValue = userSapResult.recordset[0].SAP;
                console.log(`[SAP Lookup] ✅ Resolved: ${userSapResult.recordset[0].NomeCompleto} (SAP: ${respSeplaValue})`);
              } else {
                console.warn(`[SAP Lookup] ⚠️ Could not resolve SAP for "${respSeplaValue}". Keeping original value.`);
              }
            } catch (sapErr) {
              console.error(`[SAP Lookup] ❌ Error resolving SAP for ${respSeplaValue}:`, sapErr.message);
            }
          }

          // Final safeguard: Never save an email to RESP_SEPLA
          if (respSeplaValue && respSeplaValue.includes('@')) {
            console.warn(`[SAP Lookup] 🛑 Blocking email storage in RESP_SEPLA: "${respSeplaValue}". Defaulting to ADRSIS.`);
            respSeplaValue = 'ADRSIS';
          }

          if (shouldMoveToT_ESTPLA) {
            // Migration to Technical System (T_ESTPLA)
            // ============================================================
            const sqlReq = new sql.Request();
            const requestId = String(data.id);
            const effectiveUserId = data.user_id || data.userId || '';
            const effectiveFormType = String(mappedForm);
            const rawNro = data.studyNumber || data.nro || '';
            let effectiveNro = String(rawNro);
            if (typeof rawNro === 'object' && rawNro !== null) {
              effectiveNro = String(rawNro.nextNumber || rawNro.studyNumber || rawNro.nro || '');
            }
            if (effectiveNro === '[object Object]') effectiveNro = '';

            sqlReq.input('id', sql.VarChar, requestId);
            sqlReq.input('user_id', sql.VarChar, effectiveUserId);
            sqlReq.input('formType', sql.VarChar, String(effectiveFormType));
            sqlReq.input('nro', sql.VarChar, effectiveNro);
            sqlReq.input('status', sql.VarChar, String(statusVal));
            sqlReq.input('meta', sql.NVarChar, JSON.stringify(data));
            sqlReq.input('now', sql.DateTime, now);

            // Technical fields (FO.01 - FO.04 mapping)
            sqlReq.input('emp', sql.VarChar, String(mappedUnit));
            sqlReq.input('org', sql.VarChar, String(mappedArea));
            sqlReq.input('resp', sql.VarChar, data.requesterName || '');
            sqlReq.input('tit', sql.VarChar, data.studyTitle || data.clientName || data.uteName || '');
            sqlReq.input('pres', sql.Float, safeFloat(data.pressure || data.gasPressureLevel || data.suggestedPressureRange));
            sqlReq.input('obs', sql.VarChar, (data.comments || '') + (data.validatorObservations ? `\n--- Validação: ${data.validatorObservations}` : ''));
            sqlReq.input('motivoPausa', sql.VarChar, data.holdReason || '');
            sqlReq.input('bairro', sql.VarChar, data.neighborhood || data.bairro || '');
            sqlReq.input('muni', sql.VarChar, mappedCity);
            sqlReq.input('vazI', sql.Float, safeFloat(data.instantFlow || 0));
            sqlReq.input('cons', sql.Float, safeFloat(data.monthlyConsumption || 0));

            sqlReq.input('pMax', sql.Float, safeFloat(data.presSolMax || data.minPressureMax || 0));
            sqlReq.input('pMin', sql.Float, safeFloat(data.presSolMin || data.minPressure || 0));
            sqlReq.input('hIn', sql.VarChar, String(data.horOpeIni || ''));
            sqlReq.input('hFin', sql.VarChar, String(data.horOpeFin || ''));
            sqlReq.input('dMes', sql.Int, safeInt(data.workDaysPerWeek || 0) * 4);
            sqlReq.input('mail', sql.VarChar, data.email || '');

            sqlReq.input('respSepla', sql.VarChar, respSeplaValue);
            sqlReq.input('lastModifiedBy', sql.VarChar, data.lastModifiedBy || data.userId || '');
            sqlReq.input('localiz', sql.VarChar, (data.address || '') + (data.number ? ' ' + data.number : ''));
            sqlReq.input('tel', sql.VarChar, data.phone || '');
            sqlReq.input('entradaReal', sql.Float, data.validationDate ? dateToOADate(new Date(data.validationDate)) : null);
            sqlReq.input('datEnSep', sql.Float, data.createdAt ? dateToOADate(new Date(data.createdAt)) : dateToOADate(effectiveRequestDate));
            // Use validationDate for DAT_IN_SEP as per user requirement (date moved to 200)
            sqlReq.input('datInSep', sql.Float, data.validationDate ? dateToOADate(new Date(data.validationDate)) : (data.startedAt ? dateToOADate(new Date(data.startedAt)) : null));
            sqlReq.input('datSaSep', sql.Float, data.completedAt ? dateToOADate(new Date(data.completedAt)) : ((String(statusVal) === '210' || String(statusVal) === '215') ? dateToOADate(now) : null));
            // dtEntregaPrevista: data definida no validation panel (estimatedDeliveryDate)
            const entregaStr = data.estimatedDeliveryDate || data.deliveryDeadline || '';
            const entregaDate = parseDateBR(entregaStr);
            sqlReq.input('dtEntregaPrevista', sql.Float, entregaDate ? dateToOADate(entregaDate) : null);
            const numericIDSIGEP = parseInt((data.studyNumber || '').replace(/[^0-9]/g, '')) || 0;
            sqlReq.input('idsigep', sql.BigInt, numericIDSIGEP);

            const isRevision = !!data.previousStudy;
            const cleanNroForAn = (effectiveNro || '').replace('PROV-', '');
            const nroAnValue = isRevision ? data.previousStudy : cleanNroForAn;
            sqlReq.input('nroAn', sql.VarChar, nroAnValue);

            const pressureToNormalize = data.suggestedPressureRange || data.pressure || '';
            const normalizedPressure = pressureToNormalize.substring(0, 2).toUpperCase();

            const studyTypeStr = String(data.studyType || '');
            const studySubTypeStr = String(data.studySubType || '');
            const gniNameStr = String(data.gniName || '');

            sqlReq.input('grupoEst', sql.VarChar, studyGroupToCode[studyTypeStr] || studyGroupToCode[data.studyGroup] || data.studyGroup || '0');
            sqlReq.input('tipoEst', sql.VarChar, studySubTypeToCode[studySubTypeStr] || data.tipoEst || studySubTypeStr || '0');
            sqlReq.input('tipEs', sql.Int, gniTypeToCode[gniNameStr] || gniTypeToCode[studySubTypeStr] || safeInt(data.gniType || '0'));
            sqlReq.input('grauDif', sql.Int, difficultyMapping[data.difficulty] || safeInt(data.difficultyLevel || '0'));
            sqlReq.input('tpgass', sql.VarChar, gasTypeMapping[data.gasType] || data.gasType || '');
            sqlReq.input('presSolOrig', sql.VarChar, normalizedPressure);
            sqlReq.input('croqui', sql.VarChar, data.mapReceived ? 'VERDADEIRO' : 'FALSO');
            sqlReq.input('estudoRelev', sql.VarChar, data.relevantStudy ? 'VERDADEIRO' : 'FALSO');
            sqlReq.input('dataOper', sql.DateTime, data.operationStartDate ? new Date(data.operationStartDate) : null);
            sqlReq.input('vazMedia', sql.Float, safeFloat(data.averageFlow || 0));
            sqlReq.input('vazPico', sql.Float, safeFloat(data.peakFlow || 0));

            // Technical mappings updated per user specification
            sqlReq.input('presGas', sql.VarChar, data.responsePressureBase || '');
            sqlReq.input('presClieMax', sql.Float, safeFloat(data.responseMaxPo || data.responseMaxPressure || 0));
            sqlReq.input('presClieMin', sql.Float, safeFloat(data.responseMin || data.responseMinPressure || 0));
            sqlReq.input('presClieGarant', sql.Float, safeFloat(data.responseGarantia || data.responseGarantiaPressure || 0));
            sqlReq.input('observaResp', sql.NVarChar, data.responseObservations || '');

            const isFO04 = String(effectiveFormType).includes('FO.04');
            const isFO02 = String(effectiveFormType).includes('FO.02');

            if (isFO04) {
              sqlReq.input('vazS', sql.Float, 0);
              sqlReq.input('numE', sql.Int, 0);
              sqlReq.input('numE2', sql.Int, 1);
              sqlReq.input('vazS2', sql.Float, safeFloat(data.averageFlow || 0));
              sqlReq.input('vu', sql.Float, 0);
              sqlReq.input('fp', sql.Float, 0);
              sqlReq.input('fd', sql.Float, 0);
              sqlReq.input('diversificar', sql.Float, 0);
            } else if (isFO02 && data.gridDataFO02) {
              let sumResNum = 0, sumResFlow = 0, sumComNum = 0, sumComFlow = 0;
              Object.entries(data.gridDataFO02).forEach(([key, row]) => {
                const isRes = key.toLowerCase().includes('residencial');
                const rowTotal = safeInt(row.atuais) + safeInt(row.y2) + safeInt(row.y5) + safeInt(row.y20);
                if (isRes) {
                  sumResNum += rowTotal;
                  sumResFlow += safeFloat(row.totalQ);
                } else {
                  sumComNum += rowTotal;
                  sumComFlow += safeFloat(row.totalQ);
                }
              });
              sqlReq.input('vazS', sql.Float, sumResFlow);
              sqlReq.input('numE', sql.Int, sumResNum);
              sqlReq.input('numE2', sql.Int, sumComNum);
              sqlReq.input('vazS2', sql.Float, sumComFlow);
              sqlReq.input('vu', sql.Float, safeFloat(data.unitFlow || 0));
              sqlReq.input('fp', sql.Float, safeFloat(data.penetrationFactor || data.penetration || 0));
              sqlReq.input('fd', sql.Float, safeFloat(data.diversificationFactor || data.diversification || 0));
              sqlReq.input('diversificar', sql.Float, sumResFlow);
            } else {
              sqlReq.input('vazS', sql.Float, safeFloat(data.totalFlowRes || 0));
              sqlReq.input('numE', sql.Int, safeInt(data.totalClients || data.numClientsRes || 0));
              sqlReq.input('numE2', sql.Int, safeInt(data.numClientsCom || 0));
              sqlReq.input('vazS2', sql.Float, safeFloat(data.totalFlowCom || 0));
              sqlReq.input('vu', sql.Float, safeFloat(data.unitFlow || 0));
              sqlReq.input('fp', sql.Float, safeFloat(data.penetrationFactor || data.penetration || 0));
              sqlReq.input('fd', sql.Float, safeFloat(data.diversificationFactor || data.diversification || 0));
              sqlReq.input('diversificar', sql.Float, safeFloat(data.diversifiedFlow || data.totalFlowRes || 0));
            }

            // Detailed technical response parameters
            sqlReq.input('statusEntrega', sql.VarChar, data.deliveryStatus || '');
            sqlReq.input('regulardoSN', sql.VarChar, data.regSizingActive ? 'VERDADEIRO' : 'FALSO');
            sqlReq.input('reguladroVazao', sql.Int, safeInt(data.regSizingFlow || 0));
            sqlReq.input('horaFunciona', sql.Int, safeInt(data.workHours || 0));

            // Additional sizing info
            sqlReq.input('pressaoResposta', sql.VarChar, data.responsePressureBase || '');
            sqlReq.input('custoRegulador', sql.Int, safeInt(data.regSizingCost || 0));
            sqlReq.input('pressaoEntrada', sql.VarChar, String(data.regSizingInPress || ''));
            sqlReq.input('unidPresEnt', sql.VarChar, data.unidPresEnt || 'bar');
            sqlReq.input('pressaoSaida', sql.Int, safeInt(data.regSizingOutPress || 0));
            sqlReq.input('unidPresSai', sql.VarChar, data.unidPresSai || 'mbar');
            sqlReq.input('vazaoFutura', sql.Int, safeInt(data.regSizingFutureFlow || 0));
            sqlReq.input('presSol', sql.VarChar, data.suggestedPressureRange || data.pressureUnit || '');
            sqlReq.input('unidSol', sql.VarChar, data.flowUnit || 'm³/h');
            sqlReq.input('qdc', sql.Int, safeInt(data.qdc || 0));
            sqlReq.input('emailEnviado', sql.VarChar, data.emailSent ? 'VERDADEIRO' : 'FALSO');

            // Memo fields
            sqlReq.input('memoResposta', sql.NVarChar, data.responseMemo || '');
            // User requested to leave calculated pressure in meta_data, so we stop mapping it to PRESCALC column
            sqlReq.input('prescalc', sql.NVarChar, null);
            sqlReq.input('grupored', sql.Int, safeInt(data.networkGroup || '0'));
            sqlReq.input('prazEstConst', sql.VarChar, String(data.prazEstConst || ''));
            sqlReq.input('consumoEstimado', sql.Int, safeInt(data.consumoEstimado || 0));
            sqlReq.input('pressaoInicial', sql.Float, safeFloat(data.pressaoInicial || 0));
            sqlReq.input('pressaoFinal', sql.Int, safeInt(data.pressaoFinal || 0));
            sqlReq.input('pressaoAbsoluta', sql.Float, safeFloat(data.pressaoAbsoluta || 0));
            sqlReq.input('pressaoAtm', sql.Int, safeInt(data.pressaoAtm || 0));
            sqlReq.input('codigoPasta', sql.VarChar, String(data.codigoPasta || ''));

            sqlReq.input('simulacao', sql.Float, safeFloat(data.simulacao || 0));
            sqlReq.input('supervision', sql.Float, safeFloat(data.supervision || 0));
            sqlReq.input('tempo', sql.Float, safeFloat(data.tempo || 0));
            sqlReq.input('tempoEstimado', sql.Float, safeFloat(data.tempoEstimado || 0));
            sqlReq.input('preparacion', sql.Float, safeFloat(data.preparacion || 0));

            // Network extensions
            sqlReq.input('redeExtTotal', sql.Int, safeInt(data.totalNetworkExtension || 0));

            // UPSERT Query with correct ID handling (Direct string comparison)
            console.log(`[T_ESTPLA] 🔧 Executing UPSERT for ID=${requestId}, STATUS=${statusVal}`);
            try {
              await sqlReq.query(`
            IF EXISTS (SELECT 1 FROM T_ESTPLA WHERE id = @id)
            BEGIN
              UPDATE T_ESTPLA SET
                EMPRESA = @emp, SOL_ORGAO = @org, DAT_EN_SEP = @datEnSep, DAT_IN_SEP = @datInSep, DAT_SA_SEP = @datSaSep, SOL_RESPON = @resp,
                RESP_SEPLA = @respSepla, OPERADOR_M = @respSepla, FK_MODELO = @formType,
                STATUS = @status, meta_data = @meta, TITULO = @tit, NOME_CLIENTE = @tit,
                ObsEstudSol = @obs, Bairro = @bairro, OBSERVS = @obs,
                Municipio = @muni, NumEconomias = @numE, VazaoSol = @vazS,
                VazaoInsta = @vazI, ConsMens = @cons, PresSolMax = @pMax,
                PresSolMin = @pMin, HorOpeIni = @hIn, HorOpeFin = @hFin,
                DiaOpeMes = @dMes, EmailContato = @mail, NumEconomiasComIndEtc = @numE2,
                VazaoSolComIndEtc = @vazS2, LOCALIZ = @localiz, TEL_SOL = @tel,
                EntradaReal = @entradaReal, IDSIGEP = @idsigep, NRO_EST_AN = @nroAn,
                NRO_ESTUDO = @nro, GRUPO_EST = @grupoEst, TIPO_EST = @tipoEst, TIP_ES = @tipEs,
                GrauDificult = @grauDif, TPGASS = @tpgass, 
                CROQUI = @croqui, ESTUDO_RELEV = @estudoRelev, EstudoRelevante = @estudoRelev, DATA_SOLIC_OPER = @dataOper,
                VAZ_MEDIA = @vazMedia, VAZ_PICO = @vazPico, PRESGAS = @presGas,
                PresClieMax = @presClieMax, PresClieMin = @presClieMin,
                PresClieGarant = @presClieGarant, ObservaResp = @observaResp,
                vu = @vu, fp = @fp, fd = @fd, Diversificar = @diversificar,
                StatusEntrega = @statusEntrega, RegulardoSN = @regulardoSN,
                ReguladroVazao = @reguladroVazao, HoraFunciona = @horaFunciona,
                PressaoResposta = @pressaoResposta, CustoRegulador = @custoRegulador,
                PressaoEntrada = @pressaoEntrada, unidPresEnt = @unidPresEnt,
                PressaoSaida = @pressaoSaida, unidPresSai = @unidPresSai,
                VazaoFutura = @vazaoFutura, PRESSAO = @presSol, UnidSol = @unidSol,
                QDC = @qdc, EMAIL_ENVIADO = @emailEnviado, MEMO_RESPOSTA = @memoResposta,
                PRESCALC = @prescalc, GRUPORED = @grupored, PRAZ_EST_CONST = @prazEstConst,
                CONSUMO_ESTIMADO = @consumoEstimado, PRESSAO_INICIAL = @pressaoInicial,
                PRESSAO_FINAL = @pressaoFinal, PRESSAO_ABSOLUTA = @pressaoAbsoluta,
                PRESSAO_ATM = @pressaoAtm, CODIGO_PASTA = @codigoPasta, Simulacao = @simulacao,
                Supervision = @supervision, Tempo = @tempo, TempoEstimado = @tempoEstimado,
                Preparacion = @preparacion, RedeExtTotal = @redeExtTotal,
                dtEntregaPrevista = @dtEntregaPrevista, MOTIVO_PAUSA = @motivoPausa
              WHERE id = @id
            END
            ELSE
            BEGIN
              INSERT INTO T_ESTPLA (
                id, EMPRESA, SOL_ORGAO, DAT_EN_SEP, DAT_IN_SEP, DAT_SA_SEP, SOL_RESPON, RESP_SEPLA, OPERADOR_M, FK_MODELO, STATUS, meta_data,
                TITULO, NOME_CLIENTE, LOCALIZ, Bairro, Municipio,
                NumEconomias, VazaoSol, VazaoInsta, ConsMens, PresSolMax, PresSolMin,
                HorOpeIni, HorOpeFin, DiaOpeMes, EmailContato, NumEconomiasComIndEtc,
                VazaoSolComIndEtc, TEL_SOL, EntradaReal, IDSIGEP, NRO_EST_AN, NRO_ESTUDO,
                GRUPO_EST, TIPO_EST, TIP_ES, GrauDificult, TPGASS, CROQUI, ESTUDO_RELEV, EstudoRelevante,
                DATA_SOLIC_OPER, VAZ_MEDIA, VAZ_PICO, PRESGAS, PresClieMax, PresClieMin,
                PresClieGarant, ObservaResp, vu, fp, fd, Diversificar, StatusEntrega,
                RegulardoSN, ReguladroVazao, HoraFunciona, PressaoResposta, CustoRegulador,
                PressaoEntrada, unidPresEnt, PressaoSaida, unidPresSai, VazaoFutura,
                PRESSAO, UnidSol, QDC, EMAIL_ENVIADO, MEMO_RESPOSTA, OBSERVS, PRESCALC, GRUPORED,
                PRAZ_EST_CONST, CONSUMO_ESTIMADO, PRESSAO_INICIAL, PRESSAO_FINAL,
                PRESSAO_ABSOLUTA, PRESSAO_ATM, CODIGO_PASTA, Simulacao, Supervision,
                Tempo, TempoEstimado, Preparacion, RedeExtTotal, dtEntregaPrevista, MOTIVO_PAUSA
              ) VALUES (
                @id, @emp, @org, @datEnSep, @datInSep, @datSaSep, @resp, @respSepla, @respSepla, @formType, @status, @meta,
                @tit, @tit, @localiz, @bairro, @muni, @numE, @vazS, @vazI, @cons,
                @pMax, @pMin, @hIn, @hFin, @dMes, @mail, @numE2, @vazS2, @tel, @entradaReal,
                @idsigep, @nroAn, @nro, @grupoEst, @tipoEst, @tipEs, @grauDif, @tpgass,
                @croqui, @estudoRelev, @estudoRelev, @dataOper, @vazMedia, @vazPico, @presGas, @presClieMax,
                @presClieMin, @presClieGarant, @observaResp, @vu, @fp, @fd, @diversificar,
                @statusEntrega, @regulardoSN, @reguladroVazao, @horaFunciona, @pressaoResposta,
                @custoRegulador, @pressaoEntrada, @unidPresEnt, @pressaoSaida, @unidPresSai,
                @vazaoFutura, @presSol, @unidSol, @qdc, @emailEnviado, @memoResposta, @obs,
                @prescalc, @grupored, @prazEstConst, @consumoEstimado, @pressaoInicial,
                @pressaoFinal, @pressaoAbsoluta, @pressaoAtm, @codigoPasta, @simulacao,
                @supervision, @tempo, @tempoEstimado, @preparacion, @redeExtTotal, @dtEntregaPrevista, @motivoPausa
              )
            END
          `);
              console.log(`[T_ESTPLA] ✅ UPSERT completed for ID=${requestId}, STATUS=${statusVal}`);

              // --- QC Persistence (T_CHKLST) ---
              // SÓ criar registro em T_CHKLST quando o QCControlModal é preenchido no frontend
              // e enviado para o backend com a flag fromQCModal=true
              // NÃO criar quando apenas verifica status 215/290 no banco
              console.log(`[QC] 🔍 Checking QC conditions - numericStatus: ${numericStatus}, qcData: ${!!data.qcData}, fromQCModal: ${data.qcData?.fromQCModal}`);

              const numericStatusNum = Number(numericStatus);
              const isQCApprovalResult = (numericStatusNum === 215 || numericStatusNum === 290);

              // Verificar se veio do QC Modal (suporta múltiplas formas de detecção)
              const qcDataObj = data.qcData;
              const isFromQCModal = qcDataObj && (
                qcDataObj.fromQCModal === true ||
                qcDataObj.fromQCModal === 'true' ||
                qcDataObj.qcStatusCQ === 'Aprovado' ||
                qcDataObj.qcStatusCQ === 'Reprovado'
              );

              console.log(`[QC] 🔍 isQCApprovalResult: ${isQCApprovalResult}, isFromQCModal: ${isFromQCModal}, qcStatus: ${qcDataObj?.qcStatusCQ}`);

              // Só cria T_CHKLST se Vier do Modal de CQ (ação explícita do usuário)
              if (isQCApprovalResult && isFromQCModal) {
                try {
                  // Definir effectiveNro para o registro
                  const rawNroQC = data.studyNumber || data.nro || '';
                  let effectiveNroQC = String(rawNroQC);
                  if (typeof rawNroQC === 'object' && rawNroQC !== null) {
                    effectiveNroQC = String(rawNroQC.nextNumber || rawNroQC.studyNumber || rawNroQC.nro || '');
                  }
                  if (effectiveNroQC === '[object Object]') effectiveNroQC = '';

                  console.log(`[QC] 🔍 Processing QC approval/rejection for Study: ${effectiveNroQC || requestId}`);

                  // 1. Resolve Status Code (User's dynamic workflow)
                  // Mapping: T_CHKLST 200 (Fail), 300 (Pass), 400 (Pass w/ Res)
                  let chklstStatus = 300; // Default: Aprovado
                  const qcResult = data.qcData?.qcStatusCQ;
                  const hasFailures = (Object.values(data.qcData?.qcCriticalFailures || {}).some(v => Number(v) > 0)) ||
                    (Object.values(data.qcData?.qcSecondaryFailures || {}).some(v => Number(v) > 0));

                  if (qcResult === 'Reprovado') {
                    chklstStatus = 200;
                  } else if (qcResult === 'Aprovado') {
                    chklstStatus = hasFailures ? 400 : 300;
                    if (data.qcData?.qcFinalStatus) {
                      chklstStatus = parseInt(data.qcData.qcFinalStatus);
                    }
                  }

                  // 2. Resolve Operator SAP (Reviewer)
                  let operatorSap = data.qcData?.qcSupervisor || data.assignedTo || '';
                  if (operatorSap) {
                    const opResult = await sql.query`
                  SELECT TOP 1 RTRIM(LTRIM(SAP)) as SAP 
                  FROM E_OPEMAN 
                  WHERE email = ${operatorSap.trim()} 
                     OR NomeCompleto = ${operatorSap.trim()}
                     OR NOME = ${operatorSap.trim()}
                `;
                    if (opResult.recordset.length > 0) {
                      operatorSap = opResult.recordset[0].SAP;
                    }
                  }

                  // 3. Get Next IDCHKLST
                  const idResult = await sql.query`SELECT ISNULL(MAX(IDCHKLST), 0) + 1 as nextId FROM T_CHKLST`;
                  const nextId = idResult.recordset[0].nextId;

                  // 4. Build Insert Query
                  const qcSql = new sql.Request();
                  qcSql.input('id', sql.Int, nextId);
                  qcSql.input('fkEst', sql.VarChar, effectiveNroQC || requestId);
                  qcSql.input('status', sql.Int, chklstStatus);
                  qcSql.input('operador', sql.VarChar, operatorSap);
                  qcSql.input('comments', sql.NVarChar, data.qcData?.qcComments || '');
                  qcSql.input('solDate', sql.Float, data.qcData?.qcRequestDate ? dateToOADate(new Date(data.qcData.qcRequestDate)) : null);
                  qcSql.input('valDate', sql.Float, dateToOADate(new Date()));

                  // Map Defect Counts (1-15)
                  for (let i = 1; i <= 15; i++) {
                    const count = (i <= 12)
                      ? (Number(data.qcData?.qcCriticalFailures?.[String(i)]) || 0)
                      : (Number(data.qcData?.qcSecondaryFailures?.[String(i)]) || 0);
                    qcSql.input(`q${i}`, sql.Int, count);
                    qcSql.input(`c${i}`, sql.Int, i);
                  }

                  await qcSql.query(`
                INSERT INTO T_CHKLST (
                  IDCHKLST, FK_T_ESTPLA, STATUSCHK, OPERADOR_VALIDACAO, COMENTARIOS,
                  DATA_SOLICITACAO, DATA_VALIDACAO,
                  QT_DEFCTO1, CODIGO1, QT_DEFCTO2, CODIGO2, QT_DEFCTO3, CODIGO3,
                  QT_DEFCTO4, CODIGO4, QT_DEFCTO5, CODIGO5, QT_DEFCTO6, CODIGO6,
                  QT_DEFCTO7, CODIGO7, QT_DEFCTO8, CODIGO8, QT_DEFCTO9, CODIGO9,
                  QT_DEFCTO10, CODIGO10, QT_DEFCTO11, CODIGO11, QT_DEFCTO12, CODIGO12,
                  QT_DEFCTO13, CODIGO13, QT_DEFCTO14, CODIGO14, QT_DEFCTO15, CODIGO15
                ) VALUES (
                  @id, @fkEst, @status, @operador, @comments,
                  @solDate, @valDate,
                  @q1, @c1, @q2, @c2, @q3, @c3, @q4, @c4, @q5, @c5, @q6, @c6,
                  @q7, @c7, @q8, @c8, @q9, @c9, @q10, @c10, @q11, @c11, @q12, @c12,
                  @q13, @c13, @q14, @c14, @q15, @c15
                )
              `);
                  console.log(`[QC] ✅ Record created in T_CHKLST: ID ${nextId}, Status ${chklstStatus}`);
                } catch (qcErr) {
                  console.error(`[QC] ❌ Error persisting to T_CHKLST:`, qcErr.message);
                }
              }

              // Sync Child Tables (I_ESTPLA and G_PRTRER)
              if (numericIDSIGEP) {
                console.log(`[StatusSync] 🔄 Syncing child tables for IDSIGEP: ${numericIDSIGEP}`);
                // 1. Sync I_ESTPLA (Interconnections)
                await sql.query`DELETE FROM I_ESTPLA WHERE IDSIGEP = ${numericIDSIGEP}`;
                const interconnections = data.interconnectionPoints || [];

                if (interconnections.length > 0) {
                  const maxOidRes = await sql.query`SELECT ISNULL(MAX(OID), 0) as maxOid FROM I_ESTPLA`;
                  let nextOid = (maxOidRes.recordset[0].maxOid || 0) + 1;

                  for (const point of interconnections) {
                    const ptSql = new sql.Request();
                    ptSql.input('oid', sql.Int, nextOid++);
                    ptSql.input('idsigep', sql.Int, numericIDSIGEP);
                    ptSql.input('nro', sql.Int, numericIDSIGEP);
                    ptSql.input('pres', sql.VarChar, point.pressure || '');
                    ptSql.input('mat', sql.VarChar, point.material || '');
                    ptSql.input('dia', sql.VarChar, point.diameter || '');
                    ptSql.input('logradouro', sql.VarChar, point.location || point.address || '');
                    ptSql.input('indicacao', sql.VarChar, point.comment || '');
                    await ptSql.query(`
                  INSERT INTO I_ESTPLA (OID, IDSIGEP, NRO_ESTUDO, PRESSAO, MATERIAL, DIAMETRO, LOGRADOURO, INDICACAO)
                  VALUES (@oid, @idsigep, @nro, @pres, @mat, @dia, @logradouro, @indicacao)
                `);
                  }
                }

                // 2. Sync G_PRTRER (Planned Extensions)
                await sql.query`DELETE FROM G_PRTRER WHERE IDSIGEP = ${numericIDSIGEP}`;
                const extensions = data.plannedExtensions || [];

                if (extensions.length > 0) {
                  const maxObjRes = await sql.query`SELECT ISNULL(MAX(OBJECTID), 0) as maxObj FROM G_PRTRER`;
                  let nextObj = (maxObjRes.recordset[0].maxObj || 0) + 1;

                  const extensionTypeMap = { 'DESCONHECIDO': 1, 'REDE EXTERNA': 2, 'REDE INTERNA': 3, 'RAMAL': 4 };
                  const extensionStatusMap = { 'EM SERVIÇO': 2, 'ESTUDO (ABANDONAR)': 9, 'ESTUDO (CONSTRUIR)': 5, 'ENERGIZADO': 8 };

                  for (const ext of extensions) {
                    const extSql = new sql.Request();
                    extSql.input('object', sql.Int, nextObj++);
                    extSql.input('idsigep', sql.Int, numericIDSIGEP);
                    extSql.input('nro', sql.Int, numericIDSIGEP);
                    extSql.input('mat', sql.VarChar, ext.material || '');
                    const numDiameter = parseInt(String(ext.diameter).replace(/[^0-9]/g, '')) || 0;
                    extSql.input('dia', sql.Int, numDiameter);
                    extSql.input('extensao', sql.Int, safeInt(ext.extension || 0));
                    extSql.input('tipred', sql.Int, extensionTypeMap[(ext.networkType || ext.type)?.toUpperCase()] || 1);
                    extSql.input('valvulas', sql.Int, safeInt(ext.valves || 0));
                    extSql.input('pres', sql.VarChar, ext.pressure || '');
                    extSql.input('gas', sql.VarChar, ext.gasType || 'GN');
                    extSql.input('status', sql.Int, extensionStatusMap[String(ext.status).toUpperCase()] || 5);

                    await extSql.query(`
                  INSERT INTO G_PRTRER (OBJECTID, IDSIGEP, NRO_ESTUDO, MATERIAL, DIAMETRO, Extensao, TIPRED, QT_VALVULAS, Pressao, TipGas, status)
                  VALUES (@object, @idsigep, @nro, @mat, @dia, @extensao, @tipred, @valvulas, @pres, @gas, @status)
                `);
                  }
                }
                console.log(`[StatusSync] 🚀 Record ${requestId} synced in T_ESTPLA: ${interconnections.length} pts, ${extensions.length} exts`);
              }
            } catch (dbErr) {
              console.error(`[StatusSync] ❌ Error saving to T_ESTPLA (ID: ${requestId}):`, dbErr.message);
              throw dbErr;
            }
          }

          // REGARDLESS of T_ESTPLA move, always update/insert the Requests table
          // This ensures the status is identical in both locations and prevents UI sync issues.
          const sqlReq = new sql.Request();
          const requestId = String(data.id);
          const effectiveUserId = data.user_id || data.userId || '';
          const rawNro = data.studyNumber || data.nro || '';
          let effectiveNro = String(rawNro);
          if (typeof rawNro === 'object' && rawNro !== null) {
            effectiveNro = String(rawNro.nextNumber || rawNro.studyNumber || rawNro.nro || '');
          }
          if (effectiveNro === '[object Object]') effectiveNro = '';

          // *** AUDIT: Capture previous record BEFORE the update overwrites it ***
          let previousRecord = null;
          try {
            const prevRes = await sql.query`SELECT STATUS, RESP_SEPLA, requestDate, IDSIGEP, NRO_ESTUDO FROM Requests WHERE id = ${String(requestId)}`;
            if (prevRes.recordset.length > 0) {
              previousRecord = prevRes.recordset[0];
              console.log(`[Audit] 📋 Previous record captured: Status=${previousRecord.STATUS}, Resp=${previousRecord.RESP_SEPLA}, SIGEP=${previousRecord.IDSIGEP}`);
            }
          } catch (e) {
            console.warn('[Audit] Could not fetch previous record:', e.message);
          }

          sqlReq.input('id', sql.VarChar, requestId);
          sqlReq.input('user_id', sql.VarChar, effectiveUserId);
          sqlReq.input('formType', sql.VarChar, String(mappedForm));
          sqlReq.input('nro', sql.VarChar, effectiveNro);
          sqlReq.input('status', sql.VarChar, String(statusVal));
          sqlReq.input('meta', sql.NVarChar, JSON.stringify(data));
          sqlReq.input('now', sql.DateTime, now);
          sqlReq.input('datEnSep', sql.DateTime, effectiveRequestDate);

          // Additional columns for Requests (mirroring T_ESTPLA)
          sqlReq.input('emp', sql.VarChar, String(mappedUnit));
          sqlReq.input('org', sql.VarChar, String(mappedArea));
          sqlReq.input('resp', sql.VarChar, data.requesterName || '');
          sqlReq.input('tit', sql.VarChar, data.studyTitle || data.clientName || data.uteName || '');
          sqlReq.input('bairro', sql.VarChar, data.neighborhood || data.bairro || '');
          sqlReq.input('muni', sql.VarChar, mappedCity);
          sqlReq.input('localiz', sql.VarChar, (data.address || '') + (data.number ? ' ' + data.number : ''));
          sqlReq.input('natUnit', sql.VarChar, data.naturgyUnit || '');
          sqlReq.input('respSepla', sql.VarChar, respSeplaValue || '');
          sqlReq.input('lastModifiedBy', sql.VarChar, data.lastModifiedBy || data.userId || '');
          sqlReq.input('userId', sql.VarChar, data.userId || data.user_id || '');
          sqlReq.input('idsigep', sql.BigInt, data.idsigep || data.sigep || (previousRecord ? previousRecord.IDSIGEP : null));
          const isRevision = !!data.previousStudy;
          const cleanNroForAnReq = (effectiveNro || '').replace('PROV-', '');
          const nroAnValueReq = isRevision ? data.previousStudy : cleanNroForAnReq;
          sqlReq.input('nroAn', sql.VarChar, nroAnValueReq);

          await sqlReq.query(`
          IF EXISTS (SELECT 1 FROM Requests WHERE id = @id)
          BEGIN
            UPDATE Requests SET
              user_id = @user_id, userId = @userId, formType = @formType, NRO_ESTUDO = @nro, STATUS = @status,
              meta_data = @meta, updatedAt = @now, requestDate = @datEnSep,
              EMPRESA = @emp, SOL_ORGAO = @org, SOL_RESPON = @resp, TITULO = @tit, 
              BAIRRO = @bairro, MUNICIPIO = @muni, LOCALIZ = @localiz,
              naturgyUnit = @natUnit, RESP_SEPLA = @respSepla,
              lastModifiedBy = @lastModifiedBy, IDSIGEP = @idsigep,
              NRO_EST_AN = @nroAn
            WHERE id = @id
          END
          ELSE
          BEGIN
            INSERT INTO Requests (
              id, user_id, userId, formType, NRO_ESTUDO, STATUS,
              meta_data, createdAt, updatedAt, requestDate,
              EMPRESA, SOL_ORGAO, SOL_RESPON, TITULO, BAIRRO, MUNICIPIO, LOCALIZ, 
              naturgyUnit, RESP_SEPLA, lastModifiedBy, IDSIGEP, NRO_EST_AN
            )
            VALUES (
              @id, @user_id, @userId, @formType, @nro, @status,
              @meta, @now, @now, @datEnSep,
              @emp, @org, @resp, @tit, @bairro, @muni, @localiz, 
              @natUnit, @respSepla, @lastModifiedBy, @idsigep, @nroAn
            )
          END
        `);

          console.log(`[StatusSync] ✅ Record ${requestId} synchronized in Requests with STATUS=${statusVal}`);

          // *** AUDIT: Detect and log changes ***
          const isNewStudy = !data.studyNumber || data.studyNumber === '';
          const changes = [];
          if (isNewStudy && !previousRecord) {
            if (data.previousStudy) {
              changes.push({ field: 'revisão', old: data.previousStudy, new: effectiveNro, type: 'REVISION_REQUEST' });
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'STATUS_CHANGE' });
            } else {
              changes.push({ field: 'status', old: null, new: data.status || statusVal, type: 'CREATE' });
            }
          } else if (previousRecord) {
            // 1. Status Change
            const oldS = String(previousRecord.STATUS || '');
            const newS = String(statusVal || '');

            // Normalize: treat 100 and 330 as equivalent (both mean 'Em Análise')
            const normalizedOld = (oldS === '100' ? '330' : oldS);
            const normalizedNew = (newS === '100' ? '330' : newS);

            if (normalizedOld !== normalizedNew) {
              changes.push({ field: 'status', old: oldS, new: newS, type: 'STATUS_CHANGE' });

              // *** I_INTREC Sync: Detect status transitions 200 -> 205 and 210 ***
              if (oldS === '200' && newS === '205') {
                try {
                  const intRecReq = new sql.Request();
                  intRecReq.input('studyNro', sql.VarChar, effectiveNro);
                  const nowFloat = new Date().getTime() / (1000 * 60 * 60 * 24);
                  intRecReq.input('dataIni', sql.Float, nowFloat);
                  const checkIntRec = await intRecReq.query`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = @studyNro`;
                  if (checkIntRec.recordset.length === 0) {
                    await intRecReq.query`
                      DECLARE @NewObjectID int = ISNULL((SELECT MAX(OBJECTID) FROM I_INTREC), 0) + 1;
                      INSERT INTO I_INTREC (OBJECTID, COD_ESTUDO, IDSIGEP, DATA_INI, ATIVIDADE)
                      VALUES (@NewObjectID, @studyNro, @studyNro, @dataIni, 'Generación')
                    `;
                    console.log(`[I_INTREC] ✅ DATA_INI set for study ${effectiveNro}`);
                  }
                } catch (err) {
                  console.warn('[I_INTREC] Error setting DATA_INI:', err.message);
                }
              }

              if (newS === '210') {
                try {
                  const studyTempo = previousRecord ? previousRecord.Tempo : null;
                  const intRecReq = new sql.Request();
                  intRecReq.input('studyNro', sql.VarChar, effectiveNro);
                  intRecReq.input('studyTempo', sql.Float, studyTempo);
                  const nowFloat = new Date().getTime() / (1000 * 60 * 60 * 24);
                  intRecReq.input('dataTer', sql.Float, nowFloat);
                  const checkIntRec = await intRecReq.query`SELECT 1 FROM I_INTREC WHERE COD_ESTUDO = @studyNro`;
                  if (checkIntRec.recordset.length === 0) {
                    await intRecReq.query`
                      DECLARE @NewObjectID int = ISNULL((SELECT MAX(OBJECTID) FROM I_INTREC), 0) + 1;
                      INSERT INTO I_INTREC (OBJECTID, COD_ESTUDO, IDSIGEP, DATA_TER, TEMPO, ATIVIDADE)
                      VALUES (@NewObjectID, @studyNro, @studyNro, @dataTer, @studyTempo, 'Generación')
                    `;
                  } else {
                    await intRecReq.query`
                      UPDATE I_INTREC SET DATA_TER = @dataTer, TEMPO = @studyTempo
                      WHERE COD_ESTUDO = @studyNro
                    `;
                  }
                  console.log(`[I_INTREC] ✅ DATA_TER set for study ${effectiveNro} (status 210)`);
                } catch (err) {
                  console.warn('[I_INTREC] Error setting DATA_TER:', err.message);
                }
              }
            }

            // 2. Responsible Change - only log when changing FROM system/ADRSis to another analyst
            const oldResp = String(previousRecord.RESP_SEPLA || '');
            const newResp = String(respSeplaValue || '');

            // Only log if OLD was system/ADRSis and NEW is different
            const isSystemOld = oldResp.toUpperCase().includes('SISTEMA') || oldResp.toUpperCase().includes('ADRSIS');
            const isSystemNew = newResp.toUpperCase().includes('SISTEMA') || newResp.toUpperCase().includes('ADRSIS');

            if (isSystemOld && !isSystemNew && oldResp !== newResp) {
              changes.push({ field: 'responsável', old: oldResp, new: newResp, type: 'UPDATE' });
            }

            // 3. Deadline Change
            const oldDate = previousRecord.requestDate ? new Date(previousRecord.requestDate).toISOString().split('T')[0] : '';
            const newDate = effectiveRequestDate ? new Date(effectiveRequestDate).toISOString().split('T')[0] : '';
            if (oldDate !== newDate) {
              changes.push({ field: 'prazo', old: previousRecord.requestDate, new: effectiveRequestDate, type: 'UPDATE' });
            }

          }

          // Mapping de código para texto de status (used for logging compatibility)
          const codeToTextMap = {
            '330': 'Em Análise', '100': 'Em Análise', '200': 'Aguardando Execução',
            '205': 'Em Execução', '210': 'Concluído', '215': 'Aprovado pelo CQ',
            '220': 'Rejeitado', '225': 'Enviado sem CQ', '240': 'Aguardando Informações',
            '280': 'Controle de Qualidade', '290': 'Reprovado pelo CQ',
          };

          for (const change of changes) {
            try {
              const auditReq = new sql.Request();
              auditReq.input('studyNumber', sql.VarChar, data.studyNumber || null);
              auditReq.input('actionType', sql.VarChar, change.type);
              auditReq.input('fieldChanged', sql.VarChar, change.field);

              let oldV = change.old;
              let newV = change.new;

              // If it's status, wrap in JSON for frontend compatibility
              if (change.field === 'status') {
                oldV = JSON.stringify({ status: oldV ? (codeToTextMap[oldV] || oldV) : null, studyNumber: data.studyNumber });
                newV = JSON.stringify({ status: newV ? (codeToTextMap[newV] || newV) : null, studyNumber: data.studyNumber });
              } else if (change.field === 'prazo') {
                oldV = oldV ? new Date(oldV).toISOString() : null;
                newV = newV ? new Date(newV).toISOString() : null;
              } else if (change.field === 'responsável') {
                // Resolve names for responsible analysts instead of showing IDs
                oldV = await resolveAnalystName(oldV);
                newV = await resolveAnalystName(newV);
              }

              auditReq.input('oldValue', sql.NVarChar(sql.MAX), oldV);
              auditReq.input('newValue', sql.NVarChar(sql.MAX), newV);
              const authorID = data.lastModifiedBy || data.userId || data.user_id;
              const authorName = await resolveAnalystName(authorID);
              auditReq.input('userId', sql.VarChar, authorID || null);
              auditReq.input('userName', sql.VarChar, authorName || authorID || null);
              auditReq.input('timestamp', sql.DateTime, new Date());

              await auditReq.query`
                INSERT INTO T_AUDIT (StudyNumber, ActionType, FieldChanged, OldValue, NewValue, UserId, UserName, Timestamp)
                VALUES (@studyNumber, @actionType, @fieldChanged, @oldValue, @newValue, @userId, @userName, @timestamp)
              `;

              // *** S_STAHIS: Legacy status history log ***
              if (change.field === 'status') {
                try {
                  const staReq = new sql.Request();
                  const oaDate = dateToOADate(new Date());
                  const usuarioRaw = String(data.lastModifiedBy || data.userId || data.user_id || '').trim();
                  const isNumber = /^\d+$/.test(usuarioRaw);
                  const usuario = isNumber ? usuarioRaw.padStart(8, '0') : usuarioRaw;

                  staReq.input('nro', sql.VarChar, effectiveNro || (previousRecord ? previousRecord.NRO_ESTUDO : ''));
                  staReq.input('status', sql.VarChar, String(change.new));
                  staReq.input('data', sql.Float, oaDate);
                  staReq.input('usuario', sql.VarChar, usuario);
                  staReq.input('idsigep', sql.VarChar, String(effectiveNro || data.studyNumber || data.idsigep || ''));

                  await staReq.query`
                    INSERT INTO S_STAHIS (NRO_ESTUDO, STATUS, DATA, USUARIO, IDSIGEP)
                    VALUES (@nro, @status, @data, @usuario, @idsigep)
                  `;
                  console.log(`[StatusSync] 📜 Logged to S_STAHIS for record ${requestId}`);
                } catch (staErr) {
                  console.warn('[StatusSync] ⚠️ Failed to log to S_STAHIS:', staErr.message);
                }
              }

              console.log(`[Audit] Logged ${change.field} change successfully`);
            } catch (auditErr) {
              console.warn(`[Audit] Failed to log ${change.field} change:`, auditErr.message);
            }
          }

          res.status(200).json(data);
        } catch (err) {
          const errorDetails = {
            timestamp: new Date().toISOString(),
            message: err.message,
            id: data?.id,
            studyNumber: data?.studyNumber || data?.nro,
            status: data?.status,
            numericStatus: numericStatus,
            stack: err.stack?.split('\n').slice(0, 5).join('\n')
          };
          console.error('Error saving/moving request:', errorDetails);

          // Error logging
          try {
            const fs = require('fs');
            const path = require('path');
            const logFile = path.join(__dirname, 'error_log.txt');
            const logEntry = JSON.stringify(errorDetails, null, 2) + '\n---\n';
            fs.appendFileSync(logFile, logEntry);
          } catch (logErr) { }

          res.status(500).json({ error: 'Erro ao salvar/mover solicitação', message: err.message, details: errorDetails });
        }
      } finally {
        requestLocks.delete(lockKey);
      }
    });

    app.get('/api/requests/next-number', async (req, res) => {
      try {
        const { type, baseStudyNumber, city, address, title, neighborhood } = req.query;
        const currentYear = new Date().getFullYear();
        const yearPrefix = String(currentYear);

        // 1. Auto-detection of existing study for Revision (Duplicate Check)
        // Always perform duplicate detection regardless of type
        // Use consistent normalization (remove spaces, dots, commas, hyphens)
        const normalizedAddr = (address || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const normalizedTitle = (title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const normalizedNeighborhood = (neighborhood || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (normalizedAddr.length > 8 || normalizedTitle.length > 5) {
          const checkResult = await sql.query`
             SELECT TOP 1 NRO_ESTUDO, STATUS, Municipio, LOCALIZ, TITULO, BAIRRO
             FROM (
               SELECT NRO_ESTUDO, STATUS, Municipio, LOCALIZ, TITULO, BAIRRO 
               FROM Requests 
               WHERE (
                 (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOCALIZ, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedAddr + '%'})
                 AND Municipio = ${city}
                 AND (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(BAIRRO, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedNeighborhood + '%'})
                 AND (
                   TITULO = ${title} 
                   OR (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TITULO, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedTitle + '%'})
                 )
                 AND (STATUS IS NULL OR STATUS <> '220')
               )
               UNION ALL
               SELECT 
                 LTRIM(RTRIM(ISNULL(CAST(NRO_ESTUDO as varchar(100)), CAST(IDSIGEP as varchar(100))))) as NRO_ESTUDO, 
                 STATUS, Municipio, LOCALIZ, TITULO, BAIRRO
               FROM T_ESTPLA 
               WHERE (
                 (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOCALIZ, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedAddr + '%'})
                 AND Municipio = ${city}
                 AND (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(BAIRRO, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedNeighborhood + '%'})
                 AND (
                   TITULO = ${title} 
                   OR (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TITULO, ' ', ''), '.', ''), ',', ''), '-', ''), '/', '') LIKE ${'%' + normalizedTitle + '%'})
                 )
                 AND (STATUS IS NULL OR STATUS NOT IN ('220', 220))
               )
             ) AS Combined
             ORDER BY NRO_ESTUDO DESC
           `;

          if (checkResult.recordset[0]) {
            const existingNro = String(checkResult.recordset[0].NRO_ESTUDO);
            const matchedAddr = checkResult.recordset[0].LOCALIZ;
            const matchedTitle = checkResult.recordset[0].TITULO;

            const base8 = existingNro.replace(/^PROV-/, '').substring(0, 8);
            const lastRev = parseInt(existingNro.substring(8, 10)) || 0;
            const nextRev = String(lastRev + 1).padStart(2, '0');

            console.log(`[DuplicateCheck] 🔍 Match found: ${existingNro} for ${matchedAddr} / ${matchedTitle}`);

            // Convert numeric status code to readable text
            const statusCodeToText = {
              '100': 'Em Análise',
              '200': 'Aguardando Execução',
              '205': 'Em Execução',
              '210': 'Concluído',
              '215': 'Aprovado pelo CQ',
              '220': 'Cancelado',
              '225': 'Enviado sem CQ',
              '240': 'Aguardando Informações',
              '280': 'Controle de Qualidade',
              '290': 'Reprovado pelo CQ',
              '330': 'Em Análise'
            };
            const rawStatus = String(checkResult.recordset[0].STATUS || '');
            const statusText = statusCodeToText[rawStatus] || rawStatus;

            return res.json({
              nextNumber: `PROV-${base8}${nextRev}`,
              isRevision: true,
              previousStudy: existingNro,
              matchedAddress: matchedAddr,
              matchedTitle: matchedTitle,
              status: statusText,
              city: checkResult.recordset[0].Municipio
            });
          }
        }


        // 2. Manual Revision logic
        if (type === 'revision' && baseStudyNumber) {
          const base8 = String(baseStudyNumber).replace('PROV-', '').substring(0, 8);
          const result = await sql.query`
            SELECT MAX(CAST(IDSIGEP as bigint)) as maxNro FROM (
              SELECT IDSIGEP FROM T_ESTPLA WHERE CAST(IDSIGEP as varchar) LIKE ${base8 + '%'} AND IDSIGEP IS NOT NULL AND IDSIGEP > 0
              UNION ALL
              SELECT CAST(REPLACE(NRO_ESTUDO, 'PROV-', '') as bigint) as IDSIGEP FROM Requests WHERE REPLACE(NRO_ESTUDO, 'PROV-', '') LIKE ${base8 + '%'}
            ) t
          `;
          const currentMax = result.recordset[0]?.maxNro;
          const next = currentMax ? BigInt(currentMax) + 1n : BigInt(base8 + '01');
          return res.json({ nextNumber: `PROV-${next.toString()}` });
        }

        // 3. New study sequence with YYYYXXXXRR format (Starting at 0001 for Seq, 01 for Rev)
        const sequenceResult = await sql.query`
          SELECT MAX(CAST(SUBSTRING(nro, 5, 4) as int)) as maxYearSeq FROM (
            SELECT CAST(IDSIGEP as varchar) as nro FROM T_ESTPLA 
            WHERE CAST(IDSIGEP as varchar) LIKE ${yearPrefix + '%'}
            UNION ALL
            SELECT REPLACE(NRO_ESTUDO, 'PROV-', '') as nro FROM Requests 
            WHERE REPLACE(NRO_ESTUDO, 'PROV-', '') LIKE ${yearPrefix + '%'}
          ) t
          WHERE ISNUMERIC(SUBSTRING(nro, 5, 4)) = 1
        `;

        const maxYearSeq = sequenceResult.recordset[0]?.maxYearSeq || 0;
        const nextSeq = String(maxYearSeq + 1).padStart(4, '0');
        const initialRev = '01';

        // Final format: PROV-YYYYXXXXRR (10 digits after PROV-)
        const nextNumber = `PROV-${yearPrefix}${nextSeq}${initialRev}`;
        res.json({ nextNumber });
      } catch (err) {
        console.error('Error calculating next study number:', err.message);
        res.status(500).json({ error: 'Failed' });
      }
    });

    app.get('/api/debug-db', async (req, res) => {
      try {
        const reqR = await sql.query("SELECT TOP 5 id, NRO_ESTUDO, status FROM Requests ORDER BY createdAt DESC");
        const tR = await sql.query("SELECT TOP 10 id, IDSIGEP, NRO_ESTUDO, STATUS FROM T_ESTPLA ORDER BY DataCriaReg DESC");
        res.json({
          requests: reqR.recordset,
          t_estpla: tR.recordset
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });


    // 8. DELETE Request
    app.delete('/api/requests/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const sqlReq = new sql.Request();
        sqlReq.input('id', sql.VarChar, id);
        await sqlReq.query`DELETE FROM Requests WHERE id = @id`;
        await sqlReq.query`DELETE FROM T_ESTPLA WHERE id = @id`;
        res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error deleting request:', err);
        res.status(500).json({ error: 'Failed to delete request' });
      }
    });

    const server = app.listen(port, () => {
      console.log(`[Server] API running on http://localhost:${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] ERRO: Porta ${port} já está em uso! Encerrando...`);
      } else {
        console.error('[Server] Server error:', err);
      }
      process.exit(1);
    });

  } catch (err) {
    console.error('[Server] Database error:', err);
    process.exit(1);
  }
}


// --- Attachments Endpoints ---

app.post('/api/attachments', async (req, res) => {
  try {
    const { requestId, fileName, fileType, category, contentBase64 } = req.body;
    if (!requestId || !fileName || !contentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    const sqlReq = new sql.Request();
    sqlReq.input('requestId', sql.VarChar, String(requestId));
    sqlReq.input('fileName', sql.NVarChar, fileName);
    sqlReq.input('fileContent', sql.VarBinary(sql.MAX), buffer);
    sqlReq.input('fileType', sql.NVarChar, fileType || 'application/octet-stream');
    sqlReq.input('category', sql.NVarChar, category || 'Solicitacao');

    // PREVENT DUPLICATES: Delete old file with same metadata before inserting
    await sqlReq.query(`
          DELETE FROM RequestAttachments 
          WHERE requestId = @requestId AND fileName = @fileName AND category = @category
        `);

    await sqlReq.query(`
          INSERT INTO RequestAttachments (requestId, fileName, fileContent, fileType, category)
          VALUES (@requestId, @fileName, @fileContent, @fileType, @category)
        `);

    res.status(201).json({ message: 'Attachment saved successfully' });
  } catch (err) {
    console.error('[Attachments] Error saving attachment:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.get('/api/attachments/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { category } = req.query;
    const sqlReq = new sql.Request();
    sqlReq.input('requestId', sql.VarChar, String(requestId));

    let query = 'SELECT id, fileName as name, fileType as type, category, DATALENGTH(fileContent) as size, createdAt FROM RequestAttachments WHERE requestId = @requestId';
    if (category) {
      sqlReq.input('category', sql.NVarChar, category);
      query += ' AND category = @category';
    }

    const result = await sqlReq.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('[Attachments] Error listing attachments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/attachments/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const sqlReq = new sql.Request();
    sqlReq.input('id', sql.Int, parseInt(fileId));

    const result = await sqlReq.query('SELECT fileName, fileContent, fileType FROM RequestAttachments WHERE id = @id');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.recordset[0];
    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(file.fileName)}"`);
    res.send(file.fileContent);
  } catch (err) {
    console.error('[Attachments] Error downloading file:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/attachments/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const sqlReq = new sql.Request();
    sqlReq.input('id', sql.Int, parseInt(fileId));
    await sqlReq.query('DELETE FROM RequestAttachments WHERE id = @id');
    res.json({ message: 'Attachment deleted successfully' });
  } catch (err) {
    console.error('[Attachments] Error deleting attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Maintenance: Clear responseMemo for CQ/Concluded studies
app.post('/api/maintenance/clear-response-memo', async (req, res) => {
  try {
    const check = await sql.query`
      SELECT COUNT(*) as cnt FROM Requests 
      WHERE STATUS IN ('205', '280') 
      AND responseMemo IS NOT NULL 
      AND LEN(responseMemo) > 0
    `;

    if (check.recordset[0].cnt > 0) {
      await sql.query`
        UPDATE Requests 
        SET responseMemo = '' 
        WHERE STATUS IN ('205', '280') 
        AND responseMemo IS NOT NULL 
        AND LEN(responseMemo) > 0
      `;
    }

    res.json({ success: true, updated: check.recordset[0].cnt });
  } catch (err) {
    console.error('[Maintenance] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create folder endpoint
app.post('/api/folders/create', async (req, res) => {
  try {
    const { folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'folderPath é obrigatório' });
    }

    // Create directory recursively
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`[Folders] Pasta criada: ${folderPath}`);
      res.json({ success: true, path: folderPath });
    } else {
      res.json({ success: true, path: folderPath, alreadyExists: true });
    }
  } catch (err) {
    console.error('[Folders] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

startServer();

