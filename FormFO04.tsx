
import React, { useEffect, useState, useRef } from 'react';
import { FormData } from '../types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from '../constants';

interface FormFO04Props {
  data: FormData;
  onChange: (data: Partial<FormData>) => void;
}

export const FormFO04: React.FC<FormFO04Props> = ({ data, onChange }) => {
  const [showPressureTooltip, setShowPressureTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    onChange({ [name]: processedValue });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const currentFiles = data.selectedFiles || [];
      onChange({ selectedFiles: [...currentFiles, ...newFiles] });
    }
  };

  const removeFile = (index: number) => {
    const currentFiles = data.selectedFiles || [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    onChange({ selectedFiles: updatedFiles });
  };

  // Logic & Calculations for FO.04
  useEffect(() => {
    const updates: Partial<FormData> = {};
    
    // 1. Total Predicted Flow Calculation (Instant + Increment)
    const totalFlow = (Number(data.instantConsumption) || 0) + (Number(data.consumptionIncrement) || 0);
    if (totalFlow !== data.totalPredictedFlow) {
      updates.totalPredictedFlow = totalFlow;
    }

    // 2. Monthly Predicted Consumption Calculation
    const flowValue = updates.totalPredictedFlow ?? data.totalPredictedFlow;
    const normalizedFlow = (typeof flowValue === 'number') ? flowValue : 0;

    const monthlyCons = normalizedFlow * 
                        (Number(data.workHours) || 0) * 
                        (Number(data.workDaysPerWeek) || 0) * 4;
    
    if (monthlyCons !== data.monthlyConsumption) {
      updates.monthlyConsumption = parseFloat(monthlyCons.toFixed(2));
    }

    // 3. Estimated Delivery Date (Request Date + 7 calendar days)
    if (data.requestDate) {
      const requestDateObj = new Date(data.requestDate);
      if (!isNaN(requestDateObj.getTime())) {
        const deliveryDateObj = new Date(requestDateObj);
        deliveryDateObj.setDate(deliveryDateObj.getDate() + 7);
        const deliveryDateStr = deliveryDateObj.toISOString().split('T')[0];
        if (data.estimatedDeliveryDate !== deliveryDateStr) {
          updates.estimatedDeliveryDate = deliveryDateStr;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [data.instantConsumption, data.consumptionIncrement, data.workHours, data.workDaysPerWeek, data.requestDate, data.totalPredictedFlow]);

  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];
  
  // Clean UI classes (removed font-bold from labels)
  const requiredLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-normal";
  const standardLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-normal";
  const inputBaseClass = "flex-grow p-1 rounded outline-none font-normal h-8 text-[10pt]";

  // Alphabetized Options
  const marketOptions = [
    "Climatização", "Cogeração", "GNC", "GNV", "GNV Frota", "Grande Comércio", 
    "Geração", "Geração Contínua", "Geração de Emergência", "Geração de Ponta", 
    "Industrial", "Industrial/Geração Continua", "Termogeração"
  ].sort();

  const fileTypeOptions = [
    "Arquivo KMZ", "Mapa Estudo anterior", "Mapa Geogas", 
    "Pares de Coordenadas", "Print Tela Mapa"
  ].sort();

  const naturgyOptions = ["Capital", "Interior", "SPS"].sort();
  const studyTypeOptions = ["Novo Estudo", "Revisão de Estudo"].sort();
  const pressureRangeOptions = ["AP", "MP"].sort();
  const deliveryPointOptions = ["Aproximado", "Entrada Ramal"].sort();

  return (
    <div className="space-y-8" style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif' }}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section */}
      <div className="bg-[#004080] text-white text-center py-2 px-4 rounded font-bold uppercase tracking-wide text-xs">
        ESTUDO ADR PARA CLIENTES INDUSTRIAIS, GNV, COGERAÇÃO, GERAÇÃO, CLIMATIZAÇÃO E GRANDES COMÉRCIOS
      </div>



      {/* DADOS DO SOLICITANTE */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1 font-bold rounded-t text-[10px] uppercase">DADOS DO SOLICITANTE</div>
        <div className="p-4 border border-slate-200 rounded-b grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${standardLabelClass} w-32`}>Naturgy :</label>
            <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
              <option value="">Selecione...</option>
              {naturgyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Tipo de Estudo :</label>
            <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
              <option value="">Selecione...</option>
              {studyTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          
          {data.studyType === 'Revisão de Estudo' && (
            <div className="col-span-12 flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
              <label className={`${requiredLabelClass} w-32`}>Estudo Anterior :</label>
              <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} placeholder="Código do estudo anterior" />
            </div>
          )}

          <div className="col-span-12 md:col-span-8 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Resp. Solicitação:</label>
            <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 md:col-span-4 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32 md:w-auto`}>Data Solicitação:</label>
            <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 md:col-span-8 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Área Solicitante:</label>
            <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
              <option value="">Selecione a área...</option>
              {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
            </select>
          </div>
          <div className="col-span-12 md:col-span-4 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32 md:w-auto`}>Telefone:</label>
            <input name="phone" value={data.phone || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} placeholder="(XX) XXXXX-XXXX" />
          </div>
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>e-mail:</label>
            <input type="email" name="email" value={data.email || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
        </div>
      </section>

      {/* DADOS BASE DO ESTUDO */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1 font-bold rounded-t text-[10px] uppercase">DADOS BASE DO ESTUDO</div>
        <div className="p-4 border border-slate-200 rounded-b grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Cliente:</label>
            <input name="clientName" value={data.clientName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Mercado:</label>
            <select name="marketCategory" value={data.marketCategory || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
               <option value="">Selecione...</option>
               {marketOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Endereço:</label>
            <input name="address" value={data.address || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 md:col-span-8 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Cidade/Município:</label>
            <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 md:col-span-4 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32 md:w-auto`}>Bairro:</label>
            <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
          </div>
          <div className="col-span-12 md:col-span-6 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Tipo Arquivos:</label>
            <select name="fileType" value={data.fileType || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
               <option value="">Selecione...</option>
               {fileTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-span-12 flex items-center gap-2">
            <label className={`${requiredLabelClass} w-32`}>Ponto de Entrega:</label>
            <select name="deliveryPoint" value={data.deliveryPoint || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
               <option value="">Selecione...</option>
               {deliveryPointOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Technical Data Grid Section */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Consumo Instantâneo:</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="instantConsumption" value={data.instantConsumption ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">m³/h</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Quantidade de horas de trabalho:</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="workHours" value={data.workHours ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">hora</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Consumo previsto mensal (Auto):</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="monthlyConsumption" value={data.monthlyConsumption ?? ''} readOnly className="w-full p-1 border border-slate-200 bg-white rounded text-center h-8 text-[#004080]" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">m³</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Incremento:</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="consumptionIncrement" value={data.consumptionIncrement ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">Nm³/h</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Quant. dias de trabalho/semana:</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="workDaysPerWeek" value={data.workDaysPerWeek ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">dia</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Vazão Total prevista :</label>
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="totalPredictedFlow" value={data.totalPredictedFlow ?? ''} readOnly className="w-full p-1 border border-slate-200 bg-white rounded text-center h-8" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">Nm³/h</span>
                </div>
             </div>
             
             {/* CAMPO PRESSÃO MÍNIMA COM TOOLTIP NO CONJUNTO */}
             <div 
               className="flex items-center gap-2 relative group"
               onMouseEnter={() => setShowPressureTooltip(true)}
               onMouseLeave={() => setShowPressureTooltip(false)}
             >
                <label className={`${standardLabelClass} flex-grow cursor-help underline decoration-dotted decoration-slate-300`}>
                  Pressão mínima :
                </label>
                {showPressureTooltip && (
                  <div className="absolute left-0 bottom-full mb-2 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-[9px] text-slate-600 z-20 w-72 animate-in fade-in zoom-in-95 leading-relaxed font-normal">
                    Informe a pressão mínima desejada para o cliente, lembrando que a pressão de garantia normativa é 2 bares para rede até 4 bares para clientes GNV e 7 bares para Termogeração. Nos demais clientes, será 1 bar para redes MP e 5 bares para redes em AP.
                  </div>
                )}
                <div className="flex items-center gap-2 w-48">
                   <input type="number" name="minPressure" value={data.minPressure ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 font-normal bg-white" />
                   <span className="text-[8px] font-bold text-slate-400 w-12">bar</span>
                </div>
             </div>

             <div className="flex items-center gap-2">
                <label className={`${standardLabelClass} flex-grow`}>Faixa de pressão sugerida :</label>
                <div className="flex items-center gap-2 w-48">
                   <select name="suggestedPressureRange" value={data.suggestedPressureRange || ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded bg-white text-center h-8 text-[9px] font-normal">
                      <option value="">Selecione...</option>
                      {pressureRangeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* DADOS BASE PARA EXPANSÃO (CLIENTE EM SERVIÇO) */}
      <section>
        <div className="bg-white text-[#004080] px-4 py-1 font-bold rounded-t text-[9px] uppercase border-x border-t border-slate-200 flex justify-between">
           <span>DADOS BASE PARA EXPANSÃO DE CONSUMO EM UM CLIENTE EM SERVIÇO</span>
           <div className="flex items-center gap-2">
              <span className="text-[8px] font-normal">Código SAP ISU:</span>
              <input name="sapIsuCode" value={data.sapIsuCode || ''} onChange={handleInputChange} className="w-32 bg-white border border-slate-200 rounded h-5 px-2 text-[10px] outline-none font-normal" />
           </div>
        </div>
        <div className="p-4 border border-slate-200 rounded-b space-y-3 bg-white">
           <div className="flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Nome da Industria:</label>
              <input name="industryName" value={data.industryName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                 <label className={`${standardLabelClass} w-32`}>Cidade/Município:</label>
                 <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
              </div>
              <div className="flex items-center gap-2">
                 <label className={`${standardLabelClass} w-24`}>Bairro:</label>
                 <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                 <label className={`${standardLabelClass} w-32`}>Consumo atual:</label>
                 <div className="flex items-center gap-2 flex-grow">
                    <input type="number" name="currentConsumption" value={data.currentConsumption ?? ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 bg-white rounded text-center h-8 font-normal" />
                    <span className="text-[8px] font-bold text-slate-400 w-8">m³/h</span>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <label className={`${standardLabelClass} w-32`}>Pressão contratual :</label>
                 <div className="flex items-center gap-2 flex-grow">
                    <input type="number" name="contractualPressure" value={data.contractualPressure ?? ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 bg-white rounded text-center h-8 font-normal" />
                    <span className="text-[8px] font-bold text-slate-400 w-8">bar</span>
                 </div>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Faixa de pressão Atual:</label>
              <div className="flex items-center gap-2 w-48">
                 <select name="currentPressureRange" value={data.currentPressureRange || ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 bg-white rounded text-center h-8 text-[9px] font-normal">
                    <option value="">Selecione...</option>
                    {pressureRangeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
              </div>
           </div>
        </div>
      </section>

      {/* Nova Seção: Documentação e Anexos */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Documentação e Anexos</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
              <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
            </div>
            <div className="text-center">
              <p className="font-bold text-[#004080]">Clique para fazer upload ou arraste arquivos</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest text-center">Formatos aceitos: PDF, JPG, PNG, DWG, KMZ (Max. 10MB)</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.dwg,.kmz"
            />
          </div>

          {data.selectedFiles && data.selectedFiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {data.selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <i className="fa-solid fa-file-lines text-[#004080]"></i>
                    <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button 
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:text-red-500 transition-colors text-slate-300"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CONSIDERAÇÕES E PRAZOS */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
         <h4 className="font-bold text-[#004080] mb-4 uppercase text-[9px]">Considerações sobre a solicitação</h4>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
               <label className="text-[9px] text-slate-500 uppercase font-normal">Prazo dias:</label>
               <input type="text" readOnly value="até 5 dias úteis" className="flex-grow p-2 border border-slate-200 rounded bg-white text-slate-600 text-center font-normal" />
            </div>
            <div className="flex items-center gap-4">
               <label className="text-[9px] text-slate-500 uppercase tracking-tight font-normal">Data entrega estimada (Solicitação + 7):</label>
               <input type="date" readOnly value={data.estimatedDeliveryDate || ''} className="flex-grow p-2 border border-slate-200 rounded bg-white text-[#004080] font-bold text-center" />
            </div>
         </div>
      </section>

      {/* COMENTÁRIOS */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1 font-bold rounded-t text-[10px] uppercase">COMENTÁRIOS:</div>
        <div className="p-4 border border-slate-200 rounded-b bg-white">
          <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} rows={6} className="w-full p-4 border border-slate-300 rounded outline-none bg-white font-normal text-slate-700" placeholder="Insira detalhes sobre o processo produtivo, GNV ou necessidades de pressão específicas..." />
        </div>
      </section>

      
    </div>
  );
};
