
import React, { useState } from 'react';
import { User, UserRole } from '../types/types';
import { isValidCorporateEmail, getFormattedDomains } from '../constants/constants';
import bcrypt from 'bcryptjs';
import { useDialog } from '../components/AppDialog';

interface UserManagementProps {
  users: User[];
  onUpdateUser: (user: User) => void;
  onCreateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onResetUsers?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdateUser, onCreateUser, onDeleteUser, onResetUsers }) => {
  const { showAlert } = useDialog();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.ANALISTA);
  const [newPerms, setNewPerms] = useState<('validar' | 'executar' | 'controle_qualidade')[]>([]);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newCompany, setNewCompany] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newGB, setNewGB] = useState('');
  const [newSAP, setNewSAP] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [newPhone, setNewPhone] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newNaturgyUnit, setNewNaturgyUnit] = useState('');
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Usuários Ativos': true,
    'Usuários Inativos': false
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleResetPassword = (user: User) => {
    setUserToReset(user);
  };

  const confirmResetPassword = () => {
    if (userToReset && onUpdateUser) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('123456', salt);
      onUpdateUser({
        ...userToReset,
        password: hashedPassword,
        requiresPasswordChange: true
      });
      showAlert(`Senha do usuário ${userToReset.name} foi resetada para '123456'. O usuário deverá alterar a senha no próximo acesso.`, 'Senha Resetada', 'success');
      setUserToReset(null);
    }
  };

  const toggleUserActive = (user: User) => {
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        isActive: user.isActive === false
      });
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCorporateEmail(newEmail)) {
      showAlert(`Apenas e-mails corporativos são permitidos: ${getFormattedDomains()}`, 'E-mail Inválido', 'warning');
      return;
    }

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        name: newName,
        email: newEmail.toLowerCase(),
        role: newRole,
        permissions: newPerms,
        company: newCompany,
        roleDescription: newRoleDescription,
        gb: newGB,
        sap: newSAP,
        isActive: isActive,
        phone: newPhone,
        area: newArea,
        naturgyUnit: newNaturgyUnit
      });
    } else {
      // Criptografar a senha padrão '123456'
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('123456', salt);

      const newUser: User = {
        id: crypto.randomUUID(),
        name: newName,
        email: newEmail.toLowerCase(),
        role: newRole,
        password: hashedPassword, // Definir senha padrão inicial criptografada
        permissions: newPerms,
        profileComplete: false, // Forçar preenchimento de perfil no primeiro acesso
        requiresPasswordChange: true,
        company: newCompany,
        roleDescription: newRoleDescription,
        gb: newGB,
        sap: newSAP,
        isActive: isActive,
        phone: newPhone,
        area: newArea,
        naturgyUnit: newNaturgyUnit
      };
      onCreateUser(newUser);
    }

    resetForm();
  };

  const resetForm = () => {
    setNewName('');
    setNewEmail('');
    setNewRole(UserRole.ANALISTA);
    setNewPerms([]);
    setNewCompany('');
    setNewRoleDescription('');
    setNewGB('');
    setNewSAP('');
    setIsActive(true);
    setNewPhone('');
    setNewArea('');
    setNewNaturgyUnit('');
    setEditingUser(null);
    setShowCreateForm(false);
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setNewName(user.name);
    setNewEmail(user.email);
    setNewRole(user.role);
    setNewPerms(user.permissions || []);
    setNewCompany(user.company || '');
    setNewRoleDescription(user.roleDescription || '');
    setNewGB(user.gb || '');
    setNewSAP(user.sap || '');
    setIsActive(user.isActive !== false);
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleNewPerm = (perm: 'validar' | 'executar' | 'controle_qualidade') => {
    setNewPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-[#004080] text-white">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-semibold">Gestão de Usuários</h2>
            <p className="text-blue-100/60 text-[10px] font-medium mt-1">Controle de acessos e permissões técnicas</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (showCreateForm) resetForm();
                else setShowCreateForm(true);
              }}
              className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-2 ${showCreateForm ? 'bg-red-500 text-white' : 'bg-orange-500 text-white shadow-lg shadow-orange-900/20 hover:bg-white hover:text-orange-500'}`}
            >
              {showCreateForm ? <><i className="fa-solid fa-xmark"></i> Cancelar</> : <><i className="fa-solid fa-user-plus"></i> Novo Analista</>}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateSubmit} className="p-10 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">E-mail Corporativo</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium cursor-text transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Empresa</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  placeholder="E.g. NIP do Brasil"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium transition-colors cursor-text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Cargo / Descrição</label>
                <input
                  type="text"
                  value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  placeholder="E.g. Assistente Técnico"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium transition-colors cursor-text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Usuário</label>
                <input
                  type="text"
                  value={newGB}
                  onChange={e => setNewGB(e.target.value)}
                  placeholder="ex: rsalmeida"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium transition-colors cursor-text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">GB (Código SAP)</label>
                <input
                  type="text"
                  value={newSAP}
                  onChange={e => setNewSAP(e.target.value)}
                  placeholder="ex: 00805217"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100 text-sm font-medium transition-colors cursor-text"
                />
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 pt-6 col-span-1 md:col-span-3 border-t border-slate-200 mt-2">
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newPerms.includes('validar')}
                      onChange={() => toggleNewPerm('validar')}
                      className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">Validar</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newPerms.includes('executar')}
                      onChange={() => toggleNewPerm('executar')}
                      className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">Executar</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newPerms.includes('controle_qualidade')}
                      onChange={() => toggleNewPerm('controle_qualidade')}
                      className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">Controle Qualidade</span>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-6 mt-1 sm:mt-0">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => setIsActive(!isActive)}
                      className="w-5 h-5 rounded border-slate-300 text-[#004080] focus:ring-[#004080] cursor-pointer"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-[#004080] transition-colors">{isActive ? 'Conta Ativa' : 'Conta Inativa'}</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className={`px-8 py-3 w-full sm:w-auto mt-4 sm:mt-0 ${editingUser ? 'bg-indigo-600' : 'bg-[#004080]'} text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all active:scale-95 shadow-lg hover:shadow-orange-200 flex-shrink-0`}
                >
                  {editingUser ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Usuário</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Papel</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Validar Cadastro</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Executar Estudo</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Controle Qualidade</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Status</th>
                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: 'Usuários Ativos', list: users.filter(u => u.role !== UserRole.SOLICITANTE && u.isActive !== false), icon: 'fa-user-check', color: 'text-[#004080]', bgColor: 'bg-blue-50/30' },
                { label: 'Usuários Inativos', list: users.filter(u => u.role !== UserRole.SOLICITANTE && u.isActive === false), icon: 'fa-user-slash', color: 'text-red-500', bgColor: 'bg-red-50/30' }
              ].map(group => group.list.length > 0 && (
                <React.Fragment key={group.label}>
                  <tr className={`${group.bgColor} border-y border-slate-100/50 cursor-pointer hover:bg-slate-100/50 transition-colors`} onClick={() => toggleGroup(group.label)}>
                    <td colSpan={7} className="px-8 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${group.color === 'text-[#004080]' ? 'bg-[#004080]' : 'bg-red-500'} animate-pulse`}></div>
                        <i className={`fa-solid ${group.icon} text-[10px] ${group.color} opacity-70`}></i>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${group.color} opacity-80`}>{group.label}</span>
                        <span className="ml-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-white/80 px-2 py-0.5 rounded-full border border-slate-100 shadow-sm backdrop-blur-sm">
                          {group.list.length} {group.list.length === 1 ? 'Usuário' : 'Usuários'}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                             {expandedGroups[group.label] ? 'Recolher' : 'Expandir'}
                           </span>
                           <i className={`fa-solid ${expandedGroups[group.label] ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-400 transition-transform duration-300`}></i>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedGroups[group.label] && group.list.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 group transition-colors duration-200">
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-semibold text-[#004080]">{u.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{u.email}</p>
                        {(u.company || u.roleDescription || u.gb || u.sap) && (
                          <p className="text-[10px] text-slate-500 mt-1.5 flex flex-wrap items-center gap-1.5">
                            <i className="fa-solid fa-briefcase text-slate-300 text-[9px]"></i>
                            <span>{u.company || '-'}</span>
                            <span className="text-slate-200">•</span>
                            <span>{u.roleDescription || '-'}</span>
                            <span className="text-slate-200">•</span>
                            <span className="text-slate-400">Usuário: {u.gb || '-'}</span>
                            <span className="text-slate-200">•</span>
                            <span className="text-orange-600 font-medium">GB: {u.sap || '-'}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === UserRole.ADM ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <input
                          type="checkbox"
                          disabled
                          checked={u.permissions?.includes('validar') || u.role === UserRole.ADM}
                          readOnly
                          className="w-5 h-5 rounded border-slate-200 text-[#004080] bg-slate-100 cursor-not-allowed opacity-60"
                        />
                      </td>
                      <td className="px-8 py-5 text-center">
                        <input
                          type="checkbox"
                          disabled
                          checked={u.permissions?.includes('executar') || u.role === UserRole.ADM}
                          readOnly
                          className="w-5 h-5 rounded border-slate-200 text-[#004080] bg-slate-100 cursor-not-allowed opacity-60"
                        />
                      </td>
                      <td className="px-8 py-5 text-center">
                        <input
                          type="checkbox"
                          disabled
                          checked={u.permissions?.includes('controle_qualidade') || u.role === UserRole.ADM}
                          readOnly
                          className="w-5 h-5 rounded border-slate-200 text-[#004080] bg-slate-100 cursor-not-allowed opacity-60"
                        />
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.isActive !== false ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                          {u.isActive !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(u)}
                            className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-[#004080] hover:text-white transition-all flex items-center justify-center border border-blue-100"
                            title="Editar Perfil"
                          >
                            <i className="fa-solid fa-user-pen"></i>
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center border border-amber-100"
                            title="Redefinir Senha"
                          >
                            <i className="fa-solid fa-key"></i>
                          </button>
                          <button
                            onClick={() => toggleUserActive(u)}
                            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border ${u.isActive !== false
                              ? 'bg-red-50 text-red-500 hover:bg-red-600 hover:text-white border-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border-green-100'
                              }`}
                            title={u.isActive !== false ? 'Desativar Usuário' : 'Ativar Usuário'}
                          >
                            <i className={`fa-solid ${u.isActive !== false ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                          </button>
                          {u.role !== UserRole.ADM && (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center border border-slate-100"
                              title="Remover Usuário"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#004080]/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            <div className="bg-red-500 p-8 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                <i className="fa-regular fa-trash-can text-2xl"></i>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Confirmar Exclusão</h3>
            </div>

            <div className="p-10 text-center space-y-6">
              <p className="text-slate-600 font-medium">
                Deseja realmente remover o acesso de <span className="font-black text-[#004080]">{userToDelete.name}</span>?
                Esta ação enviará todos os dados associados para a lixeira e não pode ser desfeita.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="py-2.5 px-4 bg-slate-50 text-slate-400 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onDeleteUser(userToDelete.id);
                    setUserToDelete(null);
                  }}
                  className="py-2.5 px-4 bg-red-500 text-white rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Confirmação de Reset de Senha */}
      {userToReset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#004080]/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            <div className="bg-amber-500 p-8 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                <i className="fa-solid fa-key text-2xl"></i>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Resetar Senha</h3>
            </div>

            <div className="p-10 text-center space-y-6">
              <p className="text-slate-600 font-medium">
                Tem certeza que deseja resetar a senha do usuário <span className="font-black text-[#004080]">{userToReset.name}</span>?
              </p>
              <p className="text-sm text-slate-500">
                A senha será definida como <span className="font-black text-amber-600">"123456"</span> e o usuário deverá alterá-la no próximo acesso.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUserToReset(null)}
                  className="py-2.5 px-4 bg-slate-50 text-slate-400 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmResetPassword}
                  className="py-2.5 px-4 bg-amber-500 text-white rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
