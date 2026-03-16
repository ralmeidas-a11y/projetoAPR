import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FormType, FormData, StudyStatus, User, UserRole } from './types';
import { FORM_OPTIONS } from './constants';
import { formatToLocalTime, getGMT3ISOString, isWithinLast12Months } from './utils';
import { FormFO01 } from './FormFO01';
import { FormFO02 } from './FormFO02';
import { FormFO03 } from './FormFO03';
import { FormFO04 } from './FormFO04';
import { StorageService, getRequestPath } from './storage';
import { ValidationModal } from './ValidationModal';

interface FormContainerProps {
  formType: FormType;
  initialData?: FormData;
  onBack: () => void;
  onSubmit: (data: FormData) => void;
  userId: string;
  currentUser?: User;
  allUsers?: User[];
  allRequests?: FormData[];
  readOnly?: boolean;
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  onStartExecution?: (request: FormData) => void;
  onViewRequest?: (request: FormData) => void;
}

export const FormContainer: React.FC<FormContainerProps> = ({ 
  formType, initialData, onBack, onSubmit, userId, currentUser, allUsers = [], allRequests = [], readOnly = false, onStatusUpdate, onStartExecution, onViewRequest 
}) => {
  const [formData, setFormData] = useState<FormData>(initialData || {
    id: crypto.randomUUID(),
    studyNumber: '',
    status: StudyStatus.PENDENTE,
    user_id: userId,
    formType: formType,
    requestDate: getGMT3ISOString().split('T')[0],
    studyType: 'Novo Estudo',
    naturgyUnit: currentUser?.naturgyUnit || '',
    requesterName: currentUser?.name || '',
    requesterArea: currentUser?.area || '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    gridDataFO02: {
      residenciais: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
      comerciais: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
      grandesComercios: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
      industrias: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
      gnv: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
      outros: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' }
    }
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assignedAnalyst, setAssignedAnalyst] = useState(initialData?.assignedTo || '');

  const [showPrecedentWarning, setShowPrecedentWarning] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const currentOption = FORM_OPTIONS.find(o => o.id === formType);
  const isAdmin = currentUser?.role === UserRole.ADM;
  const executors = useMemo(() => allUsers.filter(u => u.permissions?.includes('executar') || u.role === UserRole.ADM), [allUsers]);
  const isOwner = initialData?.assignedTo === currentUser?.id;
  const [supabaseFiles, setSupabaseFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Carregar arquivos do Supabase se initialData existir
  React.useEffect(() => {
    let isMounted = true;
    const fetchFiles = async () => {
      if (!initialData?.studyNumber) return;
      setIsLoadingFiles(true);
      try {
        const files = await StorageService.getRequestFiles(initialData.studyNumber, 'Solicitacao');
        if (isMounted) setSupabaseFiles(files);
      } catch (err) {
        console.error('Error loading Supabase files:', err);
      } finally {
        if (isMounted) setIsLoadingFiles(false);
      }
    };
    fetchFiles();
    return () => { isMounted = false; };
  }, [initialData?.studyNumber]);
  


  const precedentStudy = useMemo(() => {
    if (initialData || !formData.address || !formData.city || allRequests.length === 0) return null;
    const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
    const addr = normalize(formData.address);
    const city = normalize(formData.city);
    if (addr.length < 5 || city.length < 2) return null;
    
    // Check if the current form itself is matching (e.g., during edit)
    return allRequests.find(r => 
      r.id !== formData.id && 
      normalize(r.address) === addr && 
      normalize(r.city) === city
    );
  }, [allRequests, formData.address, formData.city, initialData, formData.id]);

  const studyHistory = useMemo(() => {
    if (!formData.studyNumber) return [];
    const cleanCode = (formData.studyNumber || '').replace('PROV-', '');
    const revMatch = cleanCode.match(/(.+)-REV\d+$/i);
    const baseCode = revMatch ? revMatch[1] : cleanCode;
    return allRequests
      .filter(r => (r.studyNumber || '').replace('PROV-', '').startsWith(baseCode))
      .sort((a, b) => {
        const revA = (a.studyNumber.match(/-REV(\d+)$/)?.[1] || '0');
        const revB = (b.studyNumber.match(/-REV(\d+)$/)?.[1] || '0');
        return parseInt(revB) - parseInt(revA);
      });
  }, [allRequests, formData.studyNumber]);

  React.useEffect(() => {
    if (precedentStudy && !hasShownWarning && !initialData) {
      const activeStatus = [
        StudyStatus.PENDENTE, 
        StudyStatus.EM_ANALISE, 
        StudyStatus.AGUARDANDO_EXECUCAO, 
        StudyStatus.EM_EXECUCAO, 
        StudyStatus.CONTROLE_QUALIDADE
      ].includes(precedentStudy.status);
      
      const recentlyCompleted = precedentStudy.status === StudyStatus.CONCLUIDO && isWithinLast12Months(precedentStudy.createdAt);

      if (activeStatus || recentlyCompleted) {
        setShowPrecedentWarning(true);
      }
    }
  }, [precedentStudy, hasShownWarning, initialData]);

  const handleUpdateData = (newData: Partial<FormData>) => {
    if (readOnly) return;
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setIsSubmitting(true);
    
    try {
      // 1. Snapshot do formulário via html2canvas para criar um PDF espelho 100% fiel
      let generatedPdfFile: File | undefined;
      
      if (formRef.current) {
        try {
          const canvas = await html2canvas(formRef.current, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          const pdfBlob = pdf.output('blob');
          const fileName = `Formulario_Oficial_${formData.studyNumber || formData.id}.pdf`;
          generatedPdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
          console.log('[FormContainer] html2canvas snapshot successfully generated!');
        } catch (canvasErr) {
          console.error('[FormContainer] Error capturing DOM snapshot:', canvasErr);
        }
      }

      // IMPORTANTE: Isso deve ocorrer ANTES de qualquer validação técnica posterior
      await StorageService.uploadOfficialForm(formData, generatedPdfFile);
      console.log('[FormContainer] Official form PDF generation process completed');
    } catch (err) {
      console.error('[FormContainer] Failed to generate PDF mirror during submission:', err);
      // Prosseguir mesmo se o PDF falhar para não bloquear o envio dos dados
    }

    setTimeout(() => {
      setIsSubmitting(false);
      onSubmit(formData);
    }, 1200);
  };

  const handleConfirmValidation = (assignedAnalyst: string, validationData: Partial<FormData>) => {
    if (onStatusUpdate && initialData) {
      if (initialData.status === StudyStatus.PENDENTE || initialData.status === StudyStatus.EM_ANALISE) {
        onStatusUpdate(initialData.id, StudyStatus.AGUARDANDO_EXECUCAO, undefined, assignedAnalyst || undefined, validationData);
      } else {
        onStatusUpdate(initialData.id, initialData.status, undefined, assignedAnalyst || undefined, validationData);
      }
      setShowValidationModal(false);
      onBack();
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectionReason.trim()) {
      alert('É obrigatório justificar o motivo da reprovação.');
      return;
    }
    if (onStatusUpdate && initialData) {
      onStatusUpdate(initialData.id, StudyStatus.REJEITADO, rejectionReason);
      setShowRejectionModal(false);
      onBack();
    }
  };

  const handleStartExecutionLocal = () => {
    if (onStartExecution && initialData) {
      onStartExecution(initialData);
    }
  };

  const handleFinishExecution = () => {
    if (onStatusUpdate && initialData) {
      onStatusUpdate(initialData.id, StudyStatus.CONTROLE_QUALIDADE);
      onBack();
    }
  };

  const handleFileAction = async (file: any) => {
    // 1. Tentar abrir usando API do Electron se disponível
    if (typeof window !== 'undefined' && (window as any).api?.openFile && file.path) {
      try {
        await (window as any).api.openFile(file.path);
        return;
      } catch (err) {
        console.error('Erro ao abrir via API:', err);
      }
    }

    // 2. Se tivermos o objeto File real (blob), fazer download no navegador
    if (file instanceof File || (file.size && file.type)) {
      try {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
        console.error('Erro ao baixar blob:', err);
      }
    }

    // 3. Fallback: Se tivermos o studyNumber, tentar abrir a pasta
    if (initialData?.studyNumber) {
       alert(`Não foi possível abrir o arquivo diretamente. Abrindo a pasta da solicitação: ${initialData.studyNumber}`);
       if ((window as any).api?.openFolder) {
         const folderPath = `solicitantes/${initialData.requesterName}/${initialData.studyNumber}`;
         await (window as any).api.openFolder(folderPath);
       }
    } else {
      alert("Arquivo não disponível para pré-visualização direta.");
    }
  };

  const renderForm = () => {
    const commonProps = { data: formData, onChange: handleUpdateData, readOnly };
    switch (formType) {
      case FormType.RESIDENTIAL_COMMERCIAL: return <FormFO01 {...commonProps} />;
      case FormType.EXPANSION_AREAS: return <FormFO02 {...commonProps} />;
      case FormType.THERMO_GENERATION: return <FormFO04 {...commonProps} />;
      case FormType.LARGE_CLIENTS: return <FormFO03 {...commonProps} />;
      default: return null;
    }
  };
   // Regra de segurança para vísibilidade técnica (Estudo sendo feito)
  const isPendingExecution = initialData?.status === StudyStatus.AGUARDANDO_EXECUCAO || initialData?.status === StudyStatus.EM_EXECUCAO;
  const isRequesterView = currentUser?.role === UserRole.SOLICITANTE;
  
  // Analistas vêem o que é deles ou o que está na fila (exceto se atribuído a outro)
  const isRestricted = readOnly && initialData?.assignedTo && !isOwner && !isAdmin;
  
  // Solicitante não vê detalhes técnicos enquanto está em execução
  const showInProgressMessage = isRequesterView && isPendingExecution && readOnly;

  if (showInProgressMessage) {
    return (
      <div className="bg-white rounded-3xl p-16 text-center animate-in zoom-in-95 duration-300 shadow-2xl border border-slate-100 max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-blue-50 text-[#004080] rounded-full flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner border border-blue-100">
          <i className="fa-solid fa-clock-rotate-left fa-spin"></i>
        </div>
        <h2 className="text-2xl font-black text-[#004080] uppercase tracking-tight mb-4">Estudo em Execução</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-10 font-medium">
          Este estudo ainda está em processo de execução técnica. Os detalhes e arquivos finais estarão disponíveis para visualização uma vez que o processo esteja <span className="inline-block relative font-black text-green-600 tracking-tight">
            <span className="absolute inset-0 bg-green-400/20 blur-lg rounded-full animate-pulse"></span>
            <span className="relative bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-500">concluído</span>
          </span>.
        </p>
        <button onClick={onBack} className="px-12 py-4 bg-[#004080] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all shadow-lg active:scale-95">
          Voltar para minhas solicitações
        </button>
      </div>
    );
  }

  const canValidate = isAdmin || currentUser?.permissions?.includes('validar');
  const canExecute = currentUser?.permissions?.includes('executar');
  // Se o analista tentar forçar entrada em algo que não é dele
  if (isRestricted) {
    return (
      <div className="bg-white rounded-3xl p-16 text-center animate-in zoom-in-95 duration-300 shadow-2xl border border-slate-100 max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner border border-orange-100">
          <i className="fa-solid fa-lock"></i>
        </div>
        <h2 className="text-2xl font-black text-[#004080] uppercase tracking-tight mb-4">Acesso Exclusivo</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-10 font-medium">
          Este estudo está atribuído a outro analista. Pela segurança da fila técnica, você não pode visualizar ou executar tarefas de terceiros.
        </p>
        <button onClick={onBack} className="px-12 py-4 bg-[#004080] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all shadow-lg active:scale-95">
          Voltar para meu Painel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start">
      <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-10 border border-slate-100 animate-in fade-in slide-in-from-right-8 duration-500 flex-grow w-full lg:max-w-5xl">
        
        {precedentStudy && (
          <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                   <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                </div>
                <div>
                   <h4 className="text-xs font-black text-orange-800 uppercase tracking-widest">Estudo Anterior Identificado</h4>
                   <p className="text-[11px] text-orange-700/80 font-bold uppercase mt-1">
                     Já existe um estudo para este local (<span className="underline">{precedentStudy.studyNumber}</span>). 
                     Esta nova solicitação será vinculada como uma **Revisão Técnica**.
                   </p>
                </div>
             </div>
          </div>
        )}

        {showRejectionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-4">Justificar Reprovação</h3>
              <textarea 
                autoFocus
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-red-500 transition-all text-sm h-40 bg-white"
                placeholder="Motivo da devolução para o solicitante..."
              />
              <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setShowRejectionModal(false)} className="px-6 py-2 text-slate-400 font-bold uppercase text-[10px]">Cancelar</button>
                <button onClick={handleConfirmRejection} className="px-8 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-red-200">Confirmar Devolução</button>
              </div>
            </div>
          </div>
        )}

        {showValidationModal && initialData && (
          <ValidationModal 
            initialData={initialData}
            executors={executors}
            onConfirm={handleConfirmValidation}
            onCancel={() => setShowValidationModal(false)}
          />
        )}

        {showPrecedentWarning && precedentStudy && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-orange-500">
              <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-6 text-2xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-2">ESTUDO JÁ CONCLUÍDO OU ESTUDO VIGENTE</h3>
              <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">
                Identificamos que já existe uma solicitação (<span className="text-[#004080]">{precedentStudy.studyNumber}</span>) para este endereço com status "<span className="text-orange-600">{precedentStudy.status}</span>". 
                {precedentStudy.status === StudyStatus.CONCLUIDO ? ' Estudos concluídos permanecem vigentes por 12 meses.' : ' Este estudo ainda está em processamento técnico.'}
              </p>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detalhes do Estudo Encontrado</p>
                <p className="text-xs font-bold text-slate-700">{precedentStudy.studyTitle || 'Sem Título'}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">{precedentStudy.address}, {precedentStudy.city}</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={async () => {
                    setShowPrecedentWarning(false);
                    if ((window as any).api?.openFolder) {
                      const path = getRequestPath(precedentStudy.studyNumber);
                      await (window as any).api.openFolder(path);
                    } else {
                      onViewRequest?.(precedentStudy);
                    }
                  }}
                  className="w-full py-4 bg-[#004080] text-white rounded-xl font-black text-[10px] shadow-lg"
                >
                  Visualizar Estudo Existente
                </button>
                <button 
                  onClick={() => {
                    setShowPrecedentWarning(false);
                    setHasShownWarning(true);
                  }}
                  className="w-full py-4 border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] hover:bg-slate-50"
                >
                  Ignorar e Continuar Novo Estudo
                </button>
                <button 
                  onClick={onBack}
                  className="w-full py-2 text-slate-400 font-bold text-[9px]"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b border-slate-100 pb-8">
          <div>
            <button onClick={onBack} type="button" className="flex items-center text-[#004080] hover:text-orange-500 transition-all mb-4 font-bold text-[10px] uppercase tracking-widest">
              <i className="fa-solid fa-arrow-left-long mr-2"></i>
              Voltar
            </button>
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-[#004080] rounded-xl flex items-center justify-center text-white text-xl">
                  <i className={`fa-solid ${currentOption?.icon}`}></i>
               </div>
               <div>
                  <h2 className="text-xl font-black text-[#004080] leading-none uppercase tracking-tight">{formData.studyNumber || 'Nova Solicitação'}</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-2">{currentOption?.label}</p>
               </div>
            </div>
          </div>

        </div>

        <form onSubmit={handleSubmit}>
          <div ref={formRef} className="bg-white p-4 rounded-xl">
            {renderForm()}
          </div>

          {formData.selectedFiles && formData.selectedFiles.length > 0 && (
            <section className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
               <h4 className="text-[10px] font-black text-[#004080] uppercase tracking-widest mb-4">Arquivos Anexados</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...supabaseFiles, ...(formData.selectedFiles || []).filter(lf => !supabaseFiles.some(sf => sf.name === lf.name))].map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <i className="fa-solid fa-file-pdf text-[#004080]"></i>
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{file.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={async () => {
                            if (file.fullPath) {
                              const url = await StorageService.getFileUrl(file.fullPath);
                              if (url) window.open(url, '_blank');
                            } else if (file instanceof File || (file.size && file.type)) {
                              const url = URL.createObjectURL(file);
                              window.open(url, '_blank');
                            }
                          }} 
                          className="px-3 py-1 bg-blue-50 text-[#004080] hover:bg-[#004080] hover:text-white rounded-lg transition-all font-black text-[9px] uppercase shadow-sm"
                        >
                          <i className="fa-solid fa-eye mr-1"></i> Visualizar
                        </button>
                        <button 
                          type="button"
                          onClick={async () => {
                            if (file.fullPath) {
                              const url = await StorageService.getFileUrl(file.fullPath);
                              if (url) {
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = file.name;
                                a.click();
                              }
                            } else if (file instanceof File || (file.size && file.type)) {
                              const url = URL.createObjectURL(file);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.name;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                          }} 
                          className="px-3 py-1 bg-[#FF8000] text-white hover:bg-orange-600 rounded-lg transition-all font-black text-[9px] uppercase shadow-sm"
                        >
                          <i className="fa-solid fa-download mr-1"></i> Baixar
                        </button>
                      </div>
                    </div>
                  ))}
               </div>
            </section>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-end">
            <div className="flex gap-4">
              {readOnly ? (
                <>
                  {(isAdmin || currentUser?.permissions?.includes('validar')) && (formData.status === StudyStatus.PENDENTE || formData.status === StudyStatus.EM_ANALISE) && (
                    <>
                      <button type="button" onClick={() => setShowRejectionModal(true)} className="px-8 py-4 rounded-xl border border-red-100 text-red-600 font-black uppercase text-xs">Reprovar</button>
                      <button type="button" onClick={() => setShowValidationModal(true)} className="px-10 py-4 rounded-xl bg-green-600 text-white font-black uppercase text-xs shadow-lg shadow-green-200 transition-all">Validar Estudo</button>
                    </>
                  )}
                  {(isAdmin || currentUser?.permissions?.includes('validar')) && (formData.status !== StudyStatus.PENDENTE && formData.status !== StudyStatus.EM_ANALISE && formData.status !== StudyStatus.CONCLUIDO && formData.status !== StudyStatus.CANCELADO) && (
                    <button type="button" onClick={() => setShowValidationModal(true)} className="px-10 py-4 rounded-xl bg-[#004080] text-white font-black uppercase text-xs shadow-lg transition-all">Gerenciar Atribuição</button>
                  )}
                  {canExecute && (formData.status === StudyStatus.AGUARDANDO_EXECUCAO || formData.status === StudyStatus.EM_EXECUCAO) && isOwner && (
                    <button type="button" onClick={handleStartExecutionLocal} className="px-10 py-4 rounded-xl bg-[#004080] text-white font-black uppercase text-xs shadow-lg transition-all">
                      {formData.status === StudyStatus.EM_EXECUCAO ? 'Abrir Painel Técnico' : 'Iniciar Execução'}
                    </button>
                  )}
                  {canExecute && formData.status === StudyStatus.EM_EXECUCAO && isOwner && (
                    <button type="button" onClick={handleFinishExecution} className="px-10 py-4 rounded-xl bg-indigo-600 text-white font-black uppercase text-xs shadow-lg transition-all">Enviar para Qualidade</button>
                  )}
                </>
              ) : (
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-12 py-5 rounded-2xl font-black text-white transition-all shadow-2xl text-lg flex items-center uppercase tracking-tighter ${isSubmitting ? 'bg-slate-400' : 'bg-[#004080] hover:bg-[#FF8000] active:scale-95 shadow-[#004080]/30'}`}
                >
                  {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin mr-3"></i>Enviando...</> : <>{initialData ? 'Reenviar Solicitação' : 'Gerar Solicitação'} <i className="fa-solid fa-paper-plane ml-4"></i></>}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {readOnly && studyHistory.length > 1 && (
        <aside className="w-full lg:w-72 bg-white rounded-3xl shadow-xl border border-slate-100 p-6 animate-in slide-in-from-bottom-4 duration-500 lg:sticky lg:top-24">
          <h4 className="text-xs font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
            <i className="fa-solid fa-clock-rotate-left text-orange-500"></i>
            Histórico APR
          </h4>
          <div className="space-y-3">
            {studyHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewRequest?.(item)}
                className={`w-full p-4 rounded-2xl border transition-all text-left group flex flex-col gap-1.5 ${item.id === formData.id ? 'bg-slate-50 border-[#004080] shadow-sm ring-1 ring-[#004080]' : 'bg-white border-slate-100 hover:border-[#004080]'}`}
              >
                <div className="flex items-center justify-between">
                   <span className={`text-[10px] font-black uppercase tracking-tighter ${item.id === formData.id ? 'text-[#004080]' : 'text-slate-400'}`}>
                     {item.studyNumber.includes('-REV') ? `Revisão ${item.studyNumber.split('-REV')[1]}` : 'Versão Original'}
                   </span>
                   {item.id === formData.id && <span className="w-1.5 h-1.5 bg-[#004080] rounded-full animate-pulse"></span>}
                </div>
                <p className={`text-[9px] font-bold ${item.id === formData.id ? 'text-slate-600' : 'text-slate-400'}`}>
                  Solicitado em: {item.requestDate}
                </p>
                <div className="flex items-center gap-1 mt-1">
                   <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                     {item.status}
                   </span>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-6 text-[8px] text-slate-300 font-bold uppercase text-center tracking-widest">Selecione uma versão para visualizar os dados técnicos daquela época.</p>
        </aside>
      )}
    </div>
  );
};
