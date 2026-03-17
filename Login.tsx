
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { NaturgyBranding } from './NaturgyBranding';
import { StorageService } from './storage';
import bcrypt from 'bcryptjs';
import { EmailService } from './emailService';
import { useDialog } from './AppDialog';

interface LoginProps {
  onLogin: (user: User) => void;
  onCreateAccount: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onCreateAccount }) => {
  const { showToast } = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAutoEmail, setIsAutoEmail] = useState(false);
  const [error, setError] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(0); // 0: Login, 1: Email, 2: Code, 3: New Pass

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await StorageService.getUsers();
        setUsers(allUsers);
      } catch (e) {
        console.error('Erro ao carregar usuários:', e);
      }
    };
    fetchUsers();

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
          onLogin(foundUser);
        } else {
          setError('Senha incorreta. Tente novamente.');
        }
      } else {
        setError('E-mail não cadastrado. Por favor, utilize o botão "Criar agora" abaixo.');
      }
    } catch (err) {
      setError('Erro ao processar login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const users = await StorageService.getUsers();
      const user = users.find(u => u.email.toLowerCase() === resetEmail.toLowerCase().trim());

      if (!user) {
        setError('E-mail não encontrado no sistema.');
        setIsLoading(false);
        return;
      }

      const code = await StorageService.requestPasswordReset(resetEmail);
      const emailData = EmailService.generatePasswordResetEmail(user.email, user.name, code);
      await EmailService.send(emailData);
      setResetStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar redefinição');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const isValid = await StorageService.verifyResetToken(resetEmail, resetCodeInput);
      if (isValid) {
        setResetStep(3);
      } else {
        setError('Código inválido ou expirado.');
      }
    } catch (err) {
      setError('Erro ao verificar código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newPassword, salt);
      await StorageService.updateUserPassword(resetEmail, hash);
      setResetStep(0);
      setEmail(resetEmail);
      showToast('Senha redefinida com sucesso!', 'success');
    } catch (err) {
      setError('Erro ao atualizar senha');
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
              <p className="text-slate-300 text-xs font-bold uppercase tracking-widest"></p>
            </div>

            <form onSubmit={handleFormLogin} className="space-y-6">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 flex justify-between items-center">
                  E-mail Corporativo
                  {isAutoEmail && !isDetecting && <span className="text-[8px] text-green-500 font-black tracking-widest uppercase">DETECTADO</span>}
                </label>
                <div className="relative group">
                  <i className={`fa-solid ${isDetecting ? 'fa-circle-notch fa-spin' : 'fa-user-check'} absolute left-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors`}></i>
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
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors"></i>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-sm font-medium text-white placeholder-white/60 focus:border-white/60"
                  />
                </div>
                <div className="flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => { setResetStep(1); setResetEmail(email); setError(''); }}
                    className="text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-orange-400 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>

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

              {!isDetecting && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={onCreateAccount}
                    className="text-[10px] font-black text-white/60 uppercase tracking-widest hover:text-orange-400 transition-colors"
                  >
                    Não possui conta? <span className="text-white border-b border-white/30 ml-1">Criar agora</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Lado Direito */}
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
            </div>
          </div>
        </div>
      </div>

      {/* Modal Redefinição */}
      {resetStep > 0 && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[#004080]/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            <div className="bg-[#004080] p-8 text-center text-white">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <i className={`fa-solid ${resetStep === 1 ? 'fa-envelope' : resetStep === 2 ? 'fa-shield-halved' : 'fa-key'} text-2xl text-blue-200`}></i>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Redefinir Senha</h3>
              <p className="text-blue-100/60 text-[9px] font-black uppercase tracking-widest mt-1">Passo {resetStep} de 3</p>
            </div>

            <div className="p-8">
              {resetStep === 1 && (
                <form onSubmit={handleRequestReset} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">E-mail Corporativo</label>
                    <input
                      type="email" required value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="exemplo@gmail.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#004080] text-sm font-medium"
                    />
                  </div>
                  {error && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight text-center bg-red-50 py-2 rounded-lg">{error}</p>}
                  <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#004080] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all">
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Enviar Código'}
                  </button>
                </form>
              )}

              {resetStep === 2 && (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  <div className="space-y-2 text-center">
                    <p className="text-[11px] text-slate-500 font-medium mb-4">Código enviado para <br /><span className="font-bold text-[#004080]">{resetEmail}</span></p>
                    <input
                      type="text" required maxLength={6} value={resetCodeInput}
                      onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#004080] text-2xl font-black tracking-[0.5em]"
                    />
                  </div>
                  {error && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight text-center bg-red-50 py-2 rounded-lg">{error}</p>}
                  <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#004080] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all">
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Validar Código'}
                  </button>
                </form>
              )}

              {resetStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Nova Senha</label>
                    <input
                      type="password" required value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#004080] text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#004080] uppercase tracking-widest ml-1">Confirmar Senha</label>
                    <input
                      type="password" required value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#004080] text-sm font-medium"
                    />
                  </div>
                  {error && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight text-center bg-red-50 py-2 rounded-lg">{error}</p>}
                  <button type="submit" disabled={isLoading} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black transition-all">
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Atualizar Senha'}
                  </button>
                </form>
              )}

              <button type="button" onClick={() => setResetStep(0)} className="w-full mt-4 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
