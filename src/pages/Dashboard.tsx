
import React, { useState, useEffect, useMemo } from 'react';
import { StudyStatus, FormData, User, UserRole, QCControlData } from '../types/types';
import { formatDate, normalizeArea, isAssignedToMe, isSystemAssigned } from '../utils/utils';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { ValidationModal } from '../components/ValidationModal';
import { QCControlModal } from '../components/QCControlModal';
import { StorageService } from '../services/storage';
import { useDialog } from '../components/AppDialog';

interface DashboardProps {
  user: User;
  requests: FormData[];
  allRequests: FormData[];
  allUsers?: User[];
  onAnalyze?: (request: FormData) => void;
  onExecute?: (request: FormData) => void;
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => Promise<void>;
  onViewRequest?: (request: FormData) => void;
  onCreateRequest?: (formId: string) => void;
  autoOpenRequestId?: string | null;
  onModalOpened?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user, requests, allRequests, allUsers = [], onAnalyze, onExecute, onStatusUpdate,
  onViewRequest, onCreateRequest, autoOpenRequestId, onModalOpened
}) => {
  const { showAlert, showToast } = useDialog();
  const [filter, setFilter] = useState<string>('Todas');
  const [assigningRequest, setAssigningRequest] = useState<FormData | null>(null);
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [holdingRequest, setHoldingRequest] = useState<FormData | null>(null);
  const [holdInfo, setHoldInfo] = useState('');
  const [viewingHoldReason, setViewingHoldReason] = useState<FormData | null>(null);
  const [browsingRequest, setBrowsingRequest] = useState<FormData | null>(null);
  const [validatingRequest, setValidatingRequest] = useState<FormData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [qcRequest, setQcRequest] = useState<FormData | null>(null);
  const [hasAutoNotified, setHasAutoNotified] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const itemsPerPage = 12;

  const [newAnalyst, setNewAnalyst] = useState('');
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);

  // O efeito de destaque (highlight) foi removido a pedido do usuário





  const isValidator = user.role === UserRole.ADM || user.permissions?.includes('validar');
  const isAdmin = user.role === UserRole.ADM;
  const isQC = user.role === UserRole.ADM || user.permissions?.includes('controle_qualidade');


  const resolveAnalystName = (id: string | undefined | null) => {
    if (!id) return 'Sistema';
    if (isSystemAssigned(id)) return 'ADRSIS - Sistema';

    // Tenta encontrar pelo id, email ou sap no allUsers
    const found = allUsers.find(u =>
      u.id === id ||
      u.email === id ||
      (u.sap && id.replace(/^0+/, '') === u.sap.replace(/^0+/, ''))
    );

    return found ? found.name : id;
  };

  const toggleGroup = (baseCode: string) => {
    setExpandedGroups(prev => ({ ...prev, [baseCode]: !prev[baseCode] }));
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(r => {

      // Restrição por papel (Role)
      if (user.role === UserRole.ANALISTA && !isValidator) {
        const isOwnedByMe = isAssignedToMe(r.assignedTo, user);
        const isShared = isSystemAssigned(r.assignedTo);
        const isQCStatus = isQC && r.status === StudyStatus.CONTROLE_QUALIDADE;
        if (!isOwnedByMe && !isShared && !isQCStatus) return false;
      }

      // Filtro de Busca (Search)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matches =
          (r.studyNumber || '').toLowerCase().includes(search) ||
          (r.address || '').toLowerCase().includes(search) ||
          (r.studyTitle || '').toLowerCase().includes(search) ||
          (r.clientName || '').toLowerCase().includes(search) ||
          (r.uteName || '').toLowerCase().includes(search);
        if (!matches) return false;
      }

      if (filter === 'Todas') return true;
      if (filter === 'Pendentes/Novas') return r.status === StudyStatus.PENDENTE || r.status === StudyStatus.REJEITADO || r.status === StudyStatus.EM_ANALISE || r.status === StudyStatus.AGUARDANDO_INFORMACAO;
      if (filter === 'Cadastradas') return r.status === StudyStatus.AGUARDANDO_EXECUCAO || r.status === StudyStatus.ABERTO;
      if (filter === 'Em Execução') return r.status === StudyStatus.EM_EXECUCAO;
      if (filter === 'Controle de Qualidade') {
        return r.status === StudyStatus.CONTROLE_QUALIDADE ||
          r.status === StudyStatus.ENVIADO_SEM_CQ ||
          r.status === StudyStatus.APROVADO_CQ ||
          r.status === StudyStatus.REPROVADO_CQ;
      }
      if (filter === 'Aprovado pelo CQ') return r.status === StudyStatus.APROVADO_CQ;
      if (filter === 'Concluídas') return r.status === StudyStatus.CONCLUIDO;
      if (filter === 'Canceladas') return r.status === StudyStatus.CANCELADO;
      return true;
    }).sort((a, b) => {
      const numA = a.studyNumber || '';
      const numB = b.studyNumber || '';
      return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
    });

    // IDSIGEP grouping: group by first 8 digits, show latest revision as primary
    interface GroupedRequest extends FormData {
      _allRevisions?: FormData[];
      _revisionCount?: number;
      _baseCode?: string;
    }

    const groups: { [key: string]: FormData[] } = {};
    const seenIds = new Set<string>();

    filtered.forEach(req => {
      if (seenIds.has(req.id)) return;
      seenIds.add(req.id);

      const cleanCode = (req.studyNumber || '').replace('PROV-', '');
      const numericOnly = cleanCode.replace(/[^0-9]/g, '');

      if (numericOnly.length < 8) {
        // Studies with less than 8 digits: pass through without grouping
        if (!groups['_ungrouped_']) groups['_ungrouped_'] = [];
        groups['_ungrouped_'].push(req);
        return;
      }

      const base8 = numericOnly.substring(0, 8);
      if (!groups[base8]) groups[base8] = [];
      groups[base8].push(req);
    });

    const result: GroupedRequest[] = [];

    Object.entries(groups).forEach(([base8, studies]) => {
      if (base8 === '_ungrouped_') {
        studies.forEach(s => result.push(s as GroupedRequest));
        return;
      }

      // Sort by full IDSIGEP descending (latest first)
      studies.sort((a, b) => {
        const numA = parseInt((a.studyNumber || '').replace('PROV-', '').replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt((b.studyNumber || '').replace('PROV-', '').replace(/[^0-9]/g, '')) || 0;
        return numB - numA;
      });

      const main: GroupedRequest = studies[0] as GroupedRequest;
      main._allRevisions = studies;
      main._revisionCount = studies.length;
      main._baseCode = base8;
      result.push(main);
    });

    return result;
  }, [requests, filter, searchTerm, user, isValidator, isQC]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  // Garantir que a página atual é válida após filtros
  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      } else if (i === left - 1 || i === right + 1) {
        pages.push('...');
      }
    }
    return pages.filter((item, pos, self) => self.indexOf(item) === pos);
  };

  const getFilters = () => {
    const base = ['Todas', 'Pendentes/Novas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    if (isValidator) return ['Todas', 'Pendentes/Novas', 'Cadastradas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    return base;
  };

  const getStatusStyle = (status: StudyStatus) => {
    switch (status) {
      case StudyStatus.EM_ANALISE: return 'bg-blue-50 text-blue-600 border-blue-200';
      case StudyStatus.PENDENTE: return 'bg-amber-50 text-amber-600 border-amber-200 font-bold';
      case StudyStatus.REJEITADO: return 'bg-amber-50 text-amber-600 border-amber-200';
      case StudyStatus.AGUARDANDO_EXECUCAO: return 'bg-orange-50 text-orange-600 border-orange-200';
      case StudyStatus.EM_EXECUCAO: return 'bg-purple-50 text-purple-600 border-purple-200';
      case StudyStatus.AGUARDANDO_INFORMACAO: return 'bg-orange-50 text-orange-600 border-orange-200 border-dashed font-bold';
      case StudyStatus.CONTROLE_QUALIDADE: return 'bg-purple-50 text-purple-600 border-purple-200 font-black';
      case StudyStatus.APROVADO_CQ: return 'bg-indigo-50 text-indigo-600 border-indigo-200 font-black';
      case StudyStatus.REPROVADO_CQ: return 'bg-red-50 text-red-600 border-red-200 font-black';
      case StudyStatus.ENVIADO_SEM_CQ: return 'bg-orange-50 text-orange-600 border-orange-200 font-black';
      case StudyStatus.CONCLUIDO: return 'bg-green-50 text-green-600 border-green-200';
      case StudyStatus.CANCELADO: return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const getFO = (type: string) => (type || '').split('-').pop() || '';

  const getResponsibleName = (assignedToId?: string) => {
    if (!assignedToId || assignedToId === 'ADRSis - SISTEMA' || assignedToId === 'ADRSis - Sistema') return 'ADRSis - SISTEMA';

    // Check if it's a known user
    const found = allUsers.find(u => {
      if (u.id === assignedToId) return true;
      if (u.email?.toLowerCase().trim() === assignedToId.toLowerCase().trim()) return true;
      if (u.sap?.trim().replace(/^0+/, '') === assignedToId.trim().replace(/^0+/, '')) return true;
      return false;
    });

    if (found) return found.name;

    // If it's an email format or numeric SAP that wasn't found, return Analista Externo
    const isEmail = assignedToId.includes('@');
    const isNumeric = /^\d+$/.test(assignedToId);

    if (isEmail || isNumeric) return 'Analista Externo';

    return assignedToId;
  };

  const handleOpenAssign = (req: FormData) => {
    if (req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE || isValidator) {
      setValidatingRequest(req);
    } else {
      setAssigningRequest(req);
      setSelectedAnalyst(req.assignedTo || '');
      setRejectionReason('');
      setIsRejecting(false);
    }
  };

  const handleConfirmAction = (action: 'validate' | 'reject' | 'assign', data?: Partial<FormData>, assignedTo?: string, passedReason?: string) => {
    try {
      const targetRequest = validatingRequest || assigningRequest;
      if (!targetRequest || !onStatusUpdate) return;

      if (action === 'validate') {
        const isNewValidation = (targetRequest.status as any) === 330 || targetRequest.status === StudyStatus.PENDENTE || targetRequest.status === StudyStatus.EM_ANALISE;
        const nextStatus = isNewValidation ? StudyStatus.AGUARDANDO_EXECUCAO : targetRequest.status;

        onStatusUpdate(targetRequest.id, nextStatus, undefined, assignedTo, data);
        setValidatingRequest(null);
        setAssigningRequest(null);
      } else if (action === 'reject') {
        const finalReason = passedReason || rejectionReason;
        if (!finalReason.trim()) {
          showAlert('Por favor, informe o motivo da rejeição.', 'Campo Obrigatório', 'warning');
          return;
        }
        onStatusUpdate(targetRequest.id, StudyStatus.REJEITADO, finalReason);
        setAssigningRequest(null);
        setValidatingRequest(null);
      } else if (action === 'assign') {
        onStatusUpdate(targetRequest.id, targetRequest.status, undefined, selectedAnalyst);
        setAssigningRequest(null);
      }
    } catch (error) {
      console.error('Erro ao processar ação:', error);
      showAlert('Erro ao processar ação. Por favor, tente novamente.', 'Erro', 'error');
    }
  };

  const handleOpenFolder = (req: FormData) => {
    setBrowsingRequest(req);
  };

  const renderActionButton = (req: FormData) => {
    try {
      const isMe = isAssignedToMe(req.assignedTo, user);
      const isSystem = isSystemAssigned(req.assignedTo);
      const isPRGC = req.assignedTo && req.assignedTo.toLowerCase() === 'prgc';
      const isLockedForMe = req.assignedTo && !isMe && !isSystem && !isAdmin && !(isQC && (req.status === StudyStatus.CONTROLE_QUALIDADE || req.status === StudyStatus.ENVIADO_SEM_CQ)) && !isPRGC;

      if (isLockedForMe) {
        return (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-300 flex items-center justify-center text-lg border-2 border-slate-200 cursor-not-allowed shadow-inner" title="Estudo bloqueado.">
            <i className="fa-solid fa-lock"></i>
          </div>
        );
      }

      if (req.status === StudyStatus.AGUARDANDO_EXECUCAO || req.status === StudyStatus.EM_EXECUCAO || req.status === StudyStatus.ABERTO) {
        const isAssignedToMeFlag = isAssignedToMe(req.assignedTo, user);
        const canChangeToExecution = isAssignedToMeFlag && req.status === StudyStatus.AGUARDANDO_EXECUCAO;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => {
                try { onExecute(req); } catch (e) { console.error('Erro:', e); }
              }}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#004080] to-blue-700 text-white hover:from-orange-500 hover:to-orange-600 transition-all flex items-center justify-center text-xs shadow-lg shadow-blue-500/30 active:scale-95"
              title={canChangeToExecution ? "Iniciar Execução e Abrir Painel" : "Abrir Painel de Execução"}
            >
              <i className="fa-solid fa-play"></i>
            </button>
            {req.status === StudyStatus.EM_EXECUCAO && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setHoldInfo('');
                    setHoldingRequest(req);
                  }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-500 border-2 border-orange-200 hover:from-orange-500 hover:to-orange-600 hover:text-white hover:border-orange-500 transition-all flex items-center justify-center text-xs shadow-lg shadow-orange-500/20 active:scale-95"
                  title="Solicitar Informações"
                >
                  <i className="fa-solid fa-circle-question"></i>
                </button>
              </div>
            )}
          </div>
        );
      }

      if (req.status === StudyStatus.AGUARDANDO_INFORMACAO) {
        return (
          <div className="flex gap-2">
            <button
              onClick={() => onStatusUpdate(req.id, StudyStatus.EM_EXECUCAO)}
              className="w-10 h-10 rounded-xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 animate-pulse"
              title="Retomar Execução"
            >
              <i className="fa-solid fa-play"></i>
            </button>
            {req.holdReason && (
              <button
                onClick={() => setViewingHoldReason(req)}
                className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                title="Ver Informação Solicitada"
              >
                <i className="fa-solid fa-circle-info"></i>
              </button>
            )}
          </div>
        );
      }

      if (req.status === StudyStatus.CONCLUIDO || req.status === StudyStatus.CONTROLE_QUALIDADE || req.status === StudyStatus.APROVADO_CQ || req.status === StudyStatus.REPROVADO_CQ || req.status === StudyStatus.ENVIADO_SEM_CQ) {
        const isAprovedCQ = req.status === StudyStatus.APROVADO_CQ;
        const isReprovadoCQ = req.status === StudyStatus.REPROVADO_CQ;
        const isAssignedToMeFlag = isAssignedToMe(req.assignedTo, user);
        const canFinalize = isAprovedCQ && isAssignedToMeFlag;
        const canReopenExecution = isReprovadoCQ && isAssignedToMeFlag;

        // Se estiver aprovado pelo CQ, o "aviãozinho" é exclusivo do analista responsável
        // Outros usuários (não admin) veem o ícone de bloqueio
        if (isAprovedCQ && !isAssignedToMe) {
          return (
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-200 flex items-center justify-center text-xs border border-slate-100 cursor-not-allowed" title="Aguardando Conclusão do Analista Responsável">
              <i className="fa-solid fa-plane-lock"></i>
            </div>
          );
        }

        return (
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                if (canFinalize) {
                  onStatusUpdate(req.id, StudyStatus.CONCLUIDO);
                  showToast('Estudo Concluído e E-mail enviado!', 'success');
                } else if (canReopenExecution) {
                  onStatusUpdate(req.id, StudyStatus.EM_EXECUCAO);
                  try { onExecute(req); } catch (e) { console.error('Erro:', e); }
                } else {
                  try { onExecute(req); } catch (e) { console.error('Erro:', e); }
                }
              }}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 border ${canFinalize ? 'bg-indigo-600 text-white hover:bg-orange-500' : canReopenExecution ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white'
                }`}
              title={canFinalize ? "Clique para Finalizar e Enviar E-mail ao Solicitante" : canReopenExecution ? "Reabrir Execução e Abrir Painel" : "Visualizar Painel Técnico"}
            >
              <i className={`fa-solid ${canFinalize ? 'fa-paper-plane' : canReopenExecution ? 'fa-play' : 'fa-eye'}`}></i>
            </button>
            {req.status === StudyStatus.REPROVADO_CQ && (
              <button
                onClick={() => setQcRequest(req)}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-red-100 text-red-600 border border-red-200 hover:from-red-500 hover:to-red-600 hover:text-white hover:border-red-500 transition-all flex items-center justify-center text-xs font-bold active:scale-95 animate-pulse"
                title="Visualizar Motivos de Reprovação (CQ)"
              >
                <i className="fa-solid fa-exclamation"></i>
              </button>
            )}
          </div>
        );
      }

      return null;
    } catch (error) {
      console.error('Erro ao renderizar botão de ação:', error);
      return (
        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-xs border border-slate-100">
          <i className="fa-solid fa-exclamation-triangle"></i>
        </div>
      );
    }
  };

  const executors = allUsers.filter(u => u.permissions?.includes('executar') || u.role === UserRole.ADM);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Modal de Atribuição Rápida */}
      {assigningRequest && isValidator && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-[#004080] mb-2">
              Análise de Pressão
            </h3>
            <p className="text-[10px] text-slate-400 mb-8">
              Estudo: {assigningRequest.studyNumber}
            </p>

            {(assigningRequest.status === StudyStatus.PENDENTE || assigningRequest.status === StudyStatus.EM_ANALISE) ? (
              <div className="space-y-6">
                {isRejecting ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-[10px] font-semibold text-slate-500 ml-1">Motivo da Rejeição</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Descreva o motivo pelo qual o estudo não foi validado..."
                      className="w-full p-4 border border-red-100 rounded-2xl outline-none focus:border-red-500 bg-red-50/30 text-sm font-bold text-slate-700 min-h-[120px]"
                    />
                    <div className="flex justify-end gap-3 pt-4">
                      <button onClick={() => setIsRejecting(false)} className="px-4 py-2.5 text-slate-400 font-black uppercase text-[10px]">Voltar</button>
                      <button
                        onClick={() => handleConfirmAction('reject')}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-black uppercase text-[10px] shadow-lg shadow-red-100 transition-all active:scale-95"
                      >
                        Confirmar Rejeição
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Deseja validar este estudo para execução ou rejeitá-lo para correções?
                    </p>
                    <div className="flex flex-col gap-3 mt-4">
                      <button
                        onClick={() => handleConfirmAction('validate')}
                        className="w-full py-2.5 px-4 bg-green-600 text-white rounded-lg font-black uppercase text-xs shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-check-circle text-xs"></i> Validar Estudo
                      </button>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="w-full py-2.5 px-4 bg-white border-2 border-red-100 text-red-600 rounded-lg font-black uppercase text-xs hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-times-circle text-xs"></i> Rejeitar Estudo
                      </button>
                      <button onClick={() => setAssigningRequest(null)} className="mt-2 py-2.5 px-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Analista Responsável</label>
                <select
                  value={selectedAnalyst}
                  onChange={(e) => setSelectedAnalyst(e.target.value)}
                  className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-white text-sm font-bold text-slate-700"
                >
                  <option value="">Fila Comum (Sem Responsável)</option>
                  {executors.map(exec => (
                    <option key={exec.id} value={exec.id}>{exec.name}</option>
                  ))}
                </select>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setAssigningRequest(null)} className="px-4 py-2.5 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={() => handleConfirmAction('assign')} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-black uppercase text-[10px] shadow-lg shadow-indigo-100 transition-all active:scale-95">Confirmar Atribuição</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-6 bg-gradient-to-r from-white to-slate-50 p-6 rounded-2xl border border-slate-200 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#004080] via-blue-600 to-orange-500"></div>
        <div className="shrink-0 min-w-fit pt-2">
          <h2 className="text-2xl font-black text-[#004080] uppercase tracking-tight">Painel de Controle APR</h2>
          <p className="text-slate-500 text-sm mt-1">Gerenciamento do fluxo de solicitações.</p>
        </div>

        {onCreateRequest && (isAdmin || user.role === UserRole.ANALISTA) && (
          <button
            onClick={() => onCreateRequest('PE.00492-FO.01')}
            className="py-2.5 px-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-bold text-xs uppercase flex items-center gap-2 hover:from-green-700 hover:to-green-600 hover:shadow-lg hover:shadow-green-500/30 transition-all"
          >
            <i className="fa-solid fa-plus text-xs"></i> Novo Estudo
          </button>
        )}

        <div className="flex flex-col md:flex-row gap-4 flex-grow max-w-full lg:max-w-none justify-end items-center">
          <div className="relative flex-grow md:max-w-xs lg:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004080] transition-colors">
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Pesquisar..."
              className="w-full pl-9 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#004080] focus:ring-2 focus:ring-[#004080]/10 transition-all text-xs font-bold text-slate-700 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-slate-500 transition-colors"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>

          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl overflow-x-auto shrink-0 scrollbar-hide">
            {getFilters().map(s => (
              <button
                key={s}
                onClick={() => {
                  setFilter(s);
                  setCurrentPage(1);
                }}
                className={`py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === s ? 'bg-white shadow-sm text-[#004080]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Cód / Data</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Solicitante</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Cliente</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Status / Analista Resp.</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Prazo</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">No Prazo</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold uppercase text-slate-500 tracking-wider text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">
                    Nenhuma solicitação nesta categoria disponível para você.
                  </td>
                </tr>
              ) : (
                displayedRequests.map((req) => {
                  const isMe = isAssignedToMe(req.assignedTo, user);
                  const isSystem = isSystemAssigned(req.assignedTo);
                  const hasMultipleRevisions = (req as any)._revisionCount > 1;
                  const allRevisions = (req as any)._allRevisions || [];
                  const baseCode = (req as any)._baseCode || '';
                  const isExpanded = expandedGroups[baseCode] === true;
                  const revisionCount = (req as any)._revisionCount || 1;

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

                  const deadlineStr = normalizeDate(req.dtEntregaPrevista || req.estimatedDeliveryDate);
                  const isUrgent = (() => {
                    if (!deadlineStr) return false;
                    if ([StudyStatus.CONCLUIDO, StudyStatus.CANCELADO, StudyStatus.REJEITADO].includes(req.status)) return false;
                    const deadline = new Date(deadlineStr + 'T00:00:00');
                    const now = new Date();
                    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                    return diffDays < 2;
                  })();

                  return (
                    <React.Fragment key={req.id}>
                    <tr
                      className={`transition-all duration-200 ${highlightRequestId === req.id ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset animate-pulse' : (isUrgent ? 'bg-yellow-50/70 hover:bg-yellow-50' : 'hover:bg-slate-50')}`}
                    >
                      <td className="px-5 py-3.5 text-left">
                        <div className="flex items-center gap-2.5">
                          <span className="bg-[#004080]/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded">{getFO(req.formType)}</span>
                          <p className={`text-xs font-semibold uppercase ${isUrgent ? 'text-orange-700' : 'text-[#004080]'}`}>{req.studyNumber}</p>
                          {hasMultipleRevisions && (
                            <button
                              onClick={() => toggleGroup(baseCode)}
                              className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black flex items-center gap-1 hover:bg-indigo-200 transition-colors"
                              title={`${revisionCount} revisões`}
                            >
                              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[7px]`}></i>
                              {revisionCount} rev
                            </button>
                          )}
                        </div>
                        <p className={`text-[11px] mt-1.5 ${isUrgent ? 'text-orange-600' : 'text-slate-400'}`}>{formatDate(req.requestDate)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <p className={`text-xs font-medium ${isUrgent ? 'text-slate-800' : 'text-slate-700'}`}>{req.requesterName}</p>
                        <p className={`text-[10px] mt-0.5 ${isUrgent ? 'text-orange-500' : 'text-slate-400'} uppercase`}>{normalizeArea(req.requesterArea)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <p className={`text-xs font-medium truncate max-w-[180px] ${isUrgent ? 'text-slate-800' : 'text-[#004080]'}`}>{req.studyTitle || req.uteName || req.clientName}</p>
                        <p className={`text-[10px] mt-0.5 ${isUrgent ? 'text-orange-500' : 'text-slate-400'} uppercase`}>{req.city}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-tight ${getStatusStyle(req.status)}`}>
                            {req.status}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {req.assignedTo ? (
                              <>
                                <i className={`fa-solid ${isMe ? 'fa-user-check text-green-500' : (isSystemAssigned(req.assignedTo) ? 'fa-users text-slate-300' : 'fa-user-lock text-orange-400')} text-[8px]`}></i>
                                <span className={`text-[8px] font-black uppercase ${isMe ? 'text-green-600' : (isSystemAssigned(req.assignedTo) ? 'text-slate-300' : 'text-slate-400')}`}>
                                  {isMe ? 'Sua Tarefa' : resolveAnalystName(req.assignedTo)}
                                </span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-users text-[8px] text-slate-300"></i>
                                <span className="text-[8px] font-black text-slate-300 uppercase">Sistema</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <p className={`text-xs font-semibold ${isUrgent ? 'text-orange-600' : 'text-slate-700'}`}>{req.dtEntregaPrevista ? formatDate(req.dtEntregaPrevista) : (req.estimatedDeliveryDate ? formatDate(req.estimatedDeliveryDate) : '-')}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center align-middle">
                        {req.status === StudyStatus.CONCLUIDO ? (
                          (() => {
                            if (!deadlineStr) return <span className="text-slate-300 text-sm">-</span>;
                            const deadline = new Date(deadlineStr + 'T00:00:00');
                            const completed = new Date(req.updatedAt || req.completedAt || req.requestDate);
                            const onTime = completed <= deadline;
                            return onTime ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                <i className="fa-solid fa-check text-[10px]"></i>
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                                <i className="fa-solid fa-xmark text-[10px]"></i>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Botão para Abrir Pasta da Solicitação */}
                          {req.studyNumber && (
                            <button
                              onClick={() => handleOpenFolder(req)}
                              className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600 hover:shadow-sm transition-all flex items-center justify-center text-xs"
                              title="Visualizar Arquivos"
                            >
                              <i className="fa-solid fa-folder-open"></i>
                            </button>
                          )}

                          {/* Botão de Atribuição Direta para ADM / Validador */}
                          {isValidator && [StudyStatus.PENDENTE, StudyStatus.EM_ANALISE, StudyStatus.AGUARDANDO_EXECUCAO, StudyStatus.EM_EXECUCAO, StudyStatus.ABERTO].includes(req.status) && (
                            <button
                              onClick={() => handleOpenAssign(req)}
                              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 ${req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE
                                ? 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white'
                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white'
                                }`}
                              title={req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE || req.status === StudyStatus.ABERTO ? 'Validar Estudo' : 'Gerenciar Atribuição'}
                            >
                              <i className={`fa-solid ${req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE || req.status === StudyStatus.ABERTO ? 'fa-clipboard-check' : 'fa-user-gear'}`}></i>
                            </button>
                          )}

                          {renderActionButton(req)}

                          {isQC && (req.status === StudyStatus.CONTROLE_QUALIDADE || req.status === StudyStatus.ENVIADO_SEM_CQ) && (
                            <button
                              onClick={() => setQcRequest(req)}
                              className="w-10 h-10 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                              title="Abrir Controle de Qualidade"
                            >
                              <i className="fa-solid fa-clipboard-check"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded revisions row */}
                    {hasMultipleRevisions && isExpanded && allRevisions.length > 1 && (
                      <tr key={`${req.id}-revisions`}>
                        <td colSpan={7} className="px-5 py-0 bg-indigo-50/30">
                          <div className="border border-indigo-100 rounded-xl overflow-hidden my-2">
                            <div className="px-3 py-2 bg-indigo-100/50 border-b border-indigo-100">
                              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                <i className="fa-solid fa-code-branch mr-1"></i>
                                Todas as Revisões ({revisionCount})
                              </span>
                            </div>
                            <table className="w-full">
                              <tbody className="divide-y divide-indigo-100">
                                {allRevisions.map((rev: any, idx: number) => {
                                  const fullCode = (rev.studyNumber || '').replace('PROV-', '');
                                  const isLatest = idx === 0;
                                  const revIsMe = isAssignedToMe(rev.assignedTo, user);
                                  return (
                                    <tr
                                      key={rev.id}
                                      onClick={() => onViewRequest?.(rev)}
                                      className="hover:bg-indigo-100/50 cursor-pointer transition-colors"
                                    >
                                      <td className="px-3 py-2 text-left w-48">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${isLatest ? 'bg-indigo-600 text-white' : 'bg-indigo-200 text-indigo-700'}`}>
                                            {fullCode}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border ${getStatusStyle(rev.status)}`}>
                                          {rev.status}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center text-[10px] text-slate-500">
                                        {rev.requestDate ? formatDate(rev.requestDate) : ''}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {rev.assignedTo ? (
                                          <span className={`text-[8px] font-black ${revIsMe ? 'text-green-600' : 'text-slate-400'}`}>
                                            {revIsMe ? 'Sua Tarefa' : resolveAnalystName(rev.assignedTo)}
                                          </span>
                                        ) : (
                                          <span className="text-[8px] text-slate-300">Sistema</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center text-[10px] text-slate-500">—</td>
                                      <td className="px-3 py-2 text-center text-[10px] text-slate-500">—</td>
                                      <td className="px-3 py-2 text-right">
                                        <i className="fa-solid fa-arrow-right text-[8px] text-slate-400"></i>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredRequests.length)} de {filteredRequests.length} estudos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#004080] hover:border-[#004080] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 bg-white shadow-sm"
              >
                <i className="fa-solid fa-chevron-left text-[10px]"></i>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => (
                  <React.Fragment key={idx}>
                    {page === '...' ? (
                      <span className="px-2 text-slate-300 font-black">...</span>
                    ) : (
                      <button
                        onClick={() => setCurrentPage(Number(page))}
                        className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all transform ${currentPage === page
                          ? 'bg-[#004080] text-white shadow-md scale-110'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-[#004080] hover:text-[#004080]'}`}
                      >
                        {page}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#004080] hover:border-[#004080] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 bg-white shadow-sm"
              >
                <i className="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>
      {validatingRequest && (
        <ValidationModal
          initialData={validatingRequest}
          executors={executors}
          onConfirm={(assignedTo, data) => handleConfirmAction('validate', data, assignedTo)}
          onReject={validatingRequest.status !== StudyStatus.AGUARDANDO_EXECUCAO && validatingRequest.status !== StudyStatus.EM_EXECUCAO ? (reason) => {
            handleConfirmAction('reject', undefined, undefined, reason);
          } : undefined}
          onCancel={() => setValidatingRequest(null)}
          onOpenFiles={() => handleOpenFolder(validatingRequest)}
        />
      )}

      {browsingRequest && (
        <FileBrowserModal
          request={browsingRequest}
          user={user}
          allUsers={allUsers}
          allRequests={requests}
          onClose={() => setBrowsingRequest(null)}
          onStatusUpdate={onStatusUpdate as any}
          onStartExecution={onExecute}
          restrictToCategory={validatingRequest ? 'Solicitacao' : undefined}
        />
      )}

      {qcRequest && (
        <QCControlModal
          data={qcRequest}
          allUsers={allUsers}
          currentUser={user}
          readOnly={qcRequest.status === StudyStatus.REPROVADO_CQ}
          onClose={() => setQcRequest(null)}
          onApprove={async (qcData: QCControlData) => {
            // Upload QC files to StorageService with category 'Supervisor'
            if (qcData.qcFiles && qcData.qcFiles.length > 0) {
              for (const file of qcData.qcFiles) {
                try {
                  await StorageService.uploadFile(qcRequest.id, 'Supervisor', file);
                } catch (err) {
                  console.error('[Dashboard] Erro ao upload arquivo QC:', err);
                }
              }
              // Clean up files before saving (File objects can't be serialized)
              delete qcData.qcFiles;
            }
            qcData.fromQCModal = true;
            onStatusUpdate(qcRequest.id, StudyStatus.APROVADO_CQ, undefined, undefined, { qcData });
            showToast('Estudo Aprovado pelo CQ! Retornado ao analista para conclusão final.', 'success');
            setQcRequest(null);
          }}
          onReject={async (qcData: QCControlData, reason: string) => {
            // Upload QC files to StorageService with category 'Supervisor'
            if (qcData.qcFiles && qcData.qcFiles.length > 0) {
              for (const file of qcData.qcFiles) {
                try {
                  await StorageService.uploadFile(qcRequest.id, 'Supervisor', file);
                } catch (err) {
                  console.error('[Dashboard] Erro ao upload arquivo QC:', err);
                }
              }
              // Clean up files before saving (File objects can't be serialized)
              delete qcData.qcFiles;
            }
            qcData.fromQCModal = true;
            onStatusUpdate(qcRequest.id, StudyStatus.REPROVADO_CQ, reason, undefined, { qcData });
            showToast('Estudo Reprovado pelo CQ. Retornado ao analista para correções.', 'info');
            setQcRequest(null);
          }}
        />
      )}

      {/* Modal para Solicitar Informações (Pausar) */}
      {holdingRequest && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between text-[#004080]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner border border-orange-100">
                  <i className="fa-solid fa-pause text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Pausar Estudo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{holdingRequest.studyNumber}</p>
                </div>
              </div>
              <button onClick={() => { setHoldingRequest(null); setHoldInfo(''); }} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Informação Necessária:</label>
                <textarea
                  value={holdInfo}
                  onChange={(e) => setHoldInfo(e.target.value)}
                  className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm text-slate-700 placeholder:text-slate-300"
                  placeholder="Descreva detalhadamente qual informação adicional é necessária para prosseguir com a execução técnica deste estudo..."
                ></textarea>
              </div>
              <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex items-start gap-4">
                <i className="fa-solid fa-circle-info text-orange-400 mt-1"></i>
                <p className="text-[10px] text-orange-800/80 font-bold leading-relaxed uppercase">
                  Esta mensagem será enviada ao solicitante e o estudo ficará bloqueado para execução até que você o retome manualmente.
                </p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => { setHoldingRequest(null); setHoldInfo(''); }} className="flex-1 py-2.5 px-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-lg border border-slate-100">Cancelar</button>
              <button
                disabled={!holdInfo.trim()}
                onClick={() => {
                  onStatusUpdate(holdingRequest.id, StudyStatus.AGUARDANDO_INFORMACAO, holdInfo, undefined, { holdRequestSeen: false });
                  showToast('Estudo pausado e solicitante notificado.', 'info');
                  setHoldingRequest(null);
                  setHoldInfo('');
                }}
                className={`flex-[2] py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all ${holdInfo.trim() ? 'bg-orange-500 text-white shadow-orange-200 hover:scale-[1.02] active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
              >Confirmar Pausa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Informação Solicitada (Analista) */}
      {viewingHoldReason && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between text-[#004080]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004080] shadow-inner border border-blue-100">
                  <i className="fa-solid fa-circle-info text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Informações Solicitadas</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{viewingHoldReason.studyNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!viewingHoldReason.holdResponseSeen && viewingHoldReason.holdResponse) {
                      onStatusUpdate(viewingHoldReason.id, viewingHoldReason.status, undefined, undefined, { holdResponseSeen: true });
                    }
                    setViewingHoldReason(null);
                  }}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Sua Solicitação:</p>
                <p className="text-sm text-slate-600 italic whitespace-pre-wrap leading-relaxed">"{viewingHoldReason.holdReason || 'Nenhuma informação detalhada.'}"</p>
              </div>

              {viewingHoldReason.holdResponse && (
                <div className="p-6 bg-green-50 rounded-2xl border border-green-100 border-2 shadow-sm animate-in slide-in-from-bottom-2">
                  <p className="text-[10px] text-green-600 font-black uppercase mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-reply"></i> Resposta do Solicitante:
                  </p>
                  <p className="text-sm text-green-900 font-black whitespace-pre-wrap leading-relaxed">{viewingHoldReason.holdResponse}</p>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button
                onClick={() => {
                  if (!viewingHoldReason.holdResponseSeen && viewingHoldReason.holdResponse) {
                    onStatusUpdate(viewingHoldReason.id, viewingHoldReason.status, undefined, undefined, { holdResponseSeen: true });
                  }
                  setViewingHoldReason(null);
                }}
                className="flex-1 py-4 bg-white border border-slate-100 text-xs font-black text-slate-400 uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-colors"
              >
                Fechar
              </button>
              {viewingHoldReason.holdResponse && (
                <button
                  onClick={() => {
                    onStatusUpdate(viewingHoldReason.id, StudyStatus.EM_EXECUCAO, undefined, undefined, { holdResponseSeen: true });
                    showToast('O estudo foi retomado e o status alterado para Em Execução.', 'success');
                    setViewingHoldReason(null);
                  }}
                  className="flex-[2] py-4 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
                >
                  Retomar Estudo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
