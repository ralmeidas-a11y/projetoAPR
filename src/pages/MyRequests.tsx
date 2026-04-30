
import React, { useState, useMemo } from 'react';
import { StudyStatus, FormData, User, UserRole } from '../types/types';
import { formatToLocalTime, formatDate, normalizeArea, toTitleCase } from '../utils/utils';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { useDialog } from '../components/AppDialog';

interface MyRequestsProps {
  requests: FormData[];
  allRequests: FormData[];
  currentUser?: User;
  onNewRequest: () => void;
  onEditRequest: (request: FormData) => void;
  onCancelRequest: (id: string) => void;
  onViewRequest: (request: FormData) => void;
  onRequestRevision?: (request: FormData) => void;
  onUpdateData?: (data: FormData) => void;
  autoOpenRequestId?: string | null;
  onModalOpened?: () => void;
}

export const MyRequests: React.FC<MyRequestsProps> = ({
  requests, allRequests, currentUser, onNewRequest, onEditRequest, onCancelRequest, onViewRequest, onRequestRevision, onUpdateData,
  autoOpenRequestId, onModalOpened
}) => {
  const { showToast } = useDialog();
  const [requestToCancel, setRequestToCancel] = useState<FormData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [browsingRequest, setBrowsingRequest] = useState<FormData | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [viewingHoldReason, setViewingHoldReason] = useState<FormData | null>(null);
  const [holdResponseText, setHoldResponseText] = useState('');
  const [viewMode, setViewMode] = useState<'meus' | 'area'>('meus');

  React.useEffect(() => {
    if (autoOpenRequestId) {
      const target = allRequests.find(r => r.id === autoOpenRequestId);
      if (target) {
        setViewingHoldReason(target);
        onModalOpened?.();
      }
    }
  }, [autoOpenRequestId, allRequests, onModalOpened]);

  const itemsPerPage = 6;

  // Lógica para exibir todas as solicitações sem duplicar por revisão
  const latestRequests = useMemo(() => {
    // Usar allRequests para mostrar todas as solicitações do banco
    const sourceRequests = allRequests && allRequests.length > 0 ? allRequests : (requests || []);

    const statusFilters: { [key: string]: (r: FormData) => boolean } = {
      'Todas': () => true,
      'Em Análise': (r: FormData) => r.status === StudyStatus.EM_ANALISE,
      'Pendente': (r: FormData) => r.status === StudyStatus.PENDENTE || r.status === StudyStatus.REJEITADO || r.status === StudyStatus.AGUARDANDO_INFORMACAO,
      'Aguardando Execução': (r: FormData) => r.status === StudyStatus.AGUARDANDO_EXECUCAO || r.status === StudyStatus.VALIDADO,
      'Em Execução': (r: FormData) => r.status === StudyStatus.EM_EXECUCAO || r.status === StudyStatus.CONTROLE_QUALIDADE || r.status === StudyStatus.APROVADO_CQ || r.status === StudyStatus.REPROVADO_CQ,
      'Concluído': (r: FormData) => r.status === StudyStatus.CONCLUIDO || r.status === StudyStatus.ENVIADO_SEM_CQ,
      'Cancelado': (r: FormData) => r.status === StudyStatus.CANCELADO
    };

    // Filtrar solicitações baseado no modo de visualização
    const userAreaNormalized = currentUser ? normalizeArea(currentUser.area) : '';
    
    const filteredByTab = sourceRequests.filter(req => {
      if (viewMode === 'meus') {
        // Meus Pedidos: verificar por user_id OU requesterName OU email
        const isOwnerByUserId = req.user_id === currentUser?.id;
        const isOwnerByName = req.requesterName === currentUser?.name;
        const isOwnerByEmail = req.email === currentUser?.email;
        return isOwnerByUserId || isOwnerByName || isOwnerByEmail;
      } else {
        // Pedidos da Área: todas as solicitações de usuários da mesma área
        const reqAreaNormalized = normalizeArea(req.requesterArea);
        return reqAreaNormalized === userAreaNormalized && userAreaNormalized !== ''; 
      }
    });

    // Grupo por estudo base (sem revisão)
    const groups: { [key: string]: FormData } = {};
    const seenIds = new Set<string>();

    filteredByTab.forEach(req => {
      // Skip duplicates de ID
      if (seenIds.has(req.id)) {
        console.warn('[MyRequests] Skipping duplicate ID:', req.id, 'studyNumber:', req.studyNumber);
        return;
      }
      seenIds.add(req.id);

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
    result = result.filter(statusFilters[statusFilter] || (() => true));

    // Ordenar por data (mais recente primeiro)
    return result.sort((a, b) => {
      const dateA = new Date(a.requestDate || a.createdAt || a.updatedAt || 0).getTime();
      const dateB = new Date(b.requestDate || b.createdAt || b.updatedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [requests, allRequests, searchQuery, currentUser, statusFilter, viewMode]);

  const totalPages = Math.ceil(latestRequests.length / itemsPerPage);

  // Garantir que a página atual é válida após filtros/sincronização
  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedRequests = latestRequests.slice(startIndex, startIndex + itemsPerPage);

  const getStatusStyle = (status: StudyStatus) => {
    switch (status) {
      case StudyStatus.EM_ANALISE: return 'bg-blue-50 text-blue-600 border-blue-200';
      case StudyStatus.PENDENTE: return 'bg-amber-50 text-amber-600 border-amber-200 font-bold';
      case StudyStatus.REJEITADO: return 'bg-amber-50 text-amber-600 border-amber-200';
      case StudyStatus.AGUARDANDO_INFORMACAO: return 'bg-amber-50 text-amber-600 border-amber-200 italic';
      case StudyStatus.AGUARDANDO_EXECUCAO: return 'bg-orange-50 text-orange-600 border-orange-200';
      case StudyStatus.EM_EXECUCAO: return 'bg-purple-50 text-purple-600 border-purple-200';
      case StudyStatus.CONTROLE_QUALIDADE:
      case StudyStatus.APROVADO_CQ:
      case StudyStatus.REPROVADO_CQ: return 'bg-purple-50 text-purple-600 border-purple-200';
      case StudyStatus.VALIDADO:
      case StudyStatus.CONCLUIDO:
      case StudyStatus.ENVIADO_SEM_CQ: return 'bg-green-50 text-green-600 border-green-200';
      case StudyStatus.CANCELADO: return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const getStatusDisplay = (status: StudyStatus): string => {
    switch (status) {
      case StudyStatus.CONTROLE_QUALIDADE:
      case StudyStatus.APROVADO_CQ:
      case StudyStatus.REPROVADO_CQ:
        return 'Em Execução';
      case StudyStatus.ENVIADO_SEM_CQ:
        return 'Concluído';
      default:
        return status;
    }
  };

  const getFO = (type: string) => {
    const fo = (type || '').split('-').pop() || '';
    return fo.replace(/\D/g, ''); // Extract only digits
  };

  const formatStudyID = (req: FormData) => {
    // Formato fixo conforme solicitado: PE.00492-FO + número do formulário
    const foNumber = getFO(req.formType).padStart(2, '0');
    return `PE.00492-FO${foNumber}`;
  };

  const canEdit = (req: FormData) => {
    if (!currentUser) return false;
    const isOwner = req.user_id === currentUser.id;
    const isOwnerByName = req.requesterName === currentUser.name;
    const isOwnerByEmail = req.email === currentUser.email;
    return isOwner || isOwnerByName || isOwnerByEmail;
  };

  const canCancel = (req: FormData) => {
    const isOwner = req.user_id === currentUser?.id;
    const isAdm = currentUser?.role === UserRole.ADM;
    // O usuário só pode cancelar se for o dono ou ADM, e se o estudo não estiver concluído/cancelado
    return (isOwner || isAdm) && req.status !== StudyStatus.CANCELADO && req.status !== StudyStatus.CONCLUIDO;
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Volta para a primeira página ao buscar
  };

  /**
   * Calcula as páginas a serem exibidas na paginação (Ex: 1 2 ... 96 97)
   */
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2; // Quantas páginas mostrar ao redor da atual
    const left = currentPage - delta;
    const right = currentPage + delta;
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      } else if (i === left - 1 || i === right + 1) {
        pages.push('...');
      }
    }
    // Remover duplicatas de '...'
    return pages.filter((item, pos, self) => self.indexOf(item) === pos);
  };

  const handleOpenFolder = (req: FormData) => {
    setBrowsingRequest(req);
  };

  return (
    <div className="relative overflow-x-hidden pb-20">
      {requestToCancel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[99] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center shadow-inner border border-red-100">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Cancelar Estudo?</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{requestToCancel.studyNumber}</p>
              </div>
            </div>
            <div className="p-8">
              <p className="text-sm text-slate-500 leading-relaxed font-medium">Esta ação é irreversível. O estudo será marcado como cancelado e não poderá mais ser editado ou executado.</p>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={() => setRequestToCancel(null)} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-2xl border border-slate-100">Não, Manter</button>
              <button
                onClick={() => {
                  onCancelRequest(requestToCancel.id);
                  setRequestToCancel(null);
                }}
                className="flex-[2] py-4 bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-200 hover:scale-[1.02] active:scale-95 transition-all"
              >Sim, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Informação Solicitada (Solicitante) - FORMATO ALERTA */}
      {viewingHoldReason && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-red-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header Formato Alerta */}
            <div className="p-8 bg-gradient-to-r from-red-600 to-red-500 flex items-center justify-between text-white">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-xl animate-pulse">
                  <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight leading-none">Informações Necessárias!</h3>
                  <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest mt-2">{viewingHoldReason.studyNumber} • Interrompido pelo Analista</p>
                </div>
              </div>
              <button onClick={() => { setViewingHoldReason(null); setHoldResponseText(''); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Mensagem do Analista */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-user-tie text-[#004080] text-sm"></i>
                  <p className="text-[11px] text-[#004080] font-black uppercase tracking-widest">Pedido do Analista:</p>
                </div>
                <div className="p-6 bg-red-50/50 rounded-3xl border border-red-200/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-200/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-red-200/20 transition-all"></div>
                  <p className="text-sm text-red-900 font-bold italic leading-relaxed whitespace-pre-wrap relative z-10 font-[Outfit]">
                    "{viewingHoldReason.holdReason}"
                  </p>
                </div>
              </div>

              {/* Box de Resposta */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-reply text-slate-400 text-sm"></i>
                    <label className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Sua Resposta / Informação Adicional:</label>
                  </div>
                  {viewingHoldReason.holdResponse && (
                    <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase"></span>
                  )}
                </div>

                <textarea
                  value={holdResponseText || (viewingHoldReason.holdResponse || '')}
                  onChange={(e) => setHoldResponseText(e.target.value)}
                  className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-[#004080]/10 focus:bg-white focus:border-[#004080] transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium leading-relaxed"
                  placeholder="Digite aqui os dados solicitados ou informe que o ajuste foi realizado..."
                ></textarea>

                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight text-right">

                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-slate-50 flex gap-4">
              <button
                onClick={() => { setViewingHoldReason(null); setHoldResponseText(''); }}
                className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-2xl border border-slate-200"
              >
                Cancelar
              </button>
              <button
                disabled={!holdResponseText.trim() && !viewingHoldReason.holdResponse}
                onClick={() => {
                  if (onUpdateData && viewingHoldReason) {
                    const updated = { 
                      ...viewingHoldReason, 
                      holdResponse: holdResponseText || viewingHoldReason.holdResponse,
                      holdResponseSeen: false 
                    };
                    onUpdateData(updated);
                    showToast('Resposta enviada com sucesso!', 'success');
                    setViewingHoldReason(null);
                    setHoldResponseText('');
                  }
                }}
                className={`flex-[2] py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all ${holdResponseText.trim() ? 'bg-[#004080] text-white shadow-[#004080]/20 hover:scale-[1.02] active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed uppercase'}`}
              >
                Enviar Resposta
              </button>
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
                Minhas Solicitações
              </h2>
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">
                Naturgy SPS • {currentUser?.area || 'CEP'}
              </p>
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

        {/* Conteúdo Principal com Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Lateral Esquerda - Filtros de Status (Exclusivo Solicitante) */}
          <aside className="w-full lg:w-64 shrink-0 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24">
              <h3 className="text-[10px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-2">
                <i className="fa-solid fa-filter"></i> Status do Estudo
              </h3>

              <nav className="flex flex-col gap-2">
                {['Todas', 'Em Análise', 'Pendente', 'Aguardando Execução', 'Em Execução', 'Concluído', 'Cancelado'].map(s => {
                  const isActive = statusFilter === s;

                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setCurrentPage(1);
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all text-left ${isActive
                        ? 'bg-[#004080] text-white shadow-lg shadow-blue-100 translate-x-1'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-[#004080]'
                        }`}
                    >
                      <span>{s}</span>
                      {isActive && <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Total de Pedidos
                </div>
                <div className="text-2xl font-black text-[#004080] mt-1">
                  {latestRequests.length}
                </div>
              </div>
            </div>
          </aside>

          {/* Painel MyRequest (Lista de Cards) */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setViewMode('meus')}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${viewMode === 'meus' ? 'bg-[#004080] text-white shadow-blue-100' : 'text-slate-400 hover:bg-white hover:text-[#004080]'}`}
                >
                  <i className="fa-solid fa-user-circle mr-2 opacity-70"></i>
                  Meus Pedidos
                </button>
                <button
                  onClick={() => setViewMode('area')}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${viewMode === 'area' ? 'bg-[#004080] text-white shadow-blue-100' : 'text-slate-400 hover:bg-white hover:text-[#004080]'}`}
                >
                  <i className="fa-solid fa-users mr-2 opacity-70"></i>
                  Pedidos da Área
                </button>
              </div>
            </div>

            {/* Removido Filtro de Status Superior conforme solicitado */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
                  // DEBUG: Check for duplicate IDs
                  const duplicates = displayedRequests.filter(r => r.id === req.id);
                  if (duplicates.length > 1) {
                    console.warn('[MyRequests] Duplicate ID found:', req.id, 'count:', duplicates.length);
                  }

                  const isCancelled = req.status === StudyStatus.CANCELADO;
                  const isCompleted = req.status === StudyStatus.CONCLUIDO || req.status === StudyStatus.ENVIADO_SEM_CQ;
                  const hasRevision = (req.studyNumber || '').includes('-REV');

                  return (
                    <div
                      key={req.id}
                      className={`bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-lg hover:border-[#004080]/30 transition-all group relative overflow-hidden flex flex-col justify-between ${isCancelled ? 'opacity-50 bg-slate-50' : ''}`}
                    >
                      <div className={isCancelled ? 'pointer-events-none' : ''}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{req.studyNumber || 'PROV-APR'}</p>
                            <h3 className="font-black text-[#004080] text-sm leading-tight group-hover:text-orange-500 transition-colors">
                              {req.studyTitle || req.clientName || 'Sem Título'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              Enviado em: {req.requestDate ? formatDate(req.requestDate) : 'Data não disponível'}
                            </p>
                            {isCompleted && (req.completedAt || req.updatedAt) && (
                              <div className="flex flex-col">
                                <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-0.5">
                                  Concluído em: {formatDate(req.completedAt || req.updatedAt!)}
                                </p>
                                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-0.5">
                                  Válido até: {(() => {
                                    const d = new Date(req.completedAt || req.updatedAt!);
                                    d.setFullYear(d.getFullYear() + 1);
                                    return d.toLocaleDateString('pt-BR');
                                  })()}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block ${getStatusStyle(req.status)}`}>
                              {getStatusDisplay(req.status)}
                            </span>
                            {req.status === StudyStatus.AGUARDANDO_INFORMACAO && req.holdReason && (
                              <button
                                onClick={() => setViewingHoldReason(req)}
                                className="text-[9px] text-[#004080] font-black uppercase tracking-tighter hover:underline flex items-center gap-1"
                              >
                                <i className="fa-solid fa-circle-question scale-90"></i>
                                Ver solicitação do analista
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black">{formatStudyID(req)}</span>
                            {hasRevision && <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">REV</span>}
                          </div>
                          <p className="text-xs text-slate-500 flex items-start gap-2">
                            <i className="fa-solid fa-location-dot text-slate-400 flex-shrink-0 mt-0.5"></i>
                            <span className="leading-tight">
                              {(() => {
                                const address = toTitleCase(req.address);
                                const neighborhood = toTitleCase(req.neighborhood);
                                const city = toTitleCase(req.city);
                                const sigla = (req.empresa === 'SPS') ? 'SP' : 'RJ';
                                
                                const parts = [];
                                if (address) parts.push(address);
                                if (neighborhood) parts.push(neighborhood);
                                if (city) parts.push(`${city}/${sigla}`);
                                
                                return parts.length > 0 ? parts.join(' - ') : (req.city || req.address || '—');
                              })()}
                            </span>
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
                            className="flex-1 py-2.5 px-4 bg-green-50 text-green-600 font-black uppercase text-xs tracking-widest rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                            title="Navegador de Arquivos e Formulário"
                          >
                            <i className="fa-solid fa-folder-open text-xs"></i>
                            Ver Arquivos
                          </button>

                          {canCancel(req) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRequestToCancel(req);
                              }}
                              className="py-2.5 px-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center justify-center border border-red-200 active:scale-90"
                              title="Cancelar"
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          )}
                        </div>

                        {req.status === StudyStatus.REJEITADO && req.rejectionReason && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                            <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Motivo da Rejeição:</p>
                            <p className="text-[11px] text-red-700 font-semibold leading-tight whitespace-pre-wrap">{req.rejectionReason}</p>
                          </div>
                        )}

                        {(req.status === StudyStatus.REJEITADO || req.status === StudyStatus.EM_ANALISE) && canEdit(req) && (
                          <button
                            type="button"
                            onClick={() => onEditRequest(req)}
                            disabled={isCancelled}
                            className="w-full py-2.5 px-4 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-orange-600 hover:text-white transition-all active:scale-95 disabled:opacity-40"
                          >
                            Editar
                          </button>
                        )}

                        {isCompleted && onRequestRevision && (
                          <button
                            type="button"
                            onClick={() => onRequestRevision(req)}
                            className="w-full py-2.5 px-4 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95"
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
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-8 bg-white/40 backdrop-blur-sm rounded-3xl border border-slate-200/50 mt-8 shadow-sm">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="py-2.5 px-2.5 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#004080] hover:border-[#004080] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 bg-white"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>

            <div className="flex items-center gap-1 mx-4">
              {getPageNumbers().map((page, idx) => (
                <React.Fragment key={idx}>
                  {page === '...' ? (
                    <span className="px-2 text-slate-300 font-black">...</span>
                  ) : (
                    <button
                      onClick={() => goToPage(Number(page))}
                      className={`py-2.5 px-2.5 rounded-lg text-[11px] font-black transition-all transform ${currentPage === page 
                        ? 'bg-[#004080] text-white shadow-lg shadow-blue-200 scale-110' 
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-[#004080] hover:text-[#004080]'}`}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="py-2.5 px-2.5 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#004080] hover:border-[#004080] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 bg-white"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
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
