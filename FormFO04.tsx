import React, { useState, useRef } from 'react';
import { FormData } from './types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from './constants';
import { formatDate } from './utils';

interface FormFO04Props {
  data: FormData;
  onChange: (data: Partial<FormData>) => void;
  readOnly?: boolean;
}

export const FormFO04: React.FC<FormFO04Props> = ({ data, onChange, readOnly = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (readOnly) return;
    const { name, value, type } = e.target;
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    if (name === 'uteName') {
      onChange({ [name]: processedValue, studyTitle: value });
    } else {
      onChange({ [name]: processedValue });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const currentFiles = data.selectedFiles || [];
      onChange({ selectedFiles: [...currentFiles, ...newFiles] });
    }
  };

  const removeFile = (index: number) => {
    if (readOnly) return;
    const currentFiles = data.selectedFiles || [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    onChange({ selectedFiles: updatedFiles });
  };

  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];

  const renderField = (label: string, value: any, isRequired = false) => {
    return (
      <div className="flex flex-col border-b border-slate-100 py-1">
        <span className="text-[9px] text-[#004080] font-bold uppercase tracking-tight pb-0.5">{label}</span>
        <span className="text-[10pt] font-semibold text-slate-800 pb-0.5">{value || '-'}</span>
      </div>
    );
  };

  // Helper label width to keep consistency
  const labelClass = "text-[9px] font-bold text-[#004080] shrink-0 pb-0.5 uppercase tracking-tight";
  const requiredLabelClass = "text-[9px] font-bold text-[#004080] shrink-0 pb-0.5 uppercase tracking-tight";
  const inputBaseClass = "flex-grow p-1 rounded outline-none font-normal h-8 text-[10pt] mb-0.5";

  return (
    <div className={`${readOnly ? 'w-full' : 'max-w-4xl mx-auto'} space-y-6 ${readOnly ? 'pb-4' : 'pb-20'}`}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section from PDF */}
      <div className="bg-[#004080] text-white text-center py-2 px-4 rounded font-bold uppercase tracking-wide text-xs">
        ESTUDO ADR PARA VIABILIDADE TÉCNICA DE EMPREENDIMENTO TERMELETRICO
      </div>

      {/* Dados do Solicitante */}
      <section className="bg-white border border-slate-200">
         <div className="bg-[#004080] text-white px-4 py-1.5 font-bold text-[10px] uppercase">Dados do Solicitante</div>
         {readOnly ? (
           <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-2 bg-white">
             <div className="col-span-12 md:col-span-4">{renderField("Naturgy", data.naturgyUnit)}</div>
             <div className="col-span-12 md:col-span-4">{renderField("Tipo de Estudo", data.studyType, true)}</div>
             <div className="col-span-12 md:col-span-4">{renderField("Data Solicitação", formatDate(data.requestDate), true)}</div>
             {data.studyType === 'Revisão de Estudo' && (
               <div className="col-span-12">{renderField("Estudo Anterior", data.previousStudy, true)}</div>
             )}
             <div className="col-span-12 md:col-span-8">{renderField("Resp. Solicitação", data.requesterName, true)}</div>
             <div className="col-span-12 md:col-span-4">{renderField("Telefone", data.phone)}</div>
             <div className="col-span-12 md:col-span-8">{renderField("Área Solicitante", data.requesterArea)}</div>
             <div className="col-span-12 md:col-span-4">{renderField("E-mail", data.email)}</div>
           </div>
         ) : (
           <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-3 bg-white">
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${labelClass} w-32`}>Naturgy :</label>
              <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Capital">Capital</option>
                <option value="Interior">Interior</option>
                <option value="SPS">SPS</option>
              </select>
            </div>
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Tipo de Estudo :</label>
              <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Novo Estudo">Novo Estudo</option>
                <option value="Revisão de Estudo">Revisão de Estudo</option>
              </select>
            </div>
            {data.studyType === 'Revisão de Estudo' && (
              <div className="col-span-12 flex items-center gap-2">
                <label className={`${requiredLabelClass} w-32`}>Estudo Anterior :</label>
                <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} placeholder="Código do estudo anterior" />
              </div>
            )}
            <div className="col-span-12 md:col-span-8 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Resp. Solicitação:</label>
              <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32 md:w-auto`}>Data da Solicitação:</label>
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
         )}
      </section>

      {/* DADOS BASE DO ESTUDO */}
      <section className="bg-white border border-slate-200">
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold text-[10px] uppercase">DADOS BASE DO ESTUDO</div>
        {readOnly ? (
          <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-2 bg-white">
            <div className="col-span-12 md:col-span-8">{renderField("Nome da UTE", data.uteName, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Mercado", "Termogeração")}</div>
            <div className="col-span-12">{renderField("Endereço", data.address, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Cidade", data.city, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Bairro", data.neighborhood, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Estado", data.state, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Nível Pressão", data.gasPressureLevel, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Vazão Média", `${data.averageFlow || '0'} Nm³/h`, true)}</div>
            <div className="col-span-12 md:col-span-4">{renderField("Vazão Pico", `${data.peakFlow || '0'} Nm³/h`, true)}</div>

            {/* Documentação Específica do Estudo */}
             <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 border-t border-slate-100 pt-3">
                {renderField("Prazo dias", "até 5 dias úteis")}
                {renderField("Data Inicial Opera.", formatDate(data.operationStartDate))}
             </div>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-3 bg-white">
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={requiredLabelClass}>Nome da UTE:</label>
              <input name="uteName" value={data.uteName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Mercado:</label>
              <input readOnly value="Termogeração" className={`${inputBaseClass} border border-slate-200 bg-slate-50 text-slate-500`} />
            </div>
            <div className="col-span-12 flex flex-col gap-1">
              <label className={requiredLabelClass}>Endereço:</label>
              <input name="address" value={data.address || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Cidade:</label>
              <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Bairro:</label>
              <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Estado:</label>
              <select name="state" value={data.state || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Rio de Janeiro">Rio de Janeiro</option>
                <option value="São Paulo">São Paulo</option>
                <option value="Rio/São Paulo">Rio/São Paulo</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Grid Consumos */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6 mt-2 pt-3 border-t border-slate-100">
               <div className="flex flex-col gap-1">
                  <label className={requiredLabelClass}>Nível de Pressão Solicitado:</label>
                  <div className="flex items-center gap-2">
                     <input type="number" name="gasPressureLevel" value={data.gasPressureLevel ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                     <span className="text-[8px] font-bold text-slate-400">bar</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1">
                  <label className={requiredLabelClass}>Vazão Média (24h) :</label>
                  <div className="flex items-center gap-2">
                     <input type="number" name="averageFlow" value={data.averageFlow ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                     <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1">
                  <label className={requiredLabelClass}>Vazão de Pico :</label>
                  <div className="flex items-center gap-2">
                     <input type="number" name="peakFlow" value={data.peakFlow ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                     <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                  </div>
               </div>
            </div>
          </div>
        )}
      </section>

      {/* Documentação e Anexos */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">Documentação e Anexos</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          {!readOnly && (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#004080]">Anexe arquivos KMZ ou tabelas de coordenadas</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest text-center">Formatos: PDF, KMZ, JPG, PNG, DWG (Max. 10MB)</p>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".pdf,.kmz,.jpg,.jpeg,.png,.dwg" />
            </div>
          )}

          {data.selectedFiles && data.selectedFiles.length > 0 && (
            <div className={`grid grid-cols-1 ${!readOnly ? 'md:grid-cols-2' : ''} gap-3 mt-4`}>
              {data.selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    <i className="fa-solid fa-file-lines text-[#004080] shrink-0"></i>
                    <span className="text-xs font-medium text-slate-700 break-all">{file.name}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  {!readOnly && (
                    <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors text-slate-300">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {readOnly && (!data.selectedFiles || data.selectedFiles.length === 0) && (
            <p className="text-xs text-slate-400 italic text-center py-4 uppercase font-bold tracking-widest">Nenhum documento anexo à solicitação.</p>
          )}
        </div>
      </section>

      {/* CONSIDERAÇÕES E PRAZOS */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
         <h4 className="font-bold text-[#004080] mb-4 uppercase text-[9px]">Considerações sobre a solicitação</h4>
         {readOnly ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
             {renderField("Prazo dias", "até 5 dias úteis")}
             {renderField("Data Inicial de Operação Estimada", formatDate(data.operationStartDate))}
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                 <label className="text-[9px] text-slate-500 uppercase font-normal">Prazo dias:</label>
                 <input type="text" readOnly value="até 5 dias úteis" className="flex-grow p-2 border border-slate-200 rounded bg-white text-slate-600 text-center font-normal" />
              </div>
              <div className="flex items-center gap-4">
                 <label className="text-[9px] text-slate-500 uppercase tracking-tight font-normal">Data Inicial de Operação Estimada:</label>
                 <input type="date" name="operationStartDate" value={data.operationStartDate || ''} onChange={handleInputChange} className="flex-grow p-2 border border-slate-200 rounded bg-white text-[#004080] font-bold text-center" />
              </div>
           </div>
         )}
      </section>

      {/* Comentários */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">Comentários</div>
        <div className={`p-4 border border-slate-200 bg-white ${readOnly ? '' : 'rounded-b-lg'}`}>
          {readOnly ? (
            <div className="min-h-[80px] text-[10pt] text-slate-700 whitespace-pre-wrap">
              {data.comments || 'Nenhum comentário registrado.'}
            </div>
          ) : (
            <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} rows={6} className="w-full p-4 border border-slate-300 rounded-lg outline-none bg-white font-normal text-slate-700" placeholder="Insira detalhes sobre as necessidades técnicas, cronograma ou particularidades da UTE..." />
          )}
        </div>
      </section>
    </div>
  );
};
