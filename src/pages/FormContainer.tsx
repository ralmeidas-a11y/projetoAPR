import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FormType, FormData, StudyStatus, User, UserRole } from '../types/types';
import { FORM_OPTIONS } from '../constants/constants';
import { getGMT3ISOString, isWithinLast12Months, toTitleCase, isAssignedToMe, formatDateTimeBR } from '../utils/utils';
import { getCompanyByCity } from '../utils/cityCompanyMapping';
import { FormFO01 } from './FormFO01';
import { FormFO02 } from './FormFO02';
import { FormFO03 } from './FormFO03';
import { FormFO04 } from './FormFO04';
import { StorageService, getRequestPath } from '../services/storage';
import { ValidationModal } from '../components/ValidationModal';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { useDialog } from '../components/AppDialog';

interface FormContainerProps {
  formType: FormType;
  initialData?: FormData;
  onBack: () => void;
  onSubmit: (data: FormData, pdfFile?: File) => void;
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
  formType: propFormType, initialData, onBack, onSubmit, userId, currentUser, allUsers = [], allRequests = [], readOnly = false, onStatusUpdate, onStartExecution, onViewRequest
}) => {
  // Normalize formType (handle shorthand FO.01 -> PE.00492-FO.01)
  const formType = propFormType?.startsWith('FO.')
    ? `PE.00492-${propFormType}`
    : propFormType;
  const { showAlert } = useDialog();
  const [browsingPrecedentStudy, setBrowsingPrecedentStudy] = useState<FormData | null>(null);
  const [formData, setFormData] = useState<FormData>(() => {
    const isNewStudy = !initialData?.studyNumber;

    const defaults: any = {
      id: 0,
      studyNumber: '',
      status: StudyStatus.EM_ANALISE,
      user_id: userId,
      formType: formType,
      requestDate: getGMT3ISOString().split('T')[0],
      studyType: 'Novo Estudo',
      naturgyUnit: '',
      requesterName: '',
      requesterArea: '',
      phone: '',
      email: '',
      gridDataFO02: {
        residenciais: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
        comerciais: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
        grandesComercios: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
        industrias: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
        gnv: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' },
        outros: { atuais: '', y2: '', y5: '', y20: '', totalQ: '' }
      }
    };

    if (initialData) {
      // If it's a new study being created (no studyNumber yet), allow edit for ADM, ANALISTA, and SOLICITANTE
      if (isNewStudy && (currentUser?.role === UserRole.ADM || currentUser?.role === UserRole.ANALISTA || currentUser?.role === UserRole.SOLICITANTE)) {
        return {
          ...defaults,
          ...initialData,
          requestDate: getGMT3ISOString().split('T')[0],
          readOnly: false  // NEW STUDIES ARE ALWAYS EDITABLE FOR ALL ROLES
        };
      }

      // Rule: Only the owner can edit existing studies. 
      // Strict Update: Even Admins/Analysts are Read-Only if they didn't create this specific record.
      const isOwner = initialData.user_id === userId;
      // Allow assignedTo to edit when study is REPROVADO_CQ (needs corrections)
      const isAssignedAnalyst = initialData.assignedTo === userId;
      const isReprovadoCQ = initialData.status === StudyStatus.REPROVADO_CQ;
      const canEdit = isOwner || (isAssignedAnalyst && isReprovadoCQ);

      return {
        ...defaults,
        ...initialData,
        requestDate: getGMT3ISOString().split('T')[0], // Always Today on edit
        // Sync requester info with current user IF they are the owner
        naturgyUnit: isOwner && currentUser?.naturgyUnit ? currentUser.naturgyUnit : (initialData.naturgyUnit || defaults.naturgyUnit),
        requesterName: isOwner && currentUser?.name ? currentUser.name : (initialData.requesterName || defaults.requesterName),
        requesterArea: isOwner && currentUser?.area ? currentUser.area : (initialData.requesterArea || defaults.requesterArea),
        phone: isOwner && currentUser?.phone ? currentUser.phone : (initialData.phone || defaults.phone),
        email: isOwner && currentUser?.email ? currentUser.email : (initialData.email || defaults.email),
        readOnly: !canEdit // STRICT: No Admin/Analyst bypass for existing studies
      };
    }
    return defaults;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assignedAnalyst, setAssignedAnalyst] = useState(initialData?.assignedTo || '');

  const [showPrecedentWarning, setShowPrecedentWarning] = useState(false);
  const [duplicateStep, setDuplicateStep] = useState<1 | 2>(1);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const currentOption = FORM_OPTIONS.find(o => o.id === formType);
  const isAdmin = currentUser?.role === UserRole.ADM;
  const executors = useMemo(() => allUsers.filter(u => u.permissions?.includes('executar') || u.role === UserRole.ADM), [allUsers]);
  const canExecute = currentUser?.permissions?.includes('executar');
  const isOwner = initialData?.assignedTo === currentUser?.id;
  const isCreator = initialData?.user_id === currentUser?.id;
  const isReprovadoCQ = initialData?.status === StudyStatus.REPROVADO_CQ;
  const isValidadoOrAguardando = initialData?.status === StudyStatus.VALIDADO || initialData?.status === StudyStatus.AGUARDANDO_EXECUCAO;
  const canEdit = isOwner || isCreator || (isReprovadoCQ && canExecute) || (isValidadoOrAguardando && canExecute);
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateDecision, setDuplicateDecision] = useState<'revision' | 'ignored' | 'viewing' | null>(null);
  const [backendPrecedentStudy, setBackendPrecedentStudy] = useState<FormData | null>(null);
  const formRef = useRef<HTMLDivElement>(null);


  // Carregar arquivos do servidor se initialData existir
  React.useEffect(() => {
    let isMounted = true;
    const fetchFiles = async () => {
      if (!initialData?.studyNumber) return;
      setIsLoadingFiles(true);
      try {
        const files = await StorageService.getRequestFiles(initialData.studyNumber, 'Solicitacao');
        if (isMounted) {
          const filtered = files.filter(f => f.name !== '.keep');
          setServerFiles(filtered);
        }
      } catch (err) {
        console.error('Error loading files:', err);
      } finally {
        if (isMounted) setIsLoadingFiles(false);
      }
    };
    fetchFiles();
    return () => { isMounted = false; };
  }, [initialData?.studyNumber]);



  const precedentStudy = useMemo(() => {
    if (!formData.address || !formData.city || allRequests.length === 0) return null;
    const normalize = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
    const addr = normalize(formData.address);
    const city = normalize(formData.city);
    const neighborhood = normalize(formData.neighborhood || "");
    const title = normalize(formData.studyTitle || formData.clientName || "");

    if (addr.length < 5 || city.length < 2 || title.length < 2) return null;

    return allRequests.find(r => {
      if (r.id === formData.id) return false;
      // Skip matching against the study we're currently editing
      if (initialData && String(r.id) === String(initialData.id)) return false;

      const rAddr = normalize(r.address);
      const rCity = normalize(r.city);
      const rNeighborhood = normalize(r.neighborhood || "");
      const rTitle = normalize(r.studyTitle || r.clientName || "");

      // Match: address + city + neighborhood + title
      const neighborhoodMatch = !neighborhood || !rNeighborhood || rNeighborhood === neighborhood;
      return rAddr === addr && rCity === city && neighborhoodMatch && (title.length > 0 && rTitle === title);
    });
  }, [allRequests, formData.address, formData.city, formData.neighborhood, formData.studyTitle, formData.clientName, initialData, formData.id]);


  const studyHistory = useMemo(() => {
    if (!formData.studyNumber) return [];

    const normalize = (code: string) => (code || '').replace('PROV-', '').trim();
    const currentCode = normalize(formData.studyNumber);

    // Get Base ID and current revision
    let baseCode = currentCode;
    const revSuffixMatch = currentCode.match(/(.+)-REV(\d+)$/i);

    if (revSuffixMatch) {
      baseCode = revSuffixMatch[1];
    } else if (currentCode.length === 10 && /^\d+$/.test(currentCode)) {
      baseCode = currentCode.substring(0, 8);
    }

    return allRequests
      .filter(r => {
        const rCode = normalize(r.studyNumber);
        const rPrev = normalize(r.previousStudy || '');

        // 1. Match by same base ID (New format YYYYXXXXRR)
        if (revSuffixMatch || (currentCode.length === 10 && /^\d+$/.test(currentCode))) {
          if (rCode.startsWith(baseCode)) return true;
        }

        // 2. Match by direct linkage (this is a revision of that, or both follow same previous study)
        if (formData.previousStudy && r.studyNumber === formData.previousStudy) return true;
        if (r.previousStudy && r.previousStudy === formData.studyNumber) return true;
        if (formData.previousStudy && r.previousStudy === formData.previousStudy) return true;

        // 3. Exact match (self or exact duplicate)
        return rCode === currentCode;
      })
      .sort((a, b) => {
        const getRev = (code: string | undefined) => {
          if (!code) return 0;
          const norm = normalize(code);
          const m = norm.match(/-REV(\d+)$/i);
          if (m) return parseInt(m[1]);
          if (norm.length === 10 && /^\d+$/.test(norm)) return parseInt(norm.substring(8, 10));
          return 0;
        };
        const dateA = a.requestDate || '';
        const dateB = b.requestDate || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return getRev(b.studyNumber) - getRev(a.studyNumber);
      });
  }, [allRequests, formData.studyNumber, formData.id]);

  // Debounced backend duplicate check
  useEffect(() => {
    // Skip if already decided or read-only
    if (readOnly || duplicateDecision) return;

    // Only check if we have enough info (address + city + title)
    if (!formData.address || !formData.city || !formData.studyTitle) {
      setBackendPrecedentStudy(null);
      return;
    }
    if ((formData.address?.length || 0) < 5 || (formData.studyTitle?.length || 0) < 2) {
      setBackendPrecedentStudy(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        console.log('[DuplicateCheck-FE] Checking for:', formData.address, formData.city, formData.neighborhood, formData.studyTitle);
        const result = await StorageService.getNextStudyNumber(
          'new',
          undefined,
          formData.city,
          formData.address,
          formData.studyTitle,
          formData.neighborhood
        );

        console.log('[DuplicateCheck-FE] Result:', result);

        if (result.isRevision && result.previousStudy) {
          // Don't show popup for the same study we're currently editing
          if (initialData && result.previousStudy === initialData.studyNumber) {
            console.log('[DuplicateCheck-FE] Skipping - same study being edited');
            return;
          }

          // BUSCA COMPLETA: Fetching full details to ensure all technical fields are cloned
          const fullData = await StorageService.getStudyByNumber(result.previousStudy);
          if (fullData) {
            setBackendPrecedentStudy(fullData);
          } else {
            // Fallback to basic info if full fetch fails
            setBackendPrecedentStudy({
              studyNumber: result.previousStudy,
              address: result.matchedAddress || formData.address || '',
              studyTitle: result.matchedTitle,
              status: result.status,
              city: result.city || formData.city
            } as any);
          }
          setShowDuplicateModal(true);
        } else {
          setBackendPrecedentStudy(null);
        }
      } catch (err) {
        console.error('Error checking duplicate in backend:', err);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [formData.address, formData.city, formData.neighborhood, formData.studyTitle, initialData, readOnly, duplicateDecision]);


  useEffect(() => {
    // Local duplicate check fallback - show modal regardless of status
    if (precedentStudy && !readOnly && !duplicateDecision && !backendPrecedentStudy) {
      setShowDuplicateModal(true);
    }
  }, [precedentStudy, readOnly, duplicateDecision, backendPrecedentStudy]);

  const handleUpdateData = (newData: Partial<FormData>) => {
    if (readOnly) return;

    let updatedData = { ...newData };

    // Auto-populate company and state based on city
    if (newData.city) {
      const titleCity = toTitleCase(newData.city);
      updatedData.city = titleCity;

      const cityInfo = getCompanyByCity(titleCity);
      if (cityInfo) {
        updatedData.empresa = cityInfo.company;
        // Also update state if available and relevant for the form
        if (cityInfo.state) {
          updatedData.state = cityInfo.state === 'RJ' ? 'Rio de Janeiro' :
            cityInfo.state === 'SP' ? 'São Paulo' : cityInfo.state;
        }
      }
    }

    setFormData(prev => ({ ...prev, ...updatedData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Block if there is a duplicate and no decision has been made
    setIsSubmitting(true);

    try {
      let generatedPdfFile: File | undefined;

      if (formRef.current) {
        setIsExporting(true);

        // Espera o React aplicar o modo de exportação no DOM
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const element = formRef.current;
          if (element) {
            window.scrollTo(0, 0);

            // Salvamos o estilo original para restaurar depois
            const originalStyle = element.style.cssText;

            // Forçamos uma largura padrão para que a proporção no PDF A4 seja harmoniosa (aprox 900px)
            element.style.width = '1000px';
            element.style.height = 'auto';
            element.style.overflow = 'visible';

            const canvas = await html2canvas(element, {
              scale: 2, // Aumenta resolução
              useCORS: true,
              backgroundColor: '#ffffff',
              windowWidth: 1010,
              width: 1000,
              logging: false,
              onclone: (clonedDoc) => {
                const clonedRoot = clonedDoc.body.querySelector('.bg-white.p-4.rounded-xl');
                if (clonedRoot instanceof HTMLElement) {
                  clonedRoot.style.width = '1000px';
                  clonedRoot.style.height = 'auto';
                  clonedRoot.style.overflow = 'visible';

                  // Ocultar elementos marcados com 'hide-export' (ex: anexos)
                  clonedRoot.querySelectorAll('.hide-export').forEach(node => {
                    (node as HTMLElement).style.display = 'none';
                  });

                  // Limpar restrições de altura e overflow que causam cortes
                  clonedRoot.querySelectorAll('section, div, p').forEach(node => {
                    const el = node as HTMLElement;
                    if (el.style.maxHeight || el.style.overflow === 'hidden' || el.style.overflowY === 'hidden') {
                      el.style.maxHeight = 'none';
                      el.style.overflow = 'visible';
                    }
                  });
                }
              }
            });

            // Gerar PDF em formato A4 real
            const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Calculamos as dimensões para caber em UMA ÚNICA PÁGINA A4 (Compressão total)
            const contentWidth = canvas.width;
            const contentHeight = canvas.height;
            const ratio = contentWidth / contentHeight;

            let finalWidth = pdfWidth;
            let finalHeight = pdfWidth / ratio;

            // Se a altura calculada ainda for maior que a página A4, escalonamos pela altura
            if (finalHeight > pdfHeight) {
              finalHeight = pdfHeight;
              finalWidth = finalHeight * ratio;
            }

            // Centraliza se for menor que a largura total
            const xOffset = (pdfWidth - finalWidth) / 2;
            const yOffset = 0; // Topo

            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            // Adiciona em uma única página
            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');

            const pdfBlob = pdf.output('blob');
            const fileName = `Formulario_Oficial_${formData.studyNumber || formData.id}.pdf`;
            generatedPdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // Restaura o estilo original
            element.style.cssText = originalStyle;
          }
        } catch (captureErr) {
          console.error('[FormContainer] Falha na captura do snapshot:', captureErr);
        } finally {
          setIsExporting(false);
        }
      }

      // Envia os dados e o arquivo PDF gerado
      await onSubmit(formData, generatedPdfFile);

    } catch (err) {
      console.error('[FormContainer] Erro global ao processar submissão:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmValidation = (assignedAnalyst: string, validationData: Partial<FormData>) => {
    if (onStatusUpdate && initialData) {
      onStatusUpdate(initialData.id, StudyStatus.AGUARDANDO_EXECUCAO, undefined, assignedAnalyst || undefined, validationData);
      setShowValidationModal(false);
      onBack();
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectionReason.trim()) {
      showAlert('É obrigatório justificar o motivo da reprovação.', 'Campo Obrigatório', 'warning');
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

    // 3. Fallback: Se tivermos the studyNumber, tentar abrir a pasta
    if (initialData?.studyNumber) {
      showAlert(`Não foi possível abrir o arquivo diretamente. Abrindo a pasta da solicitação: ${initialData.studyNumber}`, 'Aviso');
      if ((window as any).api?.openFolder) {
        const folderPath = `solicitantes/${initialData.requesterName}/${initialData.studyNumber}`;
        await (window as any).api.openFolder(folderPath);
      }
    } else {
      showAlert('Arquivo não disponível para pré-visualização direta.', 'Aviso');
    }
  };

  const handleSolicitarRevisaoAction = (precedent: any) => {
    if (!precedent) return;

    setDuplicateDecision('revision');

    // "Copie tudo": Deep clone the relevant technical data
    // We preserve technical fields but reset identity/requester fields to the current state
    setFormData(prev => {
      // Create a clean copy of the precedent
      const cleanClone = { ...precedent };

      // Remove metadata that should not be carried to a new revision
      delete cleanClone.id;
      delete cleanClone.createdAt;
      delete cleanClone.updatedAt;
      delete cleanClone.approvedAt;
      delete cleanClone.history;

      return {
        ...cleanClone, // Start with everything from the previous study
        id: 0,
        studyNumber: '',
        status: StudyStatus.EM_ANALISE,
        user_id: userId,
        requestDate: getGMT3ISOString().split('T')[0],
        studyType: 'Revisão de Estudo',
        previousStudy: precedent.studyNumber,

        // Keep current user as the one requesting the revision
        naturgyUnit: currentUser?.naturgyUnit || prev.naturgyUnit,
        requesterName: currentUser?.name || prev.requesterName,
        requesterArea: currentUser?.area || prev.requesterArea,
        phone: currentUser?.phone || prev.phone,
        email: currentUser?.email || prev.email,

        // Cleanup execution/quality data that shouldn't be in a new revision
        assignedTo: undefined,
        assignedToName: undefined,
        analystName: undefined,
        rejectionReason: undefined,
        selectedFiles: [],
        executionSteps: [],
        qcControl: undefined,
        currentStep: undefined,
        activeTab: undefined
      } as any;
    });

    setShowDuplicateModal(false);
  };

  const renderForm = () => {
    const displayData = duplicateDecision === 'viewing' && precedentStudy ? precedentStudy : formData;
    // Calculate effective read-only state based on permissions and ownership
    // CORREÇÃO: garantir que novo estudo seja sempre editável (inclusive para SOLICITANTE)
    const isNewStudy = !initialData?.studyNumber;

    const isOwner = initialData?.user_id === userId;

    // Novo estudo SEMPRE pode editar (independente da role)
    const canEdit = isNewStudy || isOwner;

    // ReadOnly só se explicitamente for readonly E não puder editar
    const forceReadOnly = readOnly && !canEdit;

    const commonProps = {
      data: displayData,
      onChange: handleUpdateData,
      readOnly: forceReadOnly || isExporting || duplicateDecision === 'viewing',
      precedentStudy: precedentStudy // Pass it down to forms if they need to show warnings
    };
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
  const isAssigned = isAssignedToMe(initialData?.assignedTo, currentUser);
  const isOwnerForBlocking = initialData?.user_id === userId;
  const isRestricted = readOnly && initialData?.assignedTo && !isOwnerForBlocking && !isAdmin && !isAssigned;

  // Solicitante não vê detalhes técnicos enquanto está em execução (EXCEPT if they're the owner - then they can edit)
  const showInProgressMessage = isRequesterView && isPendingExecution && readOnly && !isOwnerForBlocking;

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
      <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-10 border border-slate-100 animate-in fade-in slide-in-from-right-8 duration-500 flex-grow w-full">


        {showDuplicateModal && (precedentStudy || backendPrecedentStudy) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col items-center p-10 animate-in zoom-in-95 duration-300">

              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mb-8">
                <i className="fa-solid fa-triangle-exclamation text-orange-500 text-3xl"></i>
              </div>

              <h3 className="text-[22px] font-black text-[#004080] uppercase tracking-tighter text-center leading-tight mb-4 px-4">
                Estudo já concluído ou Estudo vigente
              </h3>

              <div className="text-center px-4 mb-8">
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Identificamos que já existe uma solicitação (<span className="font-bold text-[#004080]">{(backendPrecedentStudy || precedentStudy)?.studyNumber}</span>) para este endereço com status <span className="font-bold text-orange-600">"{(backendPrecedentStudy || precedentStudy)?.status || 'Concluído'}"</span>. Estudos concluídos permanecem vigentes por 12 meses.
                </p>
              </div>

              <div className="w-full bg-slate-50 rounded-2xl p-6 mb-10 text-left border border-slate-100">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalhes do Estudo Encontrado</span>
                <p className="text-base font-black text-slate-700 leading-none mb-2">
                  {(backendPrecedentStudy as any)?.title || (precedentStudy as any)?.studyTitle || (precedentStudy as any)?.clientName || 'Sem Título'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {(backendPrecedentStudy || precedentStudy)?.address}, {(backendPrecedentStudy || precedentStudy)?.city}
                </p>
              </div>

              <div className="w-full space-y-3 flex flex-col">
                <button
                  onClick={() => {
                    const matchedStudy = backendPrecedentStudy || precedentStudy;
                    if (matchedStudy) {
                      setDuplicateDecision('viewing');
                    }
                    setShowDuplicateModal(false);
                  }}
                  className="w-full py-4 bg-[#004080] text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-100/50 hover:bg-[#003366] transition-all active:scale-[0.98]"
                >
                  Visualizar Estudo Existente
                </button>
                <button
                  onClick={() => {
                    const matchedStudy = backendPrecedentStudy || precedentStudy;
                    handleSolicitarRevisaoAction(matchedStudy);
                  }}
                  className="w-full py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  Solicitar Revisão
                </button>

                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-[11px] font-bold transition-all mt-2"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {duplicateDecision === 'viewing' && (precedentStudy || backendPrecedentStudy) && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#004080] shadow-sm">
              <i className="fa-solid fa-eye text-xl"></i>
            </div>
            <div>
              <h4 className="text-xs font-black text-[#004080] uppercase tracking-widest">Modo Visualização (Espelho)</h4>
              <p className="text-[11px] text-blue-700/80 font-bold uppercase mt-1">
                Você está visualizando o estudo <span className="underline">{(backendPrecedentStudy || precedentStudy)?.studyNumber}</span>. Veja os detalhes abaixo e escolha uma ação no final da página.
              </p>
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

        {browsingPrecedentStudy && (
          <FileBrowserModal
            request={browsingPrecedentStudy}
            user={currentUser!}
            allUsers={allUsers}
            allRequests={allRequests}
            onClose={() => setBrowsingPrecedentStudy(null)}
          />
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

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-end">
            <div className="flex gap-4">
              {readOnly && !(isReprovadoCQ && canEdit) ? (
                <>
                  {(isAdmin || currentUser?.permissions?.includes('validar')) && (() => {
                    const statusStr = String(formData.status);
                    const statusNum = Number(formData.status);
                    const isPendenteOrAnalise =
                      formData.status === StudyStatus.PENDENTE ||
                      formData.status === StudyStatus.EM_ANALISE ||
                      statusStr === '330' ||
                      statusNum === 330;
                    return isPendenteOrAnalise;
                  })() && (
                      <>
                        <button type="button" onClick={() => setShowRejectionModal(true)} className="px-8 py-4 rounded-xl border border-red-100 text-red-600 font-black uppercase text-xs">Reprovar</button>
                        <button type="button" onClick={() => setShowValidationModal(true)} className="px-10 py-4 rounded-xl bg-green-600 text-white font-black uppercase text-xs shadow-lg shadow-green-200 transition-all">Validar Estudo</button>
                      </>
                    )}
                  {(isAdmin || currentUser?.permissions?.includes('validar')) && (() => {
                    const statusStr = String(formData.status);
                    const statusNum = Number(formData.status);
                    const isPendenteOrAnalise =
                      formData.status === StudyStatus.PENDENTE ||
                      formData.status === StudyStatus.EM_ANALISE ||
                      statusStr === '330' ||
                      statusNum === 330;
                    return !isPendenteOrAnalise && formData.status !== StudyStatus.CONCLUIDO && formData.status !== StudyStatus.CANCELADO;
                  })() && (
                      <button type="button" onClick={() => setShowValidationModal(true)} className="px-10 py-4 rounded-xl bg-[#004080] text-white font-black uppercase text-xs shadow-lg transition-all">Gerenciar Atribuição</button>
                    )}
                </>
              ) : (
                <>
                  {canExecute && (formData.status === StudyStatus.AGUARDANDO_EXECUCAO || formData.status === StudyStatus.EM_EXECUCAO || formData.status === StudyStatus.REPROVADO_CQ) && canEdit && (
                    <button type="button" onClick={handleStartExecutionLocal} className="px-10 py-4 rounded-xl bg-[#004080] text-white font-black uppercase text-xs shadow-lg transition-all">
                      {formData.status === StudyStatus.EM_EXECUCAO ? 'Abrir Painel Técnico' : 'Iniciar Execução'}
                    </button>
                  )}
                  {canExecute && (formData.status === StudyStatus.EM_EXECUCAO || formData.status === StudyStatus.REPROVADO_CQ) && canEdit && (
                    <button type="button" onClick={handleFinishExecution} className="px-10 py-4 rounded-xl bg-indigo-600 text-white font-black uppercase text-xs shadow-lg transition-all">Enviar para Qualidade</button>
                  )}
                  {!readOnly && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-12 py-5 rounded-2xl font-black text-white transition-all shadow-2xl text-lg flex items-center uppercase tracking-tighter ${isSubmitting ? 'bg-slate-400' : 'bg-[#004080] hover:bg-[#FF8000] active:scale-95 shadow-[#004080]/30'}`}
                    >
                      {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin mr-3"></i>Enviando...</> : <>{initialData?.studyNumber ? 'Reenviar Solicitação' : 'Gerar Solicitação'} <i className="fa-solid fa-paper-plane ml-4"></i></>}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      {(studyHistory.length > 1 || (!readOnly && studyHistory.length > 0)) && (
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
                    {(() => {
                      const norm = item.studyNumber.replace('PROV-', '');
                      const revMatch = norm.match(/-REV(\d+)$/i);
                      if (revMatch) return `Revisão ${revMatch[1]}`;
                      if (norm.length === 10 && /^\d+$/.test(norm)) {
                        const rev = norm.substring(8, 10);
                        return rev === '01' ? 'Versão Original' : `Revisão ${rev}`;
                      }
                      return 'Versão Original';
                    })()}
                  </span>
                  {item.id === formData.id && <span className="w-1.5 h-1.5 bg-[#004080] rounded-full animate-pulse"></span>}
                </div>
                <p className={`text-[9px] font-bold ${item.id === formData.id ? 'text-slate-600' : 'text-slate-400'}`}>
                  Solicitado em: {formatDateTimeBR(item.requestDate)}
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
