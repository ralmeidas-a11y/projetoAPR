const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(config);
    console.log("Adding missing columns to Requests table...");
    
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'Bairro')
      ALTER TABLE Requests ADD Bairro VARCHAR(MAX);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'EMPRESA')
      ALTER TABLE Requests ADD EMPRESA VARCHAR(100);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'DAT_EN_SEP')
      ALTER TABLE Requests ADD DAT_EN_SEP VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'NRO_EST_AN')
      ALTER TABLE Requests ADD NRO_EST_AN VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'PRESSAO')
      ALTER TABLE Requests ADD PRESSAO VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'RESP_SEPLA')
      ALTER TABLE Requests ADD RESP_SEPLA VARCHAR(100);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'OBSERVS')
      ALTER TABLE Requests ADD OBSERVS VARCHAR(MAX);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'TPGASS')
      ALTER TABLE Requests ADD TPGASS VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'PRESGAS')
      ALTER TABLE Requests ADD PRESGAS VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'NumEconomias')
      ALTER TABLE Requests ADD NumEconomias INT;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'VazaoSol')
      ALTER TABLE Requests ADD VazaoSol FLOAT;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'ConsMens')
      ALTER TABLE Requests ADD ConsMens INT;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'IDSIGEP')
      ALTER TABLE Requests ADD IDSIGEP BIGINT;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'GRUPO_EST')
      ALTER TABLE Requests ADD GRUPO_EST VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'TIPO_EST')
      ALTER TABLE Requests ADD TIPO_EST VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'TIP_ES')
      ALTER TABLE Requests ADD TIP_ES VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'GrauDificult')
      ALTER TABLE Requests ADD GrauDificult VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'CROQUI')
      ALTER TABLE Requests ADD CROQUI VARCHAR(20);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'EstudoRelevante')
      ALTER TABLE Requests ADD EstudoRelevante VARCHAR(20);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'UnidSol')
      ALTER TABLE Requests ADD UnidSol VARCHAR(20);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'dtEntregaPrevista')
      ALTER TABLE Requests ADD dtEntregaPrevista VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'STATUS_TEXT')
      ALTER TABLE Requests ADD STATUS_TEXT VARCHAR(50);
    `;

    await sql.query(query);
    console.log("Successfully added columns to Requests table.");
    
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.close();
  }
}

run();
