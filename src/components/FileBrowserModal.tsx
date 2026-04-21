import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FormData, User, UserRole, StudyStatus } from '../types/types';
import { StorageService, getRequestPath } from '../services/storage';
import { FormMirrorView } from './FormMirrorView';
import { useDialog } from './AppDialog';

interface FileBrowserModalProps {
  request: FormData;
  user: User;
  onClose: () => void;
  allUsers?: User[];
  allRequests?: FormData[];
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  onStartExecution?: (request: FormData) => void;
  restrictToCategory?: string;
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({ 
  request, user, onClose, allUsers = [], allRequests = [], onStatusUpdate, onStartExecution, restrictToCategory 
}) => {
  const { showConfirm, showToast } = useDialog();
  const [activeCategory, setActiveCategory] = useState<string>(restrictToCategory || 'Solicitacao');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingFormMirror, setViewingFormMirror] = useState(false);
  
  const isStaff = user.role === UserRole.ADM || user.role === UserRole.ANALISTA;

  // Identificar estudo base para mostrar revisões
  const getBaseCode = useCallback((nro: string | undefined) => {
    if (!nro) return '';
    const norm = nro.replace('PROV-', '');
    const revSuffixMatch = norm.match(/(.+)-REV(\d+)$/i);
    if (revSuffixMatch) return revSuffixMatch[1];
    if (norm.length === 10 && /^\d+$/.test(norm)) return norm.substring(0, 8);
    return norm;
  }, []);

  const baseCode = useMemo(() => getBaseCode(request.studyNumber), [request.studyNumber, getBaseCode]);

  const availableRevisions = useMemo(() => {
    if (!allRequests || allRequests.length === 0) return [request.studyNumber];
    
    return allRequests
      .filter(r => getBaseCode(r.studyNumber) === baseCode)
      .map(r => r.studyNumber)
      .sort((a, b) => {
        const getRev = (nro: string | undefined) => {
          if (!nro) return 0;
          const norm = nro.replace('PROV-', '');
          const m = norm.match(/-REV(\d+)$/i);
          if (m) return parseInt(m[1]);
          if (norm.length === 10 && /^\d+$/.test(norm)) return parseInt(norm.substring(8, 10));
          return 0;
        };
        return getRev(a) - getRev(b);
      });
  }, [allRequests, baseCode, request.studyNumber, getBaseCode]);

  const [activeRevision, setActiveRevision] = useState(request.studyNumber);

  const selectedRevisionData = useMemo(() => {
    return allRequests?.find(r => r.studyNumber === activeRevision) || request;
  }, [allRequests, activeRevision, request]);

  const requestId = useMemo(() => selectedRevisionData.id, [selectedRevisionData]);

  const categories = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
  const availableCategories = useMemo(() => {
    const base = isStaff 
      ? categories 
      : categories.filter(c => c === 'Solicitacao' || (c === 'Resposta' && selectedRevisionData.status === StudyStatus.CONCLUIDO));
    
    if (restrictToCategory) {
      return base.filter(c => c === restrictToCategory);
    }
    return base;
  }, [isStaff, restrictToCategory, selectedRevisionData.status]);

  const canModify = useMemo(() => {
    // Solicitação concluída não pode deletar/adicionar nenhum arquivo
    if (selectedRevisionData.status === StudyStatus.CONCLUIDO) return false;

    // Proprietário (Solicitante)
    if (user.role === UserRole.SOLICITANTE && user.id === selectedRevisionData.user_id) {
      const allowedOwnerStatuses = [StudyStatus.REJEITADO, StudyStatus.EM_ANALISE, StudyStatus.AGUARDANDO_EXECUCAO];
      return activeCategory === 'Solicitacao' && allowedOwnerStatuses.includes(selectedRevisionData.status);
    }

    // Analista/ADM
    if (isStaff) {
      const allowedStaffCategories = ['Resposta', 'Calculos', 'Outros'];
      return selectedRevisionData.status === StudyStatus.EM_EXECUCAO && allowedStaffCategories.includes(activeCategory);
    }

    return false;
  }, [selectedRevisionData.status, selectedRevisionData.user_id, user.role, user.id, activeCategory, isStaff]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (uploadedFiles.length === 0) return;

    setLoading(true);
    try {
      for (const file of uploadedFiles) {
        await StorageService.uploadFile(requestId, activeCategory, file as File);
      }
      await loadFiles();
      showToast(`${uploadedFiles.length} arquivo(s) adicionados.`, 'success');
    } catch (err) {
      showToast('Erro ao realizar upload.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
    }
  };

  const loadFiles = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const result = await StorageService.getRequestFiles(requestId, activeCategory);
      const remoteFiles = result.filter(f => !f.name.startsWith('.')); // Ocultar .keep
      
      // Merging local files ONLY if looking at the "current" physical request being edited
      const isCurrentRequest = activeRevision === request.studyNumber;
      const localFiles = isCurrentRequest 
        ? (activeCategory === 'Solicitacao' 
            ? (request.selectedFiles || []) 
            : (request.categorizedFiles?.[activeCategory] || []))
        : [];
      
      // Filter out invalid/empty files from local state
      const validLocalFiles = localFiles.filter((f: any) => f && f.name && f.name !== '-');
      
      const remoteNames = new Set(remoteFiles.map(f => f.name));
      const filteredLocalFiles = validLocalFiles.filter((f: any) => !remoteNames.has(f.name));

      setFiles([...remoteFiles, ...filteredLocalFiles]);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }, [activeRevision, activeCategory, request.studyNumber, request.selectedFiles, request.categorizedFiles]);

  useEffect(() => {
    loadFiles();
    
    // Auto-sync polling every 3 seconds while modal is open
    const intervalId = setInterval(() => {
      loadFiles();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [loadFiles]);

  const formatSize = (bytes?: number) => {
    if (bytes === 0 || !bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (viewingFormMirror) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-white">
        <FormMirrorView 
          data={selectedRevisionData} 
          onBack={() => setViewingFormMirror(false)} 
          currentUser={user}
          allUsers={allUsers}
          onStatusUpdate={onStatusUpdate}
          onStartExecution={onStartExecution}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#004080] p-6 text-white relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-200">
              <i className="fa-solid fa-folder-tree text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Arquivos do Estudo</h3>
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-80">{activeRevision}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Revisions Bar */}
        {availableRevisions.length > 1 && (
          <div className="bg-slate-100/50 border-b border-slate-200 px-6 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Versões:</span>
            <div className="flex gap-2">
              {availableRevisions.map(rev => {
                const isSelected = activeRevision === rev;
                const revNum = rev.match(/-REV(\d+)$/i)?.[1] || '0';
                return (
                  <button
                    key={rev}
                    onClick={() => {
                        setActiveRevision(rev);
                        setActiveCategory('Solicitacao');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                      isSelected 
                      ? 'bg-orange-500 text-white border-orange-600 shadow-sm' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-500'
                    }`}
                  >
                    {(() => {
                      const norm = rev.replace('PROV-', '');
                      const revMatch = norm.match(/-REV(\d+)$/i);
                      if (revMatch) return `REV${revMatch[1]}`;
                      if (norm.length === 10 && /^\d+$/.test(norm)) {
                        const rnum = norm.substring(8, 10);
                        return rnum === '01' ? 'ORIG.' : `REV${rnum}`;
                      }
                      return 'ORIG.';
                    })()} {rev === request.studyNumber ? '(Atual)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs - Hidden if restricted to single category */}
        {availableCategories.length > 1 && (
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeCategory === cat 
                  ? 'bg-[#004080] text-white shadow-md' 
                  : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Action Header - Upload */}
        {canModify && (
          <div className="px-6 pt-4">
             <input
               type="file"
               ref={fileInputRef}
               onChange={handleFileUpload}
               className="hidden"
               multiple
             />
             <button
               onClick={() => fileInputRef.current?.click()}
               className="w-full py-3 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center gap-3 text-indigo-500 hover:bg-indigo-100/50 hover:border-indigo-400 transition-all font-black uppercase text-[10px] tracking-widest"
             >
               <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
               Adicionar Arquivo em {activeCategory}
             </button>
          </div>
        )}

        {/* File List */}
        <div className="flex-grow overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
          {loading && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="grid gap-3">
              {files.map((file, i) => (
                <div key={i} className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004080] flex items-center justify-center shrink-0">
                    <i className={`fa-solid ${file.name?.toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file'} text-lg`}></i>
                  </div>
                  
                  <div className="min-w-0 flex-grow">
                    <p className="text-xs font-black text-slate-700 truncate">{file.name?.replace('Formulario', 'Formulário')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{formatSize(file.size)} • {file.type || 'Arquivo'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.isVirtualForm ? (
                      <button 
                         onClick={() => setViewingFormMirror(true)}
                         className="h-9 px-4 rounded-xl bg-orange-500 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-2"
                      >
                         <i className="fa-solid fa-eye"></i> Ver
                      </button>
                    ) : null}
                    
                    <button 
                      onClick={async () => {
                        const url = await StorageService.getFileUrl(file.fullPath, true);
                        if (url) {
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', file.name);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else showToast('Erro ao buscar arquivo.', 'error');
                      }}
                      className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#004080] hover:text-white transition-all flex items-center justify-center active:scale-90"
                      title="Download"
                    >
                      <i className="fa-solid fa-download text-xs"></i>
                    </button>
                    
                    {!file.isVirtualForm && (
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const url = await StorageService.getFileUrl(file.fullPath);
                            if (url) window.open(url, '_blank');
                            else showToast('Erro ao abrir arquivo.', 'error');
                          }}
                          className={`h-9 ${file.name?.startsWith('Formulario') ? 'px-4 bg-orange-500 text-white shadow-lg shadow-orange-100' : 'w-9 bg-slate-100 text-slate-600'} rounded-xl hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-90 font-black uppercase text-[9px] tracking-widest`}
                          title="Visualizar em Nova Guia"
                        >
                          <i className="fa-solid fa-eye text-xs"></i>
                          {file.name?.startsWith('Formulario') ? 'Ver' : null}
                        </button>

                        {canModify && (
                          <button 
                            onClick={async () => {
                              const ok = await showConfirm(`Deseja realmente excluir o arquivo "${file.name || 'documento'}"? Esta ação removerá o arquivo permanentemente do Storage e do Banco de Dados.`, 'Excluir Arquivo');
                              if (ok) {
                                setLoading(true);
                                try {
                                  if (!file.isVirtualForm) {
                                    if (file.id) {
                                      await StorageService.deleteFile(file.fullPath);
                                    }
                                  }
                                  await loadFiles();
                                  showToast('Arquivo excluído.', 'success');
                                } catch (err) {
                                  showToast('Erro ao excluir arquivo', 'error');
                                } finally {
                                  setLoading(false);
                                }
                              }
                            }}
                            className="h-9 w-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center active:scale-90"
                            title="Excluir Arquivo"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <i className="fa-solid fa-folder-open text-3xl mb-4 opacity-20"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Pasta vazia</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Storage Sincronizado</span>
          </div>
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
