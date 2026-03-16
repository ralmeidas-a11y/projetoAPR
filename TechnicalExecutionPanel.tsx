
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StudyStatus, FormData, User, UserRole, FormType } from './types';
import { formatDateTimeBR } from './utils';
import { StorageService } from './storage';
import { FileBrowserModal } from './FileBrowserModal';

interface TechnicalExecutionPanelProps {
  data: FormData;
  allRequests?: FormData[];
  onBack: () => void;
  onStatusUpdate: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  onUpdateData?: (updatedData: FormData) => void;
  allUsers?: User[];
  readOnly?: boolean;
}

export const TechnicalExecutionPanel: React.FC<TechnicalExecutionPanelProps> = ({ data, allRequests = [], allUsers = [], onBack, onStatusUpdate, onUpdateData, readOnly = false }) => {
  const [activeTab, setActiveTab] = useState(0); // 0: Dados do Estudo, 1: Análise Técnica, 2: Resposta
  const [activeTechSubTab, setActiveTechSubTab] = useState(0); // 0: Dados de Estudo, 1: Realizando Análise, 2: Passos Resposta
  const [activeFolder, setActiveFolder] = useState('Solicitacao');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [previewStudy, setPreviewStudy] = useState<FormData | null>(null);
  const [browsingRevision, setBrowsingRevision] = useState<FormData | null>(null);
  const [filePreview, setFilePreview] = useState<{ name: string; base64: string; mime: string } | null>(null);
  const [isPaused, setIsPaused] = useState(readOnly);
  const [elapsedTime, setElapsedTime] = useState(data.totalExecutionTime || 0);
  const [supabaseFiles, setSupabaseFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (!isPaused && !readOnly) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, readOnly]);

  // Sync elapsed time periodically
  useEffect(() => {
    if (onUpdateData && elapsedTime > 0 && elapsedTime % 10 === 0) {
      onUpdateData({ ...data, totalExecutionTime: elapsedTime });
    }
  }, [elapsedTime, onUpdateData]);

  // Fetch Supabase files when folder changes
  useEffect(() => {
    let isMounted = true;
    const fetchFiles = async () => {
      if (!data.studyNumber) return;
      setIsLoadingFiles(true);
      try {
        const files = await StorageService.getRequestFiles(data.studyNumber, activeFolder);
        if (isMounted) {
          setSupabaseFiles(files);
        }
      } catch (err) {
        console.error('Error fetching study files:', err);
      } finally {
        if (isMounted) setIsLoadingFiles(false);
      }
    };
    fetchFiles();
    return () => { isMounted = false; };
  }, [activeFolder, data.studyNumber]);

  // Consolidate estimatedDeliveryDate Logic and Repair Execution Dates
  useEffect(() => {
    let changed = false;
    const updated = { ...data };

    // 1. Repair estimatedDeliveryDate
    if (!data.estimatedDeliveryDate && data.requestDate) {
      const requestDateObj = new Date(data.requestDate);
      if (!isNaN(requestDateObj.getTime())) {
        const deliveryDateObj = new Date(requestDateObj);
        deliveryDateObj.setDate(deliveryDateObj.getDate() + 7);
        updated.estimatedDeliveryDate = deliveryDateObj.toISOString().split('T')[0];
        changed = true;
      }
    }

    // 2. Repair Inverted/Leaked Dates (Revision inheritance fix)
    if (data.status === StudyStatus.EM_EXECUCAO) {
      // If end-date exists but start-date is missing, it's swapped (usually inherited from parent)
      if (data.completedAt && !data.startedAt) {
        updated.startedAt = data.completedAt;
        updated.completedAt = undefined;
        changed = true;
      } else if (data.completedAt) {
        // Just clear end-date if in execution
        updated.completedAt = undefined;
        changed = true;
      }
      
      // Ensure startedAt is set if in execution
      if (!updated.startedAt) {
        updated.startedAt = new Date().toISOString();
        changed = true;
      }
    }

    if (changed && onUpdateData) {
      onUpdateData(updated);
    }
  }, [data.requestDate, data.estimatedDeliveryDate, data.status, data.startedAt, data.completedAt, onUpdateData]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFO = (type: string) => type.split('-').pop() || '';

  const formatCurrency = (num: any) => {
    const n = Number(num);
    return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onUpdateData) {
      const rawFiles = Array.from(e.target.files);
      const newFiles = await Promise.all(rawFiles.map(async (f: File) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result ? reader.result.toString().split(',')[1] : null;
            resolve({
              name: f.name,
              size: f.size,
              type: f.type,
              lastModified: f.lastModified,
              base64: base64String
            });
          };
          reader.onerror = () => {
            resolve({ name: f.name, size: f.size, type: f.type, lastModified: f.lastModified });
          };
          reader.readAsDataURL(f);
        });
      }));

      let updatedData = { ...data, totalExecutionTime: elapsedTime };
      if (activeFolder === 'Solicitacao') {
        updatedData.selectedFiles = [...(data.selectedFiles || []), ...newFiles];
      } else {
        const currentCategorized = data.categorizedFiles || {};
        const folderFiles = currentCategorized[activeFolder] || [];
        updatedData.categorizedFiles = {
          ...currentCategorized,
          [activeFolder]: [...folderFiles, ...newFiles]
        };
      }
      onUpdateData(updatedData);
    }
  };

  const handleViewFile = async (file: any) => {
    try {
      if (file.fullPath) {
        const url = await StorageService.getFileUrl(file.fullPath);
        if (url) {
          window.open(url, '_blank');
        } else {
          alert('Erro ao gerar link de visualização.');
        }
        return;
      }
      
      if (file.base64 && file.type) {
        setFilePreview({
          name: file.name,
          mime: file.type,
          base64: file.base64
        });
      } else {
        alert('Este arquivo não possui conteúdo para visualização. Verifique a pasta local.');
      }
    } catch (err) {
      console.warn('Erro ao visualizar arquivo:', err);
      alert('Erro ao visualizar arquivo');
    }
  };

  const handleDownloadFile = async (file: any) => {
    try {
      if (file.fullPath) {
        const url = await StorageService.getFileUrl(file.fullPath);
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.download = file.name || 'documento';
          link.click();
        } else {
          alert('Erro ao gerar link de download.');
        }
        return;
      }

      if (file.base64 && file.type) {
        const link = document.createElement('a');
        link.href = `data:${file.type};base64,${file.base64}`;
        link.download = file.name || 'documento';
        link.click();
      } else {
        alert("Arquivo não disponível para download.");
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Erro ao baixar arquivo');
    }
  };

  const handleUpdateStatus = (status: StudyStatus, additional?: Partial<FormData>) => {
    const finalAdditional: Partial<FormData> = { ...additional };
    
    // Logic to prevent date inversion and improve persistence
    if (status === StudyStatus.EM_EXECUCAO) {
      finalAdditional.startedAt = data.startedAt || new Date().toISOString();
      finalAdditional.completedAt = undefined; // Force clear if starting execution
    } else if (status === StudyStatus.CONCLUIDO) {
      finalAdditional.completedAt = new Date().toISOString();
    }

    onStatusUpdate(data.id || '', status, undefined, undefined, finalAdditional);
  };

  const handleFinishStudy = () => {
    // We pass totalExecutionTime via additionalData to avoid race conditions with onUpdateData
    handleUpdateStatus(StudyStatus.CONTROLE_QUALIDADE, { totalExecutionTime: elapsedTime });
    setShowFinishModal(false);
    onBack();
  };


  const handlePauseToggle = () => setIsPaused(prev => !prev);

  const revisionHistory = useMemo(() => {
    if (!data.studyNumber) return [];
    const cleanCode = data.studyNumber.replace('PROV-', '');
    const revMatch = cleanCode.match(/(.+)-REV\d+$/i);
    const baseCode = revMatch ? revMatch[1] : cleanCode;
    return allRequests.filter(r => 
      r.id !== data.id && 
      (r.studyNumber.replace('PROV-', '').startsWith(baseCode) || (r.previousStudy && r.previousStudy.replace('PROV-', '').startsWith(baseCode)))
    ).sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }, [allRequests, data.id, data.studyNumber]);

  const renderTechnicalField = (label: string, value: any, unit: string = '') => (
    <div className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-sm font-black text-slate-500">{value} <span className="text-[10px] font-normal text-slate-400">{unit}</span></span>
    </div>
  );

  const getFilesForActiveFolder = () => {
    // Mesclar arquivos locais (acabaram de ser anexados mas ainda não salvos)
    // com arquivos que já estão no Supabase
    let localFiles = activeFolder === 'Solicitacao' 
      ? (data.selectedFiles || []) 
      : (data.categorizedFiles?.[activeFolder] || []);

    if (activeFolder === 'Solicitacao' && data.studyNumber) {
      const fileName = `Formulário - ${data.studyNumber}.pdf`;
      const fullPath = `Solicitacoes_APR/${new Date().getFullYear()}/${data.studyNumber.replace('PROV-', '').split('-REV')[0]}/${data.studyNumber.includes('-REV') ? 'REV' + data.studyNumber.split('-REV')[1] : 'REV0'}/Solicitacao/${fileName}`;
      // Note: The above logic is a simplified version of getRequestPath for the frontend here.
      
      localFiles = [
        { 
          name: fileName, 
          type: 'application/pdf', 
          size: 0, 
          isVirtual: true,
          virtualType: 'official-form',
          fullPath: `DUMMY_FORM` // We will handle this specially in the handlers
        },
        ...localFiles
      ];
    }
    
    // Filtrar duplicatas (por nome) para não exibir o mesmo arquivo duas vezes
    const supabaseNames = new Set(supabaseFiles.map(f => f.name));
    const uniqueLocalFiles = localFiles.filter(f => !supabaseNames.has(f.name));

    return [...supabaseFiles, ...uniqueLocalFiles];
  };

  const renderCargaTable = (studyData: FormData = data) => {
    switch (studyData.formType) {
      case FormType.RESIDENTIAL_COMMERCIAL:
        return (
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mercado</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Clientes</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Vazão/Unid</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700">Residencial</td>
                  <td className="px-6 py-4 text-xs text-center font-black text-[#004080]">{studyData.numClientsRes || 0}</td>
                  <td className="px-6 py-4 text-xs text-center font-bold text-slate-600">{formatCurrency(studyData.flowUnitRes)}</td>
                  <td className="px-6 py-4 text-xs text-right font-black text-[#004080]">{formatCurrency(studyData.totalFlowRes)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700">Comercial</td>
                  <td className="px-6 py-4 text-xs text-center font-black text-[#004080]">{studyData.numClientsCom || 0}</td>
                  <td className="px-6 py-4 text-xs text-center font-bold text-slate-600">{formatCurrency(studyData.flowUnitCom)}</td>
                  <td className="px-6 py-4 text-xs text-right font-black text-[#004080]">{formatCurrency(studyData.totalFlowCom)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50/50 font-black">
                <tr className="border-t-2 border-slate-100">
                  <td className="px-6 py-4 text-xs text-[#004080]">TOTAIS GERAIS</td>
                  <td className="px-6 py-4 text-xs text-center text-[#004080]">{(Number(studyData.numClientsRes) || 0) + (Number(studyData.numClientsCom) || 0)}</td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-sm text-right text-orange-600">
                    {formatCurrency((Number(studyData.totalFlowRes) || 0) + (Number(studyData.totalFlowCom) || 0))} <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest ml-1">m³/h</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      case FormType.EXPANSION_AREAS:
        const expRows = [
          { key: 'residenciais', label: 'Residenciais' },
          { key: 'comerciais', label: 'Comerciais' },
          { key: 'grandesComercios', label: 'Grandes Comércios' },
          { key: 'industrias', label: 'Indústrias' },
          { key: 'gnv', label: 'GNV' },
          { key: 'outros', label: 'Outros' }
        ];
        return (
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Segmento de Expansão</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Atuais</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">2 Anos</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">20 Anos</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Vazão Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expRows.map(row => (
                  <tr key={row.key} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">{row.label}</td>
                    <td className="px-6 py-4 text-xs text-center font-black text-[#004080]">{studyData.gridDataFO02?.[row.key]?.atuais || 0}</td>
                    <td className="px-6 py-4 text-xs text-center font-bold text-slate-600">{studyData.gridDataFO02?.[row.key]?.y2 || 0}</td>
                    <td className="px-6 py-4 text-xs text-center font-bold text-slate-600">{studyData.gridDataFO02?.[row.key]?.y20 || 0}</td>
                    <td className="px-6 py-4 text-xs text-right font-black text-[#004080]">{formatCurrency(studyData.gridDataFO02?.[row.key]?.totalQ)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case FormType.THERMO_GENERATION:
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderTechnicalField('Pressão Máx UTE', formatCurrency(studyData.pressMaxUTE), 'bar')}
            {renderTechnicalField('Pressão Mín UTE', formatCurrency(studyData.pressMinUTE), 'bar')}
            {renderTechnicalField('Vazão Instantânea', formatCurrency(studyData.instantFlow), 'Nm³/h')}
            {renderTechnicalField('QDC Diário', formatCurrency(studyData.qdc), 'm³/dia')}
            {renderTechnicalField('Pressão Máx UPGN', formatCurrency(studyData.pressMaxUPGN), 'bar')}
            {renderTechnicalField('Pressão Mín UPGN', formatCurrency(studyData.pressMinUPGN), 'bar')}
          </div>
        );
      case FormType.LARGE_CLIENTS:
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderTechnicalField('Consumo Instantâneo', formatCurrency(studyData.instantConsumption), 'm³/h')}
            {renderTechnicalField('Incremento de Demanda', formatCurrency(studyData.consumptionIncrement), 'Nm³/h')}
            {renderTechnicalField('Consumo Mensal', formatCurrency(studyData.monthlyConsumption), 'm³')}
            {renderTechnicalField('Vazão Final Prevista', formatCurrency(studyData.totalPredictedFlow), 'Nm³/h')}
            {renderTechnicalField('Pressão Mínima', studyData.minPressure || '-', 'bar')}
            {renderTechnicalField('Regime Trabalho', studyData.workHours || 0, 'h/dia')}
            {renderTechnicalField('Dias Semanais', studyData.workDaysPerWeek || 0, 'dias')}
            {renderTechnicalField('Faixa de Pressão', studyData.suggestedPressureRange || 'N/A')}
          </div>
        );
      default: return null;
    }
  };

  const renderTechSubTab0 = () => {
    
    // Logic to calculate previous study/revision
    const getPreviousStudy = (studyNumber: string | undefined) => {
      if (!studyNumber) return '-';
      const match = studyNumber.match(/-REV(\d+)$/i);
      if (match) {
        const currentRev = parseInt(match[1], 10);
        if (currentRev > 0) {
          return studyNumber.replace(/-REV\d+$/i, `-REV${currentRev - 1}`).replace('PROV-', '');
        }
      }
      return '-';
    };

    // Logic to calculate Empresa and Estado based on Município
    const getEmpresaEstado = (municipio: string | undefined): { empresa: string, estado: string } => {
      if (!municipio) return { empresa: '-', estado: '-' };
      
      const normalizedCity = municipio.trim().toLowerCase();
      
      // Mapeamento baseado na imagem fornecida
      const mapping: Record<string, string> = {
        'alumínio': 'SPS',
        'angra dos reis': 'CEGRIO',
        'araçariguama': 'SPS',
        'arraial do cabo': 'CEGRIO',
        'barra do piraí': 'CEGRIO',
        'barra mansa': 'CEGRIO',
        'belford roxo': 'CEG',
        'boituva': 'SPS',
        'botucatu': 'SPS',
        'cabo frio': 'CEGRIO',
        'cachoeiras de macacu': 'CEGRIO',
        'campos dos goytacazes': 'CEGRIO',
        'casimiro de abreu': 'CEGRIO',
        'cerquilho': 'SPS',
        'cesário lange': 'SPS',
        'duque de caxias': 'CEG',
        'engenheiro paulo de frontin': 'CEGRIO',
        'guapimirim': 'CEG',
        'iguaba grande': 'CEGRIO',
        'iperó': 'SPS',
        'itaboraí': 'CEG',
        'itaguaí': 'CEG',
        'itapetininga': 'SPS',
        'itatiaia': 'CEGRIO',
        'itu': 'SPS',
        'japeri': 'CEG',
        'laranjal paulista': 'SPS',
        'macaé': 'CEGRIO',
        'magé': 'CEG',
        'mairinque': 'SPS',
        'mangaratiba': 'CEG',
        'maricá': 'CEG',
        'mesquita': 'CEG',
        'nilópolis': 'CEG',
        'niterói': 'CEG',
        'nova friburgo': 'CEGRIO',
        'nova iguaçu': 'CEG',
        'paracambi': 'CEG',
        'paraíba do sul': 'CEGRIO',
        'petrópolis': 'CEGRIO',
        'piraí': 'CEGRIO',
        'porto feliz': 'SPS',
        'porto real': 'CEGRIO',
        'queimados': 'CEG',
        'resende': 'CEGRIO',
        'rio das flores': 'CEGRIO',
        'rio das ostras': 'CEGRIO',
        'rio de janeiro': 'CEG',
        'salto': 'SPS',
        'são gonçalo': 'CEG',
        'são joão de meriti': 'CEG',
        'são paulo': 'SPS',
        'são pedro da aldeia': 'CEGRIO',
        'são roque': 'SPS',
        'saquarema': 'CEGRIO',
        'seropédica': 'CEG',
        'sorocaba': 'SPS',
        'tatuí': 'SPS',
        'teresópolis': 'CEGRIO',
        'tietê': 'SPS',
        'três rios': 'CEGRIO',
        'volta redonda': 'CEGRIO',
        'votorantim': 'SPS'
      };

      const empresa = mapping[normalizedCity] || 'Não Mapeado';
      const estado = empresa === 'SPS' ? 'SP' : (empresa === 'CEG' || empresa === 'CEGRIO' ? 'RJ' : '-');

      return { empresa, estado };
    };

    const locationData = getEmpresaEstado(data.city);

    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-12">
        {/* Identificação Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
            <i className="fa-solid fa-address-card text-orange-500"></i>
            1. Dados da Solicitação e Identificação
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderTechnicalField('ID Estudo', data.studyNumber?.replace('PROV-', '') || 'N/A')}
            {(() => {
              const prevText = getPreviousStudy(data.studyNumber);
              if (prevText === '-') return renderTechnicalField('Estudo Anterior', '-');

              // Robust search
              const search = prevText.toLowerCase().replace('prov-', '');
              const found = allRequests?.find(r => {
                const rNum = (r.studyNumber || '').toLowerCase().replace('prov-', '');
                return rNum === search || rNum.includes(search);
              });

              // Always create an object to allow folder browsing
              const displayObj = found || ({
                studyNumber: prevText,
                id: `ref-${prevText}`,
                status: StudyStatus.CONCLUIDO,
                formType: data.formType // Fallback to current form type
              } as FormData);

              return renderTechnicalField('Estudo Anterior', (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setBrowsingRevision(displayObj)} 
                    className="text-indigo-600 hover:text-[#004080] font-black underline decoration-indigo-300 underline-offset-4 transition-colors"
                    title="Visualizar detalhes/documentos do estudo anterior"
                  >
                    {prevText}
                  </button>
                  <button
                    onClick={() => setBrowsingRevision(displayObj)}
                    className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-600 transition-all border border-blue-100 shadow-sm"
                    title="Abrir pasta de documentos da solicitação antiga"
                  >
                    <i className="fa-solid fa-folder-open text-xs"></i>
                  </button>
                </div>
              ));
            })()}
            {renderTechnicalField('Data de Solicitação', formatDateTimeBR(data.requestDate))}
            {renderTechnicalField('Solicitante', data.requesterName || '-')}
            {renderTechnicalField('E-mail', data.email || 'NÃO UTILIZAR ESSE REGISTRO')}
            {renderTechnicalField('Área Solicitante', data.requesterArea || 'Desconhecido')}
          </div>
        </div>

        {/* Localização Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
            <i className="fa-solid fa-location-dot text-orange-500"></i>
            2. Localização e Cliente
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-2">
              {renderTechnicalField('Título/Cliente', data.studyTitle || data.clientName || data.uteName || 'NÃO UTILIZAR ESSE REGISTRO')}
            </div>
            <div className="col-span-2">
              {renderTechnicalField('Endereço ou Localidade', data.address || 'NÃO UTILIZAR ESSE REGISTRO')}
            </div>
            {renderTechnicalField('Município', data.city || '-')}
            {renderTechnicalField('Bairro', data.neighborhood || '-')}
            {renderTechnicalField('Estado', locationData.estado)}
            {renderTechnicalField('Empresa', locationData.empresa)}
          </div>
        </div>

        {/* Parâmetros Técnicos & Demanda */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
            <i className="fa-solid fa-gauge-high text-orange-500"></i>
            3. Demanda e Parâmetros Técnicos
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {renderTechnicalField('Tipo de Gás', data.gasType || '-')}
            {renderTechnicalField('Faixa de Pressão', data.suggestedPressureRange || '-')}

            {renderTechnicalField('Pressão Min.', data.suggestedPressureRange === 'BP-N' ? '19 mbar' : (data.suggestedPressureRange?.startsWith('MP-N') ? '1 bar' : (formatCurrency(data.minPressure) + ' bar')))}
            
            <div className="flex gap-4 items-center pl-2 pt-5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded disabled:opacity-75 disabled:cursor-not-allowed" checked={!!data.mapReceived} readOnly disabled />
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Mapa Recebido?</label>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded disabled:opacity-75 disabled:cursor-not-allowed" checked={!!data.relevantStudy} readOnly disabled />
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Estudo Relevante</label>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-slate-100">
            {renderTechnicalField('Nº Residenciais', data.numClientsRes || '0')}
            {renderTechnicalField('Vazão Residencial', formatCurrency(data.totalFlowRes), 'm³/h')}
            {renderTechnicalField('Nº Com. Ind. Etc', data.numClientsCom || '0')}
            {renderTechnicalField('Vazão Com. Ind. Etc', formatCurrency(data.totalFlowCom), 'm³/h')}
          </div>
        </div>

        {/* Controle da Análise */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
            <i className="fa-solid fa-clipboard-list text-orange-500"></i>
            4. Controle da Análise (GNI)
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="col-span-1 lg:col-span-3">
              {renderTechnicalField('Nomes GNI', data.gniName || '-')}
            </div>
            
            {renderTechnicalField('Tipo de Estudo', data.studyType || '-')}
            {renderTechnicalField('Sub-tipo de Estudo', data.studySubType || '-')}
            {renderTechnicalField('Dificuldade', data.difficulty || '-')}

            {renderTechnicalField('Responsável Estudo', (() => {
              if (!data.assignedTo) return '-';
              const analyst = allUsers.find(u => u.id === data.assignedTo || u.email === data.assignedTo);
              return analyst ? analyst.name : data.assignedTo;
            })())}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-slate-100">
             {renderTechnicalField('Entrada Real', formatDateTimeBR(data.requestDate))}
             {renderTechnicalField('Entrega Prevista', data.estimatedDeliveryDate ? formatDateTimeBR(data.estimatedDeliveryDate) : '-')}
             {renderTechnicalField('Início Execução', data.startedAt ? formatDateTimeBR(data.startedAt) : '-')}
             {renderTechnicalField('Término Execução', data.completedAt ? formatDateTimeBR(data.completedAt) : '-')}
          </div>
        </div>

        {/* Comentários */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm flex flex-col">
            <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
              <i className="fa-solid fa-message text-orange-500"></i>
              5. Observações do Validador
            </h4>
            <div className="flex-grow p-6 bg-slate-50 rounded-[2rem] text-sm font-medium text-slate-600 leading-relaxed border border-slate-200 shadow-sm min-h-[100px] whitespace-pre-wrap">
              {data.validatorObservations || "Sem observações do validador."}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm flex flex-col">
            <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest mb-6 flex items-center gap-3">
              <i className="fa-solid fa-message text-orange-500"></i>
              6. Notas do Solicitante
            </h4>
            <div className="flex-grow p-6 bg-slate-50/60 rounded-[2rem] text-sm font-medium text-slate-600 leading-relaxed border border-slate-100 shadow-inner min-h-[100px] whitespace-pre-wrap">
              {data.comments || "Registro de Segurança / Sem anotações adicionais."}
            </div>
          </div>
        </div>

      </div>
    );
  };


  const renderTechSubTab1 = () => {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-8">
        <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
          Realizando Análise
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
               {renderTechnicalField('Grupo Rede', '9062', '')}
               <div className="col-span-2">{renderTechnicalField('Descrição', 'Rede MP Niteroi')}</div>
               {renderTechnicalField('Estudo Anterior', '20000000')}
               <div className="col-span-2">
                 {renderTechnicalField('Estudo Vinculado', '...', '')}
               </div>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-5 gap-2 text-center">
              <div className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400 mb-1">BP-N</span><span className="text-xs font-black">22 mbar</span></div>
              <div className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400 mb-1">MaxPo</span><span className="text-xs font-black">22 mbar</span></div>
              <div className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Min</span><span className="text-xs font-black">19 mbar</span></div>
              <div className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Garantia</span><span className="text-xs font-black">19 mbar</span></div>
              <div className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Pressão Calculada</span><span className="text-xs font-black text-indigo-600">-</span></div>
            </div>

            <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100 pb-2">Extensões Redes Planificadas</h5>
            <div className="overflow-x-auto">
               <table className="w-full text-left bg-slate-50 rounded-xl overflow-hidden text-xs">
                 <thead className="bg-[#004080] text-white">
                    <tr>
                      <th className="p-2 font-normal">Material</th>
                      <th className="p-2 font-normal">Diâmetro</th>
                      <th className="p-2 font-normal">Extensão</th>
                      <th className="p-2 font-normal">Tipo de Rede</th>
                      <th className="p-2 font-normal text-center">Qt Válvulas</th>
                      <th className="p-2 font-normal">Pressão</th>
                      <th className="p-2 font-normal">Tipo Gás</th>
                      <th className="p-2 font-normal">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white border border-slate-200">
                    <tr>
                      <td className="p-2 bg-white">
                        <select disabled={readOnly} className="bg-transparent border-0 text-xs w-full"><option>PE</option><option>Aço</option></select>
                      </td>
                      <td className="p-2 bg-white">
                        <select disabled={readOnly} className="bg-transparent border-0 text-xs w-full"><option>63</option><option>90</option><option>125</option></select>
                      </td>
                      <td className="p-2 bg-white"><input type="number" disabled={readOnly} className="w-16 border-slate-200 rounded p-1 text-xs" /></td>
                      <td className="p-2 bg-white">
                        <select disabled={readOnly} className="bg-transparent border-0 text-xs w-full"><option>Principal</option><option>Ramal</option></select>
                      </td>
                      <td className="p-2 bg-white text-center">0</td>
                      <td className="p-2 bg-white">
                        <select disabled={readOnly} className="bg-transparent border-0 text-xs w-full"><option>MP</option><option>BP</option></select>
                      </td>
                      <td className="p-2 bg-white text-center font-bold">GN</td>
                      <td className="p-2 bg-white text-slate-500">Estudo (Construir)</td>
                    </tr>
                 </tbody>
               </table>
            </div>
          </div>
          
          <div className="space-y-6">
             <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Total Clientes</span><span className="text-sm font-black text-[#004080]">{(Number(data.numClientsRes)||0) + (Number(data.numClientsCom)||0)}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Vazão Unitária</span><span className="text-sm font-black text-[#004080]">{formatCurrency((Number(data.flowUnitRes)||0) + (Number(data.flowUnitCom)||0))}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">F. Penetração</span><span className="text-sm font-black text-[#004080]">1</span></div>
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">F. Diversificação</span><span className="text-sm font-black text-[#004080]">1</span></div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-1"><span className="text-xs font-black text-slate-700">Vazão Total (m³/h)</span><span className="text-lg font-black text-orange-600">{formatCurrency((Number(data.totalFlowRes)||0) + (Number(data.totalFlowCom)||0))}</span></div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                <button disabled={readOnly} className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] hover:bg-slate-50 uppercase tracking-widest shadow-sm disabled:opacity-50">Cálculo Manual</button>
                <button disabled={readOnly} className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] hover:bg-slate-50 uppercase tracking-widest shadow-sm disabled:opacity-50">Automático</button>
             </div>
             <p className="text-[9px] text-slate-400 italic leading-tight">*Sempre consultar a Norma para os fatores necessários para a diversificação.</p>
             
             <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <div className="flex justify-between items-center mb-4 text-xs font-black text-[#004080] uppercase">
                   Dimensionar Regulador? <input type="checkbox" disabled={readOnly} className="rounded" />
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between"><span className="text-[10px] font-bold text-indigo-700">Vazão</span><input type="text" disabled={readOnly} className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs" /></div>
                   <div className="flex justify-between"><span className="text-[10px] font-bold text-indigo-700">Custo</span><input type="text" disabled={readOnly} className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs" /></div>
                   <div className="flex justify-between"><span className="text-[10px] font-bold text-indigo-700">P. Entrada</span><input type="text" disabled={readOnly} className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs" /></div>
                   <div className="flex justify-between"><span className="text-[10px] font-bold text-indigo-700">P. Saída</span><input type="text" disabled={readOnly} className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs" /></div>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
           <div>
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080] mb-2">Observações Resposta</h5>
              <textarea 
                readOnly={readOnly}
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                defaultValue={`Registro de Segurança\n2-) Deverá ser confeccionado "Livro de Obra" e enviado ao GEGAT...\n3-) Deverá ser confeccionado "Livro de Obra" ...`}
              ></textarea>
           </div>
           <div>
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080] mb-2">Condições e Observações padronizadas</h5>
              <div className="h-32 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium leading-relaxed">
                 <p>Deverá ser confeccionado "Livro de Obra" e enviado ao GEGAT...</p>
                 <p>Deverá ser instalada válvula de segurança, logo após o ponto de interligação...</p>
                 <p>Dimensionamento de Rede de acordo com Anexo 1...</p>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderTechSubTab2 = () => {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6">
        <h4 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
          Passos Resposta
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
             <div className="p-5 border border-slate-200 rounded-2xl relative">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase">Preparação Arquivos Geogas</span>
                <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-600">
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-export text-[#004080]"></i> Caminho de Exportação Shapefile</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-map-location-dot text-[#004080]"></i> Criar Legenda Geogas</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-pdf text-red-500"></i> Caminho de Exportação pdf</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-globe text-green-500"></i> Arquivar Mapa Geogas</li>
                </ul>
             </div>

             <div className="p-5 border border-slate-200 rounded-2xl relative">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase">Preparação Arquivos QGis</span>
                <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-600">
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-map-location-dot text-[#004080]"></i> Criar Legenda QGis</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-pdf text-red-500"></i> Caminho de Exportação pdf</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-globe text-green-500"></i> Arquivar Mapa QGis</li>
                </ul>
             </div>
             
             <div className="p-5 border border-slate-200 rounded-2xl relative bg-indigo-50/50">
                <span className="absolute -top-3 left-4 bg-indigo-50/50 px-2 text-[10px] font-black text-[#004080] uppercase">Preparação Envio</span>
                <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-700">
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-[#004080]'}`}><i className="fa-solid fa-magnifying-glass"></i> Visualizar</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-[#004080]'}`}><i className="fa-solid fa-envelope-open-text"></i> Exportar Carta Resposta</li>
                   <li className={`flex items-center gap-2 text-red-500 ${readOnly ? '' : 'cursor-pointer hover:text-red-700'}`}><i className="fa-solid fa-paper-plane"></i> Justificar Envio Antes do Controle</li>
                   <li className={`flex items-center gap-2 font-black text-green-600 ${readOnly ? '' : 'cursor-pointer hover:text-green-700'}`}><i className="fa-solid fa-check-double"></i> Enviar Estudo</li>
                   <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-[#004080]'}`}><i className="fa-solid fa-plus text-[#004080]"></i> Abrir Controle de Qualidade</li>
                </ul>
             </div>
          </div>
          
          <div className="lg:col-span-2 space-y-6 flex flex-col">
             <div className="flex-grow flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Copiar Colar:</span>
                <textarea readOnly={readOnly} className="flex-grow min-h-[150px] border border-slate-200 rounded-2xl bg-slate-50 p-4 resize-none text-xs" />
             </div>
             
             <div className="grid grid-cols-3 gap-4 border border-slate-200 p-4 rounded-2xl">
                <div className="flex flex-col items-center gap-2">
                   <span className="text-[10px] font-black text-white bg-[#004080] w-full text-center py-1 rounded">Estudos Servidor</span>
                   <div className="w-full h-32 bg-white border border-slate-200 rounded-xl"></div>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 border-x border-slate-100 px-2">
                   <button disabled={readOnly} className="text-[9px] font-black text-[#004080] uppercase tracking-widest hover:underline disabled:opacity-50">Baixar Arquivo Winflow {">>>"}</button>
                   <button disabled={readOnly} className="text-[9px] font-black text-[#004080] uppercase tracking-widest hover:underline disabled:opacity-50">{"<<<"} Guardar Winflow</button>
                </div>
                <div className="flex flex-col items-center gap-2">
                   <span className="text-[10px] font-black text-white bg-[#004080] w-full text-center py-1 rounded">Estudos Locais</span>
                   <div className="w-full h-32 bg-white border border-slate-200 rounded-xl"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // Análise Técnica
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-300 overflow-hidden">
            <div className="flex bg-slate-100 rounded-2xl p-1 shrink-0 mt-4 mb-4 mx-2">
              {['Dados de Estudo', 'Realizando Análise', 'Passos Resposta'].map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => setActiveTechSubTab(idx)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTechSubTab === idx ? 'bg-white text-[#004080] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar px-2 pb-12 mb-4">
              {activeTechSubTab === 0 && renderTechSubTab0()}
              {activeTechSubTab === 1 && renderTechSubTab1()}
              {activeTechSubTab === 2 && renderTechSubTab2()}
            </div>
          </div>
        );
      case 1: // Resposta
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 flex-grow shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-green-50 text-green-600 rounded-[2rem] flex items-center justify-center mb-8 border border-green-100 shadow-inner">
                   <i className="fa-solid fa-file-export text-4xl"></i>
                </div>
                <h4 className="text-2xl font-black text-[#004080] uppercase tracking-tight mb-4">Emissão de Parecer Técnico</h4>
                <p className="text-sm text-slate-500 max-w-lg mb-10 leading-relaxed font-medium">
                   Finalize o estudo gerando o parecer oficial. É obrigatório anexar o documento PDF final na pasta <span className="font-bold text-[#004080] underline">Resposta</span> antes da conclusão.
                </p>
                {!readOnly && (
                  <button 
                    onClick={() => { setActiveFolder('Resposta'); handleAttachFile(); }}
                    className="px-12 py-5 bg-[#004080] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-100 hover:bg-[#FF8000] hover:shadow-orange-100 transition-all flex items-center gap-4 active:scale-95"
                  >
                     <i className="fa-solid fa-plus-circle text-lg"></i> Anexar Ofício de Resposta
                  </button>
                )}
                {readOnly && (
                  <div className="px-12 py-5 bg-indigo-50 text-indigo-600 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest border border-indigo-100 flex items-center gap-3">
                    <i className="fa-solid fa-circle-info"></i>
                    Consulta de Dados Finalizados
                  </div>
                )}
             </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 font-sans animate-in fade-in duration-300 overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
      
      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
             <div className="flex items-center justify-between mb-10">
                <div>
                   <h3 className="text-2xl font-black text-[#004080] uppercase tracking-tight">Histórico de Versões do Estudo</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                     <i className="fa-solid fa-folder-tree text-orange-500"></i> Rastreabilidade completa de revisões e anexos
                   </p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm">
                   <i className="fa-solid fa-xmark text-xl"></i>
                </button>
             </div>
             
             <div className="flex-grow overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                {revisionHistory.length === 0 ? (
                  <div className="text-center py-24 flex flex-col items-center">
                     <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-slate-100">
                        <i className="fa-solid fa-history text-3xl"></i>
                     </div>
                     <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Nenhuma versão anterior cadastrada.</p>
                  </div>
                ) : (
                  revisionHistory.map((h) => (
                    <div key={h.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between group hover:bg-white hover:border-indigo-100 hover:shadow-xl transition-all border-l-8 border-l-indigo-500">
                       <div className="flex items-center gap-8">
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm font-black text-xs border border-indigo-50 uppercase">{getFO(h.formType)}</div>
                          <div>
                             <p className="text-sm font-black text-[#004080] uppercase tracking-widest">{h.studyNumber}</p>
                             <div className="flex gap-4 mt-1.5">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><i className="fa-solid fa-calendar text-[8px]"></i> {formatDateTimeBR(h.requestDate)}</p>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest flex items-center gap-1.5"><i className="fa-solid fa-tag text-[8px]"></i> {h.status}</p>
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="text-right border-r border-slate-200 pr-6 mr-2">
                             <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mb-1">Arquivos vinculados</p>
                             <div className="flex justify-end gap-1">
                                <span className="text-xs font-black text-[#004080]">{((h.selectedFiles?.length || 0) + (Object.values(h.categorizedFiles || {}).flat().length)).toString()}</span>
                                <i className="fa-solid fa-paperclip text-[10px] text-slate-300 mt-1"></i>
                             </div>
                          </div>
                           <div className="flex items-center gap-3">
                              <button onClick={() => setPreviewStudy(h)} className="px-6 py-3 bg-white border border-slate-200 text-[#004080] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#004080] hover:text-white transition-all shadow-sm">
                                 Resumo
                              </button>
                              <button onClick={() => setBrowsingRevision(h)} className="px-6 py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2">
                                 <i className="fa-solid fa-folder-open"></i> Ver Arquivos
                              </button>
                           </div>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewStudy && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-5xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-slate-50 px-10 py-6 border-b border-slate-200 flex items-center justify-between">
                 <div>
                    <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight">Visualizando: {previewStudy.studyNumber}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Modo de Somente Leitura • Versão Histórica</p>
                 </div>
                 <button onClick={() => setPreviewStudy(null)} className="w-12 h-12 rounded-2xl bg-white text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm border border-slate-100 transition-all">
                    <i className="fa-solid fa-xmark text-lg"></i>
                 </button>
              </div>
              <div className="flex-grow overflow-y-auto p-10 custom-scrollbar space-y-10">
                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b pb-2">Identificação Principal</h4>
                       <div className="grid grid-cols-2 gap-4">
                          {renderTechnicalField('Solicitante', previewStudy.requesterName)}
                          {renderTechnicalField('Data', formatDateTimeBR(previewStudy.requestDate))}
                          <div className="col-span-2">
                             {renderTechnicalField('Título do Estudo', previewStudy.studyTitle || previewStudy.clientName || previewStudy.uteName)}
                          </div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b pb-2">Localização</h4>
                       <div className="grid grid-cols-2 gap-4">
                          {renderTechnicalField('Município', previewStudy.city)}
                          {renderTechnicalField('Bairro', previewStudy.neighborhood)}
                          <div className="col-span-2">
                             {renderTechnicalField('Endereço', previewStudy.address)}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b pb-2">Dados Técnicos da Versão</h4>
                    {renderCargaTable(previewStudy)}
                 </div>

                 <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b pb-2">Anexos desta Versão</h4>
                    {previewStudy.selectedFiles && previewStudy.selectedFiles.length > 0 ? (
                       <div className="grid grid-cols-3 gap-4">
                          {previewStudy.selectedFiles.map((f, idx) => (
                             <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 group">
                                <div className="flex items-center gap-3 min-w-0">
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm border border-slate-50">
                                      <i className="fa-solid fa-file-pdf"></i>
                                   </div>
                                   <div className="min-w-0">
                                      <p className="text-[10px] font-bold text-slate-700 truncate">{f.name}</p>
                                      <p className="text-[8px] font-black text-slate-400 uppercase">{(f.size / 1024).toFixed(0)} KB</p>
                                   </div>
                                </div>
                                <button 
                                  onClick={() => handleDownloadFile(f)}
                                  className="w-8 h-8 bg-white border border-slate-100 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100"
                                  title="Visualizar / Baixar"
                                >
                                  <i className="fa-solid fa-download text-[10px]"></i>
                                </button>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <p className="text-xs italic text-slate-400">Nenhum anexo registrado nesta versão.</p>
                    )}
                 </div>

                 <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest border-b pb-2">Observações da Época</h4>
                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 text-xs italic text-slate-500 leading-relaxed">
                       {previewStudy.comments || "Sem observações registradas nesta versão."}
                    </div>
                 </div>
              </div>
              <div className="bg-slate-50 px-10 py-6 border-t border-slate-200 flex justify-end">
                 <button onClick={() => setPreviewStudy(null)} className="px-10 py-3 bg-[#004080] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-blue-100">
                    Fechar Prévia
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {filePreview && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-black text-[#004080]">{filePreview.name}</h4>
                <p className="text-[10px] text-slate-400 uppercase">Visualização</p>
              </div>
              <button onClick={() => setFilePreview(null)} className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-grow overflow-auto bg-slate-50 p-4 flex items-center justify-center">
              {filePreview.mime?.startsWith('image/') ? (
                // Image preview
                <img src={`data:${filePreview.mime};base64,${filePreview.base64}`} alt={filePreview.name} className="max-w-full max-h-[80vh] object-contain" />
              ) : filePreview.mime === 'application/pdf' ? (
                // PDF preview
                <iframe title={filePreview.name} src={`data:application/pdf;base64,${filePreview.base64}`} className="w-full h-[80vh] border-0"></iframe>
              ) : (
                // Text or unknown: render as text
                <div className="max-w-full max-h-[80vh] overflow-auto bg-white p-4 rounded-lg border border-slate-100 text-sm">
                  <pre className="whitespace-pre-wrap break-words text-xs">{atob(filePreview.base64)}</pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 text-right">
              <a href={`data:${filePreview.mime};base64,${filePreview.base64}`} download={filePreview.name} className="px-4 py-2 bg-[#004080] text-white rounded-lg font-black text-xs">Download</a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-xl font-black text-[#004080] text-center uppercase tracking-tight mb-3">Interromper Execução</h3>
            <p className="text-slate-500 text-center text-sm mb-10 leading-relaxed font-medium">Todos os arquivos temporários e o tempo de execução registrados nesta sessão serão descartados permanentemente. Confirmar?</p>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setShowCancelModal(false)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all active:scale-95">Manter Ativo</button>
               <button onClick={() => { setShowCancelModal(false); onBack(); }} className="py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95">Sim, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONCLUIR */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h3 className="text-xl font-black text-[#004080] text-center uppercase tracking-tight mb-3">Conclusão de Estudo</h3>
            <p className="text-slate-500 text-center text-sm mb-4 leading-relaxed font-medium">Tempo de realização monitorado: <span className="font-black text-[#004080] underline">{formatTime(elapsedTime)}</span>.</p>
            <p className="text-[10px] text-slate-400 text-center mb-10 uppercase font-black tracking-widest">Enviar para o Controle de Qualidade agora?</p>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setShowFinishModal(false)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all active:scale-95">Revisar</button>
               <button onClick={handleFinishStudy} className="py-4 bg-[#004080] text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 hover:bg-indigo-600 transition-all active:scale-95">Sim, Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER FIXO */}
      <div className="bg-white px-8 py-6 flex items-center border-b border-slate-200 shadow-sm z-10">
        <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-[#004080] hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        
        <div className="ml-8 flex items-center gap-6">
           <div>
             <div className="flex items-center gap-3">
               <h2 className="text-xl font-black text-[#004080] uppercase tracking-tight">{data.studyNumber || 'PROV-APR'}</h2>
               <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-100">{getFO(data.formType)}</span>
             </div>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Centro de Engenharia e Planejamento • Naturgy SPS</p>
           </div>
        </div>

        <div className="flex-grow"></div>

        {!readOnly && (
          <div className="flex items-center gap-12 pr-12 border-r border-slate-100 mr-12">
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-2">Cronômetro de Execução Técnica</p>
              <p className={`text-2xl font-black font-mono tracking-widest transition-colors ${isPaused ? 'text-slate-200' : 'text-indigo-600'}`}>{formatTime(elapsedTime)}</p>
            </div>
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 transition-all ${isPaused ? 'bg-slate-50 text-slate-300 border-slate-100 shadow-inner' : 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-md animate-pulse'}`}>
              <i className={`fa-solid ${isPaused ? 'fa-pause' : 'fa-play'} text-2xl`}></i>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
           <button className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-[#004080] border border-slate-100 flex items-center justify-center transition-all font-black shadow-sm">?</button>
        </div>
      </div>

      <div className="flex-grow flex flex-col md:flex-row overflow-hidden bg-slate-50/20">
        {/* Sidebar Lateral - Compacted Width and Padding */}
        <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shrink-0 shadow-sm">
          <div className="space-y-2">
            {[
              { label: 'Análise Técnica', icon: 'fa-chart-network' }
            ].map((tab, idx) => (
              <button 
                key={tab.label} 
                onClick={() => setActiveTab(idx)} 
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all group ${activeTab === idx ? 'bg-[#004080] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${tab.icon} text-xs transition-transform ${activeTab === idx ? 'scale-110' : ''}`}></i>
                  <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
                </div>
                <i className={`fa-solid fa-chevron-right text-[8px] transition-all ${activeTab === idx ? 'translate-x-1 opacity-100' : 'opacity-0'}`}></i>
              </button>
            ))}
          </div>
          
          <div className="flex-grow flex flex-col min-h-0">
             <h5 className="px-3 text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
               <i className="fa-solid fa-folder-open text-[8px]"></i> Pastas
             </h5>
             <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {['Solicitacao', 'Resposta', 'Calculos', 'Outros'].map(t => (
                  <div 
                    key={t} 
                    className={`group w-full p-1 rounded-xl flex items-center gap-1 transition-all ${activeFolder === t ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <button 
                      onClick={() => setActiveFolder(t)}
                      className={`flex-grow p-2 rounded-lg flex items-center justify-between text-[11px] font-black uppercase tracking-widest transition-all ${activeFolder === t ? 'text-orange-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                    >
                      <div className="flex items-center gap-3">
                        <i className={`fa-solid fa-folder${activeFolder === t ? '-open text-orange-400' : ''} text-base`}></i>
                        {t}
                      </div>
                    </button>
                    
                    <div className="flex items-center gap-1 pr-2">
                      
                      {activeFolder === t && !readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); handleAttachFile(); }} className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-orange-500 shadow-sm hover:scale-110 border border-slate-100 transition-all active:scale-95" title="Anexar arquivo">
                          <i className="fa-solid fa-plus-circle text-[10px]"></i>
                        </button>
                      )}
                    </div>
                  </div>
               ))}
             </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-inner">
             <div className="flex items-center justify-between mb-3">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Arquivos em: <span className="text-indigo-600">{activeFolder}</span></span>
               <span className="text-[8px] font-black text-slate-300 bg-white px-1.5 py-0.5 rounded-full shadow-sm">{getFilesForActiveFolder().length}</span>
             </div>
             <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {getFilesForActiveFolder().map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-50 group hover:border-indigo-100 transition-all">
                    <div className="w-6 h-6 rounded bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-file-pdf text-[8px]"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-700 font-bold truncate group-hover:text-indigo-600">{f.name}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <button 
                         onClick={async () => {
                           if (f.isVirtual && f.virtualType === 'official-form') {
                             const fileName = `Formulário - ${data.studyNumber}.pdf`;
                             const path = `Solicitacoes_APR/${new Date().getFullYear()}/${data.studyNumber.replace('PROV-', '').split('-REV')[0]}/${data.studyNumber.includes('-REV') ? 'REV' + data.studyNumber.split('-REV')[1] : 'REV0'}/Solicitacao/${fileName}`;
                             const url = await StorageService.getFileUrl(path);
                             if (url) {
                               const link = document.createElement('a');
                               link.href = url;
                               link.download = fileName;
                               link.click();
                             } else {
                               alert('Erro ao buscar o arquivo do formulário para download.');
                             }
                           } else {
                             handleDownloadFile(f);
                           }
                         }} 
                         className="px-2 py-1 bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-widest rounded-lg text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1"
                      >
                        <i className="fa-solid fa-download text-[8px]"></i>
                        Baixar
                      </button>
                      
                      <button 
                        onClick={async () => {
                          if (f.isVirtual && f.virtualType === 'official-form') {
                             const fileName = `Formulário - ${data.studyNumber}.pdf`;
                             const path = `Solicitacoes_APR/${new Date().getFullYear()}/${data.studyNumber.replace('PROV-', '').split('-REV')[0]}/${data.studyNumber.includes('-REV') ? 'REV' + data.studyNumber.split('-REV')[1] : 'REV0'}/Solicitacao/${fileName}`;
                             const url = await StorageService.getFileUrl(path);
                             if (url) {
                               window.open(url, '_blank');
                             } else {
                               alert('Erro ao buscar o arquivo do formulário para visualização.');
                             }
                          } else {
                             handleViewFile(f);
                          }
                        }} 
                        className="w-7 h-7 bg-[#004080] text-white rounded-lg flex items-center justify-center shadow-sm hover:bg-blue-700 transition-all active:scale-90"
                        title="Visualizar"
                      >
                        <i className="fa-solid fa-eye text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {getFilesForActiveFolder().length === 0 && <span className="text-[9px] text-slate-300 italic block py-4 text-center">Vazio</span>}
             </div>
          </div>
        </div>

        {/* Área Central de Trabalho */}
        <div className="flex-grow p-10 overflow-hidden flex flex-col min-w-0">
          {renderTabContent()}
        </div>
      </div>

      {/* RODAPÉ DE CONTROLE PRINCIPAL */}
      <div className="bg-white border-t border-slate-200 px-10 py-5 flex items-center justify-between shadow-2xl z-20">
        {!readOnly ? (
          <>
            <div className="flex gap-4">
               <button 
                 onClick={handlePauseToggle} 
                 className={`px-8 py-4 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg ${isPaused ? 'bg-orange-500 text-white border-orange-400 shadow-orange-100' : 'bg-white text-orange-600 border border-orange-100 hover:bg-orange-50'}`}
               >
                 <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-sm`}></i>
                 {isPaused ? 'Retomar' : 'Pausar'}
               </button>
               
               <button 
                 onClick={() => setShowCancelModal(true)} 
                 className="px-8 py-4 bg-white text-red-500 border border-red-100 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest hover:bg-red-50 transition-all active:scale-95 shadow-lg flex items-center gap-3"
               >
                 <i className="fa-solid fa-ban text-sm"></i>
                 Cancelar
               </button>
            </div>

            <button 
               onClick={() => setShowFinishModal(true)}
               className="px-20 py-5 bg-[#004080] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.1em] shadow-2xl shadow-blue-100 hover:bg-indigo-600 transition-all active:translate-y-0.5 flex items-center gap-5"
            >
               <i className="fa-solid fa-check-double text-green-400 text-lg"></i>
               Concluir Estudo Técnico
            </button>
          </>
        ) : (
          <div className="flex items-center gap-4">
             <div className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest border border-indigo-100 flex items-center gap-3">
                <i className="fa-solid fa-eye text-sm"></i>
                Modo de Visualização Técnica
             </div>
             {data.completedAt && (
               <div className="px-6 py-3 bg-green-50 text-green-600 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest border border-green-100">
                 Concluído em: {formatDateTimeBR(data.completedAt)}
               </div>
             )}
          </div>
        )}

        <div className="hidden lg:block text-right">
           <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.1em] leading-none mb-1.5">Technical Workflow Manager</p>
           <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest opacity-50">SPS Region • Live Monitor 2.5</p>
        </div>
      </div>
      {browsingRevision && (
        <FileBrowserModal 
          request={browsingRevision} 
          user={{} as any} // User is not directly available here, but modal only needs it for role checks
          allRequests={allRequests}
          onClose={() => setBrowsingRevision(null)}
        />
      )}
    </div>
  );
};
