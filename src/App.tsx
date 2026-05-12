
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SelectionMenu } from './components/SelectionMenu';
import { FormContainer } from './pages/FormContainer';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { MyRequests } from './pages/MyRequests';
import { UserManagement } from './pages/UserManagement';
import { AuditLog } from './pages/AuditLog';
import { TechnicalExecutionPanel } from './pages/TechnicalExecutionPanel';
import { PasswordChange } from './pages/PasswordChange';

// EmailPreviewModal removed <!-- id: 11 -->
import { FormType, User, UserRole, FormData, StudyStatus } from './types/types';
import { NaturgyLogo, HeaderTitle, REVERSE_AREA_MAPPING } from './constants/constants';
import { StorageService } from './services/storage';
import { EmailService, EmailNotificationData } from './services/emailService';
import { getGMT3ISOString, normalizeArea, isAssignedToMe, isSystemAssigned, formatDate } from './utils/utils';
import { useDialog } from './components/AppDialog';

const App: React.FC = () => {
  const { showAlert, showConfirm, showToast, showBanner } = useDialog();
  const [user, setUser] = useState<User | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [editingRequest, setEditingRequest] = useState<FormData | null>(null);
  const [view, setView] = useState<'login' | 'onboarding' | 'password-change' | 'menu' | 'form' | 'dashboard' | 'my-requests' | 'analyst-view' | 'users' | 'audit' | 'execution' | 'settings'>('login');
  const [notification, setNotification] = useState<{ message: string; subtext?: string; type?: 'success' | 'info' } | null>(null);

  const [allRequests, setAllRequests] = useState<FormData[]>([]);
  const allRequestsRef = useRef<FormData[]>([]);
  const isUpdatingRef = useRef(false);
  const pendingUpdatesRef = useRef<Record<string, { status: StudyStatus; assignedTo?: string; timestamp: number }>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const notifiedHoldIdsRef = useRef<Set<string>>(new Set());
  const [autoOpenRequestId, setAutoOpenRequestId] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // --- Central de Notificações ---
  const [adminNotifications, setAdminNotifications] = useState<{ req: FormData; type: string; analyst?: string; deadline: string }[]>([]);
  const [showNotifBox, setShowNotifBox] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [historyModalAlert, setHistoryModalAlert] = useState<{ type: string; analyst?: string; acks: { name: string; time: string; status: string }[] } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const dialogVisibleRef = useRef(false);
  const lastCheckTimestamp = useRef<number>(0);

  // Fechar ao clicar fora - Central de Alertas
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // FIX: Ignorar fechar se o histórico de leitura estiver aberto, para manter conforme solicitado
      if (notifRef.current && !notifRef.current.contains(event.target as Node) && !historyModalAlert) {
        setShowNotifBox(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [historyModalAlert]);

  useEffect(() => {
    const initData = async () => {
      if (isUpdatingRef.current) {
        console.log('[Sync] Skipping - currently updating');
        return;
      }
      const [requests, users] = await Promise.all([
        StorageService.getRequests(),
        StorageService.getUsers()
      ]);
      console.log('[Sync] Fetched from server, status values:', requests.filter(r => r.id === '3').map(r => ({ id: r.id, status: r.status, studyNumber: r.studyNumber })));
      if (!isUpdatingRef.current) {
        // Apply pending updates to the fresh requests from server
        // This prevents "reversion" while the server is still processing/syncing
        const now = Date.now();
        const mergedRequests = requests.map(req => {
          const pending = pendingUpdatesRef.current[req.id];
          const currentLocal = allRequests.find(r => r.id === req.id);
          // Protection window: 30 seconds (increased to prevent sync reversion during status transitions)
          // Also check if local status is different from server status and is more recent
          if (pending && (now - pending.timestamp < 30000)) {
            console.log(`[SyncProtection] Preserving pending status for ${req.id}: ${pending.status} (server has ${req.status})`);
            return {
              ...req,
              status: pending.status,
              assignedTo: pending.assignedTo !== undefined ? pending.assignedTo : req.assignedTo
            };
          }
          // Additional protection: if local status was recently changed and is different from server, keep local
          if (currentLocal && currentLocal.status !== req.status) {
            const localUpdateTime = new Date(currentLocal.updatedAt).getTime();
            if (now - localUpdateTime < 30000) {
              console.log(`[SyncProtection] Keeping local status for ${req.id}: local=${currentLocal.status}, server=${req.status}`);
              return currentLocal;
            }
          }
          return req;
        });
        setAllRequests(mergedRequests);
        setAllUsers(users);
      }
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
    allRequestsRef.current = allRequests;
  }, [allRequests]);

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
      // Atualizar lastAccess para hoje
      const userWithAccess = { ...loggedUser, lastAccess: new Date().toISOString() };

      // Salvar/Atualizar no Banco de Dados Local
      const savedUser = await StorageService.saveUser(userWithAccess);
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

  // 3s Auto-sync for requests (merge strategy to prevent flickering)
  useEffect(() => {
    if (!user) return;

    console.log('[App] Starting 3s auto-sync polling...');
    const intervalId = setInterval(async () => {
      if (isUpdatingRef.current) return;
      try {
        const areaParam = user.area ? (REVERSE_AREA_MAPPING[user.area] || user.area) : undefined;
        const serverRequests = await StorageService.getRequests(user.id, user.role, areaParam);
        if (isUpdatingRef.current) return; // double check
        if (!serverRequests) return;

        // Merge strategy: server data is authoritative, but keep local items
        // that the server might not have yet (recently validated/moved/deleted)
        setAllRequests(prev => {
          const serverIds = new Set(serverRequests.map(r => String(r.id)));
          const now = Date.now();

          // Cleanup expired pending updates (older than 10s)
          Object.keys(pendingUpdatesRef.current).forEach(id => {
            if (now - pendingUpdatesRef.current[id].timestamp > 10000) {
              delete pendingUpdatesRef.current[id];
            }
          });

          // Keep local-only items that were updated in the last 60s
          const recentLocal = prev.filter(r => {
            if (serverIds.has(String(r.id))) {
              // If it's on server but in our pending list, WE KEEP it to prevent reversion
              if (pendingUpdatesRef.current[String(r.id)]) return true;
              return false;
            }
            const updateTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
            return (Date.now() - updateTime) < 60000;
          });

          // Merge server results, but override status if it's in our pending list
          const merged = serverRequests.map(sReq => {
            const pending = pendingUpdatesRef.current[String(sReq.id)];
            if (pending) {
              return {
                ...sReq,
                status: pending.status !== undefined ? pending.status : sReq.status,
                assignedTo: pending.assignedTo !== undefined ? pending.assignedTo : sReq.assignedTo
              };
            }
            return sReq;
          });

          // Add only unique local items
          const finalResult = [...merged];
          recentLocal.forEach(loc => {
            if (!merged.some(m => String(m.id) === String(loc.id))) {
              finalResult.push(loc);
            }
          });

          // Global Sort: Most recent first (using requestDate, createdAt or updatedAt)
          return finalResult.sort((a, b) => {
            const dateA = new Date(a.requestDate || a.createdAt || a.updatedAt || 0).getTime();
            const dateB = new Date(b.requestDate || b.createdAt || b.updatedAt || 0).getTime();
            return dateB - dateA;
          });
        });
      } catch (err) {
        console.warn('[Auto-sync] Error fetching updates:', err);
      }
    }, 3000);

    return () => {
      console.log('[App] Stopping auto-sync polling...');
      clearInterval(intervalId);
    };
  }, [user]);

  // --- Sistema de Alertas de Expiração com Recorrência de 5 min ---
  useEffect(() => {
    if (!user) return;
    if (!allRequests || allRequests.length === 0) return;

    const checkExpirations = async () => {
      const nowTs = Date.now();
      const elapsed = nowTs - lastCheckTimestamp.current;

      console.log(`[AlertCheck] Attempting check... (Elapsed: ${Math.round(elapsed / 1000)}s)`);

      if (lastCheckTimestamp.current !== 0 && elapsed < 300000) {
        console.log("[AlertCheck] ⏳ Skipping check (interval < 5min)");
        return;
      }

      lastCheckTimestamp.current = nowTs;
      console.log("[AlertCheck] 🚀 Starting expiration verification...");

      const getTodayISO = () => {
        const d = new Date();
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(d);
        const day = parts.find(p => p.type === 'day')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const year = parts.find(p => p.type === 'year')?.value;
        return `${year}-${month}-${day}`;
      };

      const normalizeDate = (ds: any) => {
        if (!ds) return '';
        const str = String(ds).trim();
        if (!isNaN(Number(str)) && !str.includes('-') && !str.includes('/')) {
          const excelDate = Number(str);
          if (excelDate > 40000) {
            try {
              const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
              return jsDate.toISOString().split('T')[0];
            } catch (e) { return str; }
          }
        }
        if (str.includes('/')) {
          const [d, m, y] = str.split('/');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return str.split('T')[0];
      };

      const getAlertThresholdDate = () => {
        const d = new Date();
        const ahead = new Date(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 365 dias - mostrar todos os estudos
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(ahead);
        const day = parts.find(p => p.type === 'day')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const year = parts.find(p => p.type === 'year')?.value;
        return `${year}-${month}-${day}`;
      };

      const resolveNameLocal = (id: string | undefined | null, fallbackName?: string) => {
        // Prioridade: assignedToName (do banco) > busca em allUsers > fallback > id
        if (fallbackName && fallbackName !== id) return fallbackName;
        if (!id) return 'Sistema';
        if (isSystemAssigned(id)) return 'ADRSIS - Sistema';
        const found = allUsers.find(u =>
          u.id === id || u.email === id || (u.sap && id.replace(/^0+/, '') === u.sap.replace(/^0+/, ''))
        );
        if (found) return found.name;
        return id;
      };

      const today = getTodayISO();
      const threshold = getAlertThresholdDate();

      // Verificar se é o primeiro acesso do dia para mostrar pop-up de alerta
      const lastAccessDate = user.lastAccess ? user.lastAccess.split('T')[0] : null;
      const isFirstAccessToday = lastAccessDate !== today;

      const expiringMyRequests: { req: FormData; deadline: string }[] = [];
      const expiringCommonQueue: { req: FormData; deadline: string }[] = [];
      const expiringAdminReport: { req: FormData; analyst: string; deadline: string }[] = [];

      allRequests.forEach(r => {
        const deadline = normalizeDate(r.estimatedDeliveryDate);
        if ([StudyStatus.CONCLUIDO, StudyStatus.CANCELADO, StudyStatus.REJEITADO].includes(r.status)) return;
        if (['Concluído', 'Cancelado', 'Rejeitado'].includes(String(r.status))) return;

        // Debug: Log para entender o que está acontecendo com cada estudo
        console.log(`[Debug] Study ${r.id} (${r.studyNumber}): deadline=${deadline}, threshold=${threshold}, status=${r.status}, assignedTo=${r.assignedTo}`);

        if (!deadline) return;

        if (deadline <= threshold) {
          const isMe = isAssignedToMe(r.assignedTo, user);
          const isSystem = isSystemAssigned(r.assignedTo);
          console.log(`[Debug] Study ${r.id}: isMe=${isMe}, isSystem=${isSystem}, user.role=${user.role}`);

          if (isMe) expiringMyRequests.push({ req: r, deadline });
          else if (isSystem) expiringCommonQueue.push({ req: r, deadline });
          else if (user.role === UserRole.ADM) {
            expiringAdminReport.push({ req: r, analyst: resolveNameLocal(r.assignedTo, r.assignedToName), deadline });
          }
        }
      });

      console.log('[Debug] Expiring counts - Minha:', expiringMyRequests.length, 'Comum:', expiringCommonQueue.length, 'Admin:', expiringAdminReport.length);

      if (expiringMyRequests.length > 0 || expiringCommonQueue.length > 0 || expiringAdminReport.length > 0) {
        const newNotifs = [
          ...expiringMyRequests.map(i => ({ ...i, type: 'Minha' })),
          ...expiringCommonQueue.map(i => ({ ...i, type: 'Comum' })),
          ...expiringAdminReport.map(i => ({ ...i, type: 'Relatório' }))
        ];
        setAdminNotifications(newNotifs);
        setHasNewNotifications(true);

        // Mostrar pop-up de alerta para analistas SEMPRE que houver estudos (não apenas no primeiro acesso)
        if (user.role === UserRole.ANALISTA && view !== 'execution' && view !== 'analyst-view') {
          if (dialogVisibleRef.current) return;

          dialogVisibleRef.current = true;
          const itemsToAlert = [...expiringMyRequests, ...expiringCommonQueue];

          const getStatusMessage = (status: string) => {
            const messages: { [key: string]: string } = {
              'Pendente': 'Estudo aguarda validação. Prazo está próximo - verifique com o validando.',
              'Em Análise': 'Estudo em análise. Verifique o andamento com o responsável.',
              'Aguardando Execução': 'Estudo liberado para execução. Inicie os trabalhos imediatamente.',
              'Em Execução': 'Estudo em andamento. O prazo está próximo - finalize urgente.',
              'Aguardando Informações': 'Estudo parado aguardando informações. Resolva as pendências.',
              'Controle de Qualidade': 'Estudo enviado ao CQ. Aguarde validação ou corrija falhas.',
              'Reprovado pelo CQ': 'Estudo reprovado. Correções necessárias - reabra a execução.',
              'Enviado sem CQ': 'Estudo enviado ao cliente. Falta finalizar a conclusão.',
              'Aprovado pelo CQ': 'Estudo aprovado. Falta apenas finalizar e enviar ao solicitante.',
              'Aberto': 'Estudo aberto aguardando atribuição. Execute ou reassigne.'
            };
            return messages[status] || 'Estudo requer atenção urgente.';
          };

          for (const item of itemsToAlert) {
            const isMeItem = expiringMyRequests.some(m => m.req.id === item.req.id);
            const label = isMeItem ? "⚠️ Minha Solicitação" : "📋 Fila Comum";
            const color = isMeItem ? "text-orange-600" : "text-blue-600";
            const statusMsg = getStatusMessage(String(item.req.status));

            const message = `
              <div class="space-y-3 pt-1">
                <strong class="${color} block mb-1 uppercase text-xs">${label}:</strong>
                <p class="text-sm font-semibold">Estudo: ${item.req.studyNumber}</p>
                <p class="text-sm">Status: <span class="text-purple-600 font-semibold">${item.req.status}</span></p>
                <p class="text-sm">Prazo: <span class="text-red-600 font-semibold">${formatDate(item.deadline)}</span></p>
                <p class="mt-3 text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                  <i class="fa-solid fa-circle-info mr-1"></i>
                  ${statusMsg}
                </p>
                <p class="mt-2 text-[10px] text-slate-400 italic border-t pt-2">Sua confirmação de leitura será registrada para este estudo ao clicar em OK.</p>
              </div>
            `;

            await showAlert(message, 'Alerta de Prazo de Expiração', 'warning');

            // Registrar cada alerta com o status atual da solicitação
            // Assim o ADM pode ver todo o histórico de alertas e em qual status cada um foi gerado
            const r = item.req;
            const ackTimestamp = new Date().toISOString();
            const updateData: Partial<FormData> = {
              user_id: r.user_id || user.id,
              alertConfirmations: [...(r.alertConfirmations || []), `${user.name}|${ackTimestamp}|${item.req.status}`],
              lastAnalystAlertDate: today
            };
            await updateRequestStatus(r.id, r.status, undefined, r.assignedTo, updateData);
          }
          dialogVisibleRef.current = false;
        }
      }
    };

    checkExpirations();
    const intervalId = setInterval(checkExpirations, 300000); // 5 minutos exatos
    return () => clearInterval(intervalId);
  }, [allRequests, user, allUsers]);

  // Monitoramento Global de Notificações (Pausa / Resposta)
  useEffect(() => {
    if (!user || allRequests.length === 0) return;

    // 1. Notificar Analista sobre Respostas
    if ((user.role === UserRole.ANALISTA || user.role === UserRole.ADM)) {
      const answered = allRequests.filter(r =>
        r.status === StudyStatus.AGUARDANDO_INFORMACAO &&
        isAssignedToMe(r.assignedTo, user) &&
        !!r.holdResponse &&
        !r.holdResponseSeen &&
        !notifiedHoldIdsRef.current.has(`${r.id}-resp-${r.holdResponse}`)
      );
      answered.forEach(req => {
        showBanner(
          `As informações solicitadas para o Estudo ${req.studyNumber} foram enviadas.`,
          'success',
          () => {
            setAutoOpenRequestId(req.id);
            // Captura o status atual no momento do clique (evita stale closure se o status mudou via outra via)
            const currentReq = allRequestsRef.current.find(r => r.id === req.id);
            const statusToUse = currentReq?.status || req.status;
            updateRequestStatus(req.id, statusToUse, undefined, req.assignedTo, { holdResponseSeen: true });
          },
          'Ver',
          () => {
            // Captura o status atual no momento de fechar (evita stale closure se o status mudou via outra via)
            const currentReq = allRequestsRef.current.find(r => r.id === req.id);
            const statusToUse = currentReq?.status || req.status;
            updateRequestStatus(req.id, statusToUse, undefined, req.assignedTo, { holdResponseSeen: true });
          }
        );
        notifiedHoldIdsRef.current.add(`${req.id}-resp-${req.holdResponse}`);
      });
    }

    // 2. Notificar Solicitante sobre Pedidos de Informação
    if (user.role === UserRole.SOLICITANTE) {
      const pending = allRequests.filter(r =>
        r.status === StudyStatus.AGUARDANDO_INFORMACAO &&
        r.user_id === user.id &&
        !r.holdResponse &&
        !r.holdRequestSeen &&
        !notifiedHoldIdsRef.current.has(`${r.id}-req-${r.holdReason || ''}`)
      );
      pending.forEach(req => {
        showBanner(
          `O Estudo ${req.studyNumber} exige informações adicionais.`,
          'info',
          () => {
            setAutoOpenRequestId(req.id);
            // Captura o status atual no momento do clique
            const currentReq = allRequestsRef.current.find(r => r.id === req.id);
            const statusToUse = currentReq?.status || req.status;
            updateRequestStatus(req.id, statusToUse, undefined, req.assignedTo, { holdRequestSeen: true });
          },
          'Ver',
          () => {
            // Captura o status atual no momento de fechar
            const currentReq = allRequestsRef.current.find(r => r.id === req.id);
            const statusToUse = currentReq?.status || req.status;
            updateRequestStatus(req.id, statusToUse, undefined, req.assignedTo, { holdRequestSeen: true });
          }
        );
        notifiedHoldIdsRef.current.add(`${req.id}-req-${req.holdReason || ''}`);
      });
    }
  }, [allRequests, user, showBanner]); // ref doesn't need to be in deps, but allRequests ensures it checks on every sync

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
    const ok = await showConfirm('Deseja sincronizar todos os arquivos com o servidor de arquivos local? Isso garantirá que todos os estudos antigos tenham suas pastas e arquivos na nova estrutura.', 'Sincronizar Storage');
    if (ok) {
      setIsSyncing(true);
      setSyncStatus('Iniciando...');
      try {
        await StorageService.migrateRequestsToStorage((msg: string) => setSyncStatus(msg));
        showToast('Sincronização concluída!', 'success');
        const updatedRequests = await StorageService.getRequests();
        setAllRequests(updatedRequests);
      } catch (err) {
        showToast('Erro ao sincronizar.', 'error');
      } finally {
        setIsSyncing(false);
        setSyncStatus('');
      }
    }
  };

  const handleRefreshData = async () => {
    console.log('[Refresh] Starting FULL data refresh...');
    setIsSyncing(true);
    setSyncStatus('Atualizando dados...');
    try {
      isUpdatingRef.current = true;

      // Primeiro sincroniza os arquivos/pastas
      setSyncStatus('Sincronizando arquivos...');
      console.log('[Refresh] Calling migrateRequestsToStorage...');
      await StorageService.migrateRequestsToStorage((msg: string) => {
        console.log('[Refresh] Migration progress:', msg);
        setSyncStatus(msg);
      });

      // Atualiza Users
      setSyncStatus('Atualizando usuários...');
      console.log('[Refresh] Fetching users...');
      const users = await StorageService.getUsers();
      console.log('[Refresh] Users fetched:', users.length);

      // Update Users state
      setAllUsers(users);

      // Atualiza Requests (Tabela principal)
      setSyncStatus('Atualizando solicitações...');
      console.log('[Refresh] Fetching requests, user:', user?.id, 'role:', user?.role, 'area:', user?.area);
      const requests = await StorageService.getRequests(user?.id, user?.role, user?.area);
      console.log('[Refresh] Requests fetched from API:', requests.length);

      // Merge com updates pendentes locales
      const mergedRequests = requests.map(req => {
        const pending = pendingUpdatesRef.current[req.id];
        const currentLocal = allRequests.find(r => r.id === req.id);
        if (pending && (Date.now() - pending.timestamp < 30000)) {
          return {
            ...req,
            status: pending.status,
            assignedTo: pending.assignedTo !== undefined ? pending.assignedTo : req.assignedTo
          };
        }
        if (currentLocal && currentLocal.status !== req.status) {
          const localUpdateTime = new Date(currentLocal.updatedAt).getTime();
          if (Date.now() - localUpdateTime < 30000) {
            return currentLocal;
          }
        }
        return req;
      });

      console.log('[Refresh] Setting merged requests:', mergedRequests.length);
      setAllRequests(mergedRequests);
      console.log('[Refresh] ✅ All data updated successfully');

      showToast('Dados atualizados!', 'success');
    } catch (err) {
      console.error('[Refresh] Erro ao atualizar dados:', err);
      showToast('Erro ao atualizar dados: ' + (err?.message || 'Erro desconhecido'), 'error');
    } finally {
      isUpdatingRef.current = false;
      setIsSyncing(false);
      setSyncStatus('');
      console.log('[Refresh] Done');
    }
  };


  const handleLogout = () => {
    setUser(null);
    setView('login');
    setEditingRequest(null);
  };

  const updateRequestStatus = async (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => {
    isUpdatingRef.current = true;
    const originalRequest = allRequests.find(r => r.id === id);
    try {
      const currentRequests = allRequests || [];
      let updatedRequestForEmail: { type: 'approval' | 'rejection' | 'completion' | 'qc_request' | 'qc_approval' | 'qc_rejection' | 'pre_qc_response' | 'pre_qc_sys' | null; request?: FormData; reason?: string } = { type: null };
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
            rejectionReason: status === StudyStatus.REJEITADO ? (reason || req.rejectionReason) : req.rejectionReason,
            holdReason: status === StudyStatus.AGUARDANDO_INFORMACAO ? (reason || req.holdReason) : (req.status === StudyStatus.AGUARDANDO_INFORMACAO ? null : req.holdReason),
            holdResponse: (status === StudyStatus.AGUARDANDO_INFORMACAO && req.status !== StudyStatus.AGUARDANDO_INFORMACAO) ? null : req.holdResponse,
            holdResponseSeen: (status === StudyStatus.AGUARDANDO_INFORMACAO && req.status !== StudyStatus.AGUARDANDO_INFORMACAO) ? false : (additionalData?.holdResponseSeen !== undefined ? additionalData.holdResponseSeen : req.holdResponseSeen),
            holdRequestSeen: (status === StudyStatus.AGUARDANDO_INFORMACAO && req.status !== StudyStatus.AGUARDANDO_INFORMACAO) ? false : (additionalData?.holdRequestSeen !== undefined ? additionalData.holdRequestSeen : req.holdRequestSeen),
            cartaGeneratedAt: status === StudyStatus.REJEITADO ? null : req.cartaGeneratedAt,
            assignedTo: assignedTo !== undefined ? assignedTo : req.assignedTo,
            startedAt: status === StudyStatus.EM_EXECUCAO ? (req.startedAt || new Date().toISOString()) : req.startedAt,
            completedAt: status === StudyStatus.CONCLUIDO ? (req.completedAt || new Date().toISOString()) : req.completedAt,
            qcRequestDate: status === StudyStatus.CONTROLE_QUALIDADE ? (req.qcRequestDate || new Date().toISOString()) : req.qcRequestDate,
            updatedAt: new Date().toISOString(),
            estimatedDeliveryDate: additionalData?.estimatedDeliveryDate !== undefined ? additionalData.estimatedDeliveryDate : req.estimatedDeliveryDate,
            userId: user?.email || req.userId,
            lastModifiedBy: user?.name || req.lastModifiedBy,
            userSap: user?.sap || req.userSap || null
          };

          // Limpar dados de QC da revisão anterior quando enviando para nova revisão de CQ
          if (status === StudyStatus.CONTROLE_QUALIDADE && req.status !== StudyStatus.CONTROLE_QUALIDADE) {
            updated.qcData = {
              qcCriticalFailures: {},
              qcSecondaryFailures: {},
              qcStatusCQ: undefined,
              qcComments: '',
            };
          }

          if ((status === StudyStatus.VALIDADO || status === StudyStatus.AGUARDANDO_EXECUCAO) && req.status !== status) {
            updatedRequestForEmail.type = 'approval';
            updatedRequestForEmail.request = updated;
          } else if (status === StudyStatus.REJEITADO && req.status !== StudyStatus.REJEITADO) {
            updatedRequestForEmail.type = 'rejection';
            updatedRequestForEmail.request = updated;
            updatedRequestForEmail.reason = reason || req.rejectionReason || 'Não se adequa aos critérios técnicos';

            // Delete previously generated Carta PDF when study is rejected
            StorageService.deleteCartaResposta(req.studyNumber);
          } else if (status === StudyStatus.CONCLUIDO && req.status !== StudyStatus.CONCLUIDO) {
            updatedRequestForEmail.type = 'completion';
            updatedRequestForEmail.request = updated;
          } else if (status === StudyStatus.CONTROLE_QUALIDADE && req.status !== StudyStatus.CONTROLE_QUALIDADE) {
            updatedRequestForEmail.type = 'qc_request';
            updatedRequestForEmail.request = {
              ...updated,
              // Limpar dados de QC da revisão anterior para nova avaliação
              qcData: {
                ...updated.qcData,
                qcCriticalFailures: {},
                qcSecondaryFailures: {},
                qcStatusCQ: undefined,
                qcComments: '',
              }
            };
          } else if (status === StudyStatus.ENVIADO_SEM_CQ && req.status !== StudyStatus.ENVIADO_SEM_CQ) {
            updatedRequestForEmail.type = 'pre_qc_response';
            updatedRequestForEmail.request = updated;
          } else if (status === StudyStatus.APROVADO_CQ && req.status !== StudyStatus.APROVADO_CQ) {
            updatedRequestForEmail.type = 'qc_approval';
            updatedRequestForEmail.request = updated;
            updatedRequestForEmail.reason = reason; // Observations
          } else if (status === StudyStatus.REJEITADO || status === StudyStatus.REPROVADO_CQ) {
            if (req.status === StudyStatus.CONTROLE_QUALIDADE) {
              updatedRequestForEmail.type = 'qc_rejection';
              updatedRequestForEmail.request = updated;
              updatedRequestForEmail.reason = reason || req.rejectionReason || 'Vistoria técnica não aprovada';
            }
          }

          if (status === StudyStatus.AGUARDANDO_EXECUCAO && req.status !== StudyStatus.AGUARDANDO_EXECUCAO) {
            requestToCreate = updated;
          }

          return updated;
        }
        return req;
      });

      setAllRequests(updatedList);

      // Criar pastas do estudo quando validado (330 -> 200)
      const targetReq = currentRequests.find(r => r.id === id);
      if (targetReq && (status === StudyStatus.AGUARDANDO_EXECUCAO || status === StudyStatus.VALIDADO) && targetReq.studyNumber?.startsWith('PROV-')) {
        const cleanStudyNumber = targetReq.studyNumber.replace('PROV-', '');
        const userFolderPath = user?.folderPath;
        if (userFolderPath && cleanStudyNumber.length >= 10) {
          const ano = cleanStudyNumber.substring(0, 4);
          const sequencial = cleanStudyNumber.substring(4, 8);
          const rev = cleanStudyNumber.substring(8, 10);
          const pastas = ['solicitacao', 'resposta', 'calculos', 'outros'];
          
          await Promise.all(pastas.map(async (pasta) => {
            const folderPath = `${userFolderPath}\\${ano}\\${sequencial}\\${rev}\\${pasta}`;
            try {
              await fetch('/api/folders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath }),
              });
            } catch (err) {
              console.error('[updateRequestStatus] Erro ao criar pasta:', err);
            }
          }));
          
          // Gerar e salvar PDF do formulário na pasta solicitacao
          const formPdfPath = `${userFolderPath}\\${ano}\\${sequencial}\\${rev}\\solicitacao\\Formulario_${cleanStudyNumber}.pdf`;
          try {
            await fetch('/api/folders/save-form-pdf', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studyId: targetReq.id,
                studyNumber: cleanStudyNumber,
                targetPath: formPdfPath
              }),
            });
          } catch (err) {
            console.error('[updateRequestStatus] Erro ao salvar PDF do formulário:', err);
          }
        }
      }

      // Track this update as "pending" to prevent sync reversion, but only if status or analyst changed.
      // This prevents background updates (like alert acknowledgments) from locking the UI status.
      const isStatusChange = status !== originalRequest?.status;
      const isAnalystChange = assignedTo !== undefined && assignedTo !== originalRequest?.assignedTo;

      if (isStatusChange || isAnalystChange) {
        pendingUpdatesRef.current[id] = {
          status,
          assignedTo: assignedTo !== undefined ? assignedTo : originalRequest?.assignedTo,
          timestamp: Date.now()
        };
      }

      const updatedReq = updatedList.find(r => r.id === id);
      const needsRename = (status === StudyStatus.AGUARDANDO_EXECUCAO || status === StudyStatus.VALIDADO) && updatedReq?.previousStudy?.startsWith('PROV-');
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

          // NEW: Upload any NEW files attached during status update (e.g. from Execution)
          // CONFORME SOLICITADO: Pular upload se status for Em Análise, Pendente ou Rejeitado
          const skipUploadStatus = ['100', '330', '240', '290', 'Em Análise', 'Pendente', 'Rejeitado'];
          const currentStatus = String(updatedReq.status);

          if (!skipUploadStatus.includes(currentStatus)) {
            if (updatedReq.selectedFiles && updatedReq.selectedFiles.length > 0) {
              for (const f of updatedReq.selectedFiles) {
                if (f instanceof File) {
                  await StorageService.uploadFile(updatedReq.id, 'Solicitacao', f);
                }
              }
            }
            if (updatedReq.categorizedFiles) {
              for (const category of Object.keys(updatedReq.categorizedFiles)) {
                const catFiles = updatedReq.categorizedFiles[category];
                if (catFiles && catFiles.length > 0) {
                  for (const f of catFiles) {
                    if (f instanceof File) {
                      await StorageService.uploadFile(updatedReq.id, category, f);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Falha ao salvar request ou mover arquivos no servidor:', err);
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
              handleSendEmail(EmailService.generateCompletionEmail(updatedRequestForEmail.request));
            } else if (updatedRequestForEmail.type === 'qc_request') {
              // Analyst -> QC Users: study finished execution
              const analystId = updatedRequestForEmail.request.assignedTo;
              let analyst = allUsers.find(u => u.id === analystId);

              // Fallback: usar usuário atual se não encontrar analista
              if (!analyst && user) {
                analyst = user;
              }

              if (analyst && analyst.email) {
                console.log('[QC Email] Analyst:', analyst.name, analyst.email);
                const qcUsers = allUsers.filter(u =>
                  (u.role === UserRole.ADM || u.permissions?.includes('controle_qualidade')) &&
                  u.email && u.email !== analyst.email
                );
                console.log('[QC Email] QC Users found:', qcUsers.map(u => ({ name: u.name, email: u.email })));

                // Se há usuários de QC, enviar para todos em cópia
                if (qcUsers.length > 0) {
                  // Pegar o primeiro destinatário principal e incluir os outros em CC
                  const primaryRecipient = qcUsers[0].email;
                  const ccRecipients = qcUsers.slice(1).map(u => u.email).join(',');

                  console.log('[QC Email] Sending to:', primaryRecipient, 'CC:', ccRecipients);

                  // Gerar email com CC
                  const emailData = EmailService.generateQCRequestEmail(
                    updatedRequestForEmail.request,
                    analyst.email,
                    analyst.name,
                    primaryRecipient
                  );

                  // Adicionar CC se houver mais destinatários
                  if (ccRecipients) {
                    emailData.ccEmail = ccRecipients;
                  }

                  handleSendEmail(emailData);
                }
              } else {
                console.log('[QC Email] Analyst not found! analystId:', analystId, 'user:', user?.email);
              }
            } else if (updatedRequestForEmail.type === 'pre_qc_response') {
              const analystId = updatedRequestForEmail.request.assignedTo;
              let analyst = allUsers.find(u => u.id === analystId);

              // Fallback: usar usuário atual se não encontrar analista
              if (!analyst && user) {
                analyst = user;
              }

              console.log('[PreQC] Analyst:', analyst?.name, analyst?.email);

              if (analyst && analyst.email) {
                console.log('[PreQC] Sending pre-QC response to requester...');
                // 1. Send response to requester
                handleSendEmail(EmailService.generatePreQCResponseEmail(
                  updatedRequestForEmail.request,
                  analyst.email,
                  analyst.name
                ));

                console.log('[PreQC] Sending pre-QC system justification...');
                // 2. Send justification to PRGC system (delayed)
                setTimeout(() => {
                  if (updatedRequestForEmail.request && analyst) {
                    handleSendEmail(EmailService.generatePreQCSysEmail(
                      updatedRequestForEmail.request,
                      analyst.email,
                      analyst.name
                    ));
                  }
                }, 600);
              } else {
                console.log('[PreQC] Analyst not found, using user as fallback');
                // Try with current user
                if (user && user.email) {
                  handleSendEmail(EmailService.generatePreQCResponseEmail(
                    updatedRequestForEmail.request,
                    user.email,
                    user.name || 'Analista'
                  ));
                }
              }

              // Important: After sending without QC, it immediately enters the QC queue
              updateRequestStatus(updatedRequestForEmail.request.id, StudyStatus.CONTROLE_QUALIDADE);
            } else if ((updatedRequestForEmail.type === 'qc_approval' || updatedRequestForEmail.type === 'qc_rejection') && updatedRequestForEmail.request) {
              const analystId = updatedRequestForEmail.request.assignedTo;
              console.log('[QC Email] Searching for analyst, assignedTo:', analystId);
              let analyst = allUsers.find(u => 
                u.id === analystId || 
                u.email.toLowerCase() === analystId?.toLowerCase() ||
                u.name.toLowerCase() === analystId?.toLowerCase() ||
                u.gb?.toLowerCase() === analystId?.toLowerCase()
              );
              // Fallback: usar usuário atual se não encontrar
              if (!analyst && user) {
                console.log('[QC Email] Analyst not found, using current user:', user.name);
                analyst = user;
              }
              // Get supervisor name from qcData if available
              const supervisorName = updatedRequestForEmail.request.qcData?.qcSupervisor || user?.name || 'Gestor APR';
              const supervisorUser = allUsers.find(u => u.name === supervisorName);
              if (analyst && analyst.email) {
                console.log('[QC Email] Analyst found:', analyst.name, analyst.email);
                if (updatedRequestForEmail.type === 'qc_approval') {
                  const emailData = EmailService.generateQCApprovalAnalystEmail(
                    updatedRequestForEmail.request,
                    analyst.email,
                    analyst.name,
                    supervisorName,
                    updatedRequestForEmail.reason
                  );
                  // Set sender to supervisor
                  emailData.senderEmail = supervisorUser?.email || user?.email;
                  emailData.senderName = supervisorName;
                  handleSendEmail(emailData);
                } else {
                  const emailData = EmailService.generateQCRejectionAnalystEmail(
                    updatedRequestForEmail.request,
                    analyst.email,
                    analyst.name,
                    supervisorName,
                    updatedRequestForEmail.reason || 'Necessita readequação técnica.'
                  );
                  // Set sender to supervisor
                  emailData.senderEmail = supervisorUser?.email || user?.email;
                  emailData.senderName = supervisorName;
                  handleSendEmail(emailData);
                }
              }
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
        const year = requestToCreate.studyNumber?.match(/APR-(\d{4})/)?.[1] || new Date().getFullYear().toString();
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
      setNotification({
        message: "Erro de Sincronização",
        subtext: "Ocorreu uma falha ao salvar as alterações no servidor.",
        type: 'info'
      });
      // Reverter estado local se originalRequest existir
      if (originalRequest) {
        setAllRequests(prev => prev.map(r => r.id === id ? originalRequest : r));
      }
    } finally {
      isUpdatingRef.current = false;
    }
  };

  const handleStartExecution = (request: FormData) => {
    const isFinished = request.status === StudyStatus.CONCLUIDO || request.status === StudyStatus.CONTROLE_QUALIDADE;
    const isPostQC = request.status === StudyStatus.APROVADO_CQ || request.status === StudyStatus.REPROVADO_CQ;

    if (user?.role === UserRole.ANALISTA && request.assignedTo && !isAssignedToMe(request.assignedTo, user) && !isSystemAssigned(request.assignedTo) && !isFinished && !isPostQC) {
      setNotification({ message: "Acesso Negado", subtext: "Este estudo já possui um responsável técnico atribuído.", type: 'info' });
      return;
    }

    // If REPROVADO_CQ, analyst re-opens for corrections → revert to EM_EXECUCAO
    if (request.status === StudyStatus.REPROVADO_CQ) {
      const now = new Date().toISOString();
      const updatedReq = { ...request, status: StudyStatus.EM_EXECUCAO, completedAt: undefined };
      setEditingRequest(updatedReq);
      updateRequestStatus(request.id, StudyStatus.EM_EXECUCAO, undefined, request.assignedTo, { completedAt: undefined });
      setView('execution');
      return;
    }

    // If APROVADO_CQ, analyst opens to finalize (send email & close)
    if (request.status === StudyStatus.APROVADO_CQ) {
      setEditingRequest(request);
      setView('execution');
      return;
    }

    const needsAssignment = user?.role === UserRole.ANALISTA && (!request.assignedTo || isSystemAssigned(request.assignedTo));
    const needsStatusUpdate = request.status === StudyStatus.AGUARDANDO_EXECUCAO;

    const newStatus = needsStatusUpdate ? StudyStatus.EM_EXECUCAO : request.status;
    const newAssignedTo = needsAssignment ? user?.id : request.assignedTo;

    // specialized Mapping Logic (FO.02 / FO.03)
    let specializedMapping: any = {};
    if (request.formType === 'PE.00492-FO.02' && request.gridDataFO02) {
      let numRes = 0;
      let flowRes = 0;
      let numCom = 0;
      let flowCom = 0;

      Object.entries(request.gridDataFO02).forEach(([segment, data]) => {
        const rowSum = (Number(data.atuais) || 0) + (Number(data.y2) || 0) + (Number(data.y5) || 0) + (Number(data.y20) || 0);
        const rowFlow = Number(data.totalQ) || 0;

        if (segment.toLowerCase().includes('residencial')) {
          numRes += rowSum;
          flowRes += rowFlow;
        } else {
          numCom += rowSum;
          flowCom += rowFlow;
        }
      });

      specializedMapping = {
        numClientsRes: numRes,
        totalFlowRes: flowRes,
        numClientsCom: numCom,
        totalFlowCom: flowCom
      };
    } else if (request.formType === 'PE.00492-FO.03') {
      const consumption = Number(request.instantConsumption) || 0;
      specializedMapping = {
        numClientsCom: 1,
        totalFlowCom: consumption
      };
    }

    if (needsStatusUpdate || needsAssignment) {
      const now = new Date().toISOString();
      let updatedStudyNumber = request.studyNumber;

      // Se validado, remover PROV-
      if ((newStatus === StudyStatus.AGUARDANDO_EXECUCAO || newStatus === StudyStatus.VALIDADO) && updatedStudyNumber.startsWith('PROV-')) {
        updatedStudyNumber = updatedStudyNumber.replace('PROV-', '');
      }

      const updatedReq = {
        ...request,
        ...specializedMapping,
        studyNumber: updatedStudyNumber,
        status: newStatus,
        assignedTo: newAssignedTo,
        startedAt: needsStatusUpdate ? now : request.startedAt
      };
      setEditingRequest(updatedReq);
      updateRequestStatus(request.id, newStatus, undefined, newAssignedTo, {
        ...specializedMapping,
        studyNumber: updatedStudyNumber,
        startedAt: needsStatusUpdate ? now : request.startedAt
      });
    } else {
      setEditingRequest(request);
    }

    setView('execution');
  };

  // Ref for debounced storage update to avoid lag on rapid keystrokes/timer updates
  const storageUpdateRef = React.useRef<any>(null);

  const handleUpdateRequestData = (updatedData: FormData) => {
    const dataWithTimestamp = { ...updatedData, updatedAt: new Date().toISOString() };
    // 1. Update UI state IMMEDIATELY (snappy)
    setAllRequests(prev => prev.map(r => r.id === dataWithTimestamp.id ? dataWithTimestamp : r));
    setEditingRequest(dataWithTimestamp);

    // 2. Debounce the PERSISTENCE (expensive)
    if (storageUpdateRef.current) clearTimeout(storageUpdateRef.current);

    // Do not auto-save unsaved drafts (id=0) to avoid database corruption
    if (String(dataWithTimestamp.id) === '0' || !dataWithTimestamp.id) {
      return;
    }

    storageUpdateRef.current = setTimeout(() => {
      StorageService.addRequest(dataWithTimestamp).catch(error => {
        console.error('Error persisting request update:', error);
      });
    }, 1000); // Wait 1 second of inactivity to save
  };

  const handleCancelRequest = (id: string) => {
    updateRequestStatus(id, StudyStatus.CANCELADO);
  };

  const handleStartForm = async (formId: FormType) => {
    // Se for ADM ou Analista E está vindo do Dashboard (não do Menu), redirecionar para o menu de seleção
    // Se já está no menu, permitir criar o formulário normalmente
    if ((user?.role === UserRole.ADM || user?.role === UserRole.ANALISTA) && view !== 'menu') {
      setView('menu');
      return;
    }
    try {
      const nextId = await StorageService.getNextId();
      setEditingRequest({ id: nextId } as any);
      setSelectedForm(formId);
      setView('form');
    } catch (err) {
      console.error('Error starting form:', err);
      // Fallback if ID generation fails
      setEditingRequest(null);
      setSelectedForm(formId);
      setView('form');
    }
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
        (async () => {
          try {
            const nextId = await StorageService.getNextId();

            // Use originalInputs as the base for the revision data
            const baseData = originalRequest.originalInputs || originalRequest;
            const isDifferentUser = user && originalRequest.user_id && originalRequest.user_id !== user.id;

            const revisionData: FormData = {
              ...baseData,
              id: nextId,
              studyNumber: '',
              status: StudyStatus.EM_ANALISE,
              formType: originalRequest.formType,
              studyType: 'Revisão de Estudo',
              previousStudy: originalRequest.studyNumber,
              requestDate: getGMT3ISOString().split('T')[0],
              assignedTo: undefined,
              rejectionReason: undefined,
              selectedFiles: [],
              categorizedFiles: {},
              totalExecutionTime: 0,
              executionStartTime: undefined,
              responseObservations: '',
              qcData: undefined,
              qcRequestDate: undefined,
              completedAt: undefined,
              // Clear validation fields
              gasType: '',
              suggestedPressureRange: '',
              minPressure: '',
              mapReceived: false,
              relevantStudy: false,
              gniName: '',
              studySubType: '',
              difficulty: '',
              validatorObservations: '',
              // Update requester data based on role
              user_id: (user?.role === UserRole.SOLICITANTE) ? (user?.id || originalRequest.user_id) : '',
              userId: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.email : (originalRequest.userId || originalRequest.email)) : '',
              lastModifiedBy: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.name : (originalRequest.lastModifiedBy || originalRequest.requesterName)) : (user?.name || ''),
              requesterName: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.name : originalRequest.requesterName) : '',
              email: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.email : originalRequest.email) : '',
              phone: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.phone : originalRequest.phone) : '',
              requesterArea: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.area : originalRequest.requesterArea) : '',
              naturgyUnit: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.naturgyUnit : originalRequest.naturgyUnit) : ''
            };
            setEditingRequest(revisionData);
            setSelectedForm(originalRequest.formType);
            setView('form');
          } catch (err) {
            console.error('Error getting next ID for revision:', err);
          }
        })();
      } else {
        setNotification({
          message: "Estudo Existente",
          subtext: `Já existe um estudo cadastrado deste local (${existingStudy.studyNumber}) que não foi concluído. Aguarde a conclusão. Status atual: ${existingStudy.status}`,
          type: 'info'
        });
      }
    } else {
      // Criar revisão normalmente
      (async () => {
        try {
          const nextId = await StorageService.getNextId();

          // Use originalInputs as the base for the revision data
          const baseData = originalRequest.originalInputs || originalRequest;
          const isDifferentUser = user && originalRequest.user_id && originalRequest.user_id !== user.id;

          const revisionData: FormData = {
            ...baseData,
            id: nextId,
            studyNumber: '',
            status: StudyStatus.PENDENTE,
            formType: originalRequest.formType,
            studyType: 'Revisão de Estudo',
            previousStudy: originalRequest.studyNumber,
            requestDate: new Date().toISOString().split('T')[0],
            assignedTo: undefined,
            rejectionReason: undefined,
            selectedFiles: [],
            categorizedFiles: {},
            totalExecutionTime: 0,
            executionStartTime: undefined,
            responseObservations: '',
            qcData: undefined,
            qcRequestDate: undefined,
            completedAt: undefined,
            // Clear validation fields
            gasType: '',
            suggestedPressureRange: '',
            minPressure: '',
            mapReceived: false,
            relevantStudy: false,
            gniName: '',
            studySubType: '',
            difficulty: '',
            validatorObservations: '',
            // Update requester data based on role
            user_id: (user?.role === UserRole.SOLICITANTE) ? (user?.id || originalRequest.user_id) : '',
            userId: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.email : (originalRequest.userId || originalRequest.email)) : '',
            lastModifiedBy: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.name : (originalRequest.lastModifiedBy || originalRequest.requesterName)) : (user?.name || ''),
            requesterName: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.name : originalRequest.requesterName) : '',
            email: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.email : originalRequest.email) : '',
            phone: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.phone : originalRequest.phone) : '',
            requesterArea: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.area : originalRequest.requesterArea) : '',
            naturgyUnit: (user?.role === UserRole.SOLICITANTE) ? (isDifferentUser ? user?.naturgyUnit : originalRequest.naturgyUnit) : ''
          };
          setEditingRequest(revisionData);
          setSelectedForm(originalRequest.formType);
          setView('form');
        } catch (err) {
          console.error('Error getting next ID for revision:', err);
        }
      })();
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
    // Para Solicitante: abrir formulário em read-only na view 'form'
    // Para outros (Analista/ADM): abrir painel técnico
    if (user?.role === UserRole.SOLICITANTE) {
      setView('form');
    } else {
      setView('execution');
    }
  };

  const handleViewExecution = (request: FormData) => {
    setEditingRequest(request);
    setSelectedForm(request.formType);
    setView('execution');
  };

  const handleBackToMenu = () => {
    if (user?.role === UserRole.ANALISTA || user?.role === UserRole.ADM) {
      setView('dashboard');
    } else {
      setView('my-requests');
      setEditingRequest(null);
    }
  };

  const handleRequestSubmit = async (newRequest: FormData, pdfFile?: File) => {
    if (isUpdatingRef.current) return;

    // Helper for normalization
    const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";

    // 1. Verificar se é um update de estudo existente (e que não seja um rascunho com id 0)
    const currentRequests = Array.isArray(allRequests) ? allRequests : [];
    const existingRequest = currentRequests.find(r => String(r.id) === String(newRequest.id) && String(newRequest.id) !== '0');
    let isUpdate = !!existingRequest;
    let finalRequest = { ...newRequest };

    isUpdatingRef.current = true;

    try {
      if (existingRequest) {
        const prevStatus = existingRequest.status;
        // Se estava rejeitado, volta para Em Análise ao reenviar
        const status = prevStatus === StudyStatus.REJEITADO ? StudyStatus.EM_ANALISE : prevStatus;
        finalRequest = {
          ...newRequest,
          status,
          rejectionReason: undefined,
          userId: user?.email || newRequest.userId,
          lastModifiedBy: user?.name || newRequest.lastModifiedBy
        };
      } else {
        // 2. É um NOVO estudo - Gerar Metadados (StudyNumber via Servidor)
        const newAddress = normalize(newRequest.address);
        const newCity = normalize(newRequest.city);
        const newTitle = normalize(newRequest.studyTitle || newRequest.clientName || '');

        // Procurar por estudos com mesmo endereço, cidade E título (deduplica por local)
        // NOTA: A decisão do usuário sobre duplicatas já foi tratada pelo modal customizado
        // no FormContainer.tsx. Se o formulário chegou aqui com previousStudy definido,
        // já é uma revisão. Se não, o usuário optou por prosseguir normalmente.
        let isRevision = !!newRequest.previousStudy;

        let studyNumber = '';

        // Assegurar ID válido para novos estudos e revisões
        const nextId = await StorageService.getNextId();

        if (isRevision) {
          // É uma revisão - Pedir próxima revisão ao servidor
          const baseRef = newRequest.previousStudy!;
          const nextNumResult = await StorageService.getNextStudyNumber('revision', baseRef);
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            id: String(newRequest.id) === '0' ? nextId : newRequest.id,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            previousStudy: baseRef,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        } else {
          // Novo estudo - Pedir próximo número global ao servidor
          const nextNumResult = await StorageService.getNextStudyNumber('new');
          studyNumber = nextNumResult.nextNumber;

          finalRequest = {
            ...newRequest,
            id: String(newRequest.id) === '0' ? nextId : newRequest.id,
            studyNumber,
            status: StudyStatus.EM_ANALISE,
            user_id: user?.id || '',
            userId: user?.email || newRequest.userId,
            lastModifiedBy: user?.name || newRequest.lastModifiedBy
          };
        }
      }

      // 3. Atualizar Estado Local IMEDIATAMENTE (Sincronamente)
      setAllRequests(prev => {
        const idx = prev.findIndex(r => r.id === finalRequest.id);
        if (idx > -1) {
          return prev.map(r => r.id === finalRequest.id ? finalRequest : r);
        } else {
          return [finalRequest, ...prev];
        }
      });

      // 4. Fluxo de Persistência no SQL Server
      const submitFlow = async () => {
        try {
          console.log('[App] Persisting request to local SQL Server:', finalRequest.studyNumber);
          await StorageService.addRequest(finalRequest);

          // Success notification ONLY AFTER DB CONFIRMATION
          setNotification({
            message: isUpdate ? "Estudo Atualizado" : "Estudo Enviado",
            subtext: `O estudo ${finalRequest.studyNumber} foi salvo com sucesso.`,
            type: 'success'
          });
          if (user?.role === UserRole.ANALISTA || user?.role === UserRole.ADM) {
            setView('dashboard');
          } else {
            setView('my-requests');
          }
          setEditingRequest(null);

          // NEW: Upload attachments and generated PDF
          if (finalRequest.selectedFiles && finalRequest.selectedFiles.length > 0) {
            for (const f of finalRequest.selectedFiles) {
              if (f instanceof File) {
                await StorageService.uploadFile(finalRequest.id, 'Solicitacao', f);
              }
            }
          }
          if (pdfFile) {
            // Renomear conforme solicitado: Formulário [CÓDIGO].pdf
            const renamedFile = new File([pdfFile], `Formulário ${finalRequest.studyNumber}.pdf`, { type: 'application/pdf' });
            await StorageService.uploadFile(finalRequest.id, 'Solicitacao', renamedFile);
          }

          // Automated email trigger on submit
          setTimeout(() => {
            handleSendEmail(generateEmailForNewRequest(finalRequest));
          }, 500);
        } catch (error) {
          console.error('Error saving request to SQL Server:', error);
          showAlert('Erro ao salvar solicitação no banco de dados local. Verifique sua conexão e tente novamente.', 'Erro ao Salvar', 'error');
        }
      };

      await submitFlow();
    } finally {
      isUpdatingRef.current = false;
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const savedUser = await StorageService.saveUser(updatedUser);
      setAllUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));

      // Update logged in user if they changed their own profile
      if (user?.id === savedUser.id || user?.email.toLowerCase() === savedUser.email.toLowerCase()) {
        setUser(savedUser);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Erro ao salvar no banco de dados. Verifique sua conexão.', 'error');
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
      showAlert('Erro ao excluir usuário no banco de dados.', 'Erro', 'error');
    }
  };

  const handleResetUsers = async () => {
    // Reset para admin não é mais recomendado com DB real, 
    // mas se necessário, poderíamos limpar profiles (exceto adm)
    showAlert('Função de reset desabilitada para segurança do banco de dados.', 'Função Desabilitada', 'warning');
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
      if (isAssignedToMe(r.assignedTo, user)) return true;

      // Se está atribuído a outro colega, ele NÃO vê (exceto ADM, que já tratamos acima)
      if (r.assignedTo && !isAssignedToMe(r.assignedTo, user)) return false;

      // Se não está atribuído a ninguém (Fila Livre):
      // Analistas veem tudo que está Pendente, Em Análise ou Aguardando Execução
      if (r.status === StudyStatus.PENDENTE ||
        r.status === StudyStatus.EM_ANALISE ||
        r.status === StudyStatus.AGUARDANDO_EXECUCAO ||
        r.status === StudyStatus.EM_EXECUCAO ||
        r.status === StudyStatus.CONCLUIDO ||
        r.status === StudyStatus.CANCELADO) {
        return true;
      }

      // Concluídos e Qualidade também somem da visão comum se forem de outros
      return false;
    });
  }, [allRequests, user]);

  if (view === 'login') return <Login onLogin={handleLogin} onCreateAccount={(presetEmail, presetPassword) => {
    // Gerar um ID único para o novo solicitante para não sobrescrever outros com ID vazio
    const newId = `sol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newUser: User = {
      id: newId,
      name: '',
      role: UserRole.SOLICITANTE,
      email: presetEmail || '',
      password: presetPassword || '',
      profileComplete: false
    };
    setUser(newUser);
    setView('onboarding');
  }} />;
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
              <h4 className="text-sm font-semibold text-[#004080]">{notification.message}</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{notification.subtext}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-2 shadow-sm">
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
                <span className="text-[10px] font-semibold text-orange-800">{syncStatus}</span>
              </div>
            )}
            <nav className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-200">
              <button
                onClick={handleRefreshData}
                disabled={isSyncing}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-green-600 hover:bg-green-50 flex items-center gap-2"
                title="Atualizar dados do banco de dados em tempo real"
              >
                <i className={`fa-solid fa-arrows-rotate ${isSyncing ? 'fa-spin' : ''}`}></i>
                Atualizar
              </button>
              {user?.role === UserRole.SOLICITANTE && (
                <button onClick={() => setView('my-requests')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${view === 'my-requests' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Minhas Solicitações</button>
              )}
{(user?.role === UserRole.ADM || user?.role === UserRole.ANALISTA) && (
                <>
                  <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${view === 'dashboard' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Estudos</button>
                  {user?.role === UserRole.ADM && (
                    <>
                      <button onClick={() => setView('users')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${view === 'users' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Usuários</button>
                      <button onClick={() => setView('audit')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${view === 'audit' ? 'bg-[#004080] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Auditoria</button>
                    </>
                  )}
                </>
              )}
            </nav>
            <div className="flex items-center gap-3">
              {user?.role === UserRole.ADM && (
                <div className="relative mr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifBox(!showNotifBox);
                      setHasNewNotifications(false);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border border-slate-200 ${showNotifBox ? 'bg-[#004080] text-white' : 'bg-white text-[#004080] hover:bg-slate-50'
                      }`}
                    title="Central de Alertas de Expiração"
                  >
                    <i className={`fa-solid ${showNotifBox ? 'fa-bell-slash' : 'fa-bell'} text-sm`}></i>
                    {hasNewNotifications && adminNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold animate-bounce">
                        {adminNotifications.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-[#004080] leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-400 mt-1">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center" title="Logout">
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
              currentUser={user || undefined}
              readOnly={editingRequest.status === StudyStatus.CONCLUIDO || editingRequest.status === StudyStatus.CONTROLE_QUALIDADE || editingRequest.status === StudyStatus.APROVADO_CQ}
            />
          )}
          {view === 'dashboard' && (
            <Dashboard
              user={user!}
              requests={visibleRequests}
              allRequests={allRequests}
              allUsers={allUsers}
              onAnalyze={handleAnalyzeRequest}
              onExecute={handleStartExecution}
              onStatusUpdate={updateRequestStatus}
              onViewRequest={handleViewExecution}
              onCreateRequest={handleStartForm}
              autoOpenRequestId={autoOpenRequestId}
              onModalOpened={() => setAutoOpenRequestId(null)}
            />
          )}
          {view === 'my-requests' && user?.role === UserRole.SOLICITANTE && (
            <MyRequests
              requests={visibleRequests}
              allRequests={allRequests}
              currentUser={user}
              onNewRequest={() => setView('menu')}
              onEditRequest={handleEditRequest}
              onCancelRequest={handleCancelRequest}
              onViewRequest={handleViewRequest}
              onRequestRevision={handleRequestRevision}
              onUpdateData={handleUpdateRequestData}
              autoOpenRequestId={autoOpenRequestId}
              onModalOpened={() => setAutoOpenRequestId(null)}
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
          {view === 'audit' && user?.role === UserRole.ADM && (
            <AuditLog currentUser={user} />
          )}
        </div>
      </main>

      {/* Email Preview Modal Removed */}

      <footer className="bg-white border-t border-slate-200 p-6 text-center text-slate-400 text-[10px] font-semibold tracking-wide mt-auto">
        <p>&copy; {new Date().getFullYear()} Naturgy - Portal Técnico.</p>
      </footer>

      {/* ========== MODAIS GLOBAIS DE ALERTAS (Migrados do Dashboard) ========== */}
      {showNotifBox && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
            <div
              ref={notifRef}
              className="bg-white rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] w-full max-w-5xl flex flex-col border border-slate-100 animate-in zoom-in-95 duration-300"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl shrink-0">
                <div className="flex items-center gap-3 text-[#004080]">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base">
                    <i className="fa-solid fa-bell animate-pulse"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight">Central de Alertas de Prazo</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Gestão administrativa de expirações e visualizações</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshData}
                    disabled={isSyncing}
                    className="w-9 h-9 rounded-xl bg-green-50 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center text-sm active:scale-90"
                    title="Atualizar dados"
                  >
                    <i className={`fa-solid fa-arrows-rotate ${isSyncing ? 'fa-spin' : ''}`}></i>
                  </button>
                  <button
                    onClick={() => setShowNotifBox(false)}
                    className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-[#004080] hover:bg-slate-100 transition-all flex items-center justify-center text-sm active:scale-90"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto bg-slate-50/30 p-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                {adminNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-3xl text-green-500 mb-4">
                      <i className="fa-solid fa-check-double"></i>
                    </div>
                    <h4 className="text-lg font-black text-slate-800 uppercase">Tudo em conformidade!</h4>
                    <p className="text-xs text-slate-400 mt-1 font-medium max-w-sm">Não há alertas de expiração pendentes.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/30">
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Estudo</th>
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Responsável</th>
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Status</th>
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Prazo</th>
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Visualização</th>
                          <th className="px-4 py-3 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminNotifications.map((n, idx) => {
                          const acks = (n.req.alertConfirmations || []).map(ack => {
                            const parts = ack.includes('|') ? ack.split('|') : [n.analyst || 'Analista', ack];
                            const name = parts[0] || 'Analista';
                            const time = parts[1] || '';
                            const status = parts[2] || '';
                            return { name, time, status };
                          });

                          return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors duration-200">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-[#004080]">{n.req.studyNumber}</span>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">{n.req.clientName || n.req.studyTitle || 'Sem título'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 border-b border-slate-50">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] ${n.type === 'Minha' ? 'bg-orange-100 text-orange-600' :
                                    n.type === 'Comum' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                    }`}>
                                    <i className={n.type === 'Relatório' ? 'fa-solid fa-user-tie' : 'fa-solid fa-inbox'}></i>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">{n.analyst || (n.type === 'Minha' ? 'EU' : 'Fila Comum')}</p>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{n.type === 'Relatório' ? 'Alerta de Analista' : `Fila: ${n.type}`}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 border-b border-slate-50">
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">
                                  {n.req.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 border-b border-slate-50 font-mono text-[10px]">
                                <span className="text-red-500 font-black bg-red-50 px-2 py-1 rounded-lg border border-red-100 flex items-center justify-center w-fit gap-1">
                                  <i className="fa-solid fa-clock-rotate-left text-[9px]"></i>
                                  {formatDate(n.deadline)}
                                </span>
                              </td>
                              <td className="px-4 py-3 border-b border-slate-50">
                                {acks.length === 0 ? (
                                  <div className="flex items-center gap-2 text-orange-400 animate-pulse">
                                    <i className="fa-solid fa-circle-exclamation text-xs"></i>
                                    <span className="text-[9px] font-semibold">{n.type === 'Comum' ? 'Ninguém viu' : 'Pendente'}</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setHistoryModalAlert({ type: n.type, analyst: n.analyst, acks })}
                                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-green-600 hover:bg-green-100 transition-all active:scale-95"
                                  >
                                    <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                                    <span className="text-[9px] font-semibold text-left">
                                      {n.type === 'Comum'
                                        ? `${new Set(acks.map(a => a.name?.trim() || 'Sistema')).size} Viram`
                                        : 'Visto'} · <span className="text-green-600">Histórico</span>
                                    </span>
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 border-b border-slate-50 text-center">
                                <button
                                  onClick={() => {
                                    setAutoOpenRequestId(n.req.id);
                                    setView('dashboard');
                                    setShowNotifBox(false);
                                  }}
                                  className="h-8 w-8 rounded-lg bg-[#004080] text-white hover:bg-blue-600 transition-all shadow-sm active:scale-90"
                                  title="Localizar Estudo"
                                >
                                  <i className="fa-solid fa-magnifying-glass-location text-xs"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-slate-400 rounded-b-2xl shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">

                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest">Total: <span className="text-[#004080] ml-1">{adminNotifications.length}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Visualizações */}
      {historyModalAlert && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/30">
              <div className="flex items-center gap-3 text-[#004080]">
                <i className="fa-solid fa-clock-rotate-left text-lg"></i>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Histórico de Leitura</h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">
                    {historyModalAlert.type === 'Comum' ? 'Fila Comum — agrupado por analista' : `Responsável: ${historyModalAlert.analyst || 'A definir'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalAlert(null)}
                className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-red-500 shadow-sm transition-all flex items-center justify-center"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4 bg-slate-50/50">
              {(() => {
                const grouped = new Map<string, { time: string; status: string }[]>();
                historyModalAlert.acks.forEach(a => {
                  const normalizedName = a.name ? a.name.trim() : 'Sistema';
                  const existing = grouped.get(normalizedName) || [];
                  existing.push({ time: a.time, status: a.status });
                  grouped.set(normalizedName, existing);
                });

                if (grouped.size === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400">Nenhum registro de visualização encontrado.</p>
                    </div>
                  );
                }

                return Array.from(grouped.entries()).map(([analystName, entries], gIdx) => (
                  <div key={gIdx} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-[10px]">
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">{analystName}</span>
                        <span className="text-[8px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                          {entries.length} {entries.length > 1 ? 'Vistas' : 'Vista'}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).map((entry, tIdx) => (
                        <div key={tIdx} className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-clock text-[9px] text-green-500"></i>
                            <span className="text-[9px] font-medium text-slate-600">
                              {new Date(entry.time).toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                          </div>
                          {entry.status && (
                            <span className="text-[7px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 font-black border border-purple-100 uppercase tracking-tighter">
                              {entry.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
