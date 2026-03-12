
import { FormData, User, UserRole } from '../types';

const REQUESTS_KEY = 'naturgy_portal_requests';
const USERS_KEY = 'naturgy_portal_users';

// ADM inicial - criar analistas através do painel de gestão
const DEFAULT_USERS: User[] = [
  { id: 'admin', name: 'Administrador', role: UserRole.ADM, email: 'admin@naturgy.com', profileComplete: true },
];

export const StorageService = {
  // Requests Management
  getRequests: (): FormData[] => {
    const data = localStorage.getItem(REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveRequests: (requests: FormData[]) => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  },

  addRequest: (request: FormData) => {
    const requests = StorageService.getRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index > -1) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    StorageService.saveRequests(requests);
    return requests;
  },

  // Users Management
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      StorageService.saveUsers(DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return JSON.parse(data);
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  resetUsersToAdmin: () => {
    StorageService.saveUsers(DEFAULT_USERS);
  },

  clearAll: () => {
    localStorage.removeItem(REQUESTS_KEY);
    localStorage.removeItem(USERS_KEY);
    window.location.reload();
  }
};
