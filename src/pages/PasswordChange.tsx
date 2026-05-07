import React, { useState } from 'react';
import { User } from '../types/types';
import { NaturgyBranding } from '../components/NaturgyBranding';
import { StorageService } from '../services/storage';
import bcrypt from 'bcryptjs';


interface PasswordChangeProps {
  user: User;
  onComplete: (updatedUser: User) => void;
}

export const PasswordChange: React.FC<PasswordChangeProps> = ({ user, onComplete }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword === '123456') {
      setError('Você deve escolher uma senha diferente da padrão.');
      return;
    }

    setIsLoading(true);

    try {
      // Criptografar a senha antes de salvar
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);

      // Atualizar no banco
      const updatedUser: User = {
        ...user,
        password: hashedPassword,
        requiresPasswordChange: false
      };
      
      await StorageService.saveUser(updatedUser);
      onComplete(updatedUser);
      
    } catch (err: any) {
      console.error('Erro ao mudar senha:', err);
      setError('Falha ao atualizar senha. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,64,128,0.15)] overflow-hidden border border-white/20">
        <div className="bg-white p-10 text-[#004080] text-center relative border-b border-slate-100">
          <div className="inline-block mb-6">
            <NaturgyBranding />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Segurança Obrigatória</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Alteração de senha no primeiro acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-6">
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
            <i className="fa-solid fa-shield-halved text-orange-500 mt-1"></i>
            <p className="text-[11px] font-medium text-orange-800 leading-relaxed">
              Por segurança, usuários com perfil administrativo devem alterar a senha antes de acessar o portal.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Nova Senha</label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="password"
                required
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
            <div className="relative">
              <i className="fa-solid fa-check-double absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="password"
                required
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <i className="fa-solid fa-circle-exclamation text-red-500"></i>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight">{error}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-5 bg-[#004080] text-white rounded-[1.25rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-[#FF8000] transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
            ) : (
              <>Atualizar e Acessar <i className="fa-solid fa-arrow-right-long"></i></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
