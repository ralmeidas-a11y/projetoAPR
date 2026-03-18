
import React, { useState, useMemo } from 'react';
import { StudyStatus, FormData, User, UserRole } from './types';
import { formatToLocalTime, normalizeArea } from './utils';
import { FileBrowserModal } from './FileBrowserModal';

interface MyRequestsProps {
  requests: FormData[];
  currentUser?: User;
  onNewRequest: () => void;
  onEditRequest: (request: FormData) => void;
  onCancelRequest: (id: string) => void;
  onViewRequest: (request: FormData) => void;
  onRequestRevision?: (request: FormData) => void;
}

export const MyRequests: React.FC<MyRequestsProps> = ({ 
  requests, currentUser, onNewRequest, onEditRequest, onCancelRequest, onViewRequest, onRequestRevision 
}) => {
  const [requestToCancel, setRequestToCancel] = useState<FormData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [browsingRequest, setBrowsingRequest] = useState<FormData | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'area'>('personal');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const itemsPerPage = 6;

  // Lógica para exibir todas as solicitações sem duplicar por revisão
  const latestRequests = useMemo(() => {
    if (!requests || requests.length === 0) return [];

    const statusFilters = {
      'Todas': () => true,
      'Pendentes/Novas': (r: FormData) => r.status === StudyStatus.PENDENTE || r.status === StudyStatus.REJEITADO || r.status === StudyStatus.EM_ANALISE,
      'Cadastradas': (r: FormData) => r.status === StudyStatus.AGUARDANDO_EXECUCAO,
      'Em Execução': (r: FormData) => r.status === StudyStatus.EM_EXECUCAO,
      'Controle de Qualidade': (r: FormData) => r.status === StudyStatus.CONTROLE_QUALIDADE,
      'Concluídas': (r: FormData) => r.status === StudyStatus.CONCLUIDO,
      'Canceladas': (r: FormData) => r.status === StudyStatus.CANCELADO
    };
    
    // Filtrar primeiro por dono/área antes de agrupar revisões
    const filteredByTab = requests.filter(req => {
      if (activeTab === 'personal') {
        return req.user_id === currentUser?.id;
      } else {
        // Aba 'Área': solicitações da mesma área mas que NÃO são do usuário logado
        const currentUserAreaNormalized = normalizeArea(currentUser?.area);
        return currentUserAreaNormalized && 
               normalizeArea(req.requesterArea) === currentUserAreaNormalized && 
               req.user_id !== currentUser.id;
      }
    });

    // Agrupar por estudo base (sem revisão)
    const groups: { [key: string]: FormData } = {};
    
    filteredByTab.forEach(req => {
      // Pegar código base (antes de -REV ou PROV-)
      const cleanCode = (req.studyNumber || '').replace('PROV-', '');
      const baseCode = cleanCode.split('-REV')[0];
      
      if (!baseCode) return; // Skip se não tem código

      // Se é a primeira do grupo ou é mais recente que a atual
      if (!groups[baseCode]) {
        groups[baseCode] = req;
      } else {
        // Comparar versões (REV)
        const currentRevMatch = (req.studyNumber || '').match(/-REV(\d+)$/i);
        const currentRev = currentRevMatch ? parseInt(currentRevMatch[1]) : 0;
        
        const storedRevMatch = (groups[baseCode].studyNumber || '').match(/-REV(\d+)$/i);
        const storedRev = storedRevMatch ? parseInt(storedRevMatch[1]) : 0;
        
        // Manter a versão mais recente
        if (currentRev >= storedRev) {
          groups[baseCode] = req;
        }
      }
    });

    let result = Object.values(groups);

    // Aplicar filtro de busca se houver
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(req => {
        const title = (req.studyTitle || req.uteName || req.clientName || '').toLowerCase();
        const code = (req.studyNumber || '').toLowerCase();
        const address = (req.address || '').toLowerCase();
        const city = (req.city || '').toLowerCase();
        const requester = (req.requesterName || '').toLowerCase();
        
        return title.includes(query) || 
               code.includes(query) || 
               address.includes(query) || 
               city.includes(query) ||
               requester.includes(query);
      });
    }

    // Aplicar filtro de status
    result = result.filter(statusFilters[statusFilter as keyof typeof statusFilters] || (() => true));

    // Ordenar por data (mais recente primeiro)
    return result.sort((a, b) => {
      const dateA = a.requestDate || '1900-01-01';
      const dateB = b.requestDate || '1900-01-01';
      return dateB.localeCompare(dateA);
    });
  }, [requests, searchQuery, activeTab, currentUser]);
  
  const totalPages = Math.ceil(latestRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedRequests = latestRequests.slice(startIndex, startIndex + itemsPerPage);

  const getStatusStyle = (status: StudyStatus) => {
    switch (status) {
      case StudyStatus.EM_ANALISE: return 'bg-blue-50 text-blue-600 border-blue-200';
      case StudyStatus.PENDENTE: return 'bg-amber-50 text-amber-600 border-amber-200 font-bold';
      case StudyStatus.REJEITADO: return 'bg-amber-50 text-amber-600 border-amber-200';
      case StudyStatus.AGUARDANDO_EXECUCAO: return 'bg-orange-50 text-orange-600 border-orange-200';
      case StudyStatus.EM_EXECUCAO: return 'bg-purple-50 text-purple-600 border-purple-200';
      case StudyStatus.CONTROLE_QUALIDADE: return 'bg-purple-50 text-purple-600 border-purple-200 font-black';
      case StudyStatus.VALIDADO:
      case StudyStatus.CONCLUIDO: return 'bg-green-50 text-green-600 border-green-200';
      case StudyStatus.CANCELADO: return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const getFO = (type: string) => (type || '').split('-').pop() || '';

  const canCancel = (status: StudyStatus) => {
    return status !== StudyStatus.CANCELADO && status !== StudyStatus.CONCLUIDO;
  };

  const handleConfirmCancel = () => {
    if (requestToCancel) {
      onCancelRequest(requestToCancel.id);
      setRequestToCancel(null);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Volta para a primeira página ao buscar
  };

  const handleOpenFolder = (req: FormData) => {
    setBrowsingRequest(req);
  };

  return (
    <div className="relative overflow-x-hidden pb-20">
      {requestToCancel && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-lg font-black text-[#004080] uppercase tracking-tight mb-2">Confirmar Cancelamento</h3>
              <p className="text-slate-500 text-[11px] mb-6">
                Deseja realmente cancelar a solicitação <span className="font-bold text-red-600">{requestToCancel.studyNumber || 'Pendente'}</span>? 
                <br /><br />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Esta ação não poderá ser desfeita.</span>
              </p>
              
              <div className="flex flex-col w-full gap-2">
                <button 
                  onClick={handleConfirmCancel}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-100 active:scale-95"
                >
                  Sim, Cancelar
                </button>
                <button 
                  onClick={() => setRequestToCancel(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
                >
                  Não, Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scaling Container for 80% Zoom simulation */}
      <div 
        style={{ 
          transform: 'scale(0.8)', 
          transformOrigin: 'top center', 
          width: '125%', 
          marginLeft: '-12.5%',
          marginBottom: '-10%' // Compensate for reduced height from scaling
        }} 
        className="space-y-6 animate-in fade-in duration-500"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#004080] to-[#004080]/90 p-6 rounded-3xl border border-blue-200 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="shrink-0">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                {activeTab === 'personal' ? 'Minhas Solicitações' : 'Solicitações da Área'}
              </h2>
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">
                Naturgy SPS • {currentUser?.area || 'CEP'}
              </p>
            </div>

            <div className="flex bg-white/10 p-1 rounded-2xl border border-white/20">
              <button 
                onClick={() => { setActiveTab('personal'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'personal' ? 'bg-white text-[#004080] shadow-md' : 'text-blue-100 hover:text-white hover:bg-white/5'}`}
              >
                Meus Pedidos
              </button>
              <button 
                onClick={() => { setActiveTab('area'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'area' ? 'bg-white text-[#004080] shadow-md' : 'text-blue-100 hover:text-white hover:bg-white/5'}`}
              >
                Equipe / Área
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex-grow lg:flex-grow-0 relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <i className="fa-solid fa-magnifying-glass text-blue-300 text-xs"></i>
              </div>
              <input 
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscar..."
                className="w-full bg-white/20 border border-white/30 text-white placeholder-blue-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-white focus:bg-white/30 transition-all"
              />
            </div>
            <button 
              type="button"
              onClick={onNewRequest}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center lg:justify-start gap-2 whitespace-nowrap"
            >
              <i className="fa-solid fa-plus text-xs"></i> Novo
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl overflow-x-auto shrink-0 no-scrollbar w-full md:w-auto">
            {['Todas', 'Pendentes/Novas', 'Cadastradas', 'Em Execução', 'Controle de Qualidade', 'Concluídas', 'Canceladas'].map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === s ? 'bg-white shadow-sm text-[#004080]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {s}
              </button>
            ))}
          </div>
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-xl border border-dashed border-slate-200">
             Exibindo <span className="text-[#004080] font-black">{latestRequests.length}</span> solicitações
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {latestRequests.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                <i className="fa-solid fa-inbox"></i>
              </div>
              <p className="text-slate-400 font-black uppercase tracking-wider text-xs mb-2">
                {searchQuery ? `Nenhum resultado` : 'Sem solicitações no momento'}
              </p>
              <p className="text-slate-300 text-xs">{searchQuery ? `para "${searchQuery}"` : 'Clique em "Novo" para começar'}</p>
            </div>
          ) : (
            displayedRequests.map(req => {
              const isCancelled = req.status === StudyStatus.CANCELADO;
              const isCompleted = req.status === StudyStatus.CONCLUIDO;
              const hasRevision = (req.studyNumber || '').includes('-REV');

              return (
                <div 
                  key={req.id} 
                  className={`bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-lg hover:border-[#004080]/30 transition-all group relative overflow-hidden flex flex-col justify-between ${isCancelled ? 'opacity-50 bg-slate-50' : ''}`}
                >
                  <div className={isCancelled ? 'pointer-events-none' : ''}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{getFO(req.formType)}</p>
                        <h3 className="font-black text-[#004080] text-sm leading-tight group-hover:text-orange-500 transition-colors">
                          {req.studyTitle || req.clientName || 'Sem Título'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {activeTab === 'area' ? `Por: ${req.requesterName} • ` : ''}Enviado em: {req.createdAt ? formatToLocalTime(req.createdAt) : 'Data não disponível'}
                        </p>
                        {isCompleted && (req.completedAt || req.updatedAt) && (
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-0.5">
                            Concluído em: {formatToLocalTime(req.completedAt || req.updatedAt!)}
                          </p>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 ${getStatusStyle(req.status)}`}>
                        {req.status}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {req.studyNumber && (
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                          <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black">{req.studyNumber}</span>
                          {hasRevision && <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">REV</span>}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-slate-400 flex-shrink-0"></i> 
                        <span>{req.city && req.address ? `${req.city} - ${req.address.substring(0, 20)}...` : req.city || req.address || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder(req);
                        }}
                        disabled={isCancelled}
                        className="flex-1 py-2 bg-green-50 text-green-600 font-black uppercase text-xs tracking-widest rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                        title="Navegador de Arquivos e Formulário"
                      >
                        <i className="fa-solid fa-folder-open text-xs"></i>
                        Ver Arquivos
                      </button>
                      
                      {activeTab === 'personal' && canCancel(req.status) && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRequestToCancel(req);
                          }}
                          className="w-10 h-10 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center justify-center border border-red-200 active:scale-90"
                          title="Cancelar"
                        >
                          <i className="fa-solid fa-trash text-sm"></i>
                        </button>
                      )}
                    </div>

                    {activeTab === 'personal' && req.status === StudyStatus.REJEITADO && req.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Motivo da Rejeição:</p>
                        <p className="text-[11px] text-red-700 font-semibold leading-tight whitespace-pre-wrap">{req.rejectionReason}</p>
                      </div>
                    )}

                    {activeTab === 'personal' && (req.status === StudyStatus.REJEITADO || req.status === StudyStatus.EM_ANALISE) && (
                      <button 
                        type="button"
                        onClick={() => onEditRequest(req)}
                        disabled={isCancelled}
                        className="w-full py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-orange-600 hover:text-white transition-all active:scale-95 disabled:opacity-40"
                      >
                        Editar
                      </button>
                    )}

                    {activeTab === 'personal' && isCompleted && onRequestRevision && (
                      <button 
                        type="button"
                        onClick={() => onRequestRevision(req)}
                        className="w-full py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                      >
                        <i className="fa-solid fa-rotate-left mr-1"></i> Revisão
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <button 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            
            <div className="flex gap-1 mx-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${currentPage === page ? 'bg-[#004080] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>

      {browsingRequest && currentUser && (
        <FileBrowserModal 
          request={browsingRequest} 
          user={currentUser!} 
          allRequests={requests}
          onClose={() => setBrowsingRequest(null)} 
        />
      )}
    </div>
  );
};
