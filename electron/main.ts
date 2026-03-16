import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function registerIpcHandlers() {
  ipcMain.handle("open-outlook-email-html", async (event, data) => {
    try {
      // 1. Gera o caminho do arquivo temporário no OS com extensão .eml
      const tempFile = path.join(
        os.tmpdir(),
        `email_draft_${Date.now()}.eml`
      );

      // 2. Se o renderer enviou o EML pronto, usa ele, senão faz fallback pro HTML simples
      let contentToWrite = data.emlContent;
      
      if (!contentToWrite) {
         // Fallback de segurança se não vier emlContent (embora o novo service mande sempre)
         const boundary = "----=_Part_0_" + Date.now().toString(16);
         contentToWrite = `From: "Sistema" <prgc@naturgy.com>\r\n`;
         contentToWrite += `To: ${data.to}\r\n`;
         contentToWrite += `Subject: =?UTF-8?B?${Buffer.from(data.subject || 'Notificação').toString('base64')}?=\r\n`;
         contentToWrite += `MIME-Version: 1.0\r\n`;
         contentToWrite += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
         contentToWrite += `--${boundary}\r\n`;
         contentToWrite += `Content-Type: text/html; charset=UTF-8\r\n`;
         contentToWrite += `Content-Transfer-Encoding: base64\r\n\r\n`;
         contentToWrite += Buffer.from(data.html || '').toString('base64') + '\r\n\r\n';
         contentToWrite += `--${boundary}--\r\n`;
      }

      // 3. Escreve no disco físico
      fs.writeFileSync(tempFile, contentToWrite, "utf8");

      // 4. Manda o SO abrir o arquivo no programa padrão (Outlook, Mail, Thunderbird, etc)
      // O abrirPath em um .eml força o cliente de email abrir a tela de "Compor" / Leitura com o anexo.
      await shell.openPath(tempFile);

      return {
        success: true,
        message: "Draft EML carregado e aberto no cliente padrão de email",
        path: tempFile
      };
    } catch (error) {
      console.error("Erro ao gerar/abrir EML local:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Erro interno do Electron"
      };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // Apontar corretamente para o arquivo preload gerado pelo seu bundler (ex: vite/tsc)
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  registerIpcHandlers();

  // Em desenvolvimento, aponte para o localhost
  // No build de produção, aponte para o dist/index.html
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
