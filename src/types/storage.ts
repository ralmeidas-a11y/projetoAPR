import { User, FormData } from './types';

export interface StorageProvider {
  // User operations
  getUser(id: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | null>;

  // Request/FormData operations
  addRequest(request: FormData): Promise<FormData>;
  getRequests(userId?: string): Promise<FormData[]>;
  getRequestById(id: string): Promise<FormData | null>;
  deleteRequest(id: string): Promise<void>;

  // File operations
  uploadCartaResposta(request: FormData, blob: Blob): Promise<string>;
  getRequestFiles(studyNumber: string, folder: string): Promise<any[]>;

  // Helper operations
  getRequestsCountByStatus(status: string): Promise<number>;
}
