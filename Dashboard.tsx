
import React, { useState } from 'react';
import { FormData, StudyStatus, User, UserRole } from '../types';

interface DashboardProps {
  user: User;
  requests: FormData[];
  allUsers?: User[];
  onAnalyze: (request: FormData) => void;
  onExecute: (request: FormData) => void;
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, requests, allUsers = [], onAnalyze, onExecute, onStatusUpdate }) => {
  const [filter, setFilter] = useState<string>('Todas');
  const [assigningRequest, setAssigningRequest] = useState<FormData | null>(null);
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [openingFolder, setOpeningFolder] = useState<string | null>(null);

  const isValidator = user.role === UserRole.ADM || user.permissions?.includes('validar');
  const isAdmin = user.role === UserRole.ADM;

  const getFilters = () => {
    const base = ['Todas', 'Pendentes/Novas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    if (isValidator) return ['Todas', 'Pendentes/Novas', 'Cadastradas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'];
    return base;
  };

  const filteredRequests = requests.filter(r => {
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
      case StudyStatus.REJEITADO: return 'bg-red-50 text-red-600 border-red-200';
      case StudyStatus.AGUARDANDO_EXECUCAO: return 'bg-orange-50 text-orange-600 border-orange-200';
      case StudyStatus.EM_EXECUCAO: return 'bg-indigo-50 text-indigo-600 border-indigo-200';
      case StudyStatus.CONTROLE_QUALIDADE: return 'bg-purple-50 text-purple-600 border-purple-200 font-black';
      case StudyStatus.CONCLUIDO: return 'bg-green-50 text-green-600 border-green-200';
      case StudyStatus.CANCELADO: return 'bg-slate-200 text-slate-500 border-slate-300 opacity-60';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const getFO = (type: string) => type.split('-').pop() || '';

  const getResponsibleName = (assignedToId?: string) => {
    if (!assignedToId) return 'Sistema (Livre)';
    const found = allUsers.find(u => u.id === assignedToId);
    return found ? found.name : 'Analista Externo';
  };

  const handleOpenAssign = (req: FormData) => {
    setAssigningRequest(req);
    setSelectedAnalyst(req.assignedTo || '');
  };

  const handleConfirmAssign = () => {
    try {
      if (assigningRequest && onStatusUpdate) {
        const newStatus = (assigningRequest.status === StudyStatus.PENDENTE || assigningRequest.status === StudyStatus.EM_ANALISE) 
          ? StudyStatus.AGUARDANDO_EXECUCAO 
          : assigningRequest.status;
        
        onStatusUpdate(assigningRequest.id, newStatus, undefined, selectedAnalyst || undefined);
        setAssigningRequest(null);
      }
    } catch (error) {
      console.error('Erro ao confirmar atribuição:', error);
      alert('Erro ao confirmar atribuição. Por favor, tente novamente.');
    }
  };

  const handleOpenFolder = async (req: FormData) => {
    if (!req.studyNumber || req.studyNumber.startsWith('PROV-') || !req.requesterName) {
      return;
    }

    setOpeningFolder(req.id);
    try {
      if (typeof window !== 'undefined' && (window as any).api?.createRequestFolder) {
        const result = await (window as any).api.createRequestFolder({
          email: req.email || '',
          userName: req.requesterName || '',
          requestId: req.studyNumber
        });

        if (result.success) {
          // Abrir a pasta
          await (window as any).api.openFolder(result.baseFolderPath);
          console.log(`%c📁 Pasta da solicitação aberta: ${req.studyNumber}`, "color: #16a34a; font-weight: bold;");
        } else if (result.requiresSync) {
          alert(`SharePoint não sincronizado.\n\nPor favor, sincronize a pasta "SolicitaWeb Estudos" do SharePoint antes de tentar acessar os arquivos.\n\nLink: ${result.sharePointUrl}`);
        } else {
          alert(`Erro ao criar/abrir pasta: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('Erro ao abrir pasta:', error);
      alert('Erro ao abrir pasta da solicitação');
    } finally {
      setOpeningFolder(null);
    }
  };

  const renderActionButton = (req: FormData) => {
    try {
      const isLockedForMe = req.assignedTo && req.assignedTo !== user.id && !isAdmin;

      if (isLockedForMe) {
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-200 flex items-center justify-center text-xs border border-slate-100 cursor-not-allowed" title="Estudo bloqueado: Atribuído a outro analista">
             <i className="fa-solid fa-lock"></i>
          </div>
        );
      }

      if (req.status === StudyStatus.PENDENTE || req.status === StudyStatus.EM_ANALISE || req.status === StudyStatus.REJEITADO) {
        return (
          <button 
            onClick={() => { try { onAnalyze(req); } catch (e) { console.error('Erro:', e); } }}
            className="w-10 h-10 rounded-xl bg-slate-100 text-[#004080] hover:bg-[#004080] hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 border border-slate-200"
            title="Analisar e Validar Solicitação"
          >
            <i className="fa-solid fa-eye"></i>
          </button>
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

      return (
        <button 
          onClick={() => { try { onAnalyze(req); } catch (e) { console.error('Erro:', e); } }}
          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-[#004080] transition-all flex items-center justify-center text-xs border border-slate-100"
          title="Visualizar Detalhes"
        >
          <i className="fa-solid fa-magnifying-glass"></i>
        </button>
      );
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
      {assigningRequest && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-2">Gestão de Atribuição</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Defina o responsável pelo estudo {assigningRequest.studyNumber}</p>
            
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
            </div>

            <div className="flex justify-end gap-3 mt-10">
              <button onClick={() => setAssigningRequest(null)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={handleConfirmAssign} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100 transition-all active:scale-95">Confirmar Atribuição</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-[#004080] uppercase tracking-tight">Painel de Controle APR</h2>
          <p className="text-slate-500 text-sm mt-1">Gerenciamento do fluxo de solicitações.</p>
        </div>
        
        <div className="flex gap-2 p-1 bg-slate-50 rounded-xl overflow-x-auto">
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
                  <tr key={req.id} className={`hover:bg-slate-50/50 transition-colors ${req.assignedTo && req.assignedTo !== user.id && !isAdmin ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#004080] text-white text-[9px] font-black px-1.5 py-0.5 rounded">{getFO(req.formType)}</span>
                        <p className="text-[11px] font-black text-[#004080] uppercase">{req.studyNumber}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{req.requestDate}</p>
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
                               <span className="text-[8px] font-black text-slate-300 uppercase">Fila Livre</span>
                             </>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700">{req.estimatedDeliveryDate || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Botão para Abrir Pasta da Solicitação */}
                        {req.studyNumber && !req.studyNumber.startsWith('PROV-') && (
                          <button 
                            onClick={() => handleOpenFolder(req)}
                            disabled={openingFolder === req.id}
                            className="w-10 h-10 rounded-xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 disabled:opacity-50"
                            title="Abrir Pasta no SharePoint"
                          >
                            {openingFolder === req.id ? (
                              <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fa-solid fa-folder-open"></i>
                            )}
                          </button>
                        )}

                        {/* Botão de Atribuição Direta para ADM */}
                        {isAdmin && (
                          <button 
                            onClick={() => handleOpenAssign(req)}
                            className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center text-xs shadow-sm active:scale-95"
                            title="Gerenciar Atribuição de Responsável"
                          >
                            <i className="fa-solid fa-user-gear"></i>
                          </button>
                        )}
                        
                        {renderActionButton(req)}
                        
                        {isAdmin && req.status === StudyStatus.CONTROLE_QUALIDADE && (
                          <button 
                             onClick={() => {
                               try {
                                 onStatusUpdate?.(req.id, StudyStatus.CONCLUIDO);
                               } catch (error) {
                                 console.error('Erro ao concluir estudo:', error);
                                 alert('Erro ao concluir estudo. Por favor, tente novamente.');
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
    </div>
  );
};
