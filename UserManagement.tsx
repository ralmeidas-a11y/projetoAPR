
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { isValidCorporateEmail, getFormattedDomains } from '../constants';

interface UserManagementProps {
  users: User[];
  onUpdateUser: (user: User) => void;
  onCreateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onResetUsers?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdateUser, onCreateUser, onDeleteUser, onResetUsers }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.ANALISTA);
  const [newPerms, setNewPerms] = useState<('validar' | 'executar')[]>([]);

  const togglePermission = (user: User, perm: 'validar' | 'executar') => {
    const currentPerms = user.permissions || [];
    const newPerms = currentPerms.includes(perm) 
      ? currentPerms.filter(p => p !== perm) 
      : [...currentPerms, perm];
    onUpdateUser({ ...user, permissions: newPerms });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCorporateEmail(newEmail)) {
      alert(`Apenas e-mails corporativos são permitidos: ${getFormattedDomains()}`);
      return;
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name: newName,
      email: newEmail.toLowerCase(),
      role: newRole,
      permissions: newPerms,
      profileComplete: true
    };

    onCreateUser(newUser);
    setNewName('');
    setNewEmail('');
    setNewPerms([]);
    setShowCreateForm(false);
  };

  const toggleNewPerm = (perm: 'validar' | 'executar') => {
    setNewPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-[#004080] text-white">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black uppercase tracking-tight">Gestão de Usuários</h2>
            <p className="text-blue-100/60 text-[10px] font-bold uppercase tracking-widest mt-1">Controle de acessos e permissões técnicas</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (window.confirm('⚠️ ATENÇÃO: Isso vai APAGAR TODOS os usuários e solicitações!\n\nDeseja continuar?')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  console.log('%c🗑️ Todos os dados foram apagados!', 'color: red; font-weight: bold; font-size: 14px');
                  setTimeout(() => { window.location.href = window.location.href; }, 500);
                }
              }}
              className="px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 flex items-center gap-2"
            >
              <i className="fa-solid fa-trash-alt"></i> Apagar Tudo
            </button>
            <button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-2 ${showCreateForm ? 'bg-red-500 text-white' : 'bg-orange-500 text-white shadow-lg shadow-orange-900/20 hover:bg-white hover:text-orange-500'}`}
            >
              {showCreateForm ? <><i className="fa-solid fa-xmark"></i> Cancelar</> : <><i className="fa-solid fa-user-plus"></i> Novo Analista</>}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateSubmit} className="p-10 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2 col-span-1">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Digite o nome completo"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium cursor-text transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">E-mail Corporativo</label>
                <input 
                  type="email" 
                  required 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="usuario@naturgy.com"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium cursor-text transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Papel</label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium appearance-none cursor-pointer transition-colors"
                >
                  <option value={UserRole.ANALISTA}>Analista</option>
                  <option value={UserRole.ADM}>Administrador</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 sm:pt-6 col-span-1 sm:col-span-2 md:col-span-1">
                <label className="flex items-center gap-3 cursor-pointer group flex-shrink-0">
                   <input 
                     type="checkbox" 
                     checked={newPerms.includes('validar')} 
                     onChange={() => toggleNewPerm('validar')} 
                     className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer" 
                   />
                   <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">Validar</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group flex-shrink-0">
                   <input 
                     type="checkbox" 
                     checked={newPerms.includes('executar')} 
                     onChange={() => toggleNewPerm('executar')} 
                     className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer" 
                   />
                   <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">Executar</span>
                </label>
                <button 
                  type="submit" 
                  className="ml-auto px-6 py-3 bg-[#004080] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all active:scale-95 shadow-lg hover:shadow-orange-200"
                >
                  Criar Conta
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuário</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Papel</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Validar Cadastro</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Executar Estudo</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.filter(u => u.role !== UserRole.SOLICITANTE).map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-[#004080] uppercase tracking-tight">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === UserRole.ADM ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <input 
                      type="checkbox" 
                      disabled={u.role === UserRole.ADM}
                      checked={u.permissions?.includes('validar') || u.role === UserRole.ADM} 
                      onChange={() => togglePermission(u, 'validar')}
                      className="w-5 h-5 rounded border-slate-200 text-[#004080] focus:ring-[#004080] cursor-pointer disabled:opacity-30"
                    />
                  </td>
                  <td className="px-8 py-5 text-center">
                    <input 
                      type="checkbox" 
                      disabled={u.role === UserRole.ADM}
                      checked={u.permissions?.includes('executar') || u.role === UserRole.ADM} 
                      onChange={() => togglePermission(u, 'executar')}
                      className="w-5 h-5 rounded border-slate-200 text-[#004080] focus:ring-[#004080] cursor-pointer disabled:opacity-30"
                    />
                  </td>
                  <td className="px-8 py-5 text-right">
                    {u.role !== UserRole.ADM && (
                      <button 
                        onClick={() => onDeleteUser(u.id)}
                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-4">
        {users.length > 1 && (
          <button 
            onClick={() => {
              if (window.confirm('Remover todos os usuários exceto Admin? Esta ação não pode ser desfeita.')) {
                onResetUsers?.();
              }
            }}
            className="px-8 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-redo mr-2"></i> Limpar e Manter Apenas Admin
          </button>
        )}
      </div>
      
      <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6 flex items-center gap-6">
         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-200">
            <i className="fa-solid fa-circle-info text-xl"></i>
         </div>
         <div>
            <h4 className="text-xs font-black text-orange-800 uppercase tracking-widest">Informação de Segurança</h4>
            <p className="text-[10px] text-orange-700/70 font-bold uppercase mt-1 leading-relaxed">
              Usuários Solicitantes não aparecem nesta lista pois são detectados automaticamente pelo Agente Microsoft Corporativo. 
              Administradores possuem todas as permissões técnicas por padrão.
            </p>
         </div>
      </div>
    </div>
  );
};
