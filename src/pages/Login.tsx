import React, { useState, useEffect } from 'react';
import { User } from '../types/types';
import { NaturgyBranding } from '../components/NaturgyBranding';
import { StorageService } from '../services/storage';
import bcrypt from 'bcryptjs';

interface LoginProps {
  onLogin: (user: User) => void;
  onCreateAccount: (email?: string, password?: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAutoEmail, setIsAutoEmail] = useState(false);
  const [error, setError] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const emailFromMain = window.api ? await window.api.getCorporateEmail() : null;
        if (!cancelled) {
          if (emailFromMain) {
            setEmail(emailFromMain);
            setIsAutoEmail(true);
          }
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
      if (!email.trim() || !password.trim()) {
        setError('Por favor, informe e-mail e senha.');
        setIsLoading(false);
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const latestUsers = await StorageService.getUsers();
      let foundUser = latestUsers.find(u => u.email.toLowerCase() === emailLower);

      if (foundUser) {
        const storedHash = foundUser.password || '';
        let isMatch = false;

        if (storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$'))) {
          try {
            isMatch = bcrypt.compareSync(password, storedHash);
          } catch (e) {
            isMatch = false;
          }
        } else {
          isMatch = password === storedHash || ((!storedHash || storedHash === '') && password === '123456');
        }

        if (isMatch) {
          if (foundUser.isActive === false) {
            setError('Sua conta está inativa. Entre em contato com um administrador.');
            setIsLoading(false);
            return;
          }
          onLogin(foundUser);
        } else {
          setError('Senha incorreta. Tente novamente.');
        }
      } else {
        onCreateAccount(email, password);
      }
    } catch (err) {
      setError(`Erro ao processar login`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col font-sans selection:bg-orange-100">
      <div className="flex-grow flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,64,128,0.15)] overflow-hidden flex flex-col md:flex-row min-h-[620px] border border-white/20">

          {/* Lado Esquerdo */}
          <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-[#004080]">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Autenticação</h2>
            </div>

            <form onSubmit={handleFormLogin} className="space-y-6">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 flex justify-between items-center">
                  E-mail Corporativo
                  {isAutoEmail && !isDetecting && <span className="text-[8px] text-green-500 font-black tracking-widest uppercase">DETECTADO</span>}
                </label>
                <div className="relative group">
                  <i className={`fa-solid ${isDetecting ? 'fa-circle-notch fa-spin' : 'fa-user-check'} absolute left-4 top-1/2 -translate-y-1/2 text-[#004080] transition-colors`}></i>
                  <input
                    type="email"
                    required
                    readOnly={isAutoEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isDetecting ? "Detectando conta..." : "exemplo@gmail.com"}
                    className={`w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-sm font-medium text-white placeholder-white/60 ${isAutoEmail ? 'bg-white/20 border-white/40' : 'focus:border-white/60'}`}
                  />
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 flex justify-between items-center">
                  Senha
                </label>
                <div className="relative group">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-[#004080] transition-colors"></i>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-sm font-medium text-white placeholder-white/60 focus:border-white/60"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-400 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <i className="fa-solid fa-circle-exclamation text-red-400"></i>
                  <p className="text-red-200 text-xs font-bold leading-tight">{error}</p>
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
                  isDetecting ? 'Detectando...' : <>Login <i className="fa-solid fa-arrow-right-long"></i></>
                )}
              </button>

              {!isDetecting && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => onCreateAccount(email, password)}
                    className="text-[10px] font-black text-white/60 uppercase tracking-widest hover:text-orange-400 transition-colors"
                  >
                    Não possui conta? <span className="text-white border-b border-white/30 ml-1">Criar agora</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Lado Direito */}
          <div className="w-full md:w-1/2 bg-white p-8 md:p-16 text-[#004080] flex flex-col relative overflow-hidden text-center justify-between min-h-[600px]">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-60"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-50/20 rounded-full blur-[100px] pointer-events-none"></div>
            
            {/* Logo Section */}
            <div className="relative z-10 pt-4">
              <div className="transform hover:scale-105 transition-all duration-700 ease-out">
                <NaturgyBranding />
              </div>
            </div>

            {/* Hero Section */}
            <div className="relative z-10 flex-grow flex flex-col justify-center py-12">
              <div className="space-y-8">
                <div className="space-y-2">
                  <h1 className="text-4xl md:text-5xl font-[900] tracking-tight leading-[0.9] flex flex-col items-center">
                    <span className="text-[#004080] uppercase opacity-90">Portal de</span>
                    <span className="text-orange-500 uppercase drop-shadow-sm">Planificação</span>
                  </h1>
                </div>
                
                <div className="flex flex-col items-center gap-6">
                  <div className="w-12 h-1 bg-orange-500 rounded-full shadow-lg shadow-orange-200/50"></div>
                  
                  <p className="text-[#004080]/40 text-[9px] md:text-[11px] font-[800] uppercase tracking-[0.5em] leading-none">
                    Área Técnica APR
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Badge */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-4 text-left bg-slate-50/80 backdrop-blur-sm p-5 rounded-[2rem] border border-slate-100/50 shadow-sm transition-all hover:bg-white hover:shadow-md group">
                <div className="w-12 h-12 bg-[#004080] rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-blue-900/20 group-hover:rotate-6 transition-transform">
                  <i className="fa-solid fa-shield-halved text-xl"></i>
                </div>
                <div className="pr-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#004080] mb-0.5">Ambiente Seguro</h4>
                  <p className="text-[10px] text-[#004080]/50 font-semibold leading-tight">Acesso autenticado aos servidores Naturgy.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="p-8 text-center">
        <p className="text-[10px] font-black text-[#004080]/30 uppercase tracking-[0.3em]">© 2026 Naturgy • APR Técnica</p>
      </footer>
    </div>
  );
};
