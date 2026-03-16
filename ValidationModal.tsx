import React, { useState } from 'react';
import { FormData, StudyStatus, FormType } from './types';

interface ValidationModalProps {
  initialData: FormData;
  executors: { id: string, name: string }[];
  onConfirm: (assignedTo: string, validationData: Partial<FormData>) => void;
  onReject?: (reason: string) => void;
  onCancel: () => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  initialData,
  executors,
  onConfirm,
  onReject,
  onCancel
}) => {
  const [assignedAnalyst, setAssignedAnalyst] = useState(initialData?.assignedTo || '');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Demanda e Parâmetros Técnicos
  const [gasType, setGasType] = useState(initialData?.gasType || 'GN');
  const [suggestedPressureRange, setSuggestedPressureRange] = useState(initialData?.suggestedPressureRange || '');
  
  const defaultMinPressure = (range: string) => {
    if (range === 'BP-N') return 19;
    if (range.includes('MP-N')) return 1;
    return '';
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

  const handleConfirm = () => {
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
      validatorObservations
    });
  };
  
  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Por favor, informe o motivo da rejeição.');
      return;
    }
    onReject?.(rejectionReason);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-[#004080] uppercase tracking-tight">
            {initialData?.assignedTo ? 'Reatribuir Estudo' : 'Validar e Atribuir Estudo'}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        <p className="text-xs text-slate-500 font-bold uppercase mb-6">
          Preencha os dados técnicos e atribua o estudo a um analista para execução.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Coluna 1: Demanda e Parâmetros e Atribuição */}
          <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Demanda e Parâmetros Técnicos</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Gás</label>
                  <select value={gasType} onChange={e => setGasType(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]">
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
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]"
                  >
                    <option value="">Selecione</option>
                    {/* FO01 opções baseadas no pedido anterior */}
                    <option value="BP-N">BP-N</option>
                    <option value="MP-N até 2 bar">MP-N até 2 bar</option>
                    <option value="MP-N até 4 bar">MP-N até 4 bar</option>
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
                      className="w-full p-3 border border-slate-200 rounded-l-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]"
                    />
                    <span className="bg-slate-100 border border-l-0 border-slate-200 px-3 py-3 rounded-r-xl text-xs font-bold text-[#004080]">
                      {suggestedPressureRange === 'BP-N' ? 'mbar' : 'bar'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-6 mt-4 pt-4 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${mapReceived ? 'bg-[#004080] border-[#004080]' : 'bg-white border-slate-300 group-hover:border-[#004080]'}`}>
                    {mapReceived && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                  </div>
                  <input type="checkbox" className="hidden" checked={mapReceived} onChange={(e) => setMapReceived(e.target.checked)} />
                  <span className="text-[10px] font-black text-slate-700 uppercase">Mapa Recebido</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${relevantStudy ? 'bg-[#004080] border-[#004080]' : 'bg-white border-slate-300 group-hover:border-[#004080]'}`}>
                    {relevantStudy && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                  </div>
                  <input type="checkbox" className="hidden" checked={relevantStudy} onChange={(e) => setRelevantStudy(e.target.checked)} />
                  <span className="text-[10px] font-black text-slate-700 uppercase">Estudo Relevante</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável pela Execução</label>
              <select 
                value={assignedAnalyst}
                onChange={(e) => setAssignedAnalyst(e.target.value)}
                className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-slate-50 text-sm font-bold text-[#004080]"
              >
                <option value="">Sistema (Fila Comum)</option>
                {executors.map(exec => (
                  <option key={exec.id} value={exec.id}>{exec.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Coluna 2: Controle da Análise (GNI) e Observacoes */}
          <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
               <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Controle da Análise (GNI)</h4>
               
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nomes GNI</label>
                 <select value={gniName} onChange={e => setGniName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]">
                    <option value="">Selecione</option>
                    <option value="Abastecimento Novos Municípios GNC - Análise de zonas de expansão">Abastecimento Novos Municípios GNC - Análise de zonas de expansão</option>
                    <option value="Análise de redes MP-BP (D+C) - Residencial/Comercial - Estudo de Viabilidade Técnica">Análise de redes MP-BP (D+C) - Residencial/Comercial - Estudo de Viabilidade Técnica</option>
                    <option value="Análise de zonas de redes de Alta Pressão - Planejamento Reforços/Religamento AP (Elaboração/Revisão)">Análise de zonas de redes de Alta Pressão - Planejamento Reforços/Religamento AP (Elaboração/Revisão)</option>
                    <option value="Atualização da Rede e Consumos - Elaboração/Revisão de Modelos Matemáticos Winflow">Atualização da Rede e Consumos - Elaboração/Revisão de Modelos Matemáticos Winflow</option>
                    <option value="Estudos Dinâmicos Wintran - Estudos GNC / Manobras">Estudos Dinâmicos Wintran - Estudos GNC / Manobras</option>
                    <option value="Estudos Especiais - Estudos Especiais (Propostas Expansão GNV, Levantamento de Dados, etc)">Estudos Especiais - Estudos Especiais (Propostas Expansão GNV, Levantamento de Dados, etc)</option>
                    <option value="Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica - Informes de viabilidade de fornecimento">Grandes Clientes (IND/GNV/GER/ETC) - Estudo de Viabilidade Técnica - Informes de viabilidade de fornecimento</option>
                    <option value="Projeto/Revisão de novos eixos - Planejamento Reforços/Religamento MP/BP (Elaboração/Revisão)">Projeto/Revisão de novos eixos - Planejamento Reforços/Religamento MP/BP (Elaboração/Revisão)</option>
                    <option value="Projeto/Revisão de novos municípios - Planejamento de Novos municípios (Elaboração/Revisão)">Projeto/Revisão de novos municípios - Planejamento de Novos municípios (Elaboração/Revisão)</option>
                 </select>
               </div>

               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Estudo</label>
                 <select value={studyType} onChange={e => setStudyType(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]">
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
                   <select value={studySubType} onChange={e => setStudySubType(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]">
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
                   <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#004080] bg-white text-xs font-bold text-[#004080]">
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
                  className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-[#004080] bg-slate-50 text-sm font-medium text-[#004080] h-28 resize-none"
                  placeholder="Instruções ou notas adicionais para o analista responsável pela execução..."
               />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="flex gap-4">
            <button onClick={onCancel} className="px-6 py-3 text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors">Cancelar</button>
            {onReject && (
              <button 
                onClick={() => setIsRejecting(!isRejecting)} 
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all border ${isRejecting ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-400 border-slate-200 hover:text-red-500 hover:border-red-200'}`}
              >
                {isRejecting ? 'Voltar' : 'Rejeitar Estudo'}
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
                <i className="fa-solid fa-check"></i>
                Validar Estudo e Atribuir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
