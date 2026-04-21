import { User, FormData } from './types';

export interface StorageProvider {
  // User operations
  getUser(id: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | null>;
  deleteUser(id: string): Promise<void>;

  // Request/FormData operations
  addRequest(request: FormData): Promise<FormData>;
  getRequests(userId?: string, role?: string, area?: string): Promise<FormData[]>;
  getRequestById(id: string): Promise<FormData | null>;
  deleteRequest(id: string): Promise<void>;

  // File operations
  uploadCartaResposta(request: FormData, blob: Blob): Promise<string>;
  deleteCartaResposta(studyNumber: string): Promise<void>;
  getRequestFiles(studyNumber: string, folder: string): Promise<any[]>;
  uploadFile(studyNumber: string, folder: string, file: File): Promise<string>;
  getFileUrl(path: string, download?: boolean): Promise<string | null>;
  deleteFile(path: string): Promise<void>;
  syncFilesFromStorage(studyNumber: string): Promise<void>;
  moveStorageFolder(oldStudyNumber: string, newStudyNumber: string): Promise<void>;
  migrateRequestsToStorage(onProgress?: (status: string) => void): Promise<void>;

  // Helper operations
  getRequestsCountByStatus(status: string): Promise<number>;
  getNextStudyNumber(
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
  }>;

  getStudyByNumber(studyNumber: string): Promise<FormData | null>;


  // Authentication/Password operations
  updateUserPassword(email: string, hash: string): Promise<void>;
}
