import React, { useState, useEffect } from 'react';
import { FormData, StudyStatus, FormType, User } from '../types/types';
import { isSystemAssigned, calculateDeadline } from '../utils/utils';
import { PRESSURE_BASES } from '../constants/constants';
import { useDialog } from './AppDialog';
import { LocationPickerModal } from './LocationPickerModal';

interface ValidationModalProps {
  initialData: FormData;
  executors: (User & { role?: string })[];
  onConfirm: (assignedTo: string, validationData: Partial<FormData>) => void;
  onReject?: (reason: string) => void;
  onCancel: () => void;
  onOpenFiles?: () => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  initialData,
  executors,
  onConfirm,
  onReject,
  onCancel,
  onOpenFiles
}) => {
  const { showAlert } = useDialog();
  const [assignedAnalyst, setAssignedAnalyst] = useState(initialData?.assignedTo || 'ADRSis - SISTEMA');
  const [hasInteractedWithAnalyst, setHasInteractedWithAnalyst] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Sincroniza o analista selecionado com a lista de executores (resolvendo SAP/Email para ID interno ou SAP)
  // APENAS se o usuário ainda não tiver interagido manualmente com o seletor.
  useEffect(() => {
    if (!hasInteractedWithAnalyst && initialData?.assignedTo && !isSystemAssigned(initialData.assignedTo)) {
      const idClean = initialData.assignedTo.trim().toLowerCase();
      const idSapClean = idClean.replace(/^0+/, '');

      const found = executors.find(e =>
        e.id.toLowerCase() === idClean ||
        e.email?.toLowerCase() === idClean ||
        e.sap?.trim().replace(/^0+/, '') === idSapClean
      );

      if (found) {
        const valueToSet = found.sap || found.id;
        if (valueToSet !== assignedAnalyst) {
          setAssignedAnalyst(valueToSet);
        }
      }
    }
  }, [initialData?.assignedTo, executors, hasInteractedWithAnalyst]);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const isPendingValidation = String(initialData?.status) === '330' || initialData?.status === StudyStatus.EM_ANALISE || initialData?.status === StudyStatus.PENDENTE;
  const isReadOnly = !isPendingValidation && (initialData?.status !== undefined && (initialData?.status as any) !== 'Aberto');

  const resolveUserName = (id: string | undefined | null, fallbackName?: string) => {
    if (!id || isSystemAssigned(id)) return 'Sistema';

    // Procura por ID, Email ou SAP (limpando zeros à esquerda)
    const idClean = id.trim().toLowerCase();
    const idSapClean = idClean.replace(/^0+/, '');

    const found = executors.find(e =>
      e.id.toLowerCase() === idClean ||
      e.email?.toLowerCase() === idClean ||
      e.sap?.trim().replace(/^0+/, '') === idSapClean
    );

    if (found) return found.name;
    if (fallbackName && fallbackName !== id) return fallbackName;
    return id;
  };

  // Demanda e Parâmetros Técnicos
  const [gasType, setGasType] = useState(initialData?.gasType || 'GN');
  const [suggestedPressureRange, setSuggestedPressureRange] = useState(initialData?.suggestedPressureRange || '');

  const defaultMinPressure = (range: string) => {
    const found = PRESSURE_BASES.find(p => p.base === range);
    return found ? found.pmin : '';
  };

  const [minPressure, setMinPressure] = useState<number | ''>(initialData?.minPressure !== undefined ? initialData.minPressure! : defaultMinPressure(initialData?.suggestedPressureRange || ''));
  const [mapReceived, setMapReceived] = useState(initialData?.mapReceived || false);
  const [relevantStudy, setRelevantStudy] = useState(initialData?.relevantStudy || false);

  // Controle da Análise (GNI)
  const [gniName, setGniName] = useState(initialData?.gniName || '');
  const [studyType, setStudyType] = useState(initialData?.studyType || '');
  const [studySubType, setStudySubType] = useState(initialData?.studySubType || '');
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || '');
  const [validatorObservations, setValidatorObservations] = useState(initialData?.validatorObservations || '');
  const isValidISODate = (dateStr: string | undefined | null): boolean => {
    if (!dateStr) return false;
    return /^\d{4}-\d{2}-\d{2}/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
  };
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    isValidISODate(initialData?.estimatedDeliveryDate)
      ? initialData.estimatedDeliveryDate
      : calculateDeadline(initialData?.requestDate, initialData?.formType || '')
  );

  const handleConfirm = () => {
    const today = new Date().toISOString();

    // If we're validating for the first time or changing validation, 
    // we use "now" as validationDate unless it already exists.
    const validationDate = initialData?.validationDate || today;

    // Recalculate deadline based on validation date if it hasn't been manually overridden
    // or if this is the first validation.
    let finalDeadline = estimatedDeliveryDate;
    if (!initialData?.validationDate) {
      // Use requestDate (submission date) or createdAt as the basis for the deadline, NOT the validation date.
      const basisDate = initialData?.requestDate || initialData?.createdAt || validationDate;
      finalDeadline = calculateDeadline(basisDate, initialData?.formType || '');
    }

    onConfirm(assignedAnalyst, {
      gasType,
      suggestedPressureRange,
      minPressure,
      mapReceived,
      relevantStudy,
      gniName,
      studyType,
      studySubType,
      difficulty,
      validatorObservations,
      estimatedDeliveryDate: finalDeadline,
      validationDate: validationDate
    });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      showAlert('Por favor, informe o motivo da rejeição.', 'Campo Obrigatório', 'warning');
      return;
    }
    // Also clear validationDate on reject
    onReject?.(rejectionReason);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-7xl shadow-2xl animate-in zoom-in-95 duration-200 my-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight">
              {initialData?.assignedTo && initialData.assignedTo !== 'ADRSis - SISTEMA'
                ? `Atribuição: ${resolveUserName(initialData.assignedTo, initialData.assignedToName)}`
                : 'Validar e Atribuir Estudo'}
            </h3>
            {onOpenFiles && (
              <button
                onClick={onOpenFiles}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-green-100 shadow-sm active:scale-95"
                title="Ver arquivos da solicitação"
              >
                <i className="fa-solid fa-folder-open"></i>
                Ver Pasta
              </button>
            )}
            {initialData?.latitude && initialData?.longitude && (
              <button
                onClick={() => setShowLocationPicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-blue-100 shadow-sm active:scale-95"
                title="Ver localização no mapa"
              >
                <i className="fa-solid fa-map-marker-alt"></i>
                Ver Localização
              </button>
            )}
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        <p className="text-xs text-slate-500 font-bold uppercase mb-4">
          Preencha os dados técnicos e atribua o estudo a um analista para execução.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* Coluna 1: Demanda e Parâmetros e Atribuição */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">Demanda e Parâmetros Técnicos</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Gás</label>
                  <select value={gasType} onChange={e => setGasType(e.target.value)} disabled={isReadOnly} className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}>
                    <option value="">Selecione</option>
                    <option value="GN">GN</option>
                    <option value="GLP">GLP</option>
                    <option value="GNL">GNL</option>
                    <option value="GNC">GNC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faixa de Pressão</label>
                  <select
                    value={suggestedPressureRange}
                    onChange={e => {
                      setSuggestedPressureRange(e.target.value);
                      setMinPressure(defaultMinPressure(e.target.value));
                    }}
                    className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                    disabled={isReadOnly}
                  >
                    <option value="">Selecione</option>
                    {PRESSURE_BASES.map(p => (
                      <option key={p.base} value={p.base}>{p.base}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pressão Min.</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={minPressure}
                      onChange={e => setMinPressure(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full p-2 border border-slate-200 rounded-l-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                      disabled={isReadOnly}
                    />
                    <span className="bg-slate-100 border border-l-0 border-slate-200 px-3 py-2 rounded-r-xl text-xs font-bold text-[#004080]">
                      {PRESSURE_BASES.find(p => p.base === suggestedPressureRange)?.unidade || 'bar'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-6 mt-2 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${mapReceived ? 'bg-[#004080] border-[#004080]' : 'bg-white border-slate-300 group-hover:border-[#004080]'}`}>
                    {mapReceived && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                  </div>
                  <input type="checkbox" className="hidden" checked={mapReceived} onChange={(e) => setMapReceived(e.target.checked)} disabled={isReadOnly} />
                  <span className="text-[10px] font-black text-slate-700 uppercase">Mapa Recebido</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${relevantStudy ? 'bg-[#004080] border-[#004080]' : 'bg-white border-slate-300 group-hover:border-[#004080]'}`}>
                    {relevantStudy && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                  </div>
                  <input type="checkbox" className="hidden" checked={relevantStudy} onChange={(e) => setRelevantStudy(e.target.checked)} disabled={isReadOnly} />
                  <span className="text-[10px] font-black text-slate-700 uppercase">Estudo Relevante</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável pela Execução</label>
              <select
                value={assignedAnalyst}
                onChange={(e) => {
                  setAssignedAnalyst(e.target.value);
                  setHasInteractedWithAnalyst(true);
                }}
                className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-slate-50 text-sm font-bold text-[#004080]"
              >
                <option value="ADRSis - SISTEMA">ADRSIS - Sistema</option>
                {executors
                  .filter(exec =>
                    exec.name !== 'ADRSis - SISTEMA' &&
                    exec.name !== 'ADRSis - Sistema' &&
                    exec.name !== 'ADRSIS - SISTEMA' &&
                    exec.role !== 'Solicitante'
                  )
                  .map(exec => (
                    <option key={exec.id} value={exec.sap || exec.id}>{exec.name}</option>
                  ))}
              </select>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-4">
              <label className="block text-[10px] font-black text-[#004080] uppercase tracking-widest mb-2">
                <i className="fa-solid fa-calendar-check mr-1.5 opacity-60"></i>
                Prazo de Entrega Estimado
              </label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]"
              />
              <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">
                {initialData?.formType === 'PE.00492-FO.02' ? '* 7 dias corridos' : '* 5 dias úteis'}
              </p>
            </div>
          </div>

          {/* Coluna 2: Controle da Análise (GNI) e Observacoes */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">Controle da Análise (GNI)</h4>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nomes GNI</label>
                <select value={gniName} onChange={e => setGniName(e.target.value)} disabled={isReadOnly} className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}>
                  <option value="">Selecione</option>
                  <option value="Abastecimento Novos Municípios GNC">Abastecimento Novos Municípios GNC</option>
                  <option value="Residencial/Comercial - Estudo de Viabilidade Técnica">Residencial/Comercial - Estudo de Viabilidade Técnica</option>
                  <option value="Planificação Reforços/Religamento AP (Elaboração/Revisão)">Planificação Reforços/Religamento AP (Elaboração/Revisão)</option>
                  <option value="Elaboração/Revisão de Modelos Matemáticos Winflow">Elaboração/Revisão de Modelos Matemáticos Winflow</option>
                  <option value="Estudos GNNC / Manobras">Estudos GNNC / Manobras</option>
                  <option value="Estudes Especiais (Propostas Expansão GNV, Levantamento de Dados, etc)">Estudes Especiais (Propostas Expansão GNV, Levantamento de Dados, etc)</option>
                  <option value="Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica">Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica</option>
                  <option value="Planificação Reforços/Religamento MP/BP (Elaboração/Revisão)">Planificação Reforços/Religamento MP/BP (Elaboração/Revisão)</option>
                  <option value="Planificação de Novos municípios (Elaboração/Revisão)">Planificação de Novos municípios (Elaboração/Revisão)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Estudo</label>
                <select value={studyType} onChange={e => setStudyType(e.target.value)} disabled={isReadOnly} className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}>
                  <option value="">Selecione</option>
                  <option value="Confiabilidade da Rede">Confiabilidade da Rede</option>
                  <option value="Conversão GN">Conversão GN</option>
                  <option value="Definir">Definir</option>
                  <option value="Expansão de Rede">Expansão de Rede</option>
                  <option value="Expansão GNV">Expansão GNV</option>
                  <option value="GNNC">GNNC</option>
                  <option value="Incremento de Vazão">Incremento de Vazão</option>
                  <option value="Modelos de Cálculo">Modelos de Cálculo</option>
                  <option value="Operação de Rede">Operação de Rede</option>
                  <option value="Outra">Outra</option>
                  <option value="Remanejamento">Remanejamento</option>
                  <option value="Renovação de Rede">Renovação de Rede</option>
                  <option value="Reforço">Reforço</option>
                  <option value="Saturação">Saturação</option>
                  <option value="Setorização ERDs">Setorização ERDs</option>
                  <option value="Solicitação Gerencial">Solicitação Gerencial</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sub-tipo de Estudo</label>
                  <select value={studySubType} onChange={e => setStudySubType(e.target.value)} disabled={isReadOnly} className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}>
                    <option value="">Selecione</option>
                    <option value="Análise de Pressões e Vazões">Análise de Pressões e Vazões</option>
                    <option value="Climatização">Climatização</option>
                    <option value="Cogeração">Cogeração</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Consulta Avulsas">Consulta Avulsas</option>
                    <option value="Definir">Definir</option>
                    <option value="Emergencial">Emergencial</option>
                    <option value="Estação de Liquefação - GNL">Estação de Liquefação - GNL</option>
                    <option value="Expansão GNV">Expansão GNV</option>
                    <option value="Gaseificação Parcial">Gaseificação Parcial</option>
                    <option value="Gaseificação Total">Gaseificação Total</option>
                    <option value="Geração">Geração</option>
                    <option value="Geração Continua">Geração Continua</option>
                    <option value="Geração de Emergência">Geração de Emergência</option>
                    <option value="Geração de Ponta">Geração de Ponta</option>
                    <option value="GNC">GNC</option>
                    <option value="GNV">GNV</option>
                    <option value="GNV Frota">GNV Frota</option>
                    <option value="Grande Comércio">Grande Comércio</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Industrial/Geração Continua">Industrial/Geração Continua</option>
                    <option value="Infra-estrutura">Infra-estrutura</option>
                    <option value="Levantamento de Dados">Levantamento de Dados</option>
                    <option value="Mapas Temático">Mapas Temático</option>
                    <option value="MECOM">MECOM</option>
                    <option value="Programado">Programado</option>
                    <option value="Reforço">Reforço</option>
                    <option value="Remanejamento">Remanejamento</option>
                    <option value="Renovação">Renovação</option>
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial/Comercial">Residencial/Comercial</option>
                    <option value="Setorização ERDs">Setorização ERDs</option>
                    <option value="Simulação">Simulação</option>
                    <option value="Termogeração">Termogeração</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dificuldade</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} disabled={isReadOnly} className={`w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080] ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}>
                    <option value="">Selecione</option>
                    <option value="Fácil">Fácil</option>
                    <option value="Médio">Médio</option>
                    <option value="Difícil">Difícil</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Observações do Validador</label>
              <textarea
                value={validatorObservations}
                onChange={e => setValidatorObservations(e.target.value)}
                disabled={isReadOnly}
                className={`w-full p-2.5 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-slate-50 text-sm font-medium text-[#004080] h-20 resize-none ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="Instruções ou notas adicionais para o analista responsável pela execução..."
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-slate-100">
          <div className="flex gap-4">
            <button onClick={onCancel} className="px-6 py-3 text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors">Cancelar</button>
            {onReject && (
              <button
                onClick={() => setIsRejecting(!isRejecting)}
                className={`px-10 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-lg active:scale-95 ${isRejecting ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-indigo-50' : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}
              >
                {isRejecting ? 'Voltar para Validação' : 'Rejeitar Estudo'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {isRejecting ? (
              <div className="flex items-center gap-3 w-full md:w-96 animate-in slide-in-from-right-4 duration-300">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Motivo da rejeição..."
                  className="flex-grow p-3 border border-red-100 rounded-xl outline-none focus:border-red-500 bg-red-50/20 text-xs font-bold text-red-700"
                />
                <button
                  onClick={handleReject}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-red-100 transition-all active:scale-95 whitespace-nowrap"
                >
                  Confirmar
                </button>
              </div>
            ) : (
              <button
                onClick={handleConfirm}
                className="w-full md:w-auto px-10 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <i className={`fa-solid ${isPendingValidation ? 'fa-paper-plane' : 'fa-floppy-disk'}`}></i>
                {isPendingValidation ? 'Enviar para Execução' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          initialLocation={{
            latitude: initialData?.latitude,
            longitude: initialData?.longitude,
            address: initialData?.address,
            neighborhood: initialData?.neighborhood,
            city: initialData?.city
          }}
          readOnly={true}
        />
      )}
    </div>
  );
};
