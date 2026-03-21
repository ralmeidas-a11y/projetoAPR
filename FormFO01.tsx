
import React, { useEffect, useRef } from 'react';
import { FormData } from './types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from './constants';
import { formatDate } from './utils';

interface FormFO01Props {
  data: FormData;
  onChange: (data: Partial<FormData>) => void;
  readOnly?: boolean;
}

export const FormFO01: React.FC<FormFO01Props> = ({ data, onChange, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBR = (num: number | string | undefined) => {
    if (num === undefined || num === null || num === '') return "0,00";
    const val = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(val)) return "0,00";
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isResActive = data.marketCategory === 'Residencial' || data.marketCategory === 'Residencial/Comercial';
  const isComActive = data.marketCategory === 'Comercial' || data.marketCategory === 'Residencial/Comercial';

  useEffect(() => {
    if (readOnly) return;
    const resTotal = isResActive ? (Number(data.numClientsRes) || 0) * (Number(data.flowUnitRes) || 0) : 0;
    const comTotal = isComActive ? (Number(data.numClientsCom) || 0) * (Number(data.flowUnitCom) || 0) : 0;
    
    const updates: Partial<FormData> = {};
    if (resTotal !== data.totalFlowRes) updates.totalFlowRes = parseFloat(resTotal.toFixed(2));
    if (comTotal !== data.totalFlowCom) updates.totalFlowCom = parseFloat(comTotal.toFixed(2));

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
  }, [data.numClientsRes, data.flowUnitRes, data.numClientsCom, data.flowUnitCom, data.requestDate, data.marketCategory, isResActive, isComActive, readOnly]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (readOnly) return;
    const { name, value, type } = e.target;
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : (name.includes('numClients') ? (parseInt(value, 10) || 0) : (parseFloat(value) || 0));
    }
    
    if (name === 'studyTitle') {
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

  const totalClients = (isResActive ? (Number(data.numClientsRes) || 0) : 0) + (isComActive ? (Number(data.numClientsCom) || 0) : 0);
  const totalFlowUnit = (isResActive ? (Number(data.flowUnitRes) || 0) : 0) + (isComActive ? (Number(data.flowUnitCom) || 0) : 0);
  const grandTotalFlow = (isResActive ? (Number(data.totalFlowRes) || 0) : 0) + (isComActive ? (Number(data.totalFlowCom) || 0) : 0);

  const inputGridClass = "w-full h-full text-center border-none focus:ring-0 outline-none bg-transparent p-0 m-0 block appearance-none text-[10pt]";
  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];

  const requiredLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-bold pb-0.5";
  const standardLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-bold pb-0.5";
  const inputBaseClass = "flex-grow p-1 rounded outline-none font-normal h-8 text-[10pt] border transition-all mb-0.5";

  // Table styles for readOnly mode
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '10pt', fontFamily: 'Arial, sans-serif' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '9px', color: '#004080', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.025em', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '10pt', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

  const ReadOnlyField = ({ label, value, colSpan = 12 }: { label: string; value: any; colSpan?: number }) => (
    <div className={`col-span-${colSpan} flex flex-col border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm`}>
      <label className="text-[8px] text-[#004080] font-extrabold uppercase tracking-widest mb-1.5 opacity-70">{label}</label>
      <div className="text-[10.5pt] font-bold text-slate-800 break-words leading-tight">{value || '-'}</div>
    </div>
  );

  return (
    <div className={`space-y-8 ${readOnly ? 'pointer-events-none' : ''}`} style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif' }}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section */}
      <div className="bg-[#004080] text-white text-center py-2.5 px-4 rounded-lg font-black uppercase tracking-widest text-[11px] shadow-md mb-6">
        ESTUDO ADR PARA VIABILIDADE TÉCNICA DE CLIENTES RESIDENCIAIS / COMERCIAIS
      </div>

      {/* DADOS DO SOLICITANTE */}
      <section className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-[#004080] text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-wider">DADOS DO SOLICITANTE</div>
        {readOnly ? (
          <div className="p-5 grid grid-cols-12 gap-4 bg-[#f8fbff]/50">
            <ReadOnlyField label="Naturgy" value={data.naturgyUnit} colSpan={4} />
            <ReadOnlyField label="Tipo de Estudo" value={data.studyType} colSpan={4} />
            <ReadOnlyField label="Estudo Anterior" value={data.studyType === 'Revisão de Estudo' ? data.previousStudy : 'N/A'} colSpan={4} />
            <ReadOnlyField label="Responsável pela Solicitação" value={data.requesterName} colSpan={8} />
            <ReadOnlyField label="Data Solicitação" value={formatDate(data.requestDate)} colSpan={4} />
            <ReadOnlyField label="Área Solicitante" value={data.requesterArea} colSpan={12} />
            <ReadOnlyField label="E-mail" value={data.email} colSpan={8} />
            <ReadOnlyField label="Telefone" value={data.phone} colSpan={4} />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-3 bg-white">
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Naturgy :</label>
              <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Capital">Capital</option>
                <option value="Interior">Interior</option>
                <option value="SPS">SPS</option>
              </select>
            </div>

            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-36`}>Tipo de Estudo :</label>
              <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Novo Estudo">Novo Estudo</option>
                <option value="Revisão de Estudo">Revisão de Estudo</option>
              </select>
            </div>

            {data.studyType === 'Revisão de Estudo' && (
              <div className="col-span-12 flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                 <label className={`${requiredLabelClass} w-32`}>Estudo Anterior :</label>
                 <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} placeholder="Ex: ADR-2023-001" />
              </div>
            )}

            <div className="col-span-12 md:col-span-8 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Resp. Solicitação:</label>
              <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-4 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32 md:w-auto`}>Data Solicitação:</label>
              <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-8 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-36`}>Área Solicitante:</label>
              <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione a área...</option>
                {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-4 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32 md:w-auto`}>Telefone:</label>
              <input name="phone" value={data.phone || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} placeholder="(21) 99999-9999" />
            </div>

            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>e-mail:</label>
              <input type="email" name="email" value={data.email || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} placeholder="email@exemplo.com" />
            </div>
          </div>
        )}
      </section>

      {/* DADOS BASE DO ESTUDO */}
      <section className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-[#004080] text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-wider">DADOS BASE DO ESTUDO</div>
        {readOnly ? (
          <div className="p-5 grid grid-cols-12 gap-4 bg-[#f8fbff]/50">
            <ReadOnlyField label="Título/Cliente" value={data.studyTitle} colSpan={12} />
            <ReadOnlyField label="Mercado" value={data.marketCategory} colSpan={6} />
            <ReadOnlyField label="Endereço" value={data.address} colSpan={12} />
            <ReadOnlyField label="Cidade" value={data.city} colSpan={6} />
            <ReadOnlyField label="Bairro" value={data.neighborhood} colSpan={6} />
            <ReadOnlyField label="Tipo de Rede" value={data.networkType} colSpan={6} />
            <ReadOnlyField label="Pressão" value={data.pressure} colSpan={6} />
            <ReadOnlyField label="Mapa Localização" value={data.mapLocation} colSpan={12} />
            <ReadOnlyField label="Tipo Arquivo" value={data.fileType} colSpan={12} />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-3 bg-white">
            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Título/Cliente :</label>
              <input name="studyTitle" value={data.studyTitle || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Mercado:</label>
              <select name="marketCategory" value={data.marketCategory || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Residencial">Residencial</option>
                <option value="Comercial">Comercial</option>
                <option value="Residencial/Comercial">Residencial/Comercial</option>
              </select>
            </div>

            <div className="col-span-12 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Endereço:</label>
              <input name="address" value={data.address || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Cidade/Município:</label>
              <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${requiredLabelClass} w-32`}>Bairro:</label>
              <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`} />
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Tipo de Rede:</label>
              <select name="networkType" value={data.networkType || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Rede interna">Rede interna</option>
                <option value="Rede externa">Rede externa</option>
                <option value="Rede externa e interna">Rede externa e interna</option>
              </select>
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Pressão rede:</label>
              <select name="pressure" value={data.pressure || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="BP até 22 mbar">BP até 22 mbar</option>
                <option value="MP Até 2 bar">MP Até 2 bar</option>
                <option value="MP Até 4 bar">MP Até 4 bar</option>
              </select>
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Mapa Localização:</label>
              <select name="mapLocation" value={data.mapLocation || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Croqui de Rede Interna">Croqui de Rede Interna</option>
                <option value="Mapa de Localização Geogas">Mapa de Localização Geogas</option>
                <option value="Planta de Situação">Planta de Situação</option>
                <option value="Não aplicável">Não aplicável</option>
              </select>
            </div>

            <div className="col-span-12 md:col-span-6 flex items-center gap-2">
              <label className={`${standardLabelClass} w-32`}>Tipo Arquivo:</label>
              <select name="fileType" value={data.fileType || ''} onChange={handleInputChange} className={`${inputBaseClass} border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                <option value="Arquivo JPG">Arquivo JPG</option>
                <option value="Arquivo PNG">Arquivo PNG</option>
                <option value="Arquivo PDF">Arquivo PDF</option>
                <option value="Arquivo KMZ">Arquivo KMZ</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* GRADE DE CONSUMO */}
      <section className="overflow-x-auto border border-slate-200">
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold text-[10px] uppercase">CARGAS / VAZÃO PREVISTA</div>
        <table style={{ ...tableStyle, minWidth: '500px', textAlign: 'center' }}>
          <thead>
            <tr style={{ backgroundColor: '#fff' }}>
              <th style={{ ...thStyle, borderRight: '1px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>Mercado</th>
              <th style={{ ...thStyle, borderRight: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Nº Clientes</th>
              <th style={{ ...thStyle, borderRight: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Vazão / Unidade (m³/h)</th>
              <th style={{ ...thStyle, padding: '10px', textAlign: 'center' }}>Q total previsto (m³/h)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px', borderRight: '1px solid #e2e8f0', fontWeight: 500, textAlign: 'left' }}>Residencial:</td>
              <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                {readOnly ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{data.numClientsRes || '-'}</div>
                ) : (
                  <input type="number" name="numClientsRes" disabled={!isResActive} value={isResActive ? (data.numClientsRes ?? '') : ''} onChange={handleInputChange} className={inputGridClass} />
                )}
              </td>
              <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                {readOnly ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{data.flowUnitRes || '-'}</div>
                ) : (
                  <input type="number" step="0.01" name="flowUnitRes" disabled={!isResActive} value={isResActive ? (data.flowUnitRes ?? '') : ''} onChange={handleInputChange} className={inputGridClass} />
                )}
              </td>
              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{formatBR(isResActive ? data.totalFlowRes : 0)}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px', borderRight: '1px solid #e2e8f0', fontWeight: 500, textAlign: 'left' }}>Comercial:</td>
              <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                {readOnly ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{data.numClientsCom || '-'}</div>
                ) : (
                  <input type="number" name="numClientsCom" disabled={!isComActive} value={isComActive ? (data.numClientsCom ?? '') : ''} onChange={handleInputChange} className={inputGridClass} />
                )}
              </td>
              <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                {readOnly ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{data.flowUnitCom || '-'}</div>
                ) : (
                  <input type="number" step="0.01" name="flowUnitCom" disabled={!isComActive} value={isComActive ? (data.flowUnitCom ?? '') : ''} onChange={handleInputChange} className={inputGridClass} />
                )}
              </td>
              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{formatBR(isComActive ? data.totalFlowCom : 0)}</td>
            </tr>

            <tr>
              <td style={{ padding: '10px', borderRight: '1px solid #e2e8f0', fontWeight: 'bold', color: '#004080', textTransform: 'uppercase', textAlign: 'left' }}>Totais:</td>
              <td style={{ padding: '10px', borderRight: '1px solid #e2e8f0', fontWeight: 'bold', textAlign: 'center' }}>{totalClients}</td>
              <td style={{ padding: '10px', borderRight: '1px solid #e2e8f0', fontWeight: 'bold', textAlign: 'center' }}>{formatBR(totalFlowUnit)}</td>
              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#004080', color: '#fff' }}>{formatBR(grandTotalFlow)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* CONSIDERAÇÕES E PRAZOS */}
      <section className="bg-white border border-slate-200 p-5">
         <h4 className="font-bold text-[#004080] mb-4 uppercase text-[10px] border-b border-slate-100 pb-2">Considerações sobre a solicitação</h4>
         {readOnly ? (
           <table style={tableStyle}>
             <tbody>
               <tr><th style={thStyle}>Prazo dias</th><td style={tdStyle}>até 5 dias úteis</td></tr>
               <tr><th style={thStyle}>Previsão de Entrega</th><td style={tdStyle}>{formatDate(data.estimatedDeliveryDate) || '-'}</td></tr>
             </tbody>
           </table>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex items-center gap-4">
                 <label className="text-[10px] text-[#004080] uppercase font-bold min-w-[80px]">Prazo dias:</label>
                 <input type="text" readOnly value="até 5 dias úteis" className="flex-1 p-2 border border-slate-300 rounded bg-white text-slate-700 text-center font-bold h-10 shadow-sm" />
              </div>
              <div className="flex items-center gap-4">
                 <label className="text-[10px] text-[#004080] uppercase tracking-tight font-bold min-w-[120px]">Previsão de Entrega:</label>
                 <input type="date" name="estimatedDeliveryDate" value={data.estimatedDeliveryDate || ''} readOnly className="flex-1 p-2 rounded border border-slate-300 outline-none font-bold h-10 text-[10pt] bg-white text-[#004080] text-center shadow-sm" />
              </div>
           </div>
         )}
      </section>

      {/* DOCUMENTAÇÃO E ANEXOS */}
      <section className="hide-export">
        <div className="bg-[#004080] text-white px-4 py-1 font-bold rounded-t text-[10px] uppercase">DOCUMENTAÇÃO E ANEXOS</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          {!readOnly && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#004080] text-sm">Clique para anexar arquivos técnicos</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest text-center">PDF, JPG, PNG, DWG, KMZ (Max. 10MB)</p>
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
                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:text-red-500 transition-colors text-slate-300"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {readOnly && (!data.selectedFiles || data.selectedFiles.length === 0) && (
            <p className="text-xs text-slate-400 italic text-center py-4">Nenhum documento anexo à solicitação.</p>
          )}
        </div>
      </section>

      {/* COMENTÁRIOS E OBSERVAÇÕES */}
      <section className="mt-8">
        <div className="bg-[#004080] text-white px-4 py-1 font-bold rounded-t text-[10px] uppercase">COMENTÁRIOS:</div>
        <div className={`p-4 border border-slate-200 ${readOnly ? '' : 'shadow-sm'} rounded-b bg-white`}>
          {readOnly ? (
            <div className="h-auto text-[10pt] text-slate-700 whitespace-pre-wrap leading-relaxed overflow-visible">
              {data.comments || 'Nenhum comentário registrado.'}
            </div>
          ) : (
            <textarea 
              name="comments" 
              value={data.comments || ''} 
              onChange={handleInputChange} 
              rows={6} 
              className="w-full p-4 border border-slate-200 rounded-xl outline-none bg-white font-normal text-slate-700 text-[10pt] leading-relaxed shadow-inner" 
              placeholder="Digite aqui as observações técnicas do estudo..." 
            />
          )}
        </div>
      </section>


    </div>
  );
};
