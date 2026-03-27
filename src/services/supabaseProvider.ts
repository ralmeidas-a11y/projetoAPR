import { supabase } from './supabaseClient';
import { User, FormData, UserRole, StudyStatus } from '../types/types';
import { StorageProvider } from '../types/storage';
import { getGMT3ISOString } from '../utils/utils';
import { getRequestPath } from './storage';

export class SupabaseProvider implements StorageProvider {
  // --- Profile Operations ---

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapProfileToUser(data);
  }

  async saveUser(user: User): Promise<User> {
    const profileData = {
      id: user.id && user.id.length > 0 ? user.id : crypto.randomUUID(),
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role,
      area: user.area,
      naturgy_unit: user.naturgyUnit,
      password: user.password,
      permissions: user.permissions || [],
      requires_password_change: user.requiresPasswordChange ?? false,
      company: user.company,
      role_description: user.roleDescription,
      gb: user.gb,
      updated_at: getGMT3ISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) throw error;
    return this.mapProfileToUser(data);
  }

  async listUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');

    if (error) return [];
    return (data || []).map(u => this.mapProfileToUser(u));
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) return null;
    return this.mapProfileToUser(data);
  }

  // --- Request Operations ---

  async addRequest(request: FormData): Promise<FormData> {
    const requestRow = {
      id: request.id,
      study_number: request.studyNumber,
      status: request.status,
      user_id: request.user_id,
      form_type: request.formType,
      updated_at: getGMT3ISOString(),
      data: request 
    };

    const { error } = await supabase
      .from('requests')
      .upsert(requestRow);

    if (error) throw error;
    
    // Sync to integrated table
    try {
      const integratedRow = this.mapToIntegratedRequest(request);
      await supabase.from('integrated_requests').upsert(integratedRow);
    } catch (err) {
      console.warn('Sync to integrated table failed', err);
    }

    return request;
  }

  async getRequests(userId?: string): Promise<FormData[]> {
    let query = supabase.from('requests').select(`
        *,
        interconnection_points(*),
        planned_extensions(*),
        fo02_grid_data(*)
      `);
    
    if (userId) query = query.eq('user_id', userId);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];

    return (data || []).map(r => this.mapRowToRequest(r));
  }

  async getRequestById(id: string): Promise<FormData | null> {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        interconnection_points(*),
        planned_extensions(*),
        fo02_grid_data(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRowToRequest(data);
  }

  async deleteRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // --- File Operations ---

  async uploadCartaResposta(request: FormData, blob: Blob): Promise<string> {
    const path = `${getRequestPath(request.studyNumber, 'Resposta')}/Carta_Resposta_${request.studyNumber}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('solicitacoes')
      .upload(path, blob, { upsert: true });

    if (error) throw error;
    return data.path;
  }

  async getRequestFiles(studyNumber: string, folder: string): Promise<any[]> {
    const path = getRequestPath(studyNumber, folder);
    const { data, error } = await supabase.storage
      .from('solicitacoes')
      .list(path);

    if (error) {
      if (error.message.includes('not found')) return [];
      throw error;
    }
    return data || [];
  }

  // --- Helper Operations ---

  async getRequestsCountByStatus(status: string): Promise<number> {
    const { count, error } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    
    if (error) return 0;
    return count || 0;
  }

  // --- Internal Mappers ---

  private mapProfileToUser(p: any): User {
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role as UserRole,
      area: p.area,
      naturgyUnit: p.naturgy_unit,
      password: p.password,
      profileComplete: true,
      requiresPasswordChange: p.requires_password_change,
      permissions: p.permissions || [],
      createdAt: p.created_at,
      company: p.company,
      roleDescription: p.role_description,
      gb: p.gb
    };
  }

  private mapRowToRequest(r: any): FormData {
    const formData: FormData = {
      ...r.data,
      id: r.id,
      studyNumber: r.study_number,
      status: r.status as StudyStatus,
      user_id: r.user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
    return formData;
  }

  private mapToIntegratedRequest(request: FormData): any {
    return {
      id: request.id,
      NRO_ESTUDO: request.studyNumber,
      STATUS: request.status
    };
  }
}
