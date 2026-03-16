import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  openOutlookEmailHtml: (data: any) => 
    ipcRenderer.invoke("open-outlook-email-html", data)
});
