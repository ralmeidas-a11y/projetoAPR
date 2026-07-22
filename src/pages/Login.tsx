import React, { useState, useEffect } from 'react';
import { User } from '../types/types';
import { NaturgyBranding } from '../components/NaturgyBranding';
import { StorageService } from '../services/storage';
import { EmailService } from '../services/emailService';
import bcrypt from 'bcryptjs';

interface LoginProps {
  onLogin: (user: User) => void;
  onCreateAccount: (email?: string, password?: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const [isAutoEmail, setIsAutoEmail] = useState(false);
  const [error, setError] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'newPassword'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotGeneratedCode, setForgotGeneratedCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotUser, setForgotUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Primeiro tenta carregar do main
        const emailFromMain = window.api ? await window.api.getCorporateEmail() : null;

        // Se não houver do main, tenta do localStorage (Remember Me)
        const savedData = localStorage.getItem('remembered_user');
        if (savedData) {
          try {
            const { email: savedEmail, password: savedPassword } = JSON.parse(savedData);
            if (savedEmail) {
              setEmail(savedEmail);
              if (savedPassword) {
                setPassword(savedPassword);
                if (passwordRef.current) passwordRef.current.value = savedPassword;
              }
              setRememberMe(true);
            }
          } catch (e) { /* ignore parse error */ }
        }

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

      const loginIdentifier = email.trim();
      const emailLower = loginIdentifier.toLowerCase();
      const latestUsers = await StorageService.getUsers();

      // Busca por email OU por SAP (GB)
      let foundUser = latestUsers.find(u =>
        u.email.toLowerCase() === emailLower ||
        (u.sap && String(u.sap).trim() === loginIdentifier) ||
        (u.gb && String(u.gb).trim() === loginIdentifier)
      );

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

          // Se o usuário marcou para lembrar, salvar as infos
          if (rememberMe) {
            localStorage.setItem('remembered_user', JSON.stringify({ email, password }));
          } else {
            localStorage.removeItem('remembered_user');
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

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Informe seu e-mail ou GB.');
      return;
    }
    try {
      const users = await StorageService.getUsers();
      const found = users.find(u =>
        u.email.toLowerCase() === forgotEmail.trim().toLowerCase() ||
        (u.sap && String(u.sap).trim() === forgotEmail.trim()) ||
        (u.gb && String(u.gb).trim() === forgotEmail.trim())
      );
      if (!found) {
        setForgotError('Usuário não encontrado.');
        return;
      }
      setForgotUser(found);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setForgotGeneratedCode(code);

      const emailData = EmailService.generatePasswordResetEmail(
        found.email,
        found.name || found.email,
        code,
      );
      await EmailService.openInOutlook(emailData);

      setForgotStep('code');
      setForgotSuccess(`Código de 6 dígitos enviado para ${found.email}. Verifique sua caixa de entrada.`);
    } catch {
      setForgotError('Erro ao enviar e-mail de recuperação.');
    }
  };

  const handleVerifyCode = () => {
    setForgotError('');
    if (forgotCode.trim() !== forgotGeneratedCode) {
      setForgotError('Código incorreto. Tente novamente.');
      return;
    }
    setForgotStep('newPassword');
  };

  const handleResetPassword = async () => {
    setForgotError('');
    if (!forgotNewPassword.trim() || !forgotConfirmPassword.trim()) {
      setForgotError('Preencha todos os campos.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('As senhas não coincidem.');
      return;
    }
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(forgotNewPassword, salt);
      await StorageService.saveUser({ ...forgotUser!, password: hash });
      setForgotSuccess('Senha redefinida com sucesso! Faça login com a nova senha.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('email');
        setForgotEmail('');
        setForgotCode('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotSuccess('');
      }, 2000);
    } catch {
      setForgotError('Erro ao redefinir senha.');
    }
  };

  const resetForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('email');
    setForgotEmail('');
    setForgotCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotUser(null);
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
                  E-mail ou GB
                  {isAutoEmail && !isDetecting && <span className="text-[8px] text-green-500 font-black tracking-widest uppercase">DETECTADO</span>}
                </label>
                <div className="relative group">
                  <i className={`fa-solid ${isDetecting ? 'fa-circle-notch fa-spin' : 'fa-user-check'} absolute left-4 top-1/2 -translate-y-1/2 text-[#004080] transition-colors`}></i>
                  <input
                    type="text"
                    required
                    readOnly={isAutoEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isDetecting ? "Detectando conta..." : "E-mail ou GB"}
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
                    ref={passwordRef}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-sm font-medium text-white placeholder-white/60 focus:border-white/60"
                  />
                </div>
              </div>

              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={() => { setShowForgotModal(true); setForgotEmail(email); }}
                  className="text-[9px] font-black text-white/50 uppercase tracking-widest hover:text-orange-400 transition-colors"
                >
                  Esqueci a senha
                </button>
              </div>

              <div className="flex items-center gap-3 px-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-white/30 rounded-lg bg-white/5 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                      <i className={`fa-solid fa-check text-[10px] text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`}></i>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest group-hover:text-white transition-colors">Salvar informações</span>
                </label>
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
                    <span className="text-[#004080] uppercase opacity-90">Portal de Planificação</span>
                    <span className="text-orange-500 uppercase drop-shadow-sm"> de Rede  </span>
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

      {/* Modal Esqueci a Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={resetForgotModal}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#004080] p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-key"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">Redefinir Senha</h3>
                    <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest">
                      {forgotStep === 'email' && 'Passo 1 de 3 — Informe seu e-mail'}
                      {forgotStep === 'code' && 'Passo 2 de 3 — Verifique o código'}
                      {forgotStep === 'newPassword' && 'Passo 3 de 3 — Nova senha'}
                    </p>
                  </div>
                </div>
                <button onClick={resetForgotModal} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 flex gap-2">
                {['email', 'code', 'newPassword'].map((step, i) => (
                  <div key={step} className={`flex-1 h-1 rounded-full transition-all ${i <= ['email', 'code', 'newPassword'].indexOf(forgotStep) ? 'bg-orange-400' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {forgotStep === 'email' && (
                <>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Informe o e-mail ou GB da conta para receber o código de recuperação.
                  </p>
                  <div className="relative">
                    <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input
                      type="text"
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                      placeholder="E-mail ou GB"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm"
                    />
                  </div>
                </>
              )}

              {forgotStep === 'code' && (
                <>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Um código de 6 dígitos foi enviado para <strong className="text-[#004080]">{forgotUser?.email}</strong>. Verifique sua caixa de entrada.
                  </p>
                  <div className="relative">
                    <i className="fa-solid fa-shield-halved absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input
                      type="text"
                      autoFocus
                      maxLength={6}
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                      placeholder="000000"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm tracking-[0.3em] font-mono text-center text-lg"
                    />
                  </div>
                </>
              )}

              {forgotStep === 'newPassword' && (
                <>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Crie uma nova senha para sua conta.
                  </p>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input
                      type="password"
                      autoFocus
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input
                      type="password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      placeholder="Confirmar nova senha"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm"
                    />
                  </div>
                </>
              )}

              {forgotError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <i className="fa-solid fa-circle-exclamation text-red-400 text-sm"></i>
                  <p className="text-red-600 text-xs font-bold">{forgotError}</p>
                </div>
              )}

              {forgotSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <i className="fa-solid fa-circle-check text-green-500 text-sm"></i>
                  <p className="text-green-700 text-xs font-bold">{forgotSuccess}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={resetForgotModal}
                className="flex-1 py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-xl border border-slate-100"
              >
                Cancelar
              </button>
              {forgotStep === 'email' && (
                <button
                  onClick={handleForgotPassword}
                  className="flex-[2] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-[#004080] text-white shadow-lg shadow-blue-900/20 hover:bg-[#003060] transition-all active:scale-[0.98]"
                >
                  Enviar Código
                </button>
              )}
              {forgotStep === 'code' && (
                <button
                  onClick={handleVerifyCode}
                  className="flex-[2] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-[#004080] text-white shadow-lg shadow-blue-900/20 hover:bg-[#003060] transition-all active:scale-[0.98]"
                >
                  Verificar Código
                </button>
              )}
              {forgotStep === 'newPassword' && (
                <button
                  onClick={handleResetPassword}
                  className="flex-[2] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all active:scale-[0.98]"
                >
                  Redefinir Senha
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
