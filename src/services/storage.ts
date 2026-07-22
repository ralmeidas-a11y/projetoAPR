import { User, FormData } from '../types/types';
import { StorageProvider } from '../types/storage';
import { SQLServerProvider } from './sqlServerProvider';

/**
 * Utility function to determine the storage path for a given study.
 * Logic is independent of the database backend.
 */
export const getRequestPath = (studyNumber: string, category?: string) => {
  if (!studyNumber) return 'Solicitacoes_APR/Unknown';
  
  const baseWithoutProv = studyNumber.replace(/^PROV-/, '');
  const revMatch = baseWithoutProv.match(/(APR-\d{4}-\d+)-REV(\d+)$/i);
  
  let baseIdentifier = baseWithoutProv;
  let revSuffix = 'REV0';
  
  if (revMatch) {
    baseIdentifier = revMatch[1];
    revSuffix = `REV${revMatch[2]}`;
  } else {
    const baseMatch = baseWithoutProv.match(/APR-\d{4}-\d+/i);
    if (baseMatch) {
      baseIdentifier = baseMatch[0];
    }
  }
  
  const yearMatch = baseIdentifier.match(/APR-(\d{4})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  
  let path = `Solicitacoes_APR/${year}/${baseIdentifier}/${revSuffix}`;
  if (category) path += `/${category}`;
  
  return path;
};

/**
 * StorageService acts as a singleton manager that delegates operations 
 * to the active StorageProvider (SQL Server).
 */
class StorageManager {
  private provider: StorageProvider;

  constructor() {
    this.provider = new SQLServerProvider();
    console.log('[StorageService] Active Provider: SQL Server (Ready for integration)');
  }

  // --- Profile Operations ---

  async getUsers(): Promise<User[]> {
    return this.provider.listUsers();
  }

  async saveUser(user: User): Promise<User> {
    return this.provider.saveUser(user);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.provider.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.provider.getUserByEmail(email);
  }

  async deleteUser(id: string): Promise<void> {
    return this.provider.deleteUser(id);
  }

  // --- Request Operations ---

  async getRequests(userId?: string, role?: string, area?: string): Promise<FormData[]> {
    return this.provider.getRequests(userId, role, area);
  }

  async addRequest(request: FormData): Promise<FormData> {
    return this.provider.addRequest(request);
  }

  async getRequestById(id: string): Promise<FormData | null> {
    return this.provider.getRequestById(id);
  }

  async deleteRequest(id: string): Promise<void> {
    return this.provider.deleteRequest(id);
  }

  // --- File Operations ---

  async uploadCartaResposta(request: FormData, blob: Blob): Promise<string> {
    return this.provider.uploadCartaResposta(request, blob);
  }

  async getRequestFiles(studyNumber: string, folder: string): Promise<any[]> {
    return this.provider.getRequestFiles(studyNumber, folder);
  }

  async uploadFile(studyNumber: string, folder: string, file: File): Promise<string> {
    return this.provider.uploadFile(studyNumber, folder, file);
  }

  async getFileUrl(path: string, download?: boolean): Promise<string | null> {
    return this.provider.getFileUrl(path, download);
  }

  async deleteFile(path: string): Promise<void> {
    return this.provider.deleteFile(path);
  }

  async syncFilesFromStorage(studyNumber: string): Promise<void> {
    return this.provider.syncFilesFromStorage(studyNumber);
  }

  async deleteCartaResposta(studyNumber: string): Promise<void> {
    return this.provider.deleteCartaResposta(studyNumber);
  }

  async moveStorageFolder(oldStudyNumber: string, newStudyNumber: string): Promise<void> {
    return this.provider.moveStorageFolder(oldStudyNumber, newStudyNumber);
  }

  async migrateRequestsToStorage(onProgress?: (status: string) => void): Promise<void> {
    return this.provider.migrateRequestsToStorage(onProgress);
  }

  // --- Utility Operations ---

  async getRequestsCountByStatus(status: string): Promise<number> {
    return this.provider.getRequestsCountByStatus(status);
  }

  async getNextStudyNumber(
    type?: 'new' | 'revision', 
    baseStudyNumber?: string,
    city?: string,
    address?: string,
    title?: string,
    neighborhood?: string
  ): Promise<{ 
    nextNumber: string; 
    isRevision?: boolean; 
    previousStudy?: string;
    matchedAddress?: string;
    matchedTitle?: string;
    status?: string;
    city?: string;
  }> {
    return this.provider.getNextStudyNumber(type, baseStudyNumber, city, address, title, neighborhood);
  }

  async getStudyByNumber(studyNumber: string): Promise<FormData | null> {
    return this.provider.getStudyByNumber(studyNumber);
  }


  async getNextId(): Promise<string> {
    const provider = (this.provider as any);
    if (provider.getNextId) {
      return provider.getNextId();
    }
    return `sol-${Date.now()}`;
  }

  async updateUserPassword(email: string, hash: string): Promise<void> {
    return this.provider.updateUserPassword(email, hash);
  }

  async getAlwaysCC(): Promise<string[]> {
    try {
      const res = await fetch('/api/always-cc');
      if (res.ok) return await res.json();
    } catch { /* ignore */ }
    return [];
  }

  async saveAlwaysCC(emails: string[]): Promise<void> {
    await fetch('/api/always-cc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
  }

  setProvider(provider: StorageProvider) {
    this.provider = provider;
  }
}

export const StorageService = new StorageManager();
