import { User, FormData } from '../types/types';
import { StorageProvider } from '../types/storage';

export class SQLServerProvider implements StorageProvider {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  // --- Profile Operations ---

  async getUser(id: string): Promise<User | null> {
    try {
      const res = await fetch(`${this.apiUrl}/api/users`);
      if (!res.ok) throw new Error('API Error');
      const users: User[] = await res.json();
      return users.find(u => u.id === id) || null;
    } catch (err) {
      console.error('[SQLServerProvider] Error fetching user', err);
      return null;
    }
  }

  async saveUser(user: User): Promise<User> {
    try {
      const res = await fetch(`${this.apiUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Failed to save user');
      return await res.json();
    } catch (err) {
      console.error('[SQLServerProvider] saveUser error', err);
      return user; 
    }
  }

  async listUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${this.apiUrl}/api/users`);
      if (!res.ok) throw new Error('Failed to list users');
      return await res.json();
    } catch (err) {
      console.error('[SQLServerProvider] listUsers error', err);
      return [];
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const res = await fetch(`${this.apiUrl}/api/users`);
      if (!res.ok) throw new Error('API Error');
      const users: User[] = await res.json();
      return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (err) {
      console.error('[SQLServerProvider] Error fetching user by email', err);
      return null;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const res = await fetch(`${this.apiUrl}/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
    } catch (err) {
      console.error('[SQLServerProvider] deleteUser error', err);
    }
  }

  // --- Request Operations ---

  async addRequest(request: FormData): Promise<FormData> {
    try {
      const res = await fetch(`${this.apiUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to add request');
      }
      return await res.json();
    } catch (err) {
      console.error('[SQLServerProvider] addRequest error', err);
      throw err; // Propagar o erro para o App.tsx
    }
  }

  async getRequests(userId?: string, role?: string, area?: string): Promise<FormData[]> {
    try {
      const url = new URL(`${this.apiUrl}/api/requests`);
      if (userId) url.searchParams.append('userId', userId);
      if (role) url.searchParams.append('role', role);
      if (area) url.searchParams.append('area', area);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to get requests');
      return await res.json();
    } catch (err) {
      console.error('[SQLServerProvider] getRequests error', err);
      return [];
    }
  }

  async getRequestById(id: string): Promise<FormData | null> {
    try {
      const all = await this.getRequests();
      return all.find(r => r.id === id) || null;
    } catch (err) {
      console.error('[SQLServerProvider] getRequestById error', err);
      return null;
    }
  }

  async deleteRequest(id: string): Promise<void> {
    try {
      const res = await fetch(`${this.apiUrl}/api/requests/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete request');
    } catch (err) {
      console.error('[SQLServerProvider] deleteRequest error', err);
    }
  }

  async getNextStudyNumber(
    type: 'new' | 'revision' = 'new', 
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
    try {
      const url = new URL(`${this.apiUrl}/api/requests/next-number`);
      url.searchParams.append('type', type);
      if (baseStudyNumber) url.searchParams.append('baseStudyNumber', baseStudyNumber);
      if (city) url.searchParams.append('city', city);
      if (address) url.searchParams.append('address', address);
      if (title) url.searchParams.append('title', title);
      if (neighborhood) url.searchParams.append('neighborhood', neighborhood);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to get next study number');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[SQLServerProvider] getNextStudyNumber error', err);
      return { nextNumber: `PROV-${Date.now()}` };
    }
  }

  async getStudyByNumber(studyNumber: string): Promise<FormData | null> {
    try {
      const res = await fetch(`${this.apiUrl}/api/requests/study/${studyNumber}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[SQLServerProvider] getStudyByNumber error', err);
      return null;
    }
  }


  async getNextId(): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/api/requests/next-id`);
      if (!res.ok) throw new Error('Failed to get next ID');
      const data = await res.json();
      return data.nextId;
    } catch (err) {
      console.error('[SQLServerProvider] getNextId error', err);
      return `sol-${Date.now()}`;
    }
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

  async uploadFile(studyNumber: string, folder: string, file: File): Promise<string> {
    console.warn('[SQLServerProvider] uploadFile not implemented');
    return '';
  }

  async getFileUrl(path: string): Promise<string | null> {
    console.warn('[SQLServerProvider] getFileUrl not implemented');
    return null;
  }

  async deleteFile(path: string): Promise<void> {
    console.warn('[SQLServerProvider] deleteFile not implemented');
  }

  async syncFilesFromStorage(studyNumber: string): Promise<void> {
    console.warn('[SQLServerProvider] syncFilesFromStorage not implemented');
  }

  async deleteCartaResposta(studyNumber: string): Promise<void> {
    console.warn('[SQLServerProvider] deleteCartaResposta not implemented');
  }

  async moveStorageFolder(oldStudyNumber: string, newStudyNumber: string): Promise<void> {
    console.warn('[SQLServerProvider] moveStorageFolder not implemented');
  }

  async migrateRequestsToStorage(onProgress?: (status: string) => void): Promise<void> {
    console.warn('[SQLServerProvider] migrateRequestsToStorage not implemented');
  }

  // --- Helper Operations ---

  async getRequestsCountByStatus(status: string): Promise<number> {
    console.warn('[SQLServerProvider] getRequestsCountByStatus not implemented');
    return 0;
  }

  async updateUserPassword(email: string, hash: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: hash, role: 'Analista' }) 
    });
    if (!res.ok) throw new Error('Failed to update password');
  }
}
