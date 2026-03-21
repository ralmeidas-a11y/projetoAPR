
import React, { useState } from 'react';
import { FormData, FormType, StudyStatus, User, UserRole } from '../types/types';
import { FormFO01 } from '../pages/FormFO01';
import { FormFO02 } from '../pages/FormFO02';
import { FormFO03 } from '../pages/FormFO03';
import { FormFO04 } from '../pages/FormFO04';
import { formatDate } from '../utils/utils';
import { ValidationModal } from './ValidationModal';
import { useDialog } from './AppDialog';

interface FormMirrorViewProps {
  data: FormData;
  onBack?: () => void;
  currentUser?: User;
  allUsers?: User[];
  onStatusUpdate?: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  onStartExecution?: (request: FormData) => void;
}

export const FormMirrorView: React.FC<FormMirrorViewProps> = ({ 
  data, onBack, currentUser, allUsers = [], onStatusUpdate, onStartExecution 
}) => {
  const { showAlert } = useDialog();
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assignedAnalyst, setAssignedAnalyst] = useState(data.assignedTo || '');

  const renderForm = () => {
    const commonProps = { data, onChange: () => {}, readOnly: true };
    switch (data.formType) {
      case FormType.RESIDENTIAL_COMMERCIAL: return <FormFO01 {...commonProps} />;
      case FormType.EXPANSION_AREAS: return <FormFO02 {...commonProps} />;
      case FormType.THERMO_GENERATION: return <FormFO03 {...commonProps} />;
      case FormType.LARGE_CLIENTS: return <FormFO04 {...commonProps} />;
      default: return null;
    }
  };

  const isAdmin = currentUser?.role === UserRole.ADM;
  const isOwner = data.assignedTo === currentUser?.id;
  const canValidate = isAdmin || currentUser?.permissions?.includes('validar');
  const canExecute = currentUser?.permissions?.includes('executar');
  const executors = allUsers.filter(u => u.permissions?.includes('executar') || u.role === UserRole.ADM);

  const handleConfirmValidation = (assignedAnalyst: string, validationData: Partial<FormData>) => {
    if (onStatusUpdate) {
      const newStatus = (data.status === StudyStatus.PENDENTE || data.status === StudyStatus.EM_ANALISE) 
        ? StudyStatus.AGUARDANDO_EXECUCAO 
        : data.status;
      onStatusUpdate(data.id, newStatus, undefined, assignedAnalyst || undefined, validationData);
      setShowValidationModal(false);
      onBack?.();
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectionReason.trim()) {
      showAlert('É obrigatório justificar o motivo da reprovação.', 'Campo Obrigatório', 'warning');
      return;
    }
    if (onStatusUpdate) {
      onStatusUpdate(data.id, StudyStatus.REJEITADO, rejectionReason);
      setShowRejectionModal(false);
      onBack?.();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/50">
      {/* Modals */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
        <ValidationModal 
          initialData={data}
          executors={executors}
          onConfirm={handleConfirmValidation}
          onCancel={() => setShowValidationModal(false)}
        />
      )}

      {/* Tool Header (Hidden on Print) */}
      <div className="print:hidden bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-[#004080] transition-all flex items-center justify-center border border-slate-100 active:scale-95"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          <div>
            <h4 className="text-sm font-black text-[#004080] uppercase tracking-tight">Espelho do Formulário de Solicitação</h4>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{data.studyNumber}</span>
               <span className="text-[8px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase border border-blue-100">{data.status}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {canValidate && (data.status === StudyStatus.PENDENTE || data.status === StudyStatus.EM_ANALISE) && (
            <div className="flex gap-2">
              <button onClick={() => setShowRejectionModal(true)} className="px-6 py-2.5 rounded-xl border border-red-100 text-red-600 font-black uppercase text-[10px] hover:bg-red-50 transition-all">Reprovar</button>
              <button onClick={() => setShowValidationModal(true)} className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-black uppercase text-[10px] shadow-lg shadow-green-200 hover:bg-green-700 transition-all">Validar Estudo</button>
            </div>
          )}

          {canExecute && (data.status === StudyStatus.AGUARDANDO_EXECUCAO || data.status === StudyStatus.EM_EXECUCAO) && isOwner && (
            <button onClick={() => onStartExecution?.(data)} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-black uppercase text-[10px] shadow-lg hover:bg-orange-600 transition-all">
              {data.status === StudyStatus.EM_EXECUCAO ? 'Abrir Painel Técnico' : 'Iniciar Execução'}
            </button>
          )}

        </div>
      </div>

      {/* Document Container */}
      <div className="flex-grow overflow-y-auto overflow-x-hidden p-4 md:p-8 print:p-0 bg-slate-200 flex justify-center no-scrollbar">
        <div className="w-full max-w-[210mm] bg-white shadow-lg print:shadow-none p-8 md:p-12 rounded-none border border-slate-300 print:border-none min-h-[297mm] flex flex-col overflow-x-hidden no-scrollbar">
          {/* Header Documento */}
          <div className="document-header flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-[#004080] rounded-lg flex items-center justify-center text-white text-xl">
                 <i className="fa-solid fa-file-contract"></i>
              </div>
              <div>
                <h1 className="text-xl font-black text-[#004080] uppercase tracking-tight">Solicitação Técnica APR</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Portal Integrado Naturgy</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-900 uppercase">Código: {data.studyNumber}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Data: {formatDate(data.requestDate)}</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="form-mirror-content flex-grow bg-white">
            {renderForm()}
          </div>

          {/* Footer Documento */}
          <div className="mt-20 pt-8 border-t border-slate-100 text-[9px] text-slate-400 font-bold uppercase text-center tracking-widest">
            <p>Este documento é uma representação digital da solicitação técnica registrada no Portal APR.</p>
            <p className="mt-1">Naturgy Brasil - {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
