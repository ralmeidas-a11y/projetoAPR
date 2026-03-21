
import React, { useState, useEffect } from 'react';
import { User } from '../types/types';
import { NaturgyLogo, REQUESTER_AREAS } from '../constants/constants';
import { StorageService } from '../services/storage';
import bcrypt from 'bcryptjs';
import { useDialog } from '../components/AppDialog';


interface OnboardingProps {
  user: User;
  onComplete: (updatedUser: User, folderPaths?: any) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  const { showAlert } = useDialog();
  // Perfil estados
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [area, setArea] = useState(user.area || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [naturgyUnit, setNaturgyUnit] = useState(user.naturgyUnit || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Success screen
  const [showSuccess, setShowSuccess] = useState(false);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !area || !phone.trim() || !naturgyUnit || !password) {
      showAlert('Por favor, preencha todos os campos, incluindo a senha', 'Campos Obrigatórios', 'warning');
      return;
    }

    if (password.length < 6) {
      showAlert('A senha deve ter pelo menos 6 caracteres', 'Senha Inválida', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('As senhas não coincidem', 'Senha Inválida', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const userEmail = email.trim().toLowerCase();

      // Criptografar a senha antes de salvar
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);

      const updatedUser: User = {
        ...user,
        name: name.trim(),
        email: userEmail,
        area,
        phone: phone.trim(),
        naturgyUnit,
        password: hashedPassword,
        profileComplete: true,
        requiresPasswordChange: false,
        lastAccess: new Date().toISOString(),
      };

      const savedUser = await StorageService.saveUser(updatedUser);

      setShowSuccess(true);
      setTimeout(() => {
        onComplete(savedUser);
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      showAlert('Erro ao atualizar perfil', 'Erro', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== TELA: PREENCHIMENTO DE PERFIL ==========
  if (!showSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
        <div className="w-full max-w-4xl bg-white rounded-[3rem] shadow-[0_30px_70px_-20px_rgba(0,64,128,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white p-10 text-[#004080] text-center relative border-b border-slate-100">
            <div className="inline-block mb-6">
              <NaturgyLogo />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Primeiro Acesso</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Personalize seu perfil corporativo</p>
            
            {/* Botão de Voltar */}
            <button 
              onClick={() => window.location.reload()} 
              className="absolute top-6 left-6 w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all text-slate-400 border border-slate-100"
              title="Voltar ao Login"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-10 md:p-16 space-y-8">
            <div className="text-center mb-10">
              <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
                Para agilizar suas futuras solicitações, confirme seus dados de contato apenas uma vez.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 col-span-1">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">E-mail Corporativo</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!!user.email && user.email !== ''}
                  className={`w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700 ${!!user.email && user.email !== '' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="exemplo@gmail.com"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700"
                  placeholder="Ex: João da Silva"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Unidade</label>
                <select 
                  required
                  value={naturgyUnit}
                  onChange={(e) => setNaturgyUnit(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700 appearance-none"
                >
                  <option value="">Selecione...</option>
                  <option value="Capital">Capital</option>
                  <option value="Interior">Interior</option>
                  <option value="SPS">SPS</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Telefone / Ramal</label>
                <input 
                  type="text" 
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700"
                  placeholder="(21) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Área</label>
                <select 
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700 appearance-none"
                >
                  <option value="">Selecione...</option>
                  {REQUESTER_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Seção de Senha */}
              <div className="md:col-span-3 border-t border-slate-100 pt-8 mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1 flex items-center gap-2">
                    <i className="fa-solid fa-lock text-[#FF8000]"></i> Definir Senha de Acesso
                  </label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Confirmar Senha</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#004080] focus:bg-white transition-all text-sm font-medium text-slate-700"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-[#004080] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-100 hover:bg-[#FF8000] hover:shadow-orange-100 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 mt-10"
            >
              {isLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
              ) : (
                <>Finalizar Cadastro <i className="fa-solid fa-arrow-right-long"></i></>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========== TELA 3: SUCESSO ==========
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-xl bg-white rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,64,128,0.25)] overflow-hidden animate-in zoom-in-95 duration-500 border border-white">
        <div className="bg-[#004080] p-12 text-center text-white relative">
           <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20">
              <i className="fa-solid fa-check text-4xl text-green-400"></i>
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tight">Perfil Atualizado!</h2>
           <p className="text-blue-100/60 text-xs font-bold uppercase tracking-widest mt-3">Você já pode acessar o Portal Técnico</p>
        </div>

        <div className="p-12 text-center space-y-10">
           <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#004080] uppercase tracking-widest">✓ Dados Pessoais Confirmados</h3>
                <p className="text-slate-600 text-[13px] leading-relaxed font-medium">
                  Seu perfil está pronto. As pastas para suas solicitações serão criadas automaticamente quando você gerar a primeira solicitação.
                </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
