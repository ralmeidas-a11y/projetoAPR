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

  const [qcStatus, setQcStatus] = useState<'Definir' | 'Aprovado' | 'Reprovado'>(existing.qcStatusCQ || 'Definir');
  const [supervisor, setSupervisor] = useState(existing.qcSupervisor || currentUser?.name || '');
  const [criticalCounts, setCriticalCounts] = useState<Record<string, number>>(existing.qcCriticalFailures || {});
  const [secondaryCounts, setSecondaryCounts] = useState<Record<string, number>>(existing.qcSecondaryFailures || {});
  const [comments, setComments] = useState(existing.qcComments || '');
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);

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
        // Direct fetch to API
        const url = `/api/qc-history/${encodeURIComponent(data.studyNumber)}`;
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
  const allIterations = [...dbIterations, ...iterations];
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
    if (hasFailures) {
      setShowConfirmApprove(true);
    } else {
      doApprove(false);
    }
  };

  const handleClearFailures = () => {
    setCriticalCounts({});
    setSecondaryCounts({});
  };

  const handleReject = () => {
    if (!onReject) return;
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
    const key = String(idx + 1); // Use 1-based indexing for backend mapping
    const current = criticalCounts[key] || 0;
    const next = Math.max(0, current + delta);
    setCriticalCounts({ ...criticalCounts, [key]: next });
  };

  const updateSecondary = (idx: number, delta: number) => {
    if (readOnly) return;
    const key = String(idx + 13); // Use 13-15 for secondary
    const current = secondaryCounts[key] || 0;
    const next = Math.max(0, current + delta);
    setSecondaryCounts({ ...secondaryCounts, [key]: next });
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

        {/* Body */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {/* Info Row */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="col-span-4 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Solicitação Controle</span>
              <span className="text-xs font-bold text-slate-700">
                {existing.qcRequestDate ? formatDateTimeBR(existing.qcRequestDate) : (data.qcRequestDate ? formatDateTimeBR(data.qcRequestDate) : (data.completedAt ? formatDateTimeBR(data.completedAt) : '-'))}
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
                      onChange={(e) => setComments(e.target.value)}
                      rows={4}
                      className="w-full border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-700 outline-none focus:border-[#004080] resize-none"
                      placeholder="Observações do revisor..."
                    />
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Iterations sidebar */}
            <div className="w-64 border-l border-slate-200 bg-slate-50/50 p-4 shrink-0 flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Revisões do CQ
                </span>
                <div className="space-y-2">
                  {allIterations.length === 0 && (
                    <div className="text-[10px] text-slate-400 font-bold italic text-center py-4">
                      Nenhuma revisão anterior.
                    </div>
                  )}
                  {allIterations.map((it: any, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedRevision(it)}
                      className={`p-3 rounded-lg border text-[10px] font-bold cursor-pointer hover:shadow-md transition-all ${it.status === 'Aprovado' ? 'bg-green-50 border-green-200 text-green-700' :
                        it.status === 'Reprovado' ? 'bg-red-50 border-red-200 text-red-700' :
                          'bg-white border-slate-200 text-slate-500'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="uppercase tracking-wider font-black">{it.status}</span>
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
                  {/* Current pending iteration */}
                  {!readOnly && (
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
                    Estudo: {data.studyNumber}
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
                  <div className={`px-4 py-2 rounded-lg font-black text-xs uppercase ${
                    selectedRevision.status === 'Reprovado' ? 'bg-red-100 text-red-700 border border-red-200' :
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
                className="px-8 py-3.5 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <i className="fa-solid fa-times-circle"></i>
                Reprovar CQ
              </button>
              <button
                onClick={handleApprove}
                className="px-8 py-3.5 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <i className="fa-solid fa-check-double"></i>
                Aprovar CQ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation popup for approving with failures */}
      {
        showConfirmApprove && (
          <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 mx-4 border border-slate-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600 text-2xl"></i>
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-800 uppercase tracking-tight">Decisão de Aprovação</h4>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Identificamos falhas no estudo</p>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                  Foram registradas <strong className="text-red-600">{totalCritical} falhas críticas</strong> e <strong className="text-amber-600">{totalSecondary} secundárias</strong>.
                  Como você deseja prosseguir com a aprovação deste estudo?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                <button
                  onClick={() => { setShowConfirmApprove(false); doApprove(true); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-file-signature text-amber-700"></i>
                  </div>
                  <div>
                    <span className="block font-black text-[11px] text-amber-800 uppercase">Aprovar com Ressalvas</span>
                    <span className="block text-[9px] text-amber-600 font-bold mt-0.5">O analista será notificado</span>
                  </div>
                </button>

                <button
                  onClick={() => { setShowConfirmApprove(false); doApprove(false); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-check-double text-green-700"></i>
                  </div>
                  <div>
                    <span className="block font-black text-[11px] text-green-800 uppercase">Aprovar Sem Ressalvas</span>
                    <span className="block text-[9px] text-green-600 font-bold mt-0.5">Aprovação imediata</span>
                  </div>
                </button>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowConfirmApprove(false)}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all py-2"
                >
                  Voltar para o Controle
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};
