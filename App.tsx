
import React, { useState, useEffect, useMemo } from 'react';
import { SelectionMenu } from './SelectionMenu';
import { FormContainer } from './FormContainer';
import { Login } from './Login';
import { Onboarding } from './Onboarding';
import { Dashboard } from './Dashboard';
import { MyRequests } from './MyRequests';
import { UserManagement } from './UserManagement';
import { TechnicalExecutionPanel } from './TechnicalExecutionPanel';
import { PasswordChange } from './PasswordChange';
// EmailPreviewModal removed <!-- id: 11 -->
import { FormType, User, UserRole, FormData, StudyStatus } from './types';
import { NaturgyLogo, HeaderTitle } from './constants';
import { StorageService } from './storage';
import { EmailService, EmailNotificationData } from './emailService';
import { getGMT3ISOString, normalizeArea } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [editingRequest, setEditingRequest] = useState<FormData | null>(null);
  const [view, setView] = useState<'login' | 'onboarding' | 'password-change' | 'menu' | 'form' | 'dashboard' | 'my-requests' | 'analyst-view' | 'users' | 'execution'>('login');
  const [notification, setNotification] = useState<{ message: string; subtext?: string; type?: 'success' | 'info' } | null>(null);
  
  const [allRequests, setAllRequests] = useState<FormData[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  // emailPreview state removed <!-- id: 26 -->
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    const initData = async () => {
      const [requests, users] = await Promise.all([
        StorageService.getRequests(),
        StorageService.getUsers()
      ]);
      setAllRequests(requests);
      setAllUsers(users);
    };
    initData();

    // Sincronismo automático a cada 10 segundos
    const syncInterval = setInterval(initData, 10000);
    return () => clearInterval(syncInterval);
  }, []);

  // DEBUG: Expose cleanup functions to console
  useEffect(() => {
    // Modo desenvolvimento
  }, []);

  // Removidos os useEffects de salvamento automático no localStorage
  // A persistência agora é tratada diretamente nos handlers async

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
        // Notificação de sucesso removida a pedido do usuário
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
  const generateEmailForNewRequest = (request: FormData): EmailNotificationData => {
    const attachmentNames = request.selectedFiles?.map(f => f.name) || [];
    const attachmentPaths = request.selectedFiles
      ?.map(f => f?.path)
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0) || [];
    return EmailService.generateNewRequestEmail(request, attachmentNames, attachmentPaths);
  };

  /**
   * Função para exibir preview de email ao validar solicitação
   */
  const generateEmailForApproval = (request: FormData): EmailNotificationData => {
    return EmailService.generateApprovalEmail(request, user?.name);
  };

  /**
   * Função para exibir preview de email ao rejeitar solicitação
   */
  const generateEmailForRejection = (request: FormData, reason: string): EmailNotificationData => {
    return EmailService.generateRejectionEmail(request, reason, user?.name);
  };

  /**
   * Função para exibir preview de email ao concluir solicitação
   */
  const generateEmailForCompletion = (request: FormData): EmailNotificationData => {
    return EmailService.generateCompletionEmail(request, user?.name);
  };

  const handleLogin = async (loggedUser: User) => {
    // PRIORIDADE 0: Se exige troca de senha (primeiro acesso analista/adm)
    if (loggedUser.requiresPasswordChange) {
      setUser(loggedUser);
      setView('password-change');
      return;
    }

    try {
      // Salvar/Atualizar no Supabase
      const savedUser = await StorageService.saveUser(loggedUser);
      setUser(savedUser);
      
      // Atualizar lista local
      setAllUsers(prev => {
        const exists = prev.some(u => u.id === savedUser.id);
        return exists ? prev.map(u => u.id === savedUser.id ? savedUser : u) : [savedUser, ...prev];
      });

      // PRIORIDADE 1: Se Solicitante sem perfil completo, vai para onboarding obrigatório
      if (savedUser.role === UserRole.SOLICITANTE && !savedUser.profileComplete) {
        setView('onboarding');
        return;
      }
      
      // PRIORIDADE 2: Se Admin ou Analista, vai para dashboard
      if (savedUser.role === UserRole.ADM || savedUser.role === UserRole.ANALISTA) {
        setView('dashboard');
        return;
      }
      
      // PRIORIDADE 3: Se Solicitante com perfil completo, vai para meus pedidos
      setView('my-requests');
    } catch (error) {
      console.error('Erro ao processar login:', error);
      setUser(loggedUser); // Fallback mental
      setView('my-requests');
    }
  };

  const handlePasswordChangeComplete = (updatedUser: User) => {
    handleLogin(updatedUser);
  };

  // 3s Auto-sync for requests
  useEffect(() => {
    if (!user) return;
    
    console.log('[App] Starting 3s auto-sync polling...');
    const intervalId = setInterval(async () => {
      try {
        const updatedRequests = await StorageService.getRequests();
        if (updatedRequests && updatedRequests.length > 0) {
          setAllRequests(updatedRequests);
        }
      } catch (err) {
        console.warn('[Auto-sync] Error fetching updates:', err);
      }
    }, 3000);

    return () => {
      console.log('[App] Stopping auto-sync polling...');
      clearInterval(intervalId);
    };
  }, [user]);

  const handleOnboardingComplete = async (finalizedUser: User, folderPaths?: any) => {
    try {
      // O usuário já foi salvo no Onboarding.tsx, então apenas atualizamos o estado local
      setAllUsers(prev => {
        const exists = prev.some(u => u.id === finalizedUser.id);
        return exists ? prev.map(u => u.id === finalizedUser.id ? finalizedUser : u) : [finalizedUser, ...prev];
      });
      
      setUser(finalizedUser);
      
      // Armazenar folderPaths no localStorage para este usuário
      if (folderPaths && finalizedUser.id) {
        const userFolderMap = JSON.parse(localStorage.getItem('naturgy_user_folders') || '{}');
        userFolderMap[finalizedUser.id] = folderPaths;
        localStorage.setItem('naturgy_user_folders', JSON.stringify(userFolderMap));
      }
      
      // Redirecionar conforme role
      if (finalizedUser.role === UserRole.ADM || finalizedUser.role === UserRole.ANALISTA) {
        setView('dashboard');
      } else {
        setView('my-requests');
      }
    } catch (error) {
      console.error('Erro ao processar finalização do onboarding:', error);
      setView('my-requests');
    }
  };

  const handleSyncStorage = async () => {
    if (confirm('Deseja sincronizar todos os arquivos com o Supabase Storage? Isso garantirá que todos os estudos antigos tenham suas pastas e arquivos na nova estrutura.')) {
      setIsSyncing(true);
      setSyncStatus('Iniciando...');
      try {
        await StorageService.migrateRequestsToStorage((msg: string) => setSyncStatus(msg));
        alert('Sincronização concluída!');
        // Recarregar os dados para refletir as mudanças (base64 removido)
        const updatedRequests = await StorageService.getRequests();
        setAllRequests(updatedRequests);
      } catch (err) {
        alert('Erro ao sincronizar.');
      } finally {
        setIsSyncing(false);
        setSyncStatus('');
      }
    }
  };


  const handleLogout = () => {
    setUser(null);
    setView('login');
    setEditingRequest(null);
  };

  const updateRequestStatus = async (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => {
    try {
      const currentRequests = allRequests || [];
      let updatedRequestForEmail: { type: 'approval' | 'rejection' | 'completion' | null; request?: FormData; reason?: string } = { type: null };
      let requestToCreate: FormData | null = null;

      const updatedList = currentRequests.map(req => {
        if (req.id === id) {
          let studyNumber = req.studyNumber || '';
          let needsRename = false;
          let oldStudyNumber = studyNumber;

          if ((status === StudyStatus.AGUARDANDO_EXECUCAO || status === StudyStatus.VALIDADO) && studyNumber.startsWith('PROV-')) {
            studyNumber = studyNumber.replace('PROV-', '');
            needsRename = true;
          }
          
          const updated: FormData = { 
            ...req, 
            ...(additionalData || {}),
            status, 
            studyNumber,
            rejectionReason: status === StudyStatus.REJEITADO ? (reason || req.rejectionReason) : undefined,
            assignedTo: assignedTo !== undefined ? assignedTo : req.assignedTo,
            startedAt: status === StudyStatus.EM_EXECUCAO ? (req.startedAt || new Date().toISOString()) : req.startedAt,
            completedAt: status === StudyStatus.CONCLUIDO ? (req.completedAt || new Date().toISOString()) : req.completedAt
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
      
      const updatedReq = updatedList.find(r => r.id === id);
      const needsRename = (status === StudyStatus.AGUARDANDO_EXECUCAO || status === StudyStatus.VALIDADO) && updatedReq?.previousStudyNumber?.startsWith('PROV-'); 
      // Wait, needsRename was local to the map. I need to capture it or recalculate.
      
      if (updatedReq) {
        try {
          // If the ID changed (PROV- removed), move the files first
          const oldNumber = currentRequests.find(r => r.id === id)?.studyNumber;
          if (oldNumber && updatedReq.studyNumber !== oldNumber) {
             console.log(`[App] Study number changed from ${oldNumber} to ${updatedReq.studyNumber}. Moving storage...`);
             await StorageService.moveStorageFolder(oldNumber, updatedReq.studyNumber);
          }

          // Await to ensure it's saved before any auto-sync overwrites it
          await StorageService.addRequest(updatedReq);
        } catch (err) {
          console.warn('Falha ao salvar request ou mover arquivos no Supabase:', err);
        }

        // Removido uploadOfficialForm daqui para garantir que o PDF seja um espelho fiel 
        // do envio original do solicitante e não inclua dados da validação.
      }

      // Processar email FORA do state updater
      setTimeout(() => {
        try {
          if (updatedRequestForEmail.type && updatedRequestForEmail.request) {
            if (updatedRequestForEmail.type === 'approval') {
              handleSendEmail(generateEmailForApproval(updatedRequestForEmail.request));
            } else if (updatedRequestForEmail.type === 'rejection' && updatedRequestForEmail.reason) {
              handleSendEmail(generateEmailForRejection(updatedRequestForEmail.request, updatedRequestForEmail.reason));
            } else if (updatedRequestForEmail.type === 'completion') {
              handleSendEmail(generateEmailForCompletion(updatedRequestForEmail.request));
              // Notificação de conclusão removida a pedido do usuário
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
        const year = requestToCreate.studyNumber.match(/APR-(\d{4})/)?.[1] || new Date().getFullYear().toString();
        const isRevision = requestToCreate.studyNumber.includes('-REV');
        const baseStudyId = isRevision ? requestToCreate.studyNumber.split('-REV')[0] : requestToCreate.studyNumber;
        const revFolder = isRevision ? `REV${requestToCreate.studyNumber.split('-REV')[1]}` : 'REV1';

        (window as any).api.createRequestFolder({
          email: requestToCreate.email || '',
          userName: requestToCreate.requesterName,
          requestId: requestToCreate.studyNumber,
          year,
          baseStudyId,
          revFolder,
          fullPath: `Solicitacoes_APR/${year}/${baseStudyId}/${revFolder}`
        }).then(async (result: any) => {
          if (result.success) {
            const files = requestToCreate.selectedFiles || [];
            if (files.length > 0 && (window as any).api) {
              for (const f of files) {
                try {
                  const solicitacaoDir = `${result.baseFolderPath}/Solicitacao`;
                  if (f.path) {
                    await (window as any).api.saveFile(f.path, `${solicitacaoDir}/${f.name}`);
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
    const isFinished = request.status === StudyStatus.CONCLUIDO || request.status === StudyStatus.CONTROLE_QUALIDADE;
    
    if (user?.role === UserRole.ANALISTA && request.assignedTo && request.assignedTo !== user.id && !isFinished) {
       setNotification({ message: "Acesso Negado", subtext: "Este estudo já possui um responsável técnico atribuído.", type: 'info' });
       return;
    }

    const needsAssignment = user?.role === UserRole.ANALISTA && !request.assignedTo;
    const needsStatusUpdate = request.status === StudyStatus.AGUARDANDO_EXECUCAO;

    const newStatus = needsStatusUpdate ? StudyStatus.EM_EXECUCAO : request.status;
    const newAssignedTo = needsAssignment ? user?.id : request.assignedTo;

    if (needsStatusUpdate || needsAssignment) {
       const now = new Date().toISOString();
       const updatedReq = { 
         ...request, 
         status: newStatus, 
         assignedTo: newAssignedTo,
         startedAt: needsStatusUpdate ? now : request.startedAt 
       };
       setEditingRequest(updatedReq);
       updateRequestStatus(request.id, newStatus, undefined, newAssignedTo, { startedAt: needsStatusUpdate ? now : request.startedAt });
    } else {
       setEditingRequest(request);
    }

    setView('execution');
  };

  const handleUpdateRequestData = async (updatedData: FormData) => {
    try {
      await StorageService.addRequest(updatedData);
      setAllRequests(prev => prev.map(r => r.id === updatedData.id ? updatedData : r));
      setEditingRequest(updatedData);
    } catch (error) {
      console.error('Error updating request:', error);
      // Optionally, show a notification to the user
    }
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
          requestDate: getGMT3ISOString().split('T')[0],
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
    let finalRequest = { ...newRequest };
    let isUpdate = false;

    // Determinar status ANTES do setAllRequests para evitar race condition com closure
    const existingRequest = allRequests.find(r => r.id === newRequest.id);
    if (existingRequest) {
      isUpdate = true;
      const prevStatus = existingRequest.status;
      const status = prevStatus === StudyStatus.REJEITADO ? StudyStatus.EM_ANALISE : StudyStatus.EM_ANALISE;
      finalRequest = { ...newRequest, status, rejectionReason: undefined };
    }

    setAllRequests(prev => {
      const idx = prev.findIndex(r => r.id === newRequest.id);
      
      if (idx > -1) {
        // isUpdate e finalRequest já foram calculados acima
        return prev.map(r => r.id === newRequest.id ? finalRequest : r);
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
          const cleanBase = baseReference.replace('PROV-', '');
          const revMatch = cleanBase.match(/(.+)-REV\d+$/i);
          const baseCode = revMatch ? revMatch[1] : cleanBase;
          
          // Filter carefully to match ONLY this baseCode
          const relatedVersions = prev.filter(r => {
             const rClean = r.studyNumber.replace('PROV-', '');
             const rRevMatch = rClean.match(/(.+)-REV\d+$/i);
             const rBase = rRevMatch ? rRevMatch[1] : rClean;
             return rBase === baseCode;
          });

          const totalVersions = relatedVersions.length;
          studyNumber = `PROV-${baseCode}-REV${totalVersions}`;
          
          finalRequest = { 
            ...newRequest, 
            studyType: 'Revisão de Estudo', 
            previousStudy: baseReference,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            user_id: user?.id 
          };
        } else {
          // Novo estudo - gerar código sequencial global
          const currentYear = new Date().getFullYear();
          
          // Encontrar a última sequência numérica global para o ano corrente
          let maxSeq = 0;
          prev.forEach(r => {
            // Match format: PROV-APR-YEAR-SEQ or APR-YEAR-SEQ
            const match = r.studyNumber?.match(new RegExp(`APR-${currentYear}-(\\d+)`));
            if (match) {
              const num = parseInt(match[1]);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
          
          const newSeq = String(maxSeq + 1).padStart(4, '0');
          studyNumber = `PROV-APR-${currentYear}-${newSeq}`;
          
          finalRequest = { 
             ...newRequest, 
             studyNumber, 
             status: StudyStatus.EM_ANALISE, 
             user_id: user?.id 
          };
        }
        
        return [finalRequest, ...prev];
      }
    });

    const submitFlow = async () => {
      try {
        await StorageService.addRequest(finalRequest);
        

        // Automated email trigger on submit
        setTimeout(() => {
          handleSendEmail(generateEmailForNewRequest(finalRequest));
        }, 500);

        setView('my-requests');
        setEditingRequest(null);
      } catch (error) {
        console.error('Error saving request to Supabase:', error);
        alert('Erro ao salvar solicitação no banco de dados. Tente novamente.');
      }
    };
    submitFlow();
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      await StorageService.saveUser(updatedUser);
      setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleCreateUser = async (newUser: User) => {
    try {
      await StorageService.saveUser(newUser);
      setAllUsers(prev => [newUser, ...prev]);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await StorageService.deleteUser(userId);
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erro ao excluir usuário no banco de dados.');
    }
  };

  const handleResetUsers = async () => {
    // Reset para admin não é mais recomendado com DB real, 
    // mas se necessário, poderíamos limpar profiles (exceto adm)
    alert('Função de reset desabilitada para segurança do banco de dados.');
  };

  const visibleRequests = useMemo(() => {
    if (!user) return [];
    
    // ADM e Analista Validador vêem tudo sem restrição
    if (user.role === UserRole.ADM || user.permissions?.includes('validar')) return allRequests;
    
    // Solicitante vê o que ele pediu OU o que é da mesma área dele
    if (user.role === UserRole.SOLICITANTE) {
      const userAreaNormalized = normalizeArea(user.area);
      return allRequests.filter(r => 
        r.user_id === user.id || 
        (userAreaNormalized && normalizeArea(r.requesterArea) === userAreaNormalized)
      );
    }
    
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

      // Se não está atribuído a ninguém (Fila Livre):
      // Analistas veem tudo que está Pendente, Em Análise ou Aguardando Execução
      if (r.status === StudyStatus.PENDENTE || 
          r.status === StudyStatus.EM_ANALISE || 
          r.status === StudyStatus.AGUARDANDO_EXECUCAO ||
          r.status === StudyStatus.EM_EXECUCAO) {
        return true;
      }
      
      // Concluídos e Qualidade também somem da visão comum se forem de outros
      return false;
    });
  }, [allRequests, user]);

  if (view === 'login') return <Login onLogin={handleLogin} onCreateAccount={() => setView('onboarding')} />;
  if (view === 'onboarding') return <Onboarding user={user || { id: '', name: '', role: UserRole.SOLICITANTE, email: '', profileComplete: false }} onComplete={handleOnboardingComplete} />;
  if (view === 'password-change' && user) return <PasswordChange user={user} onComplete={handlePasswordChangeComplete} />;

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
            {isSyncing && (
              <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl animate-pulse">
                <i className="fa-solid fa-sync fa-spin text-orange-500 text-[10px]"></i>
                <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">{syncStatus}</span>
              </div>
            )}
            <nav className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-200">
               <button 
                 onClick={handleSyncStorage} 
                 disabled={isSyncing}
                 className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-500 hover:bg-slate-100 flex items-center gap-2"
                 title="Sincronizar arquivos e pastas com o banco"
               >
                 <i className={`fa-solid fa-arrows-rotate ${isSyncing ? 'fa-spin' : ''}`}></i>
                 Sincronizar
               </button>
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
              allUsers={allUsers}
              readOnly={editingRequest.status === StudyStatus.CONCLUIDO || editingRequest.status === StudyStatus.CONTROLE_QUALIDADE}
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
              requests={visibleRequests} 
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

      {/* Email Preview Modal Removed */}

      <footer className="bg-white border-t border-slate-200 p-6 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-auto">
        <p>&copy; {new Date().getFullYear()} Naturgy - Portal Técnico.</p>
      </footer>
    </div>
  );
};
export default App;
