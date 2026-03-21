
import React, { useState } from 'react';
import { StudyStatus, FormData, User, UserRole, QCControlData } from './types';
import { formatToLocalTime, formatDate } from './utils';
import { FileBrowserModal } from './FileBrowserModal';
import { ValidationModal } from './ValidationModal';
import { QCControlModal } from './QCControlModal';
import { useDialog } from './AppDialog';

interface DashboardProps {
  user: User;
  requests: FormData[];
  allRequests: FormData[];
  allUsers?: User[];
  onAnalyze: (request: FormData) => void;
  onExecute: (request: FormData) => void;
  onStatusUpdate: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  autoOpenRequestId?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user, requests, allRequests, allUsers = [], onAnalyze, onExecute, onStatusUpdate,
  autoOpenRequestId, onModalOpened
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

  React.useEffect(() => {
    if (autoOpenRequestId) {
      const target = allRequests.find(r => r.id === autoOpenRequestId);
      if (target) {
        setViewingHoldReason(target);
        onModalOpened?.();
      }
    }
  }, [autoOpenRequestId, allRequests, onModalOpened]);




  const isValidator = user.role === UserRole.ADM || user.permissions?.includes('validar');
  const isAdmin = user.role === UserRole.ADM;
  const isQC = user.role === UserRole.ADM || user.permissions?.includes('controle_qualidade');

  const getFilters = () => {
    const base = ['Todas', 'Pendentes/Novas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    if (isValidator) return ['Todas', 'Pendentes/Novas', 'Cadastradas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    return base;
  };

  const filteredRequests = requests.filter(r => {
    // Restrição por papel (Role)
    if (user.role === UserRole.ANALISTA && !isValidator) {
      const isOwnedByMe = r.assignedTo === user.id;
      const isUnassigned = !r.assignedTo;
      const isQCStatus = isQC && r.status === StudyStatus.CONTROLE_QUALIDADE;
      if (!isOwnedByMe && !isUnassigned && !isQCStatus) return false;
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
    if (filter === 'Pendentes/Novas') return r.status === StudyStatus.PENDENTE || r.status === StudyStatus.REJEITADO || r.status === StudyStatus.EM_ANALISE;
    if (filter === 'Cadastradas') return r.status === StudyStatus.AGUARDANDO_EXECUCAO;
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
  });

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

  const getFO = (type: string) => type.split('-').pop() || '';

  const getResponsibleName = (assignedToId?: string) => {
    if (!assignedToId) return 'Sistema';
    const found = allUsers.find(u => u.id === assignedToId);
    return found ? found.name : 'Analista Externo';
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
        onStatusUpdate(targetRequest.id, StudyStatus.AGUARDANDO_EXECUCAO, undefined, assignedTo, data);
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
      const isLockedForMe = req.assignedTo && req.assignedTo !== user.id && !isAdmin && !(isQC && req.status === StudyStatus.CONTROLE_QUALIDADE);

      if (isLockedForMe) {
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-200 flex items-center justify-center text-xs border border-slate-100 cursor-not-allowed" title="Estudo bloqueado: Atribuído a outro analista">
            <i className="fa-solid fa-lock"></i>
          </div>
        );
      }

      if (req.status === StudyStatus.AGUARDANDO_EXECUCAO || req.status === StudyStatus.EM_EXECUCAO) {
        return (
          <div className="flex gap-2">
            <button
              onClick={() => { try { onExecute(req); } catch (e) { console.error('Erro:', e); } }}
              className="w-10 h-10 rounded-xl bg-[#004080] text-white hover:bg-orange-500 transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
              title="Abrir Painel Técnico de Execução"
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
                  className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 border border-orange-100 hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                  title="Pausar Estudo (Solicitar Informações)"
                >
                  <i className="fa-solid fa-pause"></i>
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

      if (req.status === StudyStatus.CONCLUIDO || req.status === StudyStatus.CONTROLE_QUALIDADE || req.status === StudyStatus.APROVADO_CQ || req.status === StudyStatus.REPROVADO_CQ) {
        const isAprovedCQ = req.status === StudyStatus.APROVADO_CQ;
        const isAssignedToMe = req.assignedTo === user.id;
        const canFinalize = isAprovedCQ && isAssignedToMe;

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
          <button
            onClick={() => {
              if (canFinalize) {
                onStatusUpdate(req.id, StudyStatus.CONCLUIDO);
                showToast('Estudo Concluído e E-mail enviado!', 'success');
              } else {
                try { onExecute(req); } catch (e) { console.error('Erro:', e); }
              }
            }}
            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 border ${canFinalize ? 'bg-indigo-600 text-white hover:bg-orange-500' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white'
              }`}
            title={canFinalize ? "Clique para Finalizar e Enviar E-mail ao Solicitante" : "Visualizar Painel Técnico"}
          >
            <i className={`fa-solid ${canFinalize ? 'fa-paper-plane' : 'fa-eye'}`}></i>
          </button>
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
            <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-2">
              {assigningRequest.status === StudyStatus.PENDENTE || assigningRequest.status === StudyStatus.EM_ANALISE
                ? 'Validação de Estudo'
                : 'Gestão de Atribuição'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">
              Estudo: {assigningRequest.studyNumber}
            </p>

            {(assigningRequest.status === StudyStatus.PENDENTE || assigningRequest.status === StudyStatus.EM_ANALISE) ? (
              <div className="space-y-6">
                {isRejecting ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-red-500">Motivo da Rejeição</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Descreva o motivo pelo qual o estudo não foi validado..."
                      className="w-full p-4 border border-red-100 rounded-2xl outline-none focus:border-red-500 bg-red-50/30 text-sm font-bold text-slate-700 min-h-[120px]"
                    />
                    <div className="flex justify-end gap-3 pt-4">
                      <button onClick={() => setIsRejecting(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Voltar</button>
                      <button
                        onClick={() => handleConfirmAction('reject')}
                        className="px-8 py-4 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-red-100 transition-all active:scale-95"
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
                        className="w-full p-5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <i className="fa-solid fa-check-circle"></i> Validar Estudo
                      </button>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="w-full p-5 bg-white border-2 border-red-100 text-red-600 rounded-2xl font-black uppercase text-xs hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <i className="fa-solid fa-times-circle"></i> Rejeitar Estudo
                      </button>
                      <button onClick={() => setAssigningRequest(null)} className="mt-4 px-6 py-3 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600">Cancelar</button>
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

                <div className="flex justify-end gap-3 mt-10">
                  <button onClick={() => setAssigningRequest(null)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={() => handleConfirmAction('assign')} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100 transition-all active:scale-95">Confirmar Atribuição</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="shrink-0 min-w-fit">
          <h2 className="text-2xl font-black text-[#004080] uppercase tracking-tight">Painel de Controle APR</h2>
          <p className="text-slate-500 text-sm mt-1">Gerenciamento do fluxo de solicitações.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 flex-grow max-w-full lg:max-w-none justify-end items-center">
          <div className="relative flex-grow md:max-w-xs lg:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004080] transition-colors">
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#004080] focus:bg-white transition-all text-xs font-bold text-slate-700 placeholder:text-slate-400"
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
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === s ? 'bg-white shadow-sm text-[#004080]' : 'text-slate-400 hover:text-slate-600'}`}
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
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080]">Cód / Data</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080]">Solicitante</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080]">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080]">Status / Analista Resp.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080]">Prazo</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#004080] text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                    Nenhuma solicitação nesta categoria disponível para você.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className={`hover:bg-slate-50/50 transition-colors ${req.assignedTo && req.assignedTo !== user.id && !isAdmin && !(isQC && req.status === StudyStatus.CONTROLE_QUALIDADE) ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#004080] text-white text-[9px] font-black px-1.5 py-0.5 rounded">{getFO(req.formType)}</span>
                        <p className="text-[11px] font-black text-[#004080] uppercase">{req.studyNumber}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{formatDate(req.requestDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700">{req.requesterName}</p>
                      <p className="text-[9px] text-slate-400 uppercase mt-0.5">{req.requesterArea}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-[#004080] truncate max-w-[200px]">{req.studyTitle || req.uteName || req.clientName}</p>
                      <p className="text-[9px] text-slate-400 uppercase mt-0.5">{req.city}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter ${getStatusStyle(req.status)}`}>
                          {req.status}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {req.assignedTo ? (
                            <>
                              <i className={`fa-solid ${req.assignedTo === user.id ? 'fa-user-check text-green-500' : 'fa-user-lock text-orange-400'} text-[8px]`}></i>
                              <span className={`text-[8px] font-black uppercase ${req.assignedTo === user.id ? 'text-green-600' : 'text-slate-400'}`}>
                                {req.assignedTo === user.id ? 'Sua Tarefa' : getResponsibleName(req.assignedTo)}
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
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700">{req.estimatedDeliveryDate ? formatDate(req.estimatedDeliveryDate) : '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Botão para Abrir Pasta da Solicitação */}
                        {req.studyNumber && (
                          <button
                            onClick={() => handleOpenFolder(req)}
                            className="w-10 h-10 rounded-xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                            title="Visualizar Arquivos no Storage"
                          >
                            <i className="fa-solid fa-folder-open"></i>
                          </button>
                        )}

                        {/* Botão de Atribuição Direta para ADM / Validador */}
                        {isValidator && [StudyStatus.PENDENTE, StudyStatus.EM_ANALISE, StudyStatus.AGUARDANDO_EXECUCAO, StudyStatus.EM_EXECUCAO].includes(req.status) && (
                          <button
                            onClick={() => handleOpenAssign(req)}
                            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 ${req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE
                              ? 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white'
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white'
                              }`}
                            title={req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE ? 'Validar / Rejeitar Estudo' : 'Gerenciar Atribuição'}
                          >
                            <i className={`fa-solid ${req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE ? 'fa-clipboard-check' : 'fa-user-gear'}`}></i>
                          </button>
                        )}

                        {renderActionButton(req)}

                        {isQC && req.status === StudyStatus.CONTROLE_QUALIDADE && (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {validatingRequest && (
        <ValidationModal
          initialData={validatingRequest}
          executors={executors.map(u => ({ id: u.id, name: u.name }))}
          onConfirm={(assignedTo, data) => handleConfirmAction('validate', data, assignedTo)}
          onReject={(reason) => {
            handleConfirmAction('reject', undefined, undefined, reason);
          }}
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
          readOnly={false}
          onClose={() => setQcRequest(null)}
          onApprove={(qcData: QCControlData) => {
            onStatusUpdate(qcRequest.id, StudyStatus.APROVADO_CQ, undefined, undefined, { qcData });
            showToast('Estudo Aprovado pelo CQ! Retornado ao analista para conclusão final.', 'success');
            setQcRequest(null);
          }}
          onReject={(qcData: QCControlData, reason: string) => {
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
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={() => { setHoldingRequest(null); setHoldInfo(''); }} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-2xl border border-slate-100">Cancelar</button>
              <button
                disabled={!holdInfo.trim()}
                onClick={() => {
                  onStatusUpdate(holdingRequest.id, StudyStatus.AGUARDANDO_INFORMACAO, holdInfo, undefined, { holdRequestSeen: false });
                  showToast('Estudo pausado e solicitante notificado.', 'info');
                  setHoldingRequest(null);
                  setHoldInfo('');
                }}
                className={`flex-[2] py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${holdInfo.trim() ? 'bg-orange-500 text-white shadow-orange-200 hover:scale-[1.02] active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
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
