import { User, FormData } from '../types/types';
import { StorageProvider } from '../types/storage';

export class SQLServerProvider implements StorageProvider {
  // --- Profile Operations ---

  async getUser(id: string): Promise<User | null> {
    console.warn('[SQLServerProvider] getUser not implemented');
    return null;
  }

  async saveUser(user: User): Promise<User> {
    console.warn('[SQLServerProvider] saveUser not implemented');
    return user;
  }

  async listUsers(): Promise<User[]> {
    console.warn('[SQLServerProvider] listUsers not implemented');
    return [];
  }

  async getUserByEmail(email: string): Promise<User | null> {
    console.warn('[SQLServerProvider] getUserByEmail not implemented');
    return null;
  }

  // --- Request Operations ---

  async addRequest(request: FormData): Promise<FormData> {
    console.warn('[SQLServerProvider] addRequest not implemented');
    return request;
  }

  async getRequests(userId?: string): Promise<FormData[]> {
    console.warn('[SQLServerProvider] getRequests not implemented');
    return [];
  }

  async getRequestById(id: string): Promise<FormData | null> {
    console.warn('[SQLServerProvider] getRequestById not implemented');
    return null;
  }

  async deleteRequest(id: string): Promise<void> {
    console.warn('[SQLServerProvider] deleteRequest not implemented');
  }

  // --- File Operations ---

  async uploadCartaResposta(request: FormData, blob: Blob): Promise<string> {
    console.warn('[SQLServerProvider] uploadCartaResposta not implemented');
    return '';
  }

  async getRequestFiles(studyNumber: string, folder: string): Promise<any[]> {
    console.warn('[SQLServerProvider] getRequestFiles not implemented');
    return [];
  }

  // --- Helper Operations ---

  async getRequestsCountByStatus(status: string): Promise<number> {
    console.warn('[SQLServerProvider] getRequestsCountByStatus not implemented');
    return 0;
  }
}
