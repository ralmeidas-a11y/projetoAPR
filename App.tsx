
import React, { useState, useEffect, useMemo } from 'react';
import { SelectionMenu } from './components/SelectionMenu';
import { FormContainer } from './components/FormContainer';
import { Login } from './components/Login';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { MyRequests } from './components/MyRequests';
import { UserManagement } from './components/UserManagement';
import { TechnicalExecutionPanel } from './components/TechnicalExecutionPanel';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { FormType, User, UserRole, FormData, StudyStatus } from './types';
import { NaturgyLogo, HeaderTitle } from './constants';
import { StorageService } from './services/storage';
import { EmailService, EmailNotificationData } from './services/emailService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormType | null>(null);
  const [editingRequest, setEditingRequest] = useState<FormData | null>(null);
  const [view, setView] = useState<'login' | 'onboarding' | 'menu' | 'form' | 'dashboard' | 'my-requests' | 'analyst-view' | 'users' | 'execution'>('login');
  const [notification, setNotification] = useState<{ message: string; subtext?: string; type?: 'success' | 'info' } | null>(null);
  
  const [allRequests, setAllRequests] = useState<FormData[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [emailPreview, setEmailPreview] = useState<EmailNotificationData | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    setAllRequests(StorageService.getRequests());
    setAllUsers(StorageService.getUsers());
  }, []);

  // DEBUG: Expose cleanup functions to console
  useEffect(() => {
    // NOTA IMPORTANTE: Funções de debug removidas por questões de segurança
    // Em produção, nunca exponha funções de limpeza/modificação ao console
    // Se precisar de debug, implemente autenticação apropriada
    console.log('%c⚠️  MODO DESENVOLVIMENTO', 'color: red; font-weight: bold; font-size: 14px');
    console.log('%cAtenção: Esta aplicação está em DESENVOLVIMENTO.', 'color: orange; font-weight: bold');
    console.log('%cEm PRODUÇÃO, todas as funções de debug devem ser removidas e substituídas por API segura.', 'color: orange; font-weight: bold');
  }, []);

  useEffect(() => {
    if (allRequests.length > 0) {
      StorageService.saveRequests(allRequests);
    }
  }, [allRequests]);

  useEffect(() => {
    if (allUsers.length > 0) {
      StorageService.saveUsers(allUsers);
    }
  }, [allUsers]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  /**
   * Handler para enviar email através do Outlook
   */
  const handleSendEmail = async (emailData: EmailNotificationData) => {
    setIsEmailLoading(true);
    try {
      const result = await EmailService.openInOutlook(emailData);
      if (result.success) {
        setNotification({ 
          message: "E-mail Enviado!", 
          subtext: result.message,
          type: 'success'
        });
        setEmailPreview(null);
      } else {
        setNotification({ 
          message: "Erro ao Enviar E-mail", 
          subtext: result.message,
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setNotification({ 
        message: "Erro ao Enviar E-mail",
        subtext: error instanceof Error ? error.message : 'Erro desconhecido',
        type: 'info'
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  /**
   * Função para exibir preview de email ao criar/validar/rejeitar solicitação
   */
  const showEmailPreviewForNewRequest = (request: FormData) => {
    const attachmentNames = request.selectedFiles?.map(f => f.name) || [];
    const attachmentPaths = request.selectedFiles
      ?.map(f => f?.path)
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0) || [];
    const emailPreview = EmailService.generateNewRequestEmail(request, attachmentNames, attachmentPaths);
    setEmailPreview(emailPreview);
  };

  /**
   * Função para exibir preview de email ao validar solicitação
   */
  const showEmailPreviewForApproval = (request: FormData) => {
    const emailPreview = EmailService.generateApprovalEmail(request, user?.name);
    console.log(`%c✉️ Preview de Aprovação Gerado: ${request.studyNumber}`, "color: #0084ff; font-weight: bold;", emailPreview);
    setEmailPreview(emailPreview);
  };

  /**
   * Função para exibir preview de email ao rejeitar solicitação
   */
  const showEmailPreviewForRejection = (request: FormData, reason: string) => {
    const emailPreview = EmailService.generateRejectionEmail(request, reason, user?.name);
    console.log(`%c✉️ Preview de Rejeição Gerado: ${request.studyNumber}`, "color: #ff6b6b; font-weight: bold;", emailPreview);
    setEmailPreview(emailPreview);
  };

  /**
   * Função para exibir preview de email ao concluir solicitação
   */
  const showEmailPreviewForCompletion = (request: FormData) => {
    const emailPreview = EmailService.generateCompletionEmail(request, user?.name);
    console.log(`%c✉️ Preview de Conclusão Gerado: ${request.studyNumber}`, "color: #10b981; font-weight: bold;", emailPreview);
    setEmailPreview(emailPreview);
  };

  const handleLogin = (loggedUser: User) => {
    console.log('🔐 Login iniciado para:', loggedUser.email, 'Role:', loggedUser.role, 'ProfileComplete:', loggedUser.profileComplete);
    // Sempre atualizar (upsert) o usuário no storage quando login
    const exists = allUsers.some(u => u.id === loggedUser.id);
    const users = exists ? allUsers.map(u => u.id === loggedUser.id ? loggedUser : u) : [loggedUser, ...allUsers];
    setAllUsers(users);
    StorageService.saveUsers(users);

    setUser(loggedUser);
    
    // PRIORIDADE 1: Se Solicitante sem perfil completo, vai para onboarding obrigatório
    if (loggedUser.role === UserRole.SOLICITANTE && !loggedUser.profileComplete) {
      console.log('→ Redirecionando para ONBOARDING (perfil incompleto)');
      setView('onboarding');
      return;
    }
    
    // PRIORIDADE 2: Se Admin ou Analista, vai para dashboard
    if (loggedUser.role === UserRole.ADM || loggedUser.role === UserRole.ANALISTA) {
      console.log('→ Redirecionando para DASHBOARD');
      setView('dashboard');
      return;
    }
    
    // PRIORIDADE 3: Se Solicitante com perfil completo, vai para meus pedidos
    console.log('→ Redirecionando para SUAS SOLICITAÇÕES');
    setView('my-requests');
  };

  const handleOnboardingComplete = (updatedUser: User, folderPaths?: any) => {
    console.log('✅ Onboarding completado para:', updatedUser.email, 'Nome:', updatedUser.name);
    
    // IMPORTANTE: Garantir que profileComplete está marcado como true
    const finalizedUser: User = {
      ...updatedUser,
      profileComplete: true,
      lastAccess: new Date().toISOString(),
    };
    
    // Atualizar (upsert) o usuário no estado E no storage imediatamente
    const exists = allUsers.some(u => u.id === finalizedUser.id);
    const updatedUsers = exists ? allUsers.map(u => u.id === finalizedUser.id ? finalizedUser : u) : [finalizedUser, ...allUsers];
    setAllUsers(updatedUsers);
    StorageService.saveUsers(updatedUsers);
    
    setUser(finalizedUser);
    
    // Armazenar folderPaths no localStorage para este usuário
    if (folderPaths && finalizedUser.id) {
      const userFolderMap = JSON.parse(localStorage.getItem('naturgy_user_folders') || '{}');
      userFolderMap[finalizedUser.id] = folderPaths;
      localStorage.setItem('naturgy_user_folders', JSON.stringify(userFolderMap));
    }
    
    console.log('✅ Usuário salvo com profileComplete = true');
    console.log('→ Redirecionando para SUAS SOLICITAÇÕES');
    setView('my-requests');
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setEditingRequest(null);
  };

  const updateRequestStatus = (id: string, status: StudyStatus, reason?: string, assignedTo?: string) => {
    try {
      const currentRequests = allRequests || [];
      let updatedRequestForEmail: { type: 'approval' | 'rejection' | 'completion' | null; request?: FormData; reason?: string } = { type: null };
      let requestToCreate: FormData | null = null;

      const updatedList = currentRequests.map(req => {
        if (req.id === id) {
          let studyNumber = req.studyNumber || '';
          if ((status === StudyStatus.AGUARDANDO_EXECUCAO || status === StudyStatus.VALIDADO) && studyNumber.startsWith('PROV-')) {
            studyNumber = studyNumber.replace('PROV-', '');
          }
          
          const updated: FormData = { 
            ...req, 
            status, 
            studyNumber,
            rejectionReason: status === StudyStatus.REJEITADO ? (reason || req.rejectionReason) : undefined,
            assignedTo: assignedTo !== undefined ? assignedTo : req.assignedTo
          };

          if ((status === StudyStatus.VALIDADO || status === StudyStatus.AGUARDANDO_EXECUCAO) && req.status !== status) {
            updatedRequestForEmail.type = 'approval';
            updatedRequestForEmail.request = updated;
          } else if (status === StudyStatus.REJEITADO && req.status !== StudyStatus.REJEITADO) {
            updatedRequestForEmail.type = 'rejection';
            updatedRequestForEmail.request = updated;
            updatedRequestForEmail.reason = reason || req.rejectionReason || 'Não se adequa aos critérios técnicos';
          } else if (status === StudyStatus.CONCLUIDO && req.status !== StudyStatus.CONCLUIDO) {
            updatedRequestForEmail.type = 'completion';
            updatedRequestForEmail.request = updated;
          }

          if (status === StudyStatus.AGUARDANDO_EXECUCAO && req.status !== StudyStatus.AGUARDANDO_EXECUCAO) {
            requestToCreate = updated;
          }

          return updated;
        }
        return req;
      });

      setAllRequests(updatedList);
      try {
        StorageService.saveRequests(updatedList);
      } catch (storageError) {
        console.warn('Falha ao salvar requests:', storageError);
      }

      // Processar email FORA do state updater
      setTimeout(() => {
        try {
          if (updatedRequestForEmail.type && updatedRequestForEmail.request) {
            if (updatedRequestForEmail.type === 'approval') {
              showEmailPreviewForApproval(updatedRequestForEmail.request);
            } else if (updatedRequestForEmail.type === 'rejection' && updatedRequestForEmail.reason) {
              showEmailPreviewForRejection(updatedRequestForEmail.request, updatedRequestForEmail.reason);
            } else if (updatedRequestForEmail.type === 'completion') {
              showEmailPreviewForCompletion(updatedRequestForEmail.request);
              setNotification({ 
                message: "Estudo Finalizado!", 
                subtext: `${updatedRequestForEmail.request.requesterName} - Estudo ${updatedRequestForEmail.request.studyNumber} concluído com sucesso!`,
                type: 'success'
              });
            }
          }
        } catch (previewError) {
          console.error('Erro ao gerar preview de email:', previewError);
          setNotification({
            message: "Erro ao gerar preview",
            subtext: "Ocorreu um erro ao preparar o email. Tente novamente.",
            type: 'info'
          });
        }
      }, 0);

      if (requestToCreate && (window as any).api?.createRequestFolder) {
        (window as any).api.createRequestFolder({
          email: requestToCreate.email || '',
          userName: requestToCreate.requesterName,
          requestId: requestToCreate.studyNumber
        }).then(async (result: any) => {
          if (result.success) {
            console.log(`%c📁 Pasta criada: ${requestToCreate.studyNumber}`, "color: #16a34a; font-weight: bold;");

            const files = requestToCreate.selectedFiles || [];
            if (files.length > 0 && (window as any).api) {
              for (const f of files) {
                try {
                  const solicitacaoDir = `${result.baseFolderPath}/Solicitação`;
                  if (f.path) {
                    await (window as any).api.saveFile(f.path, `${solicitacaoDir}/${f.name}`);
                    console.log(`✓ Arquivo copiado: ${f.name}`);
                  } else {
                    const toBase64 = (fileObj: any) => new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const data = reader.result as string;
                        const base64 = data.split(',')[1] || '';
                        resolve(base64);
                      };
                      reader.onerror = (e) => reject(e);
                      reader.readAsDataURL(fileObj);
                    });

                    const base64 = await toBase64(f);
                    await (window as any).api.saveFileData(f.name, base64, solicitacaoDir);
                    console.log(`✓ Arquivo enviado: ${f.name}`);
                  }
                } catch (saveErr) {
                  console.warn('Erro ao salvar anexo:', saveErr);
                }
              }
            }
          }
        }).catch((err: any) => {
          console.warn('Erro ao criar pasta:', err);
        });
      }

    } catch (outerError) {
      console.error('Erro crítico ao atualizar status:', outerError);
      setNotification({
        message: "Erro ao Atualizar",
        subtext: "Ocorreu um erro ao atualizar o status. Tente novamente.",
        type: 'info'
      });
    }
  };

  const handleStartExecution = (request: FormData) => {
    // Verificação de segurança adicional para Analistas
    if (user?.role === UserRole.ANALISTA && request.assignedTo && request.assignedTo !== user.id) {
       setNotification({ message: "Acesso Negado", subtext: "Este estudo já possui um responsável técnico atribuído.", type: 'info' });
       return;
    }

    setEditingRequest(request);
    if (request.status === StudyStatus.AGUARDANDO_EXECUCAO) {
       updateRequestStatus(request.id, StudyStatus.EM_EXECUCAO, undefined, user?.id);
    }
    setView('execution');
  };

  const handleUpdateRequestData = (updatedData: FormData) => {
    setAllRequests(prev => {
      const newList = prev.map(r => r.id === updatedData.id ? updatedData : r);
      StorageService.saveRequests(newList);
      return newList;
    });
    setEditingRequest(updatedData);
  };

  const handleCancelRequest = (id: string) => {
    updateRequestStatus(id, StudyStatus.CANCELADO);
  };

  const handleStartForm = (formId: FormType) => {
    setSelectedForm(formId);
    setEditingRequest(null);
    setView('form');
  };

  const handleEditRequest = (request: FormData) => {
    setEditingRequest(request);
    setSelectedForm(request.formType);
    setView('form');
  };

  const handleRequestRevision = (originalRequest: FormData) => {
    // Verificar se o estudo original foi concluído (permissão para revisão)
    if (originalRequest.status !== StudyStatus.CONCLUIDO) {
      setNotification({ 
        message: "Revisão Não Permitida", 
        subtext: `O estudo ${originalRequest.studyNumber} precisa estar CONCLUÍDO para solicitar uma revisão. Status atual: ${originalRequest.status}`,
        type: 'info'
      });
      return;
    }

    // Verificar se já existe outro estudo com mesmo endereço/cidade (de outro solicitante)
    const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
    const addr = normalize(originalRequest.address);
    const city = normalize(originalRequest.city);
    
    const existingStudy = allRequests.find(r => 
      normalize(r.address) === addr && 
      normalize(r.city) === city &&
      r.id !== originalRequest.id &&
      r.user_id !== originalRequest.user_id
    );

    if (existingStudy) {
      if (existingStudy.status === StudyStatus.CONCLUIDO) {
        // Permitir nova revisão como novo estudo
        const revisionData: FormData = {
          ...originalRequest,
          id: crypto.randomUUID(),
          studyNumber: '',
          status: StudyStatus.PENDENTE,
          studyType: 'Revisão de Estudo',
          previousStudy: originalRequest.studyNumber,
          requestDate: new Date().toISOString().split('T')[0],
          assignedTo: undefined,
          rejectionReason: undefined,
          selectedFiles: [],
          categorizedFiles: {},
          totalExecutionTime: 0,
          executionStartTime: undefined,
          user_id: user?.id || originalRequest.user_id 
        };
        setEditingRequest(revisionData);
        setSelectedForm(originalRequest.formType);
        setView('form');
      } else {
        setNotification({ 
          message: "Estudo Existente", 
          subtext: `Já existe um estudo cadastrado deste local (${existingStudy.studyNumber}) que não foi concluído. Aguarde a conclusão. Status atual: ${existingStudy.status}`,
          type: 'info'
        });
      }
    } else {
      // Criar revisão normalmente
      const revisionData: FormData = {
        ...originalRequest,
        id: crypto.randomUUID(),
        studyNumber: '',
        status: StudyStatus.PENDENTE,
        studyType: 'Revisão de Estudo',
        previousStudy: originalRequest.studyNumber,
        requestDate: new Date().toISOString().split('T')[0],
        assignedTo: undefined,
        rejectionReason: undefined,
        selectedFiles: [],
        categorizedFiles: {},
        totalExecutionTime: 0,
        executionStartTime: undefined,
        user_id: user?.id || originalRequest.user_id 
      };
      setEditingRequest(revisionData);
      setSelectedForm(originalRequest.formType);
      setView('form');
    }
  };

  const handleAnalyzeRequest = (request: FormData) => {
    if (user?.role === UserRole.ANALISTA && request.assignedTo && request.assignedTo !== user.id) {
       setNotification({ message: "Acesso Restrito", subtext: "Apenas o responsável técnico ou ADM podem visualizar este estudo.", type: 'info' });
       return;
    }
    setEditingRequest(request);
    setSelectedForm(request.formType);
    setView('analyst-view');
  };

  const handleViewRequest = (request: FormData) => {
    setEditingRequest(request);
    setSelectedForm(request.formType);
    setView('analyst-view');
  };

  const handleBackToMenu = () => {
    if (user?.role === UserRole.ANALISTA || user?.role === UserRole.ADM) {
      setView('dashboard');
    } else {
      setView('my-requests');
    }
    setEditingRequest(null);
  };

  const handleRequestSubmit = (newRequest: FormData) => {
    setAllRequests(prev => {
      let updatedList: FormData[];
      const idx = prev.findIndex(r => r.id === newRequest.id);
      let finalRequest = { ...newRequest };
      
      if (idx > -1) {
        const prevStatus = prev[idx].status;
        const status = prevStatus === StudyStatus.REJEITADO ? StudyStatus.PENDENTE : StudyStatus.EM_ANALISE;
        finalRequest = { ...newRequest, status, rejectionReason: undefined };
        updatedList = prev.map(r => r.id === newRequest.id ? finalRequest : r);
      } else {
        const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
        const newAddress = normalize(newRequest.address);
        const newCity = normalize(newRequest.city);
        const newTitle = normalize(newRequest.studyTitle || newRequest.clientName || '');

        // Procurar por estudos com mesmo endereço, cidade E título (deduplica por local)
        const matchingStudy = prev.find(r => 
          normalize(r.address) === newAddress && 
          normalize(r.city) === newCity &&
          normalize(r.studyTitle || r.clientName || '') === newTitle
        );

        let studyNumber = '';
        
        if (matchingStudy || (newRequest.studyType === 'Revisão de Estudo' && newRequest.previousStudy)) {
          // É uma revisão - reutilizar código base
          const baseReference = matchingStudy ? matchingStudy.studyNumber : newRequest.previousStudy!;
          const baseCode = baseReference.split('-REV')[0].replace('PROV-', '');
          
          const totalVersions = prev.filter(r => r.studyNumber.replace('PROV-', '').startsWith(baseCode)).length;
          studyNumber = `PROV-${baseCode}-REV${totalVersions}`;
          
          finalRequest.studyType = 'Revisão de Estudo';
          finalRequest.previousStudy = baseReference;
        } else {
          // Novo estudo - gerar código com tipo de formulário
          const currentYear = new Date().getFullYear();
          const foType = newRequest.formType?.split('-').pop() || 'FO.XX'; // Ex: FO.01
          
          // Filtrar sequências apenas deste tipo de formulário
          let maxSeq = 0;
          prev.forEach(r => {
            const pattern = `${foType}-APR-\\d{4}-(\\d+)`;
            const match = r.studyNumber?.match(new RegExp(pattern));
            if (match) {
              const num = parseInt(match[1]);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
          
          const newSeq = String(maxSeq + 1).padStart(4, '0');
          studyNumber = `PROV-${foType}-APR-${currentYear}-${newSeq}`;
        }
        
        finalRequest = { ...newRequest, studyNumber, status: StudyStatus.EM_ANALISE, user_id: user?.id };
        updatedList = [finalRequest, ...prev];
      }

      // Mostrar preview de email para nova solicitação
      showEmailPreviewForNewRequest(finalRequest);
      
      // Notificação removida a pedido do usuário

      StorageService.saveRequests(updatedList);
      return updatedList;
    });
    setView('my-requests');
    setEditingRequest(null);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setAllUsers(prev => {
      const newUsers = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
      StorageService.saveUsers(newUsers);
      return newUsers;
    });
  };

  const handleCreateUser = (newUser: User) => {
    setAllUsers(prev => {
      const newUsers = [newUser, ...prev];
      StorageService.saveUsers(newUsers);
      return newUsers;
    });
  };

  const handleDeleteUser = (userId: string) => {
    setAllUsers(prev => {
      const newUsers = prev.filter(u => u.id !== userId);
      StorageService.saveUsers(newUsers);
      return newUsers;
    });
  };

  const handleResetUsers = () => {
    StorageService.resetUsersToAdmin();
    setAllUsers(StorageService.getUsers());
  };

  const visibleRequests = useMemo(() => {
    if (!user) return [];
    
    // ADM vê tudo sem restrição
    if (user.role === UserRole.ADM) return allRequests;
    
    // Solicitante vê apenas o que ele pediu
    if (user.role === UserRole.SOLICITANTE) return allRequests.filter(r => r.user_id === user.id);
    
    // Analista (Validador ou Executor):
    // REGRAS DE VISIBILIDADE TÉCNICA RIGOROSA:
    // 1. Vê o que é seu (atribuído a ele)
    // 2. Vê o que está "Pendente/Analise" sem responsável (para poder validar e assumir)
    // 3. Vê o que está "Aguardando Execução" sem responsável (se tiver permissão de executor)
    // NÃO VÊ o que está atribuído a outro colega (proteção de fila e exclusividade)
    const isValidator = user.permissions?.includes('validar');
    const isExecutor = user.permissions?.includes('executar');

    return allRequests.filter(r => {
      // Se está atribuído ao próprio analista, ele vê sempre
      if (r.assignedTo === user.id) return true;
      
      // Se está atribuído a outro colega, ele NÃO vê (exceto ADM, que já tratamos acima)
      if (r.assignedTo && r.assignedTo !== user.id) return false;

      // Se não está atribuído a ninguém:
      if (isValidator && (r.status === StudyStatus.PENDENTE || r.status === StudyStatus.EM_ANALISE)) return true;
      if (isExecutor && r.status === StudyStatus.AGUARDANDO_EXECUCAO) return true;
      
      // Concluídos e Qualidade também somem da visão comum se forem de outros
      return false;
    });
  }, [allRequests, user]);

  if (view === 'login') return <Login onLogin={handleLogin} />;
  if (view === 'onboarding' && user) return <Onboarding user={user} onComplete={handleOnboardingComplete} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="mx-4 bg-white border border-slate-100 rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,64,128,0.2)] p-6 flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${notification.type === 'success' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
               <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check' : 'fa-envelope-circle-check'} text-2xl`}></i>
            </div>
            <div className="flex-grow">
               <h4 className="text-sm font-black text-[#004080] uppercase tracking-tight">{notification.message}</h4>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">{notification.subtext}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-8">
            <div onClick={handleBackToMenu} className="cursor-pointer transition-transform active:scale-95">
              <NaturgyLogo />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-200">
               {user?.role === UserRole.SOLICITANTE && (
                 <button onClick={() => setView('my-requests')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${view === 'my-requests' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Minhas Solicitações</button>
               )}
               {(user?.role === UserRole.ADM || user?.role === UserRole.ANALISTA) && (
                 <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${view === 'dashboard' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Estudos</button>
               )}
               {user?.role === UserRole.ADM && (
                 <button onClick={() => setView('users')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${view === 'users' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Usuários</button>
               )}
            </nav>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-[#004080] leading-none uppercase">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{user?.role}</p>
              </div>
              <button onClick={() => (window as any).api?.minimizeWindow?.()} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center" title="Minimizar janela">
                <i className="fa-solid fa-minus"></i>
              </button>
              <button onClick={() => (window as any).api?.closeApp?.()} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center" title="Fechar aplicação">
                <i className="fa-solid fa-xmark"></i>
              </button>
              <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center" title="Logout">
                <i className="fa-solid fa-power-off"></i>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow p-4 md:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {view === 'menu' && <SelectionMenu onStart={handleStartForm} />}
          {(view === 'form' || view === 'analyst-view') && (
            <FormContainer 
              key={editingRequest?.id || selectedForm || 'new'}
              formType={selectedForm!} 
              initialData={editingRequest || undefined}
              onBack={handleBackToMenu}
              onSubmit={handleRequestSubmit}
              userId={user?.id || ''}
              currentUser={user || undefined}
              allUsers={allUsers}
              allRequests={allRequests}
              readOnly={view === 'analyst-view'}
              onStatusUpdate={updateRequestStatus}
              onStartExecution={handleStartExecution}
              onViewRequest={handleViewRequest}
            />
          )}
          {view === 'execution' && editingRequest && (
            <TechnicalExecutionPanel 
              data={editingRequest} 
              allRequests={allRequests}
              onBack={handleBackToMenu}
              onStatusUpdate={updateRequestStatus} 
              onUpdateData={handleUpdateRequestData}
            />
          )}
          {view === 'dashboard' && (
            <Dashboard 
              user={user!} 
              requests={visibleRequests} 
              allUsers={allUsers}
              onAnalyze={handleAnalyzeRequest} 
              onExecute={handleStartExecution}
              onStatusUpdate={updateRequestStatus} 
            />
          )}
          {view === 'my-requests' && user?.role === UserRole.SOLICITANTE && (
            <MyRequests 
              requests={allRequests.filter(r => r.user_id === user?.id || r.requesterName === user?.name || r.email === user?.email)} 
              currentUser={user}
              onNewRequest={() => setView('menu')}
              onEditRequest={handleEditRequest}
              onCancelRequest={handleCancelRequest}
              onViewRequest={handleViewRequest}
              onRequestRevision={handleRequestRevision}
            />
          )}
          {view === 'users' && user?.role === UserRole.ADM && (
            <UserManagement 
              users={allUsers} 
              onUpdateUser={handleUpdateUser} 
              onCreateUser={handleCreateUser}
              onDeleteUser={handleDeleteUser}
              onResetUsers={handleResetUsers}
            />
          )}
        </div>
      </main>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={!!emailPreview}
        emailData={emailPreview!}
        onClose={() => setEmailPreview(null)}
        isLoading={isEmailLoading}
      />

      <footer className="bg-white border-t border-slate-200 p-6 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-auto">
        <p>&copy; {new Date().getFullYear()} Naturgy - Portal Técnico.</p>
      </footer>
    </div>
  );
};
export default App;
