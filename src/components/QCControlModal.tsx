import React, { useState, useMemo, useEffect } from 'react';
import { FormData, QCControlData, QCIteration, StudyStatus, User, UserRole } from '../types/types';
import { formatDateTimeBR } from '../utils/utils';
import { StorageService } from '../services/storage';

interface QCControlModalProps {
  data: FormData;
  allUsers: User[];
  currentUser?: User;
  readOnly?: boolean;
  onClose: () => void;
  onApprove?: (qcData: QCControlData) => void;
  onReject?: (qcData: QCControlData, reason: string) => void;
}

const CRITICAL_FAILURES = [
  'Soluções técnicas inadequadas que provoquem um investimento diâmetro superior ao necessário.', // 1
  'Aplicação incorreta dos procedimentos, que resultem em soluções técnicas equivocadas.', // 2
  'Traçado inadequado da rede quando não houver fornecimento a nenhum cliente (trechos com vazão zero).', // 3
  'Travessias desnecessárias em rodovias nacionais, locais, linhas férreas, pontes, rios, riachos, BR-T, VLT, etc.', // 4
  'Aplicação de perdas de carga não homogêneas em cada trecho, em função do diâmetro, vazão e pressão.', // 5
  'Velocidades do gás superiores a 30 m/s.', // 6
  'Utilização de materiais e diâmetros não adequados à faixa de pressão.', // 7
  'Análise insuficiente e/ou inadequada das possíveis alternativas técnicas a serem aplicadas.', // 8
  'Investimento desnecessário na rede, existindo alternativas de realimentação por meio de novas ERMs.', // 9
  'Aplicação de coeficientes de cálculo, densidades e peso específico incorretos na faixa de pressão.', // 10
  'Modelos de simulação não calculados, informações incorretas (WinFlow), arquivos PDF com erros.', // 11
  'Relatórios ou documentos com informações incorretas ou contraditórias.', // 12
];

const SECONDARY_FAILURES = [
  'Representação gráfica defeituosa do traçado da rede ou da solução técnica proposta.', // 13
  'Erro nas informações apresentadas no mapa, dificultando a clara compreensão do projeto (pressões, vazões, clientes, etc.)', // 14
  'Relatório com ausência de algum dos dados básicos exigidos.', // 15
];

export const QCControlModal: React.FC<QCControlModalProps> = ({
  data,
  allUsers,
  currentUser,
  readOnly = false,
  onClose,
  onApprove,
  onReject,
}) => {
  // Initialize from existing QC data or defaults
  const existing = data.qcData || {};

  // Para revisões, não carregar falhas da revisão anterior
  const isRevision = data.previousStudy && data.previousStudy.length > 0;
  const initialCriticalFailures = isRevision ? {} : (existing.qcCriticalFailures || {});
  const initialSecondaryFailures = isRevision ? {} : (existing.qcSecondaryFailures || {});

  const [qcStatus, setQcStatus] = useState<'Definir' | 'Aprovado' | 'Reprovado'>(existing.qcStatusCQ || 'Definir');
  const [supervisor, setSupervisor] = useState(existing.qcSupervisor || currentUser?.name || '');
  const [criticalCounts, setCriticalCounts] = useState<Record<string, number>>(initialCriticalFailures);
  const [secondaryCounts, setSecondaryCounts] = useState<Record<string, number>>(initialSecondaryFailures);
  const [comments, setComments] = useState(isRevision ? '' : (existing.qcComments || ''));
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [inlineAlert, setInlineAlert] = useState<{ type: 'error' | 'warning'; message: string } | null>(null);
  const [qcFiles, setQcFiles] = useState<File[]>([]);

  const toggleGroup = (studyNum: string) => {
    setExpandedGroups(prev => ({ ...prev, [studyNum]: !prev[studyNum] }));
  };

  const qcUsers = useMemo(() => {
    return allUsers.filter(u => u.role === UserRole.ADM || u.permissions?.includes('controle_qualidade'));
  }, [allUsers]);

  const analystName = useMemo(() => {
    if (data.analystName) return data.analystName;
    const analyst = allUsers.find(u => u.id === data.assignedTo || u.email?.toLowerCase() === data.assignedTo?.toLowerCase());
    return analyst?.name || '-';
  }, [data, allUsers]);

  // Resolve reviewer name from SAP code
  const resolveReviewerName = (reviewer: string) => {
    if (!reviewer) return '-';
    // Try to find user by SAP
    const userBySap = allUsers.find(u => u.sap === reviewer || u.sap === reviewer.replace(/^0+/, ''));
    if (userBySap) return userBySap.name;
    // Try by email
    const userByEmail = allUsers.find(u => u.email?.toLowerCase() === reviewer.toLowerCase());
    if (userByEmail) return userByEmail.name;
    // Return original if not found
    return reviewer;
  };

  // Fetch QC history from database
  const [dbIterations, setDbIterations] = useState<QCIteration[]>([]);
  const [cqRequestDateFromDB, setCqRequestDateFromDB] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchQCHistory = async () => {
      if (!data.studyNumber) {
        console.log('[QCModal] No studyNumber, skipping history fetch');
        return;
      }

      setIsLoadingHistory(true);
      console.log('[QCModal] Fetching QC history for:', data.studyNumber);
      try {
        // Compute base8 for cross-revision history
        const base8 = data.studyNumber.replace(/^PROV-/, '').substring(0, 8);
        const url = `/api/qc-history/${encodeURIComponent(data.studyNumber)}?base8=${encodeURIComponent(base8)}`;
        console.log('[QCModal] Fetching from URL:', url);
        const res = await fetch(url);
        console.log('[QCModal] Response status:', res.status, 'Content-Type:', res.headers.get('content-type'));

        if (!res.ok) {
          console.error('[QCModal] Failed to fetch history, status:', res.status);
          const text = await res.text();
          console.error('[QCModal] Response text:', text.substring(0, 500));
          setIsLoadingHistory(false);
          return;
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('[QCModal] Response is not JSON, content-type:', contentType);
          const text = await res.text();
          console.error('[QCModal] Response text:', text.substring(0, 500));
          setIsLoadingHistory(false);
          return;
        }

        const history = await res.json();
        console.log('[QCModal] History fetched:', history);
        // Store full history data including failures for detailed view
        setDbIterations(history);
        console.log('[QCModal] Stored full iterations with details:', history);

        // Fetch CQ request date from S_STAHIS
        try {
          const cqRes = await fetch(`/api/cq-request-date/${encodeURIComponent(data.studyNumber)}`);
          if (cqRes.ok) {
            const cqData = await cqRes.json();
            if (cqData.success && cqData.requestDate) {
              setCqRequestDateFromDB(cqData.requestDate);
              console.log('[QCModal] CQ request date from S_STAHIS:', cqData.requestDate);
            }
          }
        } catch (cqErr) {
          console.warn('[QCModal] Could not fetch CQ request date:', cqErr);
        }
      } catch (err) {
        console.error('[QCModal] Error fetching QC history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchQCHistory();
  }, [data.studyNumber]);

  // Combine local iterations (from existing.qcIterations) with database history
  const iterations: QCIteration[] = existing.qcIterations || [];

  // Para revisões, mostra mensagem diferente
  const shouldLoadFailures = !isRevision && iterations.length === 0;

  const allIterations = useMemo(() => {
    // Prefer DB iterations as they are the source of truth
    // Only fall back to local iterations if DB has no data
    if (dbIterations.length > 0) {
      // FIX Bug 7: Dedup key includes reviewer to prevent losing distinct iterations from different supervisors
      const seen = new Set<string>();
      const unique: any[] = [];
      dbIterations.forEach(it => {
        const key = `${it.studyNumber || ''}_${it.validationDate || ''}_${it.status || ''}_${it.reviewer || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(it);
        }
      });
      return unique.sort((a, b) => {
        const dateA = new Date(a.date || a.validationDate || 0).getTime();
        const dateB = new Date(b.date || b.validationDate || 0).getTime();
        return dateA - dateB;
      });
    }

    // Fallback to local iterations only if no DB data
    return [...iterations].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateA - dateB;
    });
  }, [dbIterations, iterations]);

  const totalRevisions = allIterations.length + (readOnly ? 0 : (qcStatus !== 'Definir' ? 1 : 0));

  const totalCritical = Object.values(criticalCounts).reduce<number>((a, b) => a + (Number(b) || 0), 0);
  const totalSecondary = Object.values(secondaryCounts).reduce<number>((a, b) => a + (Number(b) || 0), 0);

  const buildQCData = (): QCControlData => ({
    qcRequestDate: existing.qcRequestDate || data.completedAt || new Date().toISOString(),
    qcValidationDate: new Date().toISOString(),
    qcStatusCQ: qcStatus,
    qcSupervisor: supervisor,
    qcCriticalFailures: criticalCounts,
    qcSecondaryFailures: secondaryCounts,
    qcIterations: [
      ...allIterations,
      {
        status: qcStatus === 'Definir' ? 'Aguardando' : qcStatus,
        date: new Date().toISOString(),
        reviewer: currentUser?.name || supervisor,
      },
    ],
    qcComments: comments,
    qcFiles: qcFiles.length > 0 ? qcFiles : undefined,
  });

  const doApprove = (withReservations: boolean = false) => {
    if (!onApprove) return;
    const statusText = 'Aprovado';
    const finalCode = withReservations ? '400' : '300';

    setQcStatus('Aprovado');
    const qc = buildQCData();
    qc.qcStatusCQ = 'Aprovado';
    qc.qcFinalStatus = finalCode;
    qc.qcIterations = [
      ...allIterations,
      {
        status: withReservations ? 'Aprovado com Ressalvas' : 'Aprovado',
        date: new Date().toISOString(),
        reviewer: currentUser?.name || supervisor
      },
    ];
    onApprove(qc);
  };

  const handleApprove = () => {
    if (!onApprove) return;
    const hasFailures = totalCritical > 0 || totalSecondary > 0;
    
    // SE tem falhas → NÃO pode aprovar, redireciona para reprovação
    if (hasFailures) {
      setInlineAlert({ type: 'warning', message: 'Este estudo possui falhas registradas e não pode ser aprovado. Por favor, utilize a opção Reprovar CQ.' });
      return;
    }
    
    setInlineAlert(null);
    // SE sem falhas + com comentários → Aprovado com Ressalvas
    if (comments && comments.trim().length > 0) {
      doApprove(true);
    } else {
      // SE sem falhas + sem comentários → Aprovado normalmente
      doApprove(false);
    }
  };

  const handleClearFailures = () => {
    setCriticalCounts({});
    setSecondaryCounts({});
  };

  const handleReject = () => {
    if (!onReject) return;
    
    const hasFailures = totalCritical > 0 || totalSecondary > 0;
    
    // OBRIGATÓRIO: ao menos um item crítico ou secundário assinalado
    if (!hasFailures) {
      setInlineAlert({ type: 'error', message: 'Para reprovar um estudo, é obrigatório assinalar pelo menos um item crítico ou secundário de falha.' });
      return;
    }
    
    // OBRIGATÓRIO: campo de comentários preenchido
    if (!comments || comments.trim().length === 0) {
      setInlineAlert({ type: 'error', message: 'Preencha o campo de comentários com o motivo da reprovação.' });
      return;
    }
    
    setInlineAlert(null);
    setQcStatus('Reprovado');
    const qc = buildQCData();
    qc.qcStatusCQ = 'Reprovado';
    qc.qcIterations = [
      ...allIterations,
      { status: 'Reprovado', date: new Date().toISOString(), reviewer: currentUser?.name || supervisor },
    ];
    const rejectionItems: string[] = [];
    CRITICAL_FAILURES.forEach((f, i) => {
      const key = String(i + 1);
      if ((criticalCounts[key] || 0) > 0) rejectionItems.push(`[Crítica] ${f}`);
    });
    SECONDARY_FAILURES.forEach((f, i) => {
      const key = String(i + 13);
      if ((secondaryCounts[key] || 0) > 0) rejectionItems.push(`[Secundária] ${f}`);
    });
    const reason = [
      rejectionItems.length > 0 ? rejectionItems.join('\n') : '',
      comments ? `\nComentários: ${comments}` : '',
    ].filter(Boolean).join('\n') || 'Reprovado pelo controle de qualidade.';
    onReject(qc, reason);
  };

  const updateCritical = (idx: number, delta: number) => {
    if (readOnly) return;
    setInlineAlert(null);
    const key = String(idx + 1); // Use 1-based indexing for backend mapping
    const current = criticalCounts[key] || 0;
    const next = Math.max(0, current + delta);
    setCriticalCounts({ ...criticalCounts, [key]: next });
  };

  const updateSecondary = (idx: number, delta: number) => {
    if (readOnly) return;
    setInlineAlert(null);
    const key = String(idx + 13); // Use 13-15 for secondary
    const current = secondaryCounts[key] || 0;
    const next = Math.max(0, current + delta);
    setSecondaryCounts({ ...secondaryCounts, [key]: next });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setQcFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setQcFiles(prev => prev.filter((_, i) => i !== index));
  };

  const thStyle = 'px-3 py-2 text-left text-[10px] font-black text-[#004080] uppercase tracking-wide border-b border-slate-200';
  const tdStyle = 'px-3 py-2 text-[10px] font-bold text-slate-700 border-b border-slate-100';

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[95vh] shadow-2xl overflow-hidden flex flex-col border border-slate-200">

        {/* Header */}
        <div className="bg-[#004080] p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-clipboard-check"></i>
            </div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-sm">Controle de Qualidade</h3>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-0.5">
                Estudo: {data.studyNumber?.replace('PROV-', '') || '-'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <span className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest border ${qcStatus === 'Aprovado' ? 'bg-green-500 border-green-400 text-white' :
              qcStatus === 'Reprovado' ? 'bg-red-500 border-red-400 text-white' :
                'bg-white/20 border-white/30 text-white'
              }`}>
              Status: {qcStatus}
            </span>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Inline Alert */}
        {inlineAlert && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-xl flex items-start gap-3 ${
            inlineAlert.type === 'error' 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
              inlineAlert.type === 'error' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <i className={`text-xs ${
                inlineAlert.type === 'error' 
                  ? 'fa-solid fa-circle-xmark text-red-500' 
                  : 'fa-solid fa-triangle-exclamation text-amber-500'
              }`}></i>
            </div>
            <div className="flex-1">
              <p className={`text-[11px] font-bold ${
                inlineAlert.type === 'error' ? 'text-red-700' : 'text-amber-700'
              }`}>{inlineAlert.message}</p>
            </div>
            <button
              onClick={() => setInlineAlert(null)}
              className={`text-[10px] ${
                inlineAlert.type === 'error' ? 'text-red-400 hover:text-red-600' : 'text-amber-400 hover:text-amber-600'
              }`}
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {/* Info Row */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="col-span-4 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Solicitação Controle</span>
              <span className="text-xs font-bold text-slate-700">
                {cqRequestDateFromDB ? formatDateTimeBR(cqRequestDateFromDB) : (existing.qcRequestDate ? formatDateTimeBR(existing.qcRequestDate) : (data.qcRequestDate ? formatDateTimeBR(data.qcRequestDate) : (data.completedAt ? formatDateTimeBR(data.completedAt) : '-')))}
              </span>
            </div>
            <div className="col-span-4 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resp. Estudo</span>
              <span className="text-xs font-bold text-[#004080]">{analystName}</span>
            </div>
            <div className="col-span-4 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exec. / Supervisado</span>
              {readOnly ? (
                <span className="text-xs font-bold text-slate-700">{supervisor || '-'}</span>
              ) : (
                <select
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="text-xs font-bold text-slate-700 border border-slate-200 rounded-lg p-1.5 bg-white outline-none"
                >
                  <option value="">Selecione...</option>
                  {qcUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex gap-0">
            {/* LEFT: Failures Tables */}
            <div className="flex-grow p-6 space-y-6">
              {/* Falhas Críticas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 px-4 py-2 flex items-center justify-between border-b border-red-100">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Falhas Críticas
                  </span>
                  {totalCritical > 0 && (
                    <span className="text-[10px] font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                      Total: {totalCritical}
                    </span>
                  )}
                  {!readOnly && totalCritical > 0 && (
                    <button
                      onClick={() => setCriticalCounts({})}
                      className="text-[9px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      <i className="fa-solid fa-eraser text-[8px]"></i> Limpar
                    </button>
                  )}
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={`${thStyle} w-16 text-center`}>Atual</th>
                      <th className={thStyle}>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRITICAL_FAILURES.map((failure, idx) => {
                      const count = criticalCounts[String(idx + 1)] || 0;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${count > 0 ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-3 py-1.5 text-center border-b border-slate-100 border-r border-slate-100">
                            {readOnly ? (
                              <span className={`text-sm font-black ${count > 0 ? 'text-red-600' : 'text-slate-300'}`}>{count}</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => updateCritical(idx, -1)}
                                  className="w-5 h-5 rounded bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-[10px] transition-colors"
                                >
                                  <i className="fa-solid fa-minus"></i>
                                </button>
                                <span className={`text-sm font-black min-w-[20px] text-center ${count > 0 ? 'text-red-600' : 'text-slate-300'}`}>{count}</span>
                                <button
                                  onClick={() => updateCritical(idx, 1)}
                                  className="w-5 h-5 rounded bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-[10px] transition-colors"
                                >
                                  <i className="fa-solid fa-plus"></i>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${tdStyle} ${count > 0 ? 'text-red-700 font-black' : ''}`}>{failure}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Falhas Secundárias */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2 flex items-center justify-between border-b border-amber-100">
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-exclamation-circle"></i>
                    Falhas Secundária
                  </span>
                  {totalSecondary > 0 && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
                      Total: {totalSecondary}
                    </span>
                  )}
                  {!readOnly && totalSecondary > 0 && (
                    <button
                      onClick={() => setSecondaryCounts({})}
                      className="text-[9px] font-black text-amber-400 hover:text-amber-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      <i className="fa-solid fa-eraser text-[8px]"></i> Limpar
                    </button>
                  )}
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={`${thStyle} w-16 text-center`}>Atual</th>
                      <th className={thStyle}>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SECONDARY_FAILURES.map((failure, idx) => {
                      const count = secondaryCounts[String(idx + 13)] || 0;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${count > 0 ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-3 py-1.5 text-center border-b border-slate-100 border-r border-slate-100">
                            {readOnly ? (
                              <span className={`text-sm font-black ${count > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{count}</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => updateSecondary(idx, -1)}
                                  className="w-5 h-5 rounded bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600 flex items-center justify-center text-[10px] transition-colors"
                                >
                                  <i className="fa-solid fa-minus"></i>
                                </button>
                                <span className={`text-sm font-black min-w-[20px] text-center ${count > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{count}</span>
                                <button
                                  onClick={() => updateSecondary(idx, 1)}
                                  className="w-5 h-5 rounded bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600 flex items-center justify-center text-[10px] transition-colors"
                                >
                                  <i className="fa-solid fa-plus"></i>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${tdStyle} ${count > 0 ? 'text-amber-700 font-black' : ''}`}>{failure}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Comentários */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-comment-dots"></i>
                    Comentários
                  </span>
                </div>
                <div className="p-3">
                  {readOnly ? (
                    <div className="min-h-[80px] text-xs text-slate-700 whitespace-pre-wrap p-2">
                      {comments || 'Nenhum comentário registrado.'}
                    </div>
                  ) : (
                    <textarea
                      value={comments}
                      onChange={(e) => { setComments(e.target.value); setInlineAlert(null); }}
                      rows={4}
                      className="w-full border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#004080] resize-none"
                      placeholder="Observações do revisor..."
                    />
                  )}
                </div>
              </div>

              {/* Arquivos do Supervisor */}
              {(readOnly || !readOnly) && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-100">
                    <span className="text-[10px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-paperclip"></i>
                      Anexos do Supervisor
                    </span>
                    {!readOnly && (
                      <label className="cursor-pointer text-[9px] font-black text-[#004080] hover:text-blue-600 uppercase tracking-widest flex items-center gap-1 transition-colors">
                        <i className="fa-solid fa-upload text-[8px]"></i> Adicionar
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <div className="p-3">
                    {qcFiles.length === 0 ? (
                      <div className="text-[10px] text-slate-400 font-bold italic text-center py-2">
                        {readOnly ? 'Nenhum arquivo anexado pelo supervisor.' : 'Nenhum arquivo anexado.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {qcFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                            <i className="fa-solid fa-file text-slate-400 text-[10px]"></i>
                            <span className="text-[10px] text-slate-700 flex-1 truncate">{file.name}</span>
                            <span className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                            {!readOnly && (
                              <button
                                onClick={() => removeFile(idx)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <i className="fa-solid fa-times text-[8px]"></i>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Iterations sidebar */}
            <div className="w-64 border-l border-slate-200 bg-slate-50/50 p-4 shrink-0 flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  {isRevision ? 'Histórico de Revisões de CQ' : 'Histórico de Revisões de CQ'}
                </span>
                <div className="space-y-2">
                  {allIterations.length === 0 && (
                    <div className="text-[10px] text-slate-400 font-bold italic text-center py-4">
                      Nenhuma revisão anterior.
                    </div>
                  )}
                  {/* Group and sort by study number - most recent first */}
                  {(() => {
                    // First sort all iterations by date (most recent first)
                    const sorted = [...allIterations].sort((a, b) => {
                      const dateA = new Date(a.validationDate || 0).getTime();
                      const dateB = new Date(b.validationDate || 0).getTime();
                      return dateB - dateA;
                    });

                    // Group by study number
                    const grouped: Record<string, any[]> = {};
                    sorted.forEach((it: any) => {
                      const studyNum = it.studyNumber || '';
                      if (!studyNum || studyNum === 'N/A') return null;  // Skip empty or N/A
                      if (!grouped[studyNum]) grouped[studyNum] = [];
                      grouped[studyNum].push(it);
                    });

                    // Sort groups by most recent iteration in each group (descending by study number)
                    const sortedGroups = Object.entries(grouped)
                      .filter(([num]) => num && num !== 'N/A' && num !== '')
                      .sort(([numA], [numB]) => {
                        return numB.localeCompare(numA, undefined, { numeric: true });
                      });

                    return sortedGroups.map(([studyNum, iterations]: [string, any]) => {
                      const isExpanded = expandedGroups[studyNum] === undefined ? false : expandedGroups[studyNum];
                      return (
                        <div key={studyNum} className="mb-3">
                          <button
                            onClick={() => toggleGroup(studyNum)}
                            className="w-full text-[9px] font-black text-[#004080] uppercase tracking-wider mb-1 bg-slate-100 px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-200 transition-colors"
                          >
                            <span>{studyNum}</span>
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px]`}></i>
                          </button>
                          {isExpanded && (
                            <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                              {iterations.map((it: any, idx: number) => (
                                <div
                                  key={`${studyNum}-${idx}`}
                                  onClick={() => setSelectedRevision(it)}
                                  className={`p-3 rounded-lg border text-[10px] font-bold cursor-pointer hover:shadow-md transition-all ${it.status === 'Aprovado' ? 'bg-green-50 border-green-200 text-green-700' :
                                    it.status === 'Reprovado' ? 'bg-red-50 border-red-200 text-red-700' :
                                      'bg-white border-slate-200 text-slate-500'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="uppercase tracking-wider font-black">{it.status}</span>
                                      {it.studyNumber && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-black">
                                          R{String(it.studyNumber || '').slice(-2)}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] opacity-70">{it.validationDate ? formatDateTimeBR(it.validationDate) : '-'}</span>
                                  </div>
                                  {it.reviewer && (
                                    <div className="text-[9px] mt-1 opacity-60">{resolveReviewerName(it.reviewer)}</div>
                                  )}
                                  <div className="text-[8px] mt-1 text-[#004080] opacity-70">
                                    <i className="fa-solid fa-eye"></i> Ver detalhes
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {/* Current pending iteration */}
                  {!readOnly && !selectedRevision && (
                    <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-white text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <i className="fa-solid fa-hourglass-half animate-pulse"></i>
                      Aguardando decisão...
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-auto pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 uppercase">Falhas Críticas:</span>
                  <span className={`font-black ${totalCritical > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalCritical}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 uppercase">Falhas Secundárias:</span>
                  <span className={`font-black ${totalSecondary > 0 ? 'text-amber-600' : 'text-green-600'}`}>{totalSecondary}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 uppercase">Quantidade de Revisões:</span>
                  <span className="font-black text-[#004080]">{allIterations.length + (!readOnly ? 1 : 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revision Details Modal */}
        {selectedRevision && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-[#004080] uppercase tracking-tight text-sm">
                    Detalhes da Revisão de CQ
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Estudo: {selectedRevision?.studyNumber || data.studyNumber}
                  </p>
                </div>
                <button
                  onClick={() => {
                    console.log('[QCModal] Selected revision data:', selectedRevision);
                    setSelectedRevision(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {/* Status & Date */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`px-4 py-2 rounded-lg font-black text-xs uppercase ${selectedRevision.status === 'Reprovado' ? 'bg-red-100 text-red-700 border border-red-200' :
                    selectedRevision.status === 'Aprovado' ? 'bg-green-100 text-green-700 border border-green-200' :
                      'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                    {selectedRevision.status}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-bold">Data:</span> {selectedRevision.validationDate ? formatDateTimeBR(selectedRevision.validationDate) : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-bold">Revisor:</span> {resolveReviewerName(selectedRevision.reviewer)}
                  </div>
                </div>

                {/* Critical Failures */}
                {selectedRevision.criticalFailures && (
                  <div className="mb-6">
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-circle-xmark"></i>
                      Falhas Críticas
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(selectedRevision.criticalFailures).map(([key, count]: [string, any]) => {
                        const num = parseInt(key);
                        const countVal = Number(count) || 0;
                        return countVal > 0 ? (
                          <div key={key} className="flex items-center gap-2 text-[9px] p-2 bg-red-50 rounded border border-red-100">
                            <span className="text-slate-700 flex-1">{CRITICAL_FAILURES[num - 1]}</span>
                            <span className="font-black text-red-600 bg-red-100 px-2 rounded">{countVal}</span>
                          </div>
                        ) : null;
                      })}
                      {Object.values(selectedRevision.criticalFailures).every(v => !v) && (
                        <div className="text-[10px] text-green-600 italic p-2">Nenhuma falha crítica encontrada</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Secondary Failures */}
                {selectedRevision.secondaryFailures && (
                  <div className="mb-6">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      Falhas Secundárias
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(selectedRevision.secondaryFailures).map(([key, count]: [string, any]) => {
                        const num = parseInt(key);
                        const countVal = Number(count) || 0;
                        return countVal > 0 ? (
                          <div key={key} className="flex items-center gap-2 text-[9px] p-2 bg-amber-50 rounded border border-amber-100">
                            <span className="text-slate-700 flex-1">{SECONDARY_FAILURES[num - 13]}</span>
                            <span className="font-black text-amber-600 bg-amber-100 px-2 rounded">{countVal}</span>
                          </div>
                        ) : null;
                      })}
                      {Object.values(selectedRevision.secondaryFailures).every(v => !v) && (
                        <div className="text-[10px] text-green-600 italic p-2">Nenhuma falha secundária encontrada</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {selectedRevision.comments && (
                  <div className="mb-4">
                    <h4 className="text-[10px] font-black text-[#004080] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-comment"></i>
                      Comentários
                    </h4>
                    <div className="text-[10px] text-slate-600 p-3 bg-slate-50 rounded border border-slate-200 whitespace-pre-wrap">
                      {selectedRevision.comments || 'Nenhum comentário'}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedRevision(null)}
                  className="px-6 py-2 bg-[#004080] text-white rounded-lg font-black uppercase text-[10px] hover:bg-[#003060]"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-all active:scale-95"
          >
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>

          {!readOnly && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={totalCritical === 0 && totalSecondary === 0}
                className={`px-8 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                  totalCritical === 0 && totalSecondary === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-red-600 text-white shadow-red-100 hover:bg-red-700'
                }`}
              >
                <i className="fa-solid fa-times-circle"></i>
                Reprovar CQ
              </button>
              <button
                onClick={handleApprove}
                disabled={totalCritical > 0 || totalSecondary > 0}
                title={
                  totalCritical > 0 || totalSecondary > 0
                    ? 'Não é possível aprovar com falhas registradas. Utilize Reprovar CQ.'
                    : comments && comments.trim().length > 0
                    ? 'Aprovar com Ressalvas: estudo aprovado mas com observações a serem corrigidas'
                    : 'Aprovar: estudo sem falhas e sem ressalvas'
                }
                className={`px-8 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                  totalCritical > 0 || totalSecondary > 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-green-600 text-white shadow-green-100 hover:bg-green-700'
                }`}
              >
                <i className="fa-solid fa-check-double"></i>
                {comments && comments.trim().length > 0 && totalCritical === 0 && totalSecondary === 0
                  ? 'Aprovar CQ com Ressalva'
                  : 'Aprovar CQ'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
};
