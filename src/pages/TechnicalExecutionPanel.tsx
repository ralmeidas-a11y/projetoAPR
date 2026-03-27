
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StudyStatus, FormData, User, UserRole, FormType, InterconnectionPoint, PlannedExtension } from '../types/types';
import { formatDateTimeBR } from '../utils/utils';
import { StorageService } from '../services/storage';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { QCControlModal } from '../components/QCControlModal';
import { useDialog } from '../components/AppDialog';
import { NETWORK_GROUPS, PRESSURE_BASES, STANDARDIZED_CONDITIONS_BLOCKS } from '../constants/constants';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TechnicalExecutionPanelProps {
  data: FormData;
  allRequests?: FormData[];
  onBack: () => void;
  onStatusUpdate: (id: string, status: StudyStatus, reason?: string, assignedTo?: string, additionalData?: Partial<FormData>) => void;
  onUpdateData?: (updatedData: FormData) => void;
  allUsers?: User[];
  currentUser?: User;
  readOnly?: boolean;
}

export const TechnicalExecutionPanel: React.FC<TechnicalExecutionPanelProps> = ({ data, allRequests = [], allUsers = [], currentUser, onBack, onStatusUpdate, onUpdateData, readOnly = false }) => {
  const { showToast, showAlert, showConfirm } = useDialog();
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

  const [selectedStandardized, setSelectedStandardized] = useState<string | null>(null);
  const [selectedResponseObservation, setSelectedResponseObservation] = useState<string | null>(null);
  const [newCondInput, setNewCondInput] = useState('');
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  const [editingObsIdx, setEditingObsIdx] = useState<number | null>(null);
  const [editingObsValue, setEditingObsValue] = useState('');
  const [showCartaPreview, setShowCartaPreview] = useState(false);

  const [fillingModal, setFillingModal] = useState<{
    queue: string[];
    index: number;
    currentItem: string;
    vars: string[];
    values: Record<string, string>;
  } | null>(null);

  const [calcMode, setCalcMode] = useState<'auto' | 'manual'>('auto');
  const [manualCalc, setManualCalc] = useState({
    totalClients: 0,
    unitFlow: 0.09,
    penetration: 1,
    diversification: 1
  });

  const [isExportingCarta, setIsExportingCarta] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdInfo, setHoldInfo] = useState('');
  const cartaRef = useRef<HTMLDivElement>(null);
  const hiddenCartaRef = useRef<HTMLDivElement>(null);

  const getDiversificationFactor = (total: number) => {
    if (total <= 0) return 0;
    if (total < 100) return 1.00;
    if (total < 250) return 0.88;
    if (total < 500) return 0.82;
    if (total < 750) return 0.75;
    if (total < 1000) return 0.63;
    if (total < 2000) return 0.56;
    if (total < 3000) return 0.50;
    return 0.47;
  };

  const responseObsList = useMemo(() =>
    (data.responseObservations || '').split('\n').filter(l => l.trim() !== ''),
    [data.responseObservations]
  );

  const previousStudyObs = useMemo(() => {
    if (!data.previousStudy || !allRequests) return [];
    const prev = allRequests.find(r => r.studyNumber === data.previousStudy);
    if (!prev || !prev.responseObservations) return [];
    return prev.responseObservations.split('\n').filter(l => l.trim() !== '');
  }, [data.previousStudy, allRequests]);

  const availableBlocks = useMemo(() => {
    const blocks = Object.entries(STANDARDIZED_CONDITIONS_BLOCKS).map(([id, block]) => ({
      id,
      ...block,
      availableItens: block.itens.filter(item => !responseObsList.includes(item))
    }));

    // Insert dynamic block between Bloco 6 and 7
    const idx6 = blocks.findIndex(b => b.id === 'Bloco 6');
    const prevBlock = {
      id: 'PrevRevision',
      descricao: 'Observações da Revisão Anterior',
      itens: previousStudyObs,
      availableItens: previousStudyObs.filter(item => !responseObsList.includes(item))
    };

    if (idx6 !== -1) {
      blocks.splice(idx6 + 1, 0, prevBlock);
    } else {
      blocks.push(prevBlock);
    }

    return blocks.filter(b => b.itens.length > 0 || b.id === 'PrevRevision');
  }, [responseObsList, previousStudyObs]);

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev =>
      prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]
    );
  };

  // Helper to add multiple items at once
  const handleUpdateResponseObs = (newList: string[]) => {
    if (!onUpdateData) return;
    onUpdateData({ ...data, responseObservations: newList.join('\n') });
  };

  const extractVars = (text: string) => {
    const matches = text.match(/\[(.*?)\]/g);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const handleAddCondition = (cond?: string) => {
    const toAdd = cond || selectedStandardized || '';
    if (!toAdd || !onUpdateData) return;
    if (responseObsList.includes(toAdd)) return;

    const vars = extractVars(toAdd);
    if (vars.length > 0) {
      setFillingModal({
        queue: [],
        index: 0,
        currentItem: toAdd,
        vars,
        values: {}
      });
    } else {
      handleUpdateResponseObs([...responseObsList, toAdd]);
      if (toAdd === selectedStandardized) setSelectedStandardized(null);
    }
  };

  const handleAddBlock = (itens: string[]) => {
    if (!onUpdateData) return;
    const newItens = itens.filter(item => !responseObsList.includes(item));
    if (newItens.length === 0) return;

    const withVars = newItens.filter(item => extractVars(item).length > 0);
    const withoutVars = newItens.filter(item => extractVars(item).length === 0);

    // Add those without vars immediately
    if (withoutVars.length > 0) {
      handleUpdateResponseObs([...responseObsList, ...withoutVars]);
    }

    // Queue those with vars
    if (withVars.length > 0) {
      setFillingModal({
        queue: withVars,
        index: 0,
        currentItem: withVars[0],
        vars: extractVars(withVars[0]),
        values: {}
      });
    }
  };

  const handleConfirmFilling = () => {
    if (!fillingModal) return;

    // Replace all vars in current item
    let finalized = fillingModal.currentItem;
    Object.entries(fillingModal.values).forEach(([placeholder, val]) => {
      finalized = finalized.split(placeholder).join(val || placeholder);
    });

    const newList = [...responseObsList, finalized];
    handleUpdateResponseObs(newList);

    // Process next in queue
    const nextIdx = fillingModal.index + 1;
    if (fillingModal.queue && nextIdx < fillingModal.queue.length) {
      const nextItem = fillingModal.queue[nextIdx];
      setFillingModal({
        ...fillingModal,
        index: nextIdx,
        currentItem: nextItem,
        vars: extractVars(nextItem),
        values: {}
      });
    } else {
      setFillingModal(null);
    }
  };

  const handleRemoveCondition = (cond?: string) => {
    const toRemove = cond || selectedResponseObservation || '';
    if (!toRemove || !onUpdateData) return;
    const newList = responseObsList.filter(l => l !== toRemove);
    handleUpdateResponseObs(newList);
    if (toRemove === selectedResponseObservation) setSelectedResponseObservation(null);
    setEditingObsIdx(null);
  };

  const handleJustifyPreQC = async () => {
    if (readOnly || !onStatusUpdate) return;

    const confirm = await showConfirm(
      'Confirmar Envio Antecipado?',
      'Esta ação enviará a resposta ao solicitante e uma justificativa ao sistema PRGC informando que o envio foi feito antes do Controle de Qualidade devido ao prazo. O estudo ainda passará pelo processo de CQ posteriormente.'
    );

    if (confirm) {
      onStatusUpdate(data.id, StudyStatus.ENVIADO_SEM_CQ);
      showToast('Envio antecipado processado com sucesso!', 'success');
      onBack();
    }
  };

  const handleStartEditing = (idx: number, value: string) => {
    if (readOnly) return;
    setEditingObsIdx(idx);
    setEditingObsValue(value);
  };

  const handleSaveEdit = () => {
    if (editingObsIdx === null || !onUpdateData) return;
    const newList = [...responseObsList];
    newList[editingObsIdx] = editingObsValue;
    handleUpdateResponseObs(newList);
    setEditingObsIdx(null);
  };

  const formatCurrency = (val: any) => {
    const n = Number(val);
    if (isNaN(n)) return '0,00';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const handleExportCartaPDF = async (fromPreview: boolean = false) => {
    setIsExportingCarta(true);

    // Pequeno delay para garantir que o estado reativo assentou
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      let activeRequest = data;
      if (!data.cartaGeneratedAt && onUpdateData) {
        const now = new Date().toISOString();
        activeRequest = { ...data, cartaGeneratedAt: now };
        onUpdateData(activeRequest);

        // Ensure immediate database persistence for metadata
        await StorageService.addRequest(activeRequest);

        // Tempo para o estado persistir antes da captura
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Usamos o elemento oculto dedicado que está SEMPRE no DOM
      const target = hiddenCartaRef.current;
      if (!target) {
        // Fallback para o preview se o oculto falhar por algum motivo
        const previewTarget = cartaRef.current;
        if (!previewTarget) throw new Error('Alvo de captura não encontrado (Normal ou Preview)');
        const canvas = await html2canvas(previewTarget, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          allowTaint: true,
          windowWidth: 1200,
          scrollX: 0,
          scrollY: 0
        });
        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        await StorageService.uploadCartaResposta(activeRequest, pdf.output('blob'));
      } else {
        const canvas = await html2canvas(target, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          allowTaint: true,
          windowWidth: 1200,
          scrollX: 0,
          scrollY: 0
        });
        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        await StorageService.uploadCartaResposta(activeRequest, pdf.output('blob'));
      }

      showToast('Carta Resposta salva com sucesso!', 'success');
      if (activeFolder === 'Resposta') {
        const files = await StorageService.getRequestFiles(data.studyNumber, 'Resposta');
        setSupabaseFiles(files.filter((f: any) => f.name !== '.keep'));
      } else {
        setActiveFolder('Resposta');
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast('Erro ao exportar PDF.', 'error');
    } finally {
      setIsExportingCarta(false);
    }
  };

  const renderCartaPaper = (reference: React.RefObject<HTMLDivElement>) => {
    const docDate = data.cartaGeneratedAt || data.completedAt || new Date().toISOString();
    const validUntilDate = (() => {
      const d = new Date(docDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toLocaleDateString('pt-BR');
    })();

    return (
      <div
        ref={reference}
        className="bg-white p-12 shadow-2xl relative flex flex-col min-h-[1122px] w-[794px] overflow-hidden shrink-0 mb-20 mt-4"
        style={{ fontVariantLigatures: 'none' }}
      >
        <div className="absolute left-[-352px] top-[700px] -translate-y-1/2 -rotate-90 w-[800px] flex justify-center items-end h-10">
          <span className="text-[11px] font-black text-[#004080] uppercase tracking-[1em] select-none whitespace-nowrap leading-none">
            PE.05306-FO.06 Rev.01/23.11 • Resposta de Estudo de Rede
          </span>
        </div>

        <div className="flex justify-between items-start mb-8 ml-10">
          <div className="flex flex-col">
            <span className="text-[14px] font-black text-slate-900 tracking-tight">{data.studyNumber?.replace('PROV-', '')}</span>
            <span className="text-[14px] font-black text-[#004080] uppercase mt-1 tracking-tight">GEGAT - Análise e Planificação da Rede</span>
          </div>
          <div className="flex flex-col items-end">
            <img src="/logo.png" alt="Naturgy" className="h-28 object-contain mb-1" />
          </div>
        </div>

        <div className="ml-10 space-y-4 flex-grow flex flex-col">
          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-0.5 border-b border-black">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Dados da Solicitação:</span>
            </div>
            <div className="p-3">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }} className="text-[11px] leading-tight font-medium text-slate-800">
                <tbody>
                  <tr>
                    <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Área:</span> <span className="whitespace-normal break-words">{data.requesterArea || '-'}</span>
                    </td>
                    <td rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: '#dc2626', color: 'white', fontWeight: '900', fontSize: '10px', border: '1px solid black', height: '36px' }}>
                      Estudo Válido até: {validUntilDate}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Solicitante:</span> <span className="whitespace-normal break-words">{data.requesterName || '-'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ width: '40%', verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Mercado:</span> <span className="whitespace-normal break-words">{data.studySubType || '-'}</span>
                    </td>
                    <td style={{ width: '26%', verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Data:</span> {new Date(docDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ width: '34%', verticalAlign: 'top', paddingBottom: '2px', paddingLeft: '8px' }}>
                      <span className="font-black">Código Estudo:</span> {data.studyNumber?.replace('PROV-', '') || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Cliente:</span> <span className="whitespace-normal break-words">{data.clientName || data.studyTitle || '-'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                      <span className="font-black">Município:</span> <span className="whitespace-normal break-words">{data.city || '-'}</span>
                    </td>
                    <td style={{ verticalAlign: 'top', paddingBottom: '2px', paddingLeft: '8px' }}>
                      <span className="font-black">Bairro:</span> <span className="whitespace-normal break-words">{data.neighborhood || '-'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-2 p-3 bg-slate-50 border border-black rounded shadow-inner min-h-[60px]">
                <span className="font-black uppercase text-[9px] text-slate-400 mb-1 block">Localização:</span>
                <span className="text-[11px] leading-tight whitespace-normal break-words block">{data.address || '-'}</span>
              </div>

              <div className="col-span-12 mt-3 border border-black">
                <table className="w-full text-center divide-y divide-black divide-x border-collapse text-[10px] font-black table-auto">
                  <thead className="bg-[#f0f0f0]">
                    <tr className="divide-x divide-black">
                      <th className="w-1/3 py-1 text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Clientes Residenciais</th>
                      <th className="w-1/3 py-1 text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Clientes Comerciais</th>
                      <th className="py-1 text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Vazão Total Informada m³/h</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    <tr className="divide-x divide-black h-8 text-center" style={{ textAlign: 'center' }}>
                      <td className="p-0" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid black' }}>{data.numClientsRes || '0'}</td>
                              <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'middle' }}>{formatCurrency(data.totalFlowRes)} m³/h</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td className="p-0" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid black' }}>{data.numClientsCom || '0'}</td>
                              <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'middle' }}>{formatCurrency(data.totalFlowCom)} m³/h</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td className="py-1" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        {formatCurrency((Number(data.totalFlowRes) || 0) + (Number(data.totalFlowCom) || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-0.5 border-b border-black">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Redes Dimensionadas:</span>
            </div>
            <div className="p-0">
              <table className="w-full text-center border-collapse text-[8px] font-black table-auto">
                <thead className="bg-white border-b border-black">
                  <tr className="divide-x divide-black uppercase">
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Extensão (m)</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Ø (mm)</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Material</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Pressão</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Gás</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Válvulas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black bg-blue-50/30">
                    <td colSpan={6} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px 0' }} className="text-center font-black uppercase text-[7px] text-blue-700 tracking-tighter">
                      {data.plannedExtensions?.[0]?.networkType || data.networkDescription || 'Rede Externa'}
                    </td>
                  </tr>
                  {(data.plannedExtensions && data.plannedExtensions.length > 0) ? data.plannedExtensions.map((ext, idx) => (
                    <tr key={idx} className="divide-x divide-black uppercase border-b border-black/10 text-center" style={{ textAlign: 'center' }}>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.extension}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.diameter}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.material}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.pressure}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.gasType}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.valves}</td>
                    </tr>
                  )) : (
                    <tr className="divide-x divide-black"><td colSpan={6} className="p-2"></td></tr>
                  )}
                  {Array.from({ length: Math.max(0, 10 - (data.plannedExtensions?.length || 0)) }).map((_, i) => (
                    <tr key={`fake-${i}`} className="divide-x divide-black">
                      <td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-black flex h-8 items-center text-[10px] font-black">
            <div className="bg-slate-200 h-full flex items-center px-4 border-r border-black shrink-0">
              <span className="uppercase text-slate-800">Pressões Normativas:</span>
            </div>
            <div className="flex-grow flex justify-around px-8">
              <span>Máx.: {data.responseMaxPo ?? ' - '} bar</span>
              <span>Min.: {data.responseMin ?? ' - '} bar</span>
              <span>Garantia: {data.responseGarantia ?? ' - '} bar</span>
            </div>
          </div>

          <div className="border border-black min-h-[140px]">
            <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Pontos de Interligações:</span>
            </div>
            <div className="p-4 flex flex-col gap-2 text-[10px] font-medium text-slate-700 leading-snug">
              {(data.interconnectionPoints && data.interconnectionPoints.length > 0) ? data.interconnectionPoints.map((p, i) => (
                <div key={i} className="whitespace-normal break-words">
                  • Rede {p.pressure} Ø {p.diameter} {p.material}, {p.location || 'Local a confirmar'}, {p.comment}.
                </div>
              )) : (
                <span className="italic text-slate-300">Conforme indicado em projeto / croqui.</span>
              )}
            </div>
          </div>

          <div className="border border-black min-h-[200px] flex flex-col">
            <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Condições e Observações:</span>
            </div>
            <div className="p-6 flex flex-col gap-1 text-[9px] font-bold text-red-500 italic leading-normal whitespace-pre-wrap">
              {(data.responseObservations || '').split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0">{i + 1}-)</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-grow"></div>

          <div className="pt-8 flex justify-around items-end">
            <div className="flex flex-col items-center">
              <div className="w-56 border-t border-black mb-1"></div>
              <span className="text-[10px] font-black text-slate-900 uppercase">
                {(data.analystName || (data.assignedTo === currentUser?.id || data.assignedTo?.toLowerCase() === currentUser?.email.toLowerCase() ? currentUser?.name : allUsers.find(u => u.id === data.assignedTo || u.email.toLowerCase() === data.assignedTo?.toLowerCase())?.name) || 'Responsável Técnico').toUpperCase()}
              </span>
              <span className="text-[7px] font-bold text-slate-900 uppercase tracking-tighter text-center">
                {data.analystCompany || (data.assignedTo === currentUser?.id || data.assignedTo?.toLowerCase() === currentUser?.email.toLowerCase() ? currentUser?.company : allUsers.find(u => u.id === data.assignedTo || u.email.toLowerCase() === data.assignedTo?.toLowerCase())?.company) || 'Empresa'} - {data.analystRole || (data.assignedTo === currentUser?.id || data.assignedTo?.toLowerCase() === currentUser?.email.toLowerCase() ? currentUser?.roleDescription : allUsers.find(u => u.id === data.assignedTo || u.email.toLowerCase() === data.assignedTo?.toLowerCase())?.roleDescription) || 'Cargo'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-56 border-t border-black mb-1"></div>
              <span className="text-[10px] font-black text-slate-900 uppercase">Ricardo Solon</span>
              <span className="text-[7px] font-bold text-slate-900 uppercase tracking-tighter text-center">Chefe da Análise e Planificação da Rede</span>
            </div>
          </div>

          <div className="pt-10 flex flex-col items-end gap-1 mt-4">
            <p className="text-[8px] font-black text-black uppercase tracking-widest text-right italic">
              {`Documento gerado eletronicamete pelo usuário "${data.analystGB || (data.assignedTo === currentUser?.id || data.assignedTo?.toLowerCase() === currentUser?.email.toLowerCase() ? currentUser?.gb : allUsers.find(u => u.id === data.assignedTo || u.email.toLowerCase() === data.assignedTo?.toLowerCase())?.gb) || 'SISTEMA'}" em ${new Date(docDate).toLocaleDateString('pt-BR')} às ${new Date(docDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCartaPreviewModal = () => {
    if (!showCartaPreview) return null;
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[98vh] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
          <div className="p-6 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <i className="fa-solid fa-file-pdf"></i>
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#004080] uppercase tracking-tight">Prévia da Carta Resposta</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visualização Técnica</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={isExportingCarta}
                onClick={async () => await handleExportCartaPDF(true)}
                className={`flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 ${isExportingCarta ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <i className={`fa-solid ${isExportingCarta ? 'fa-spinner fa-spin' : 'fa-file-export'}`}></i>
                {isExportingCarta ? 'Exportando...' : 'Exportar Carta'}
              </button>
              <button
                onClick={() => setShowCartaPreview(false)}
                className="px-6 py-2 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all border border-slate-200 active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 sm:p-12 bg-slate-300/50 flex flex-col items-center custom-scrollbar">
            {renderCartaPaper(cartaRef)}
          </div>
        </div>
      </div>
    );
  };

  const handleAddCustomCondition = () => {
    const trimmed = newCondInput.trim();
    if (!trimmed) return;
    if (!responseObsList.includes(trimmed)) {
      handleUpdateResponseObs([...responseObsList, trimmed]);
    }
    setNewCondInput('');
  };
  // Custom Constants for the new tables
  const MATERIALS = ["AC", "PE", "FF", "AG", "DV", "PA"];
  const DIAMETERS = ["19mm", "20mm", "25mm", "32mm", "38mm", "40mm", "50mm", "56mm", "63mm", "75mm", "90mm", "100mm", "110mm", "125mm", "140mm", "150mm", "160mm", "175mm", "200mm", "225mm", "250mm", "300mm", "315mm", "350mm", "400mm", "450mm", "500mm", "600mm", "700mm", "750mm"];
  const INTERCONNECTION_COMMENTS = ["Conforme indicado em croqui", "Rede em Frente"];
  const NETWORK_TYPES_EXT = ["Desconhecido", "Rede Externa", "Rede Interna", "Ramal"];
  const GAS_TYPES_EXT = ["GN", "GNC", "GNL", "GNS", "GLP"];
  const STATUS_EXT = ["Em Serviço", "Estudo (Abandonar)", "Estudo (Construir)", "Energizado"];

  // Row management for Interconnection Points
  const addInterconnectionPoint = () => {
    if (!onUpdateData) return;
    const newPoint: InterconnectionPoint = {
      id: crypto.randomUUID(),
      pressure: PRESSURE_BASES[0]?.base || 'MP-N',
      material: MATERIALS[1], // PE as default
      diameter: '63mm',
      location: '',
      comment: INTERCONNECTION_COMMENTS[0]
    };
    onUpdateData({
      ...data,
      interconnectionPoints: [...(data.interconnectionPoints || []), newPoint]
    });
  };

  const updateInterconnectionPoint = (id: string, field: keyof InterconnectionPoint, value: string) => {
    if (!onUpdateData) return;
    const updated = (data.interconnectionPoints || []).map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    onUpdateData({ ...data, interconnectionPoints: updated });
  };

  const removeInterconnectionPoint = (id: string) => {
    if (!onUpdateData) return;
    const filtered = (data.interconnectionPoints || []).filter(p => p.id !== id);
    onUpdateData({ ...data, interconnectionPoints: filtered });
  };

  // Row management for Planned Network Extensions
  const addPlannedExtension = () => {
    if (!onUpdateData) return;
    const newExt: PlannedExtension = {
      id: crypto.randomUUID(),
      material: MATERIALS[1], // PE as default
      diameter: '63mm',
      extension: '',
      networkType: NETWORK_TYPES_EXT[0], // Desconhecido
      valves: 0,
      pressure: 'MP',
      gasType: GAS_TYPES_EXT[0], // GN
      status: STATUS_EXT[2] // Estudo (Construir)
    };
    onUpdateData({
      ...data,
      plannedExtensions: [...(data.plannedExtensions || []), newExt]
    });
  };

  const updatePlannedExtension = (id: string, field: keyof PlannedExtension, value: any) => {
    if (!onUpdateData) return;
    const updated = (data.plannedExtensions || []).map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    onUpdateData({ ...data, plannedExtensions: updated });
  };

  const removePlannedExtension = (id: string) => {
    if (!onUpdateData) return;
    const filtered = (data.plannedExtensions || []).filter(p => p.id !== id);
    onUpdateData({ ...data, plannedExtensions: filtered });
  };

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
          const filtered = files.filter(f => f.name !== '.keep');
          setSupabaseFiles(filtered);
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

  const totalPlannedExtension = useMemo(() => {
    return (data.plannedExtensions || []).reduce((acc, current) => acc + (Number(current.extension) || 0), 0);
  }, [data.plannedExtensions]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFO = (type: string) => type.split('-').pop() || '';

  const isResidencial = data.studySubType?.toLowerCase() === 'residencial';
  const totalClientsAuto = Number(data.numClientsRes) || 0;
  const unitFlowAuto = 0.09;
  const penetrationAuto = 1;
  const diversificationAuto = getDiversificationFactor(totalClientsAuto);
  const totalFlowAuto = totalClientsAuto * unitFlowAuto * penetrationAuto * diversificationAuto;

  const currentCalc = calcMode === 'auto' ? {
    totalClients: totalClientsAuto,
    unitFlow: unitFlowAuto,
    penetration: penetrationAuto,
    diversification: diversificationAuto,
    totalFlow: totalFlowAuto
  } : {
    ...manualCalc,
    totalFlow: manualCalc.totalClients * manualCalc.unitFlow * manualCalc.penetration * manualCalc.diversification
  };

  const handleApplyAutoCalc = () => {
    if (!onUpdateData || readOnly) return;
    setCalcMode('auto');
    onUpdateData({
      ...data,
      totalFlowRes: totalFlowAuto
    });
  };

  const handleApplyManualCalc = () => {
    if (!onUpdateData || readOnly) return;
    const total = manualCalc.totalClients * manualCalc.unitFlow * manualCalc.penetration * manualCalc.diversification;
    onUpdateData({
      ...data,
      totalFlowRes: total
    });
  };

  const validateAnalysisFields = () => {
    const missingFields: string[] = [];

    if (!data.networkGroup) missingFields.push('Grupo Rede');
    if (!data.responsePressureBase) missingFields.push('Pressão Resposta');

    if (!data.interconnectionPoints || data.interconnectionPoints.length === 0) {
      missingFields.push('Pelo menos um Ponto de Interligação');
    }

    if (!data.plannedExtensions || data.plannedExtensions.length === 0) {
      missingFields.push('Pelo menos uma Extensão de Rede Planificada');
    }

    if (isResidencial && !data.totalFlowRes) {
      missingFields.push('Cálculo de Vazão Residencial (Aplicar)');
    }

    if (data.regSizingActive) {
      if (!data.regSizingFlow) missingFields.push('Vazão do Regulador');
      if (!data.regSizingCost) missingFields.push('Custo do Regulador');
      if (!data.regSizingInPress) missingFields.push('P. Entrada do Regulador');
      if (!data.regSizingOutPress) missingFields.push('P. Saída do Regulador');
      if (!data.regSizingFutureFlow) missingFields.push('Vazão Futura do Regulador');
    }

    if (!data.responseObservations || data.responseObservations.trim() === '') {
      missingFields.push('Observações Resposta');
    }

    return missingFields;
  };

  const handleTechSubTabChange = (idx: number) => {
    if (idx === 2) { // Passos Resposta
      const missing = validateAnalysisFields();
      if (missing.length > 0) {
        showAlert(
          `Para acessar a aba "Passos Resposta", preencha todos os campos obrigatórios da Análise:\n\n• ${missing.join('\n• ')}`,
          'Campos Obrigatórios Pendentes',
          'warning'
        );
        return;
      }
    }
    setActiveTechSubTab(idx);
  };

  const validateAllTechnicalFields = () => {
    return validateAnalysisFields();
  };

  const handleInitiateFinish = async () => {
    const missing = validateAllTechnicalFields();
    if (missing.length > 0) {
      const confirmed = await showConfirm(
        `Existem campos pendentes na análise técnica:\n\n• ${missing.join('\n• ')}\n\nDeseja prosseguir para a finalização mesmo assim?`,
        'Campos Incompletos'
      );
      if (!confirmed) return;
    }
    setShowFinishModal(true);
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
          showToast('Erro ao gerar link de visualização.', 'error');
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
        showToast('Este arquivo não possui conteúdo para visualização. Verifique a pasta local.', 'warning');
      }
    } catch (err) {
      console.warn('Erro ao visualizar arquivo:', err);
      showToast('Erro ao visualizar arquivo', 'error');
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
          showToast('Erro ao gerar link de download.', 'error');
        }
        return;
      }

      if (file.base64 && file.type) {
        const link = document.createElement('a');
        link.href = `data:${file.type};base64,${file.base64}`;
        link.download = file.name || 'documento';
        link.click();
      } else {
        showToast('Arquivo não disponível para download.', 'warning');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Erro ao baixar arquivo', 'error');
    }
  };

  const handleUpdateStatus = (status: StudyStatus, additional?: Partial<FormData>) => {
    const finalAdditional: Partial<FormData> = { ...additional };

    // Logic to prevent date inversion and improve persistence
    if (status === StudyStatus.EM_EXECUCAO) {
      finalAdditional.startedAt = data.startedAt || new Date().toISOString();
      finalAdditional.completedAt = undefined; // Force clear if starting execution
    } else if (status === StudyStatus.CONCLUIDO || status === StudyStatus.CONTROLE_QUALIDADE) {
      if (status === StudyStatus.CONCLUIDO) {
        finalAdditional.completedAt = new Date().toISOString();
      }

      // Auto-populate analyst info if assigned
      if (data.assignedTo) {
        const analyst = allUsers.find(u =>
          u.id === data.assignedTo ||
          u.email.toLowerCase() === data.assignedTo.toLowerCase()
        );
        if (analyst) {
          finalAdditional.analystCompany = analyst.company;
          finalAdditional.analystRole = analyst.roleDescription;
          finalAdditional.analystGB = analyst.gb;
        }
      }
    }

    onStatusUpdate(data.id || '', status, undefined, undefined, finalAdditional);
  };

  const handleFinishStudy = () => {
    // We pass totalExecutionTime via additionalData to avoid race conditions with onUpdateData
    handleUpdateStatus(StudyStatus.CONTROLE_QUALIDADE, { totalExecutionTime: elapsedTime });
    setShowFinishModal(false);
    onBack();
  };

  const handleFinalizeApproved = async () => {
    const confirmed = await showConfirm(
      'O estudo foi aprovado pelo Controle de Qualidade.\n\nDeseja concluir o estudo e enviar notificação ao solicitante?',
      'Concluir Estudo Aprovado'
    );
    if (!confirmed) return;
    handleUpdateStatus(StudyStatus.CONCLUIDO, { totalExecutionTime: elapsedTime });
    onBack();
  };


  const handlePauseToggle = () => setIsPaused(prev => !prev);

  const handleOpenHoldModal = () => {
    setHoldInfo('');
    setShowHoldModal(true);
  };

  const handleConfirmHold = () => {
    if (!holdInfo.trim()) return;
    onStatusUpdate(data.id || '', StudyStatus.AGUARDANDO_INFORMACAO, holdInfo, undefined, {
      totalExecutionTime: elapsedTime,
      holdRequestSeen: false
    });
    setShowHoldModal(false);
    onBack();
  };


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
    // Sempre usar os arquivos do Supabase Storage como fonte de verdade.
    // Os dados locais (data.selectedFiles / categorizedFiles) podem estar desatualizados.
    const storageFiles = supabaseFiles.filter(f => f.name !== '.keep');

    // Se o Storage ainda está sendo carregado, não mostrar nada (evita dados fantasmas)
    if (isLoadingFiles) return [];

    // Adicionar entrada virtual do formulário oficial se ele existir no storage
    const hasOfficialForm = storageFiles.some(f => f.name.startsWith('Formulario'));
    if (activeFolder === 'Solicitacao' && data.studyNumber && !hasOfficialForm) {
      // Não adicionar virtual se o storage já tem o formulário real
      // Se não tiver nenhum formulário, não inventar um virtual
    }

    return storageFiles;
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
              {/* Grupo Rede Selection */}
              <div className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Grupo Rede</span>
                {readOnly ? (
                  <span className="text-sm font-black text-slate-500">{data.networkGroup || '-'}</span>
                ) : (
                  <select
                    className="bg-transparent border-0 text-sm font-black text-[#004080] focus:ring-0 outline-none w-full cursor-pointer"
                    value={data.networkGroup !== undefined ? data.networkGroup : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        if (onUpdateData) onUpdateData({ ...data, networkGroup: undefined, networkDescription: '' });
                        return;
                      }
                      const code = parseInt(val);
                      const group = NETWORK_GROUPS.find(g => g.grupoRede === code);
                      if (onUpdateData) {
                        onUpdateData({
                          ...data,
                          networkGroup: code,
                          networkDescription: group?.descricao || ''
                        });
                      }
                    }}
                  >
                    <option value="">Selecione...</option>
                    {NETWORK_GROUPS.map(g => (
                      <option key={g.grupoRede} value={g.grupoRede}>
                        {g.grupoRede}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Descrição - Brought automatically from Grupo Rede */}
              <div className="col-span-2 flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Descrição</span>
                <span className="text-sm font-black text-[#004080] min-h-[20px]">
                  {data.networkDescription || (data.networkGroup !== undefined ? NETWORK_GROUPS.find(g => g.grupoRede === data.networkGroup)?.descricao : '-') || '-'}
                </span>
              </div>

              {renderTechnicalField('Estudo Anterior', data.previousStudy || '-')}
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-5 gap-2 text-center">
              {/* Pressão Resposta (Base Selection) */}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Pressão resposta</span>
                {readOnly ? (
                  <span className="text-xs font-black">{data.responsePressureBase || '-'}</span>
                ) : (
                  <select
                    className="bg-transparent border-0 text-xs font-black text-[#004080] focus:ring-0 outline-none p-0 h-auto text-center cursor-pointer"
                    value={data.responsePressureBase || ""}
                    onChange={(e) => {
                      const base = e.target.value;
                      if (!base) {
                        if (onUpdateData) onUpdateData({
                          ...data,
                          responsePressureBase: undefined,
                          responseMaxPo: undefined,
                          responseMin: undefined,
                          responseGarantia: undefined,
                          responseUnit: undefined
                        });
                        return;
                      }
                      const pressureObj = PRESSURE_BASES.find(p => p.base === base);
                      if (onUpdateData && pressureObj) {
                        onUpdateData({
                          ...data,
                          responsePressureBase: base,
                          responseMaxPo: pressureObj.pmax,
                          responseMin: pressureObj.pmin,
                          responseGarantia: pressureObj.pgarantia,
                          responseUnit: pressureObj.unidade
                        });
                      }
                    }}
                  >
                    <option value="">Sel...</option>
                    {PRESSURE_BASES.map(p => (
                      <option key={p.base} value={p.base}>{p.base}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* MaxPo */}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">MaxPo</span>
                <span className="text-xs font-black">
                  {data.responseMaxPo !== undefined ? `${data.responseMaxPo} ${data.responseUnit}` : '-'}
                </span>
              </div>

              {/* Min */}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Min</span>
                <span className="text-xs font-black">
                  {data.responseMin !== undefined ? `${data.responseMin} ${data.responseUnit}` : '-'}
                </span>
              </div>

              {/* Garantia */}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Garantia</span>
                <span className="text-xs font-black">
                  {data.responseGarantia !== undefined ? `${data.responseGarantia} ${data.responseUnit}` : '-'}
                </span>
              </div>

              {/* Pressão Calculada */}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Pressão Calculada</span>
                {readOnly ? (
                  <span className="text-xs font-black text-indigo-600">{data.responseCalculatedPressure || '-'}</span>
                ) : (
                  <input
                    type="text"
                    className="bg-transparent border-0 text-xs font-black text-indigo-600 focus:ring-0 outline-none p-0 h-auto text-center"
                    placeholder="-"
                    value={data.responseCalculatedPressure || ''}
                    onChange={(e) => {
                      if (onUpdateData) onUpdateData({ ...data, responseCalculatedPressure: e.target.value });
                    }}
                  />
                )}
              </div>
            </div>

            {/* SECTION: PONTO(S) DE INTERLIGAÇÃO(ÕES) */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080]">Ponto(s) de Interligação(ões)</h5>
              {!readOnly && (
                <button onClick={addInterconnectionPoint} className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1">
                  <i className="fa-solid fa-plus text-[8px]"></i> Adicionar Linha
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left bg-slate-50 rounded-xl overflow-hidden text-xs">
                <thead className="bg-[#004080] text-white">
                  <tr>
                    <th className="p-2 font-normal">Pressão</th>
                    <th className="p-2 font-normal">Material</th>
                    <th className="p-2 font-normal">Diâmetro</th>
                    <th className="p-2 font-normal">Ponto de interligação logradouro</th>
                    <th className="p-2 font-normal">Comentário</th>
                    {!readOnly && <th className="p-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white border border-slate-200">
                  {(!data.interconnectionPoints || data.interconnectionPoints.length === 0) && (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400 bg-white">Nenhum ponto de interligação adicionado.</td></tr>
                  )}
                  {(data.interconnectionPoints || []).map((point) => (
                    <tr key={point.id}>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={point.pressure}
                          onChange={(e) => updateInterconnectionPoint(point.id, 'pressure', e.target.value)}
                        >
                          {PRESSURE_BASES.map(pb => (
                            <option key={pb.base} value={pb.base}>{pb.base}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={point.material}
                          onChange={(e) => updateInterconnectionPoint(point.id, 'material', e.target.value)}
                        >
                          {MATERIALS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={point.diameter}
                          onChange={(e) => updateInterconnectionPoint(point.id, 'diameter', e.target.value)}
                        >
                          {DIAMETERS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="Ex: Rua das Flores, 123"
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-xs text-slate-600 italic"
                          value={point.location}
                          onChange={(e) => updateInterconnectionPoint(point.id, 'location', e.target.value)}
                        />
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0 text-slate-400"
                          value={point.comment}
                          onChange={(e) => updateInterconnectionPoint(point.id, 'comment', e.target.value)}
                        >
                          {INTERCONNECTION_COMMENTS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      {!readOnly && (
                        <td className="p-2 bg-white text-center">
                          <button onClick={() => removeInterconnectionPoint(point.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECTION: EXTENSÕES REDES PLANIFICADAS */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080]">Extensões Redes Planificadas</h5>
              {!readOnly && (
                <button onClick={addPlannedExtension} className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1">
                  <i className="fa-solid fa-plus text-[8px]"></i> Adicionar Rede
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left bg-slate-50 rounded-xl overflow-hidden text-xs">
                <thead className="bg-[#004080] text-white">
                  <tr>
                    <th className="p-2 font-normal">Material</th>
                    <th className="p-2 font-normal">Diâmetro</th>
                    <th className="p-2 font-normal text-center">Extensão (m)</th>
                    <th className="p-2 font-normal">Tipo de Rede</th>
                    <th className="p-2 font-normal text-center">Válvulas</th>
                    <th className="p-2 font-normal">Pressão</th>
                    <th className="p-2 font-normal">Gás</th>
                    <th className="p-2 font-normal">Status</th>
                    {!readOnly && <th className="p-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white border border-slate-200">
                  {(!data.plannedExtensions || data.plannedExtensions.length === 0) && (
                    <tr key="empty"><td colSpan={9} className="p-4 text-center text-slate-400 bg-white">Nenhuma extensão planificada adicionada.</td></tr>
                  )}
                  {(data.plannedExtensions || []).map((ext) => (
                    <tr key={ext.id}>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={ext.material}
                          onChange={(e) => updatePlannedExtension(ext.id, 'material', e.target.value)}
                        >
                          {MATERIALS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={ext.diameter}
                          onChange={(e) => updatePlannedExtension(ext.id, 'diameter', e.target.value)}
                        >
                          {DIAMETERS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <input
                          type="number"
                          disabled={readOnly}
                          className="w-16 border-slate-200 rounded p-1 text-xs text-center"
                          value={ext.extension}
                          onChange={(e) => updatePlannedExtension(ext.id, 'extension', e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={ext.networkType}
                          onChange={(e) => updatePlannedExtension(ext.id, 'networkType', e.target.value)}
                        >
                          {NETWORK_TYPES_EXT.map(nt => (
                            <option key={nt} value={nt}>{nt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <input
                          type="number"
                          disabled={readOnly}
                          className="w-12 border-slate-200 rounded p-1 text-xs text-center"
                          value={ext.valves}
                          onChange={(e) => updatePlannedExtension(ext.id, 'valves', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0"
                          value={ext.pressure}
                          onChange={(e) => updatePlannedExtension(ext.id, 'pressure', e.target.value)}
                        >
                          <option>AP</option>
                          <option>MP</option>
                          <option>BP</option>
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0 text-center font-bold text-[#004080]"
                          value={ext.gasType}
                          onChange={(e) => updatePlannedExtension(ext.id, 'gasType', e.target.value)}
                        >
                          {GAS_TYPES_EXT.map(gt => (
                            <option key={gt} value={gt}>{gt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 bg-white">
                        <select
                          disabled={readOnly}
                          className="bg-transparent border-0 text-xs w-full focus:ring-0 text-slate-500 font-medium"
                          value={ext.status}
                          onChange={(e) => updatePlannedExtension(ext.id, 'status', e.target.value)}
                        >
                          {STATUS_EXT.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </td>
                      {!readOnly && (
                        <td className="p-2 bg-white text-center">
                          <button onClick={() => removePlannedExtension(ext.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-start pr-2 pt-2 gap-4 items-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Extensão Total:</span>
              <span className="text-sm font-black text-[#004080] bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                {totalPlannedExtension} m
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`space-y-6 ${!isResidencial ? 'opacity-40 grayscale pointer-events-none select-none' : ''}`}>
              {!isResidencial && (
                <div className="bg-orange-50 border border-orange-100 p-2 rounded-lg mb-2 text-center">
                  <p className="text-[8px] font-black text-orange-600 uppercase tracking-tighter italic">Disponível apenas para estudos Residenciais</p>
                </div>
              )}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-[#004080]">Cálculo Residencial</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Base PE.05306 / NT-200</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCalcMode('auto')}
                      className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${calcMode === 'auto' ? 'bg-[#004080] text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => {
                        setCalcMode('manual');
                        setManualCalc({
                          totalClients: totalClientsAuto,
                          unitFlow: unitFlowAuto,
                          penetration: penetrationAuto,
                          diversification: diversificationAuto
                        });
                      }}
                      className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${calcMode === 'manual' ? 'bg-[#004080] text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                    >
                      Man
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Total Clientes</span>
                    {calcMode === 'auto' ? (
                      <span className="text-sm font-black text-[#004080]">{currentCalc.totalClients}</span>
                    ) : (
                      <input
                        type="number"
                        className="w-16 bg-white border border-slate-200 rounded p-1 text-xs font-black text-right outline-none focus:ring-1 focus:ring-indigo-500"
                        value={manualCalc.totalClients}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManualCalc(prev => ({ ...prev, totalClients: val, diversification: getDiversificationFactor(val) }));
                        }}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Vazão Unitária</span>
                    {calcMode === 'auto' ? (
                      <span className="text-sm font-black text-[#004080]">{currentCalc.unitFlow.toFixed(3)}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.001"
                        className="w-16 bg-white border border-slate-200 rounded p-1 text-xs font-black text-right outline-none focus:ring-1 focus:ring-indigo-500"
                        value={manualCalc.unitFlow}
                        onChange={(e) => setManualCalc(prev => ({ ...prev, unitFlow: Number(e.target.value) }))}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">F. Penetração</span>
                    {calcMode === 'auto' ? (
                      <span className="text-sm font-black text-[#004080]">{currentCalc.penetration}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.1"
                        className="w-16 bg-white border border-slate-200 rounded p-1 text-xs font-black text-right outline-none focus:ring-1 focus:ring-indigo-500"
                        value={manualCalc.penetration}
                        onChange={(e) => setManualCalc(prev => ({ ...prev, penetration: Number(e.target.value) }))}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">F. Diversificação</span>
                    {calcMode === 'auto' ? (
                      <span className="text-sm font-black text-[#004080]">{currentCalc.diversification.toFixed(2)}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        className="w-16 bg-white border border-slate-200 rounded p-1 text-xs font-black text-right outline-none focus:ring-1 focus:ring-indigo-500"
                        value={manualCalc.diversification}
                        onChange={(e) => setManualCalc(prev => ({ ...prev, diversification: Number(e.target.value) }))}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-1">
                    <span className="text-xs font-black text-slate-700">Vazão Total (m³/h)</span>
                    <span className="text-lg font-black text-orange-600">
                      {currentCalc.totalFlow.toFixed(3).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <button
                  disabled={readOnly}
                  onClick={() => {
                    const total = currentCalc.totalFlow;
                    const summary = `Vazão total para o dimensionamento: ${total.toFixed(3).replace('.', ',')} m³/h (Clientes: ${currentCalc.totalClients} | Qut: ${currentCalc.unitFlow.toFixed(2)} | FP: ${currentCalc.penetration} | FD: ${currentCalc.diversification.toFixed(2)})`;

                    if (onUpdateData) {
                      onUpdateData({
                        ...data,
                        totalFlowRes: total,
                        responseObservations: [...responseObsList, summary].join('\n')
                      });
                      showToast('Cálculo aplicado à resposta técnica!', 'success');
                    }
                  }}
                  className="w-full mt-2 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  Aplicar Cálculo à Resposta <i className="fa-solid fa-check-double ml-1"></i>
                </button>
              </div>

              <p className="text-[9px] text-slate-400 italic leading-tight px-2">
                *Sempre consultar a Norma para os fatores necessários para a diversificação, pressão mínima e perda de carga admissível.
              </p>
            </div>

            <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-4 text-xs font-black text-[#004080] uppercase">
                Dimensionar Regulador?
                <input
                  type="checkbox"
                  checked={!!data.regSizingActive}
                  onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingActive: e.target.checked })}
                  disabled={readOnly}
                  className="rounded"
                />
              </div>
              <div className={`space-y-2 transition-all duration-300 ${!data.regSizingActive ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-700">Vazão</span>
                  <input
                    type="text"
                    value={data.regSizingFlow || ''}
                    onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingFlow: e.target.value })}
                    disabled={readOnly || !data.regSizingActive}
                    placeholder="m³/h"
                    className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-700">Custo</span>
                  <input
                    type="text"
                    value={data.regSizingCost || ''}
                    onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingCost: e.target.value })}
                    disabled={readOnly || !data.regSizingActive}
                    placeholder="R$"
                    className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-700">P. Entrada</span>
                  <input
                    type="text"
                    value={data.regSizingInPress || ''}
                    onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingInPress: e.target.value })}
                    disabled={readOnly || !data.regSizingActive}
                    placeholder="bar"
                    className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-700">P. Saída</span>
                  <input
                    type="text"
                    value={data.regSizingOutPress || ''}
                    onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingOutPress: e.target.value })}
                    disabled={readOnly || !data.regSizingActive}
                    placeholder="mbar"
                    className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-700">Vazão Futura</span>
                  <input
                    type="text"
                    value={data.regSizingFutureFlow || ''}
                    onChange={(e) => onUpdateData && onUpdateData({ ...data, regSizingFutureFlow: e.target.value })}
                    disabled={readOnly || !data.regSizingActive}
                    placeholder="m³/h"
                    className="w-20 p-1 bg-white border border-indigo-200 rounded text-xs text-right"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-center pt-6 border-t border-slate-100">
          {/* LEFT: Standardized Conditions (Grouped by Blocks) */}
          <div className="flex-1 space-y-2">
            <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080] mb-2 text-center md:text-left">Condições Padronizadas</h5>
            <div className="h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium leading-relaxed custom-scrollbar">
              <div className="space-y-4">
                {availableBlocks.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 italic">Nenhuma condição padrão disponível.</div>
                ) : (
                  availableBlocks.map(block => {
                    const isExpanded = expandedBlocks.includes(block.id);
                    return (
                      <div key={block.id} className="space-y-1">
                        <div
                          onClick={() => {
                            if (block.id === 'PrevRevision' && block.itens.length === 0) {
                              showAlert('Não há registro de estudo anterior para este código ou o estudo selecionado não possui observações.', 'Sem Estudo Anterior', 'warning');
                              return;
                            }
                            setSelectedStandardized(block.id);
                            toggleBlock(block.id);
                          }}
                          onDoubleClick={() => {
                            if (block.id === 'PrevRevision' && block.itens.length === 0) {
                              showAlert('Não há registro de estudo anterior para este código ou o estudo selecionado não possui observações.', 'Sem Estudo Anterior', 'warning');
                              return;
                            }
                            !readOnly && handleAddBlock(block.itens);
                          }}
                          className={`p-2 rounded-lg cursor-pointer transition-colors border flex items-center gap-2 ${selectedStandardized === block.id ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-[#004080] border-slate-200'}`}
                        >
                          <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px] transition-transform`}></i>
                          <div className="flex-grow flex justify-between items-center group">
                            <span className="font-black uppercase tracking-tight">{block.descricao}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (block.id === 'PrevRevision' && block.itens.length === 0) {
                                  showAlert('Não há registro de estudo anterior para este código ou o estudo selecionado não possui observações.', 'Sem Estudo Anterior', 'warning');
                                  return;
                                }
                                !readOnly && handleAddBlock(block.itens);
                              }}
                              className={`text-[9px] px-1.5 rounded bg-white font-black hover:scale-110 active:scale-95 transition-all shadow-sm ${selectedStandardized === block.id ? 'text-indigo-600' : 'text-[#004080]'}`}
                              title="Incluir todo o bloco"
                            >
                              INCLUIR <i className="fa-solid fa-plus-circle ml-1"></i>
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="pl-6 space-y-1 animate-in slide-in-from-top-1 duration-200">
                            {block.itens.map((item, idx) => {
                              const isAdded = responseObsList.includes(item);
                              return (
                                <div
                                  key={idx}
                                  onDoubleClick={() => !readOnly && !isAdded && handleAddCondition(item)}
                                  className={`p-2 rounded-lg text-[9px] transition-colors border border-transparent ${isAdded ? 'opacity-40 line-through select-none' : 'hover:bg-white hover:border-slate-200 cursor-copy text-slate-500 italic'}`}
                                  title={isAdded ? "Já adicionado" : "Clique duplo para adicionar individualmente"}
                                >
                                  • {item}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE: Buttons */}
          <div className="flex flex-row md:flex-col gap-2 justify-center">
            <button
              onClick={() => {
                const block = availableBlocks.find(b => b.id === selectedStandardized);
                if (block) handleAddBlock(block.itens);
              }}
              disabled={readOnly || !selectedStandardized}
              className="bg-[#004080] text-white px-3 py-1 rounded-md text-[10px] font-black hover:bg-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-tighter"
            >
              Adicionar <i className="fa-solid fa-angles-right ml-1"></i>
            </button>
            <button
              onClick={() => handleRemoveCondition()}
              disabled={readOnly || !selectedResponseObservation}
              className="bg-white border border-slate-200 text-[#004080] px-3 py-1 rounded-md text-[10px] font-black hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-tighter"
            >
              <i className="fa-solid fa-angles-left mr-1"></i> Remover
            </button>
          </div>

          {/* RIGHT: Response Observations */}
          <div className="flex-1 space-y-2">
            <h5 className="text-[10px] uppercase font-black tracking-widest text-[#004080] mb-2 text-center md:text-left">Observações Resposta</h5>

            {!readOnly && (
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Nova observação personalizada..."
                  className="flex-1 text-[10px] p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  value={newCondInput}
                  onChange={(e) => setNewCondInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCondition()}
                />
                <button
                  onClick={handleAddCustomCondition}
                  className="px-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-100 transition-colors"
                >
                  <i className="fa-solid fa-plus text-[10px]"></i>
                </button>
              </div>
            )}

            <div className="h-48 flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-inner">
              <div className="flex-1 overflow-y-auto space-y-1 mb-1 pr-1 custom-scrollbar">
                {responseObsList.length === 0 ? (
                  <div className="text-[10px] text-slate-400 italic p-4 text-center">Nenhuma condição adicionada. Use os botões centrais, clique duas vezes ou crie uma personalizada acima.</div>
                ) : (
                  responseObsList.map((obs, idx) => (
                    <div
                      key={`${obs}-${idx}`}
                      onClick={() => !readOnly && setSelectedResponseObservation(obs)}
                      onDoubleClick={() => !readOnly && handleRemoveCondition(obs)}
                      className={`p-2 rounded-lg transition-colors select-none relative group ${selectedResponseObservation === obs ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-200 text-slate-700 font-medium'}`}
                    >
                      {editingObsIdx === idx ? (
                        <input
                          autoFocus
                          className="w-full bg-white text-slate-800 p-1 rounded border border-indigo-300 outline-none text-[10px]"
                          value={editingObsValue}
                          onChange={(e) => setEditingObsValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setEditingObsIdx(null);
                          }}
                        />
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="flex-grow">{obs}</span>
                          {!readOnly && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEditing(idx, obs); }}
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 transition-all ${selectedResponseObservation === obs ? 'text-white' : 'text-indigo-500'}`}
                              title="Editar observação"
                            >
                              <i className="fa-solid fa-pen-to-square text-[8px]"></i>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
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
          <div className="p-5 border border-slate-200 rounded-2xl relative">
            <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-[#004080] uppercase">Preparação Arquivos Geogas</span>
            <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-600">
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-export text-[#004080]"></i> Caminho de Exportação Shapefile</li>
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-map-location-dot text-[#004080]"></i> Criar Legenda Geogas</li>
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-pdf text-red-500"></i> Caminho de Exportação PDF</li>
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-globe text-green-500"></i> Arquivar Mapa Geogas</li>
            </ul>
          </div>

          <div className="p-5 border border-slate-200 rounded-2xl relative">
            <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-[#004080] uppercase">Preparação Arquivos QGis</span>
            <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-600">
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-map-location-dot text-[#004080]"></i> Criar Legenda QGis</li>
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-file-pdf text-red-500"></i> Caminho de Exportação PDF</li>
              <li className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-indigo-600'}`}><i className="fa-solid fa-globe text-green-500"></i> Arquivar Mapa QGis</li>
            </ul>
          </div>

          <div className="p-5 border border-slate-200 rounded-2xl relative bg-indigo-50/50">
            <span className="absolute -top-3 left-4 bg-indigo-50/50 px-2 text-[10px] font-black text-[#004080] uppercase">Preparação Envio</span>
            <ul className="space-y-3 mt-2 text-[10px] font-bold text-slate-700">
              <li
                onClick={() => !readOnly && setShowCartaPreview(true)}
                className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-[#004080]'}`}
              >
                <i className="fa-solid fa-magnifying-glass"></i> Visualizar
              </li>
              <li
                onClick={() => !readOnly && handleExportCartaPDF()}
                className={`flex items-center gap-2 ${readOnly ? '' : 'cursor-pointer hover:text-[#004080]'} ${isExportingCarta ? 'animate-pulse opacity-50' : ''}`}
              >
                <i className="fa-solid fa-envelope-open-text"></i> {isExportingCarta ? 'Exportando...' : 'Exportar Carta Resposta'}
              </li>
              <li
                onClick={handleJustifyPreQC}
                className={`flex items-center gap-2 text-red-500 ${readOnly ? '' : 'cursor-pointer hover:text-red-700'}`}
              >
                <i className="fa-solid fa-paper-plane"></i> Justificar Envio Antes do Controle
              </li>

              <li
                onClick={() => setShowQCModal(true)}
                className={`flex items-center gap-2 cursor-pointer hover:text-[#004080] ${data.qcData ? 'text-purple-600 font-black' : ''}`}
              >
                <i className={`fa-solid ${data.qcData?.qcStatusCQ === 'Reprovado' ? 'fa-triangle-exclamation text-red-500' : data.qcData?.qcStatusCQ === 'Aprovado' ? 'fa-check-circle text-green-500' : 'fa-plus text-[#004080]'}`}></i>
                {data.qcData?.qcStatusCQ === 'Reprovado' ? 'Ver Motivo da Reprovação CQ' : data.qcData?.qcStatusCQ === 'Aprovado' ? 'Ver Aprovação CQ' : 'Abrir Controle de Qualidade'}
              </li>
            </ul>
          </div>
        </div>

        <div className="flex-grow flex flex-col min-h-[300px]">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Copiar Colar:</span>
          <textarea
            readOnly={readOnly}
            className="flex-grow border border-slate-200 rounded-2xl bg-slate-50 p-4 resize-none text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
            placeholder=""
            value={data.responseMemo || ''}
            onChange={(e) => onUpdateData && onUpdateData({ ...data, responseMemo: e.target.value })}
          />
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
                  onClick={() => handleTechSubTabChange(idx)}
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
                    {previewStudy.selectedFiles.filter(f => f.name !== '.keep').map((f, idx) => (
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Centro de Engenharia e Planejamento de Rede</p>
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
                            showToast('Erro ao buscar o arquivo do formulário para download.', 'error');
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
                            showToast('Erro ao buscar o arquivo do formulário para visualização.', 'error');
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
          <div className="flex w-full justify-between items-center">
            <div className="flex gap-4">
              <button
                onClick={handlePauseToggle}
                className={`px-8 py-4 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg ${isPaused ? 'bg-orange-500 text-white border-orange-400 shadow-orange-100' : 'bg-white text-orange-600 border border-orange-100 hover:bg-orange-50'}`}
              >
                <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-sm`}></i>
                {isPaused ? 'Retomar Cronômetro' : 'Pausar Cronômetro'}
              </button>

              <button
                onClick={handleOpenHoldModal}
                className="px-8 py-4 bg-orange-50 text-orange-600 border border-orange-100 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-lg flex items-center gap-3"
              >
                <i className="fa-solid fa-circle-question text-sm"></i>
                Pedir Informação
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
              onClick={handleInitiateFinish}
              className="px-20 py-5 bg-[#004080] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.1em] shadow-2xl shadow-blue-100 hover:bg-indigo-600 transition-all active:translate-y-0.5 flex items-center gap-5"
            >
              <i className="fa-solid fa-check-double text-green-400 text-lg"></i>
              Concluir Estudo Técnico
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {data.status === StudyStatus.APROVADO_CQ && (
              <div className="px-6 py-3 bg-green-50 text-green-600 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest border border-green-100 flex items-center gap-3">
                <i className="fa-solid fa-clipboard-check text-sm"></i>
                Aprovado pelo CQ
              </div>
            )}
            {data.completedAt && (
              <div className="px-6 py-3 bg-green-50 text-green-600 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest border border-green-100">
                Concluído em: {formatDateTimeBR(data.completedAt)}
              </div>
            )}
          </div>
        )}

        <div className="hidden lg:block text-right">
          <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.1em] leading-none mb-1.5"></p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest opacity-50"></p>
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

      {/* ── Variable Filler Modal ── */}
      {fillingModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#004080] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-pen-nib text-xs"></i>
                <h3 className="font-black uppercase tracking-tight text-[11px]">Preencher Informações</h3>
              </div>
              {fillingModal.queue.length > 0 && (
                <span className="text-[9px] bg-white/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                  Processando {fillingModal.index + 1} de {fillingModal.queue.length}
                </span>
              )}
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic text-slate-600 text-[11px] leading-relaxed relative">
                <i className="fa-solid fa-quote-left absolute -top-2 -left-1 text-slate-200 text-xl"></i>
                "{fillingModal.currentItem}"
              </div>

              <div className="space-y-4">
                {fillingModal.vars.map(v => (
                  <div key={v} className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      {v.replace('[', '').replace(']', '').replace(/_/g, ' ')}
                    </label>
                    <input
                      autoFocus={fillingModal.vars[0] === v}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                      placeholder={`Informe o valor para este campo...`}
                      value={fillingModal.values[v] || ''}
                      onChange={(e) => setFillingModal({
                        ...fillingModal,
                        values: { ...fillingModal.values, [v]: e.target.value }
                      })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmFilling();
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setFillingModal(null)}
                className="px-6 py-2.5 text-[10px] font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFilling}
                className="bg-[#004080] hover:bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-3"
              >
                {fillingModal.queue.length > 1 && (fillingModal.index + 1) < fillingModal.queue.length ? 'Próximo Item' : 'Confirmar e Adicionar'}
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>
          </div>
        </div>
      )}
      {renderCartaPreviewModal()}
      {showHoldModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between text-[#004080]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner border border-orange-100">
                  <i className="fa-solid fa-pause text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Pausar e Pedir Info</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{data.studyNumber}</p>
                </div>
              </div>
              <button onClick={() => { setShowHoldModal(false); setHoldInfo(''); setIsPaused(false); }} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Informação Necessária:</label>
                <textarea
                  autoFocus
                  value={holdInfo}
                  onChange={(e) => setHoldInfo(e.target.value)}
                  className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm text-slate-700 placeholder:text-slate-300"
                  placeholder="Descreva detalhadamente qual informação adicional é necessária para prosseguir..."
                ></textarea>
              </div>
              <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex items-start gap-4">
                <i className="fa-solid fa-circle-info text-orange-400 mt-1"></i>
                <p className="text-[10px] text-orange-800/80 font-bold leading-relaxed uppercase">
                  O estudo ficará bloqueado e o solicitante receberá um banner de notificação.
                </p>
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button
                onClick={() => { setShowHoldModal(false); setHoldInfo(''); setIsPaused(false); }}
                className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors bg-white rounded-2xl border border-slate-100"
              >
                Continuar Executando
              </button>
              <button
                disabled={!holdInfo.trim()}
                onClick={handleConfirmHold}
                className={`flex-[2] py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${holdInfo.trim() ? 'bg-orange-500 text-white shadow-orange-200 hover:scale-[1.02] active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
              >
                Confirmar Pausa
              </button>
            </div>
          </div>
        </div>
      )}
      {showQCModal && (
        <QCControlModal
          data={data}
          allUsers={allUsers}
          currentUser={currentUser}
          readOnly={true}
          onClose={() => setShowQCModal(false)}
        />
      )}
      {/* Off-screen hidden carta for background SVG/PNG export */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '1200px', pointerEvents: 'none', background: 'white', zIndex: -1 }}>
        {renderCartaPaper(hiddenCartaRef)}
      </div>
    </div>
  );
};
