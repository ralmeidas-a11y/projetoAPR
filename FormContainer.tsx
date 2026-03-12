
import React, { useState, useMemo } from 'react';
import { FormType, FormData, StudyStatus, User, UserRole } from '../types';
import { FORM_OPTIONS } from '../constants';
import { FormFO01 } from './FormFO01';
import { FormFO02 } from './FormFO02';
import { FormFO03 } from './FormFO03';
import { FormFO04 } from './FormFO04';

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
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string) => void;
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
    requestDate: new Date().toISOString().split('T')[0],
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

  const currentOption = FORM_OPTIONS.find(o => o.id === formType);
  const isAdmin = currentUser?.role === UserRole.ADM;
  const isOwner = initialData?.assignedTo === currentUser?.id;
  
  // Regra de segurança para visualização
  const isRestricted = readOnly && initialData?.assignedTo && !isOwner && !isAdmin;

  const precedentStudy = useMemo(() => {
    if (initialData || !formData.address || !formData.city) return null;
    const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
    const addr = normalize(formData.address);
    const city = normalize(formData.city);
    if (addr.length < 5) return null;
    return allRequests.find(r => normalize(r.address) === addr && normalize(r.city) === city);
  }, [allRequests, formData.address, formData.city, initialData]);

  const studyHistory = useMemo(() => {
    if (!formData.studyNumber) return [];
    const baseCode = (formData.studyNumber || '').split('-REV')[0].replace('PROV-', '');
    return allRequests
      .filter(r => (r.studyNumber || '').replace('PROV-', '').startsWith(baseCode))
      .sort((a, b) => {
        const revA = (a.studyNumber.match(/-REV(\d+)$/)?.[1] || '0');
        const revB = (b.studyNumber.match(/-REV(\d+)$/)?.[1] || '0');
        return parseInt(revB) - parseInt(revA);
      });
  }, [allRequests, formData.studyNumber]);

  const handleUpdateData = (newData: Partial<FormData>) => {
    if (readOnly) return;
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSubmit(formData);
    }, 1200);
  };

  const handleConfirmValidation = () => {
    if (onStatusUpdate && initialData) {
      // Se for ADM reatribuindo, mantém o status atual (Ex: EM_EXECUCAO), senão muda para Aguardando
      const newStatus = (initialData.status === StudyStatus.PENDENTE || initialData.status === StudyStatus.EM_ANALISE) 
        ? StudyStatus.AGUARDANDO_EXECUCAO 
        : initialData.status;

      onStatusUpdate(initialData.id, newStatus, undefined, assignedAnalyst || undefined);
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

  const renderForm = () => {
    const commonProps = { data: formData, onChange: handleUpdateData, readOnly };
    switch (formType) {
      case FormType.RESIDENTIAL_COMMERCIAL: return <FormFO01 {...commonProps} />;
      case FormType.EXPANSION_AREAS: return <FormFO02 {...commonProps} />;
      case FormType.THERMO_GENERATION: return <FormFO03 {...commonProps} />;
      case FormType.LARGE_CLIENTS: return <FormFO04 {...commonProps} />;
      default: return null;
    }
  };

  const canValidate = isAdmin || currentUser?.permissions?.includes('validar');
  const canExecute = currentUser?.permissions?.includes('executar');
  const executors = allUsers.filter(u => u.permissions?.includes('executar') || u.role === UserRole.ADM);

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

        {showValidationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-4">{initialData?.assignedTo ? 'Reatribuir Estudo' : 'Validar e Atribuir Estudo'}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase mb-6">Defina o analista responsável pela execução técnica.</p>
              <div className="space-y-4">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável pela Execução</label>
                 <select 
                   value={assignedAnalyst}
                   onChange={(e) => setAssignedAnalyst(e.target.value)}
                   className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-white text-sm font-bold text-slate-700"
                 >
                   <option value="">Sistema (Fila Comum)</option>
                   {executors.map(exec => (
                     <option key={exec.id} value={exec.id}>{exec.name}</option>
                   ))}
                 </select>
              </div>
              <div className="flex justify-end gap-4 mt-10">
                <button onClick={() => setShowValidationModal(false)} className="px-6 py-2 text-slate-400 font-bold uppercase text-[10px]">Cancelar</button>
                <button onClick={handleConfirmValidation} className="px-8 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-200">Salvar Atribuição</button>
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
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 ${readOnly ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
             <i className={`fa-solid ${readOnly ? 'fa-magnifying-glass-chart' : 'fa-file-contract'} text-lg`}></i>
             <span className="text-xs font-black uppercase tracking-widest">
               {formData.status}
             </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {renderForm()}

          {formData.selectedFiles && formData.selectedFiles.length > 0 && (
            <section className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
               <h4 className="text-[10px] font-black text-[#004080] uppercase tracking-widest mb-4">Arquivos Anexados</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formData.selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                      <button 
                        type="button"
                        onClick={() => alert('Download do arquivo: ' + file.name)} 
                        className="text-[#004080] hover:text-orange-500 transition-all font-black text-[10px] uppercase"
                      >
                        <i className="fa-solid fa-download mr-1"></i> Baixar
                      </button>
                    </div>
                  ))}
               </div>
            </section>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-end">
            <div className="flex gap-4">
              {readOnly ? (
                <>
                  {canValidate && (formData.status === StudyStatus.PENDENTE || formData.status === StudyStatus.EM_ANALISE) && (
                    <>
                      <button type="button" onClick={() => setShowRejectionModal(true)} className="px-8 py-4 rounded-xl border border-red-100 text-red-600 font-black uppercase text-xs">Reprovar</button>
                      <button type="button" onClick={() => setShowValidationModal(true)} className="px-10 py-4 rounded-xl bg-green-600 text-white font-black uppercase text-xs shadow-lg shadow-green-200 transition-all">Validar Estudo</button>
                    </>
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
