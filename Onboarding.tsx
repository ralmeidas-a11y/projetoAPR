
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { NaturgyLogo, REQUESTER_AREAS } from '../constants';
import { StorageService } from '../services/storage';

interface OnboardingProps {
  user: User;
  onComplete: (updatedUser: User, folderPaths?: any) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  // Tutorial estados
  const [showTutorial, setShowTutorial] = useState(true);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  
  // Perfil estados
  const [name, setName] = useState(user.name);
  const [area, setArea] = useState(user.area || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [naturgyUnit, setNaturgyUnit] = useState(user.naturgyUnit || '');
  const [isLoading, setIsLoading] = useState(false);
  
  // Success screen
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Verificar se pasta já existe ao montar componente
  useEffect(() => {
    const checkExistingFolder = async () => {
      if (window.api?.checkUserFolder) {
        try {
          const result = await window.api.checkUserFolder(user.name);
          if (result.exists) {
            console.log('📁 Pasta do usuário já existe:', user.name);
            // Pular o tutorial e ir direto para o perfil
            setShowTutorial(false);
          }
        } catch (error) {
          console.warn('Erro ao verificar pasta:', error);
          // Se houver erro, continua normalmente com o tutorial
        }
      }
    };
    
    checkExistingFolder();
  }, [user.name]);

  const allStepsCompleted = step1Done && step2Done && step3Done;

  const handleCompleteStep = (step: number) => {
    if (step === 1) setStep1Done(true);
    if (step === 2) setStep2Done(true);
    if (step === 3) setStep3Done(true);
  };

  const handleProceedToProfile = () => {
    setShowTutorial(false);
  };

  const openLinkWithEdge = async (url: string) => {
    if (window.api?.openExternalLinkWithEdge) {
      try {
        await window.api.openExternalLinkWithEdge(url);
      } catch (error) {
        console.warn('Erro ao abrir link com Edge:', error);
        // Fallback para abrir normalmente
        window.open(url, '_blank');
      }
    } else {
      // Fallback se API não disponível
      window.open(url, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !area || !phone.trim() || !naturgyUnit) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    setIsLoading(true);
      try {
        // Criar pasta do usuário no SharePoint (IPC call ao Electron)
        // Com timeout para não travara tela
        let createdFolderPath: string | null = null;
        if (window.api?.createUserFolder) {
          const userName = name.trim();
          console.log('📁 Criando pasta do usuário no SharePoint:', userName);
          
          try {
            // Timeout de 10 segundos para a chamada IPC
            const folderPromise = window.api.createUserFolder(userName);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout ao criar pasta SharePoint')), 10000)
            );
            
            const folderResult = await Promise.race([folderPromise, timeoutPromise]);
            
            if (!folderResult.success) {
              console.warn('⚠️ Aviso ao criar pasta SharePoint:', folderResult.error);
            } else {
              console.log('✓ Pasta do usuário criada no SharePoint');
              createdFolderPath = folderResult.userFolderPath || null;
            }
          } catch (ipcErr) {
            console.warn('⚠️ Erro ao chamar createUserFolder:', ipcErr);
            // Continuar mesmo com erro (pode estar offline ou SharePoint não disponível)
          }
        }

      const updatedUser: User = {
        ...user,
        name: name.trim(),
        area,
        phone: phone.trim(),
        naturgyUnit,
        profileComplete: true,
        lastAccess: new Date().toISOString(),
      };

      const users = StorageService.getUsers();
      const userIndex = users.findIndex(u => u.id === user.id);
      if (userIndex >= 0) {
        users[userIndex] = updatedUser;
        StorageService.saveUsers(users);
      }

      setShowSuccess(true);
      setTimeout(() => {
        onComplete(updatedUser, { userFolderPath: createdFolderPath });
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Erro ao atualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== TELA 1: TUTORIAL ==========
  if (showTutorial) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
        <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-[0_30px_70px_-20px_rgba(0,64,128,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-[#004080] p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-xl mb-6 transform -rotate-2">
              <NaturgyLogo />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Bem-vindo!</h2>
            <p className="text-blue-100/60 text-xs font-bold uppercase tracking-widest mt-2">Vamos configurar seu acesso</p>
          </div>

          <div className="p-10 md:p-16 space-y-8">
            <div className="text-center mb-10">
              <p className="text-slate-600 text-lg font-bold mb-8">Antes de começar, complete 3 passos simples:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-6 rounded-2xl border-2 transition-all ${step1Done ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="font-black text-[#004080] uppercase text-sm mb-3 flex items-center gap-2">
                  <span className={step1Done ? 'text-green-600' : 'text-slate-400'}>1️⃣</span>
                  Teams
                </h3>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">Entre na equipe de colaboração</p>
                <button
                  onClick={() => {
                    openLinkWithEdge('https://teams.microsoft.com/l/team/19%3aNF5u5JDuqkt6B5MgL_atu6_9gs9CInc8ScQPwHAJ0HA1%40thread.tacv2/conversations?groupId=1c82b5d7-4b20-45d8-93ba-c47c5ee71d95&tenantId=31c04b5b-a8f4-4bc9-8f54-0046a6e70f35');
                    setStep1Done(true);
                  }}
                  className="w-full px-3 py-2 bg-[#0078D4] text-white rounded-lg font-bold text-xs hover:bg-[#106EBE] transition-all"
                >
                  Acessar
                </button>
              </div>

              <div className={`p-6 rounded-2xl border-2 transition-all ${step2Done ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'} ${!step1Done ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}`}>
                <h3 className="font-black text-[#004080] uppercase text-sm mb-3 flex items-center gap-2">
                  <span className={step2Done ? 'text-green-600' : 'text-slate-400'}>2️⃣</span>
                  SharePoint
                </h3>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">Sincronize os documentos</p>
                <button
                  onClick={() => {
                    openLinkWithEdge('https://gasnatural.sharepoint.com/sites/SolicitaWebEstu/Documentos%20compartidos/Forms/AllItems.aspx');
                    setStep2Done(true);
                  }}
                  disabled={!step1Done}
                  className="w-full px-3 py-2 bg-[#107C10] text-white rounded-lg font-bold text-xs hover:enabled:bg-[#0D6B0D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Acessar
                </button>
              </div>

              <div className={`p-6 rounded-2xl border-2 transition-all ${step3Done ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'} ${!step1Done || !step2Done ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}`}>
                <h3 className="font-black text-[#004080] uppercase text-sm mb-3 flex items-center gap-2">
                  <span className={step3Done ? 'text-green-600' : 'text-slate-400'}>3️⃣</span>
                  Sincronizar
                </h3>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">Ativar no seu OneDrive</p>
                <button 
                  onClick={() => setStep3Done(true)}
                  disabled={!step1Done || !step2Done}
                  className="w-full px-3 py-2 bg-[#004080] text-white rounded-lg font-bold text-xs hover:enabled:bg-[#003060] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Pronto
                </button>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200">
              <button 
                onClick={handleProceedToProfile}
                disabled={!allStepsCompleted}
                className="w-full py-4 bg-[#004080] text-white rounded-2xl font-black uppercase text-sm tracking-wide hover:enabled:bg-[#FF8000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {allStepsCompleted ? '✓ Continuar para Perfil' : '⏳ Complete os 3 passos para continuar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== TELA 2: PREENCHIMENTO DE PERFIL ==========
  if (!showTutorial && !showSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
        <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-[0_30px_70px_-20px_rgba(0,64,128,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-[#004080] p-10 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-xl mb-6 transform -rotate-2">
              <NaturgyLogo />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Primeiro Acesso</h2>
            <p className="text-blue-100/60 text-xs font-bold uppercase tracking-widest mt-2">Personalize seu perfil corporativo</p>
          </div>

          <form onSubmit={handleSubmit} className="p-10 md:p-16 space-y-8">
            <div className="text-center mb-10">
              <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
                Para agilizar suas futuras solicitações, confirme seus dados de contato apenas uma vez.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="space-y-2 col-span-2 md:col-span-1">
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

              <div className="space-y-2 col-span-2 md:col-span-1">
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

              <div className="space-y-2 col-span-2">
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
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-[#004080] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-100 hover:bg-[#FF8000] hover:shadow-orange-100 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 mt-10"
            >
              {isLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
              ) : (
                <>Finalizar Onboarding <i className="fa-solid fa-arrow-right-long"></i></>
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
