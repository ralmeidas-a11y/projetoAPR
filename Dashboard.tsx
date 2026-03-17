
import React, { useState } from 'react';
import { StudyStatus, FormData, User, UserRole } from './types';
import { formatToLocalTime, formatDate } from './utils';
import { FileBrowserModal } from './FileBrowserModal';
import { ValidationModal } from './ValidationModal';
import { useDialog } from './AppDialog';

interface DashboardProps {
  user: User;
  requests: FormData[];
  allUsers?: User[];
  onAnalyze: (request: FormData) => void;
  onExecute: (request: FormData) => void;
  onStatusUpdate: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, requests, allUsers = [], onAnalyze, onExecute, onStatusUpdate }) => {
  const { showAlert, showToast } = useDialog();
  const [filter, setFilter] = useState<string>('Todas');
  const [assigningRequest, setAssigningRequest] = useState<FormData | null>(null);
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [browsingRequest, setBrowsingRequest] = useState<FormData | null>(null);
  const [validatingRequest, setValidatingRequest] = useState<FormData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    if (filter === 'Controle de Qualidade') return r.status === StudyStatus.CONTROLE_QUALIDADE;
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
      case StudyStatus.CONTROLE_QUALIDADE: return 'bg-purple-50 text-purple-600 border-purple-200 font-black';
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
          <button 
            onClick={() => { try { onExecute(req); } catch (e) { console.error('Erro:', e); } }}
            className="w-10 h-10 rounded-xl bg-[#004080] text-white hover:bg-orange-500 transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
            title="Abrir Painel Técnico de Execução"
          >
            <i className="fa-solid fa-play"></i>
          </button>
        );
      }

      if (req.status === StudyStatus.CONCLUIDO || req.status === StudyStatus.CONTROLE_QUALIDADE) {
        return (
          <button 
            onClick={() => { try { onExecute(req); } catch (e) { console.error('Erro:', e); } }}
            className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 border border-indigo-100"
            title="Visualizar Painel Técnico (Leitura)"
          >
            <i className="fa-solid fa-eye"></i>
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
                            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 ${
                              req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE
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
                             onClick={() => {
                               try {
                                  onStatusUpdate?.(req.id, StudyStatus.CONCLUIDO);
                                } catch (error) {
                                  console.error('Erro ao concluir estudo:', error);
                                  showToast('Erro ao concluir estudo. Por favor, tente novamente.', 'error');
                                }
                             }}
                             className="w-10 h-10 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                             title="Aprovar e Concluir"
                          >
                             <i className="fa-solid fa-check-double"></i>
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
    </div>
  );
};
