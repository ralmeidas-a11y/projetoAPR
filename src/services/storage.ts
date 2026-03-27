import { User, FormData } from '../types/types';
import { StorageProvider } from '../types/storage';
import { SupabaseProvider } from './supabaseProvider';
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
 * to the active StorageProvider (Supabase or SQL Server).
 */
class StorageManager {
  private provider: StorageProvider;

  constructor() {
    const useSQLServer = import.meta.env.VITE_USE_SQL_SERVER === 'true';
    this.provider = useSQLServer ? new SQLServerProvider() : new SupabaseProvider();
    
    console.log(`[StorageService] Active Provider: ${useSQLServer ? 'SQL Server' : 'Supabase'}`);
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

  // --- Request Operations ---

  async getRequests(userId?: string): Promise<FormData[]> {
    return this.provider.getRequests(userId);
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

  // --- Utility Operations ---

  async getRequestsCountByStatus(status: string): Promise<number> {
    return this.provider.getRequestsCountByStatus(status);
  }

  setProvider(provider: StorageProvider) {
    this.provider = provider;
  }
}

export const StorageService = new StorageManager();
