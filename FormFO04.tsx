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

  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];

  const renderField = (label: string, value: any, isRequired = false) => {
    return (
      <div className="flex flex-col border-b border-slate-100 py-1">
        <span className="text-[9px] text-[#004080] font-bold uppercase tracking-tight">{label}</span>
        <span className="text-[10pt] font-semibold text-slate-800">{value || '-'}</span>
      </div>
    );
  };

  // Helper label width to keep consistency
  const labelClass = "text-[9px] font-bold text-[#004080] shrink-0";
  const requiredLabelClass = "text-[9px] font-bold text-[#004080] shrink-0";

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
              <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 bg-white rounded outline-none font-normal h-8">
                <option value="">Selecione...</option>
                <option value="Capital">Capital</option>
                <option value="Interior">Interior</option>
                <option value="SPS">SPS</option>
              </select>
            </div>
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Tipo de Estudo :</label>
              <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white">
                <option value="">Selecione...</option>
                <option value="Novo Estudo">Novo Estudo</option>
                <option value="Revisão de Estudo">Revisão de Estudo</option>
              </select>
            </div>
            {data.studyType === 'Revisão de Estudo' && (
              <div className="col-span-12 flex items-center gap-2">
                <label className={`${requiredLabelClass} w-32`}>Estudo Anterior :</label>
                <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" placeholder="Código do estudo anterior" />
              </div>
            )}
            <div className="col-span-12 md:col-span-8 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Resp. Solicitação:</label>
              <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
            </div>
            <div className="col-span-12 md:col-span-4 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32 md:w-auto`}>Data da Solicitação:</label>
              <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
            </div>
            <div className="col-span-12 md:col-span-8 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Área Solicitante:</label>
              <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none bg-white font-normal h-8">
                <option value="">Selecione a área...</option>
                {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32 md:w-auto`}>Telefone:</label>
              <input name="phone" value={data.phone || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" placeholder="(XX) XXXXX-XXXX" />
            </div>
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>e-mail:</label>
              <input type="email" name="email" value={data.email || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
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
            <div className="col-span-12">
              <div className="flex flex-col border-b border-slate-100 py-1">
                <span className="text-[9px] text-[#004080] font-bold uppercase tracking-tight">Localização (Coordenadas)</span>
                <span className="text-[10pt] font-semibold text-slate-800 whitespace-pre-wrap">{data.mapLocation || '-'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 bg-white">
            <div className="flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Nome da UTE:</label>
              <input name="uteName" value={data.uteName || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <label className={`${labelClass} w-32`}>Mercado:</label>
              <input readOnly value="Termogeração" className="flex-grow p-1 border border-slate-200 bg-white rounded outline-none font-normal h-8" />
            </div>
            <div className="flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Endereço:</label>
              <input name="address" value={data.address || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center gap-2">
                  <label className={`${requiredLabelClass} w-32`}>Cidade/Município:</label>
                  <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
               </div>
               <div className="flex items-center gap-2">
                  <label className={`${requiredLabelClass} w-24`}>Bairro:</label>
                  <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none font-normal h-8 bg-white" />
               </div>
            </div>
            <div className="flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Estado:</label>
              <select name="state" value={data.state || ''} onChange={handleInputChange} className="flex-grow p-1 border border-slate-200 rounded outline-none bg-white font-normal h-8">
                <option value="">Selecione...</option>
                <option value="Rio de Janeiro">Rio de Janeiro</option>
                <option value="São Paulo">São Paulo</option>
                <option value="Rio/São Paulo">Rio/São Paulo</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
              <label className={`${requiredLabelClass}`}>Localização (4) :</label>
              <div className={`absolute left-0 bottom-full mb-2 w-full p-3 bg-white border border-slate-200 rounded-md shadow-xl transition-all duration-300 z-10 ${showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <h5 className="font-bold text-[#004080] text-[10pt] mb-1">Localização em Coordenadas</h5>
                <p className="text-[9pt] text-slate-600 leading-snug italic">Anexar planta georreferenciada de localização do empreendimento com a indicação aproximada do ponto de entrega à UTE com coordenadas UTM. Preferencialmente associada à imagem por satélite.</p>
                <div className="absolute top-full left-10 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-200"></div>
              </div>
              <textarea name="mapLocation" value={data.mapLocation || ''} onChange={handleInputChange} rows={3} className="w-full p-2 border border-slate-200 rounded outline-none font-normal bg-white" placeholder="Descreva a localização georeferenciada ou indique se anexou o arquivo..." />
            </div>
          </div>
        )}
      </section>

      {/* DADOS TÉCNICOS E PONTO DE ENTREGA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dados Técnico UTE */}
        <section>
          <div className="bg-white text-[#004080] text-center py-1 font-bold text-[9px] border-x border-t border-slate-200 rounded-t uppercase">Dados Técnico UTE</div>
          <div className="p-4 border border-slate-200 rounded-b bg-white space-y-3">
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">Pressão Máxima UTE :</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                   {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.pressMaxUTE || '-'}</span>
                   ) : (
                     <input type="number" name="pressMaxUTE" value={data.pressMaxUTE ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8">bar</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">Pressão Mínima UTE :</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                   {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.pressMinUTE || '-'}</span>
                   ) : (
                     <input type="number" name="pressMinUTE" value={data.pressMinUTE ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8">bar</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">Vazão Instantânea :</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                   {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.instantFlow || '-'}</span>
                   ) : (
                     <input type="number" name="instantFlow" value={data.instantFlow ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8 whitespace-nowrap">Nm³/h (2)</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">QDC</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                   {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.qdc || '-'}</span>
                   ) : (
                     <input type="number" name="qdc" value={data.qdc ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8">m³/dia</span>
                </div>
             </div>
          </div>
        </section>

        {/* Dados Ponto de Entrega */}
        <section>
          <div className="bg-white text-[#004080] text-center py-1 font-bold text-[9px] border-x border-t border-slate-200 rounded-t uppercase">Dados Ponto de Entrega</div>
          <div className="p-4 border border-slate-200 rounded-b bg-white space-y-3">
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">Pressão Máxima UPGN :</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                    {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.pressMaxUPGN || '-'}</span>
                   ) : (
                     <input type="number" name="pressMaxUPGN" value={data.pressMaxUPGN ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8">bar (3)</span>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[#004080] flex-grow uppercase">Pressão Mínima UPGN :</label>
                <div className="flex items-center gap-2 w-32 border-b border-slate-100 pb-1">
                   {readOnly ? (
                     <span className="w-full text-center font-semibold text-slate-800">{data.pressMinUPGN || '-'}</span>
                   ) : (
                     <input type="number" name="pressMinUPGN" value={data.pressMinUPGN ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                   )}
                   <span className="text-[8px] font-bold text-slate-400 w-8">bar (3)</span>
                </div>
             </div>
             <div className="h-8"></div>
             <div className="h-8"></div>
          </div>
        </section>
      </div>

      {/* Documentação e Anexos */}
      {!readOnly && (
        <section>
          <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Documentação e Anexos</div>
          <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white"
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
      )}

      {/* OBSERVAÇÕES */}
      <section className="bg-white p-4 border border-slate-200 rounded-lg">
        <h4 className="font-bold text-[#004080] mb-3 uppercase text-[9px]">OBSERVAÇÕES:</h4>
        <ul className="space-y-2 text-[8pt] text-slate-600 list-none leading-tight">
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">1 -</span>
            <span>Entende-se por metro cúbico (m³) o volume de gás, que nas condições de temperatura de 20 ºC (vinte graus Celsius), pressão absoluta de 0,101325MPa e Poder Calorífico Superior (PCS) de 9.400 kcal/m³, ocupa o volume de 1 (um) metro cúbico.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">2 -</span>
            <span>Vazão instantânea significa a vazão máxima horária.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">3 -</span>
            <span>Pressão no ponto de entrega do gás a UTE, no flange de saída da estação de medição da Concessionária.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">4 -</span>
            <span>A área prevista para o ponto de entrega deverá ser cedida à Concessionária através de servidão administrativa com acesso por via externa independentemente de autorização da UTE. Anexar planta georreferenciada de localização do empreendimento com a indicação aproximada do ponto de entrega à UTE com coordenadas UTM. Preferencialmente associada à imagem por satélite.</span>
          </li>
        </ul>
      </section>

      {/* COMENTÁRIOS */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">COMENTÁRIOS:</div>
        <div className={`p-4 border border-slate-200 bg-white ${readOnly ? '' : 'rounded-b'}`}>
          {readOnly ? (
            <div className="min-h-[80px] text-[10pt] text-slate-700 whitespace-pre-wrap">
              {data.comments || 'Nenhum comentário registrado.'}
            </div>
          ) : (
            <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} rows={6} className="w-full p-4 border border-slate-200 rounded outline-none bg-white font-normal text-slate-700" placeholder="Insira observações relevantes aqui..." />
          )}
        </div>
      </section>
    </div>
  );
};
