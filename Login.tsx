
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { NaturgyBranding } from './NaturgyBranding';
import { StorageService } from '../services/storage';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showTestProfiles, setShowTestProfiles] = useState(false);

  useEffect(() => {
    const allUsers = StorageService.getUsers();
    setUsers(allUsers);
    // Request corporate email from the Electron main process (preload)
    let cancelled = false;
    (async () => {
      try {
        const emailFromMain = window.api ? await window.api.getCorporateEmail() : null;
        if (!cancelled) {
          if (emailFromMain) setEmail(emailFromMain);
          setIsDetecting(false);
        }
      } catch (e) {
        if (!cancelled) setIsDetecting(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email.trim()) {
        setError('Por favor, informe seu e-mail corporativo');
        setIsLoading(false);
        return;
      }

      // Procura o usuário por email (busca case-insensitive)
      const emailLower = email.toLowerCase().trim();
      let foundUser = users.find(u => u.email.toLowerCase() === emailLower);
      
      if (foundUser) {
        // OPÇÃO 1: Usuário já existe no sistema
        console.log('✅ Usuário encontrado:', foundUser.email, 'Profile Complete:', foundUser.profileComplete);
        
        // Se o usuário é solicitante E profileComplete é false, verifica se a pasta existe no SharePoint
        // Se profileComplete já é true, significa que passou pelo onboarding e dados estão válidos
        if (foundUser.role === UserRole.SOLICITANTE && !foundUser.profileComplete && window.api?.checkUserFolder && foundUser.name) {
          console.log('🔍 Verificando pasta do usuário no SharePoint...');
          try {
            // Timeout de 8 segundos para a verificação SharePoint
            const checkPromise = window.api.checkUserFolder(foundUser.name);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout ao verificar pasta SharePoint')), 8000)
            );
            
            const checkResult = await Promise.race([checkPromise, timeoutPromise]);
            console.log('📁 Resultado da verificação:', checkResult);
            
            if (checkResult.exists) {
              console.log('✅ Pasta encontrada. Marcando perfil como completo...');
              // Marca como completo já que a pasta existe
              foundUser.profileComplete = true;
              // Atualiza no storage
              const updatedUsers = users.map(u => u.id === foundUser.id ? foundUser : u);
              StorageService.saveUsers(updatedUsers);
            } else {
              console.log('⚠️ Pasta não encontrada. Forçando onboarding...');
              foundUser.profileComplete = false;
            }
          } catch (err) {
            console.warn('⚠️ Erro ao verificar pasta SharePoint:', err);
            // Continua mesmo com erro (pode estar offline)
            // Não força redesenho do onboarding se estiver offline
          }
        }
        
        onLogin(foundUser);
      } else {
        // OPÇÃO 2: Novo usuário - cria como Solicitante com profileComplete = false
        console.log('🆕 Novo usuário detectado:', emailLower);
        const newSolicitante: User = {
          id: emailLower.split('@')[0], // Usa parte do email como ID
          name: '', // Vazio - será preenchido no onboarding
          role: UserRole.SOLICITANTE,
          email: emailLower,
          profileComplete: false, // IMPORTANTE: sempre false para forçar onboarding
          lastAccess: new Date().toISOString(),
        };
        
        // Salva o novo usuário no storage
        const updatedUsers = [...users, newSolicitante];
        StorageService.saveUsers(updatedUsers);
        setUsers(updatedUsers);
        
        console.log('💾 Novo usuário salvo. Redirecionando para onboarding...');
        // Faz login com o novo usuário (o App.tsx vai redirecionar para onboarding)
        onLogin(newSolicitante);
      }
    } catch (err) {
      console.error('❌ Erro no login:', err);
      setError('Erro ao processar login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (user: User) => {
    setIsLoading(true);
    setTimeout(() => onLogin(user), 500);
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col font-sans selection:bg-orange-100">
      {/* Window Controls Header */}
      <div className="flex justify-end gap-2 p-4 bg-white border-b border-slate-200">
        <button onClick={() => (window as any).api?.minimizeWindow?.()} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center" title="Minimizar janela">
          <i className="fa-solid fa-minus text-xs"></i>
        </button>
        <button onClick={() => (window as any).api?.closeApp?.()} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center" title="Fechar aplicação">
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      <div className="flex-grow flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,64,128,0.15)] overflow-hidden flex flex-col md:flex-row min-h-[620px] border border-white/20">
        
        {/* Lado Esquerdo - Formulário Autopreenchido */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-[#004080]">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Autenticação</h2>
            <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">Acesso via Microsoft Account</p>
          </div>

          <form onSubmit={handleFormLogin} className="space-y-6">
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 flex justify-between items-center">
                E-mail Corporativo
                {email && !isDetecting && <span className="text-[8px] text-green-500 font-black tracking-widest uppercase"></span>}
              </label>
              <div className="relative group">
                <i className={`fa-solid ${isDetecting ? 'fa-circle-notch fa-spin' : 'fa-user-check'} absolute left-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors`}></i>
                <input 
                  type="email"
                  required
                  readOnly={!isDetecting && email !== ''}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isDetecting ? "Detectando conta..." : "usuario@naturgy.com"}
                  className={`w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-sm font-medium text-white placeholder-white/60 ${!isDetecting && email ? 'bg-white/20 border-white/40' : ''}`}
                />
              </div>
            </div>

            {/* Token removido: o agente já fornece a conta corporativa conectada; apenas exibimos o e-mail */}

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-400 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <i className="fa-solid fa-circle-exclamation text-red-300"></i>
                <p className="text-[11px] font-bold text-red-200 uppercase tracking-tight">{error}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading || isDetecting}
              className={`w-full py-5 rounded-[1.25rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 ${isDetecting ? 'bg-white/20 text-white/60' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/50 hover:shadow-orange-600/50'}`}
            >
              {isLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
              ) : (
                isDetecting ? 'Aguardando Agente...' : <>Login <i className="fa-solid fa-arrow-right-long"></i></>
              )}
            </button>
          </form>

          {/* Quick Access Toggle - Importante para manter a flexibilidade de testes */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <button 
              onClick={() => setShowTestProfiles(!showTestProfiles)}
              className="flex items-center gap-2 text-[10px] font-black text-white/60 uppercase tracking-widest hover:text-white transition-colors mx-auto"
            >
              <i className={`fa-solid ${showTestProfiles ? 'fa-chevron-up' : 'fa-flask'} transition-transform`}></i>
              {showTestProfiles ? 'Ocultar Simulações' : 'Simular Outros Perfis de Acesso'}
            </button>

            {showTestProfiles && (
              <div className="grid grid-cols-1 gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-300">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleQuickLogin(user)}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] ${
                        user.role === UserRole.SOLICITANTE ? 'bg-white/20 text-white' : 
                        user.role === UserRole.ANALISTA ? 'bg-orange-500/30 text-orange-200' : 'bg-indigo-500/30 text-indigo-200'
                      }`}>
                        <i className={`fa-solid ${
                          user.role === UserRole.SOLICITANTE ? 'fa-user-edit' : 
                          user.role === UserRole.ANALISTA ? 'fa-user-cog' : 'fa-user-shield'
                        }`}></i>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-white uppercase leading-none">{user.name}</p>
                        <p className="text-[8px] text-white/70 font-bold uppercase mt-1">{user.role}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito - Branding & Status da Integração */}
        <div className="w-full md:w-1/2 bg-white p-12 text-[#004080] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-100 rounded-full -ml-24 -mb-24 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="inline-block mb-16 transform -rotate-2">
              <div className="scale-125 origin-top-left">
                <NaturgyBranding />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight mb-4 text-[#004080]">
              Portal de Solicitações de <br />
              <span className="text-orange-500">Estudo de Rede</span>
            </h1>
            
            <div className="mt-8 space-y-4">
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
