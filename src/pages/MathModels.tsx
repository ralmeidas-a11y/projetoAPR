
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types/types';
import { useDialog } from '../components/AppDialog';

interface MathModel {
  id: string;
  idsigep: number;
  status: string;
  statusCode: string;
  titulo: string;
  localiz: string;
  respSepla: string;
  respSeplaSap: string;
}

interface MathModelsProps {
  currentUser: User;
  onBack: () => void;
  onNewModel: () => void;
  onCreateRevision: (model: MathModel) => void;
}

export const MathModels: React.FC<MathModelsProps> = ({
  currentUser,
  onBack,
  onNewModel,
  onCreateRevision
}) => {
  const { showToast } = useDialog();
  const [models, setModels] = useState<MathModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/math-models');
      if (!response.ok) throw new Error('Erro ao buscar modelos');
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Error fetching math models:', error);
      showToast('Erro ao carregar modelos matemáticos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    return models.filter(m => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          String(m.idsigep || '').toLowerCase().includes(search) ||
          (m.titulo || '').toLowerCase().includes(search) ||
          (m.localiz || '').toLowerCase().includes(search) ||
          (m.respSepla || '').toLowerCase().includes(search) ||
          (m.status || '').toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [models, searchTerm]);

  const totalPages = Math.ceil(filteredModels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedModels = filteredModels.slice(startIndex, startIndex + itemsPerPage);

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

  const getStatusStyle = (statusCode: string) => {
    switch (statusCode) {
      case '300': return 'bg-amber-50 text-amber-600 border-amber-200 font-bold';
      case '200': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const isModelInUse = (model: MathModel) => model.statusCode === '300';

  const isMine = (model: MathModel) => {
    const userSap = currentUser.sap || '';
    const modelSap = model.respSeplaSap || '';
    return modelSap === userSap || modelSap.replace(/^0+/, '') === userSap.replace(/^0+/, '');
  };

  const handleLock = async (model: MathModel) => {
    try {
      const res = await fetch(`/api/math-models/${model.id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sap: currentUser.sap })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Erro ao utilizar modelo', 'error');
        return;
      }
      showToast('Modelo selecionado com sucesso', 'success');
      fetchModels();
    } catch {
      showToast('Erro ao utilizar modelo', 'error');
    }
  };

  const handleUnlock = async (model: MathModel) => {
    try {
      const res = await fetch(`/api/math-models/${model.id}/unlock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sap: currentUser.sap })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Erro ao liberar modelo', 'error');
        return;
      }
      showToast('Modelo liberado com sucesso', 'success');
      fetchModels();
    } catch {
      showToast('Erro ao liberar modelo', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <div>
            <h2 className="text-lg font-black text-[#004080] uppercase tracking-tight">Modelos Matemáticos</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Winflow - Elaboração e Revisão</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <i className="fa-solid fa-spinner fa-spin text-blue-500"></i>
            </div>
            <span className="text-xs text-slate-400 font-medium">Carregando modelos...</span>
          </div>
        </div>
      </div>
    );
  }

  const modelsInUseByOthers = filteredModels.filter(m => isModelInUse(m) && !isMine(m));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <div>
            <h2 className="text-lg font-black text-[#004080] uppercase tracking-tight">Modelos Matemáticos</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Winflow - Elaboração e Revisão</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
            <input
              type="text"
              placeholder="Buscar por IDSIGEP, título, localização..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-72"
            />
          </div>
          <button
            onClick={() => onNewModel()}
            className="px-3 py-2 rounded-xl text-[10px] font-bold bg-[#004080] text-white hover:bg-[#003060] transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <i className="fa-solid fa-plus text-[9px]"></i>
            Novo Modelo
          </button>
          <button
            onClick={fetchModels}
            className="w-9 h-9 rounded-xl bg-green-50 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center text-sm active:scale-90"
            title="Atualizar"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      {modelsInUseByOthers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-700">Atenção: {modelsInUseByOthers.length} {modelsInUseByOthers.length === 1 ? 'modelo está' : 'modelos estão'} em uso por outro(s) analista(s)</p>
            <div className="mt-1.5 space-y-0.5">
              {modelsInUseByOthers.map(m => (
                <p key={m.id} className="text-[10px] text-amber-600">
                  <span className="font-bold">{m.idsigep}</span> — {m.titulo || 'Sem título'} — Responsável: <span className="font-semibold">{m.respSepla || 'Analista'}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
              <i className="fa-solid fa-square-root-variable text-xs"></i>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {filteredModels.length} {filteredModels.length === 1 ? 'modelo' : 'modelos'} encontrado(s)
            </span>
          </div>
        </div>

        {filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-3xl text-slate-300 mb-4">
              <i className="fa-solid fa-calculator"></i>
            </div>
            <h4 className="text-sm font-bold text-slate-500 uppercase">Nenhum modelo encontrado</h4>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
              Não há modelos matemáticos cadastrados com GRUPO_EST = 190.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">IDSIGEP</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Título</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Localização</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Responsável</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedModels.map((model) => {
                  const inUse = isModelInUse(model);
                  const modelIsMine = isMine(model);

                  return (
                    <tr
                      key={model.id}
                      className={`transition-colors duration-150 ${
                        inUse && !modelIsMine ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-black text-[#004080] tracking-tight">
                          {model.idsigep || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[250px]" title={model.titulo}>
                          {model.titulo || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-slate-600 truncate max-w-[200px]" title={model.localiz}>
                          {model.localiz || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {inUse ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                            <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[120px]">
                              {modelIsMine ? 'Você' : (model.respSepla || 'Analista')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${getStatusStyle(model.statusCode)}`}>
                          {model.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!inUse ? (
                            <button
                              onClick={() => handleLock(model)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 bg-[#004080] text-white hover:bg-[#003060] shadow-sm"
                            >
                              <i className="fa-solid fa-play text-[9px] mr-1"></i>
                              Utilizar
                            </button>
                          ) : modelIsMine ? (
                            <button
                              onClick={() => handleUnlock(model)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 bg-green-500 text-white hover:bg-green-600 shadow-sm"
                            >
                              <i className="fa-solid fa-unlock text-[9px] mr-1"></i>
                              Liberar
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              <i className="fa-solid fa-lock text-[9px] mr-1"></i>
                              Em uso
                            </span>
                          )}
                          <button
                            onClick={() => onCreateRevision(model)}
                            disabled={model.statusCode === '300'}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-sm ${
                              model.statusCode === '300'
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                            title={model.statusCode === '300' ? 'Libere o modelo antes de criar revisão' : 'Criar Revisão'}
                          >
                            <i className="fa-solid fa-code-branch text-[9px] mr-1"></i>
                            Revisão
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[9px] text-slate-400 font-bold uppercase">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-[10px]"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              {getPageNumbers().map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                    page === currentPage
                      ? 'bg-[#004080] text-white shadow-sm'
                      : typeof page === 'number'
                        ? 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        : 'bg-transparent text-slate-300 cursor-default'
                  }`}
                  disabled={typeof page !== 'number'}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-[10px]"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
