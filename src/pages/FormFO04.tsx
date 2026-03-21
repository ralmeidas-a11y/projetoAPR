import React, { useState, useRef } from 'react';
import { FormData } from '../types/types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from '../constants/constants';
import { formatDate } from '../utils/utils';

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

  const labelClass = "text-[9px] font-bold text-[#004080] shrink-0 pb-0.5 uppercase tracking-tight";
  const requiredLabelClass = "text-[9px] font-bold text-[#004080] shrink-0 pb-0.5 uppercase tracking-tight";
  const inputBaseClass = "flex-grow p-1 rounded outline-none font-normal h-8 text-[10pt] mb-0.5";

  // Table styles for readOnly mode
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '10pt', fontFamily: 'Arial, sans-serif' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '9px', color: '#004080', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.025em', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '10pt', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

  const ReadOnlyField = ({ label, value, colSpan = 12, suffix = '' }: { label: string; value: any; colSpan?: number; suffix?: string }) => (
    <div className={`col-span-${colSpan} flex flex-col border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm`}>
      <label className="text-[8px] text-[#004080] font-extrabold uppercase tracking-widest mb-1.5 opacity-70">{label}</label>
      <div className="text-[10pt] font-bold text-slate-800 break-words leading-tight">
        {value !== undefined && value !== null && value !== '' ? `${value}${suffix}` : '-'}
      </div>
    </div>
  );

  return (
    <div className={`${readOnly ? 'w-full' : 'max-w-4xl mx-auto'} space-y-6 ${readOnly ? 'pb-4' : 'pb-20'}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section from PDF */}
      <div className="bg-[#004080] text-white text-center py-2.5 px-4 rounded-lg font-black uppercase tracking-widest text-[11px] shadow-md mb-6">
        ESTUDO ADR PARA VIABILIDADE TÉCNICA DE EMPREENDIMENTO TERMELETRICO
      </div>

      {/* Dados do Solicitante */}
      <section className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-[#004080] text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-wider">Dados do Solicitante</div>
        {readOnly ? (
          <div className="p-5 grid grid-cols-12 gap-4 bg-[#f8fbff]/50">
            <ReadOnlyField label="Naturgy" value={data.naturgyUnit} colSpan={4} />
            <ReadOnlyField label="Tipo de Estudo" value={data.studyType} colSpan={4} />
            <ReadOnlyField label="Data Solicitação" value={formatDate(data.requestDate)} colSpan={4} />
            <ReadOnlyField label="Estudo Anterior" value={data.studyType === 'Revisão de Estudo' ? data.previousStudy : 'N/A'} colSpan={12} />
            <ReadOnlyField label="Responsável pela Solicitação" value={data.requesterName} colSpan={8} />
            <ReadOnlyField label="Telefone" value={data.phone} colSpan={4} />
            <ReadOnlyField label="Área Solicitante" value={data.requesterArea} colSpan={12} />
            <ReadOnlyField label="E-mail" value={data.email} colSpan={12} />
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
      <section className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-[#004080] text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-wider">DADOS BASE DO ESTUDO</div>
        {readOnly ? (
          <div className="p-5 flex flex-col gap-6 bg-[#f8fbff]/50">
            <div className="grid grid-cols-12 gap-4">
              <ReadOnlyField label="Nome da UTE" value={data.uteName} colSpan={8} />
              <ReadOnlyField label="Mercado" value="Termogeração" colSpan={4} />
              <ReadOnlyField label="Endereço" value={data.address} colSpan={12} />
              <ReadOnlyField label="Cidade" value={data.city} colSpan={4} />
              <ReadOnlyField label="Bairro" value={data.neighborhood} colSpan={4} />
              <ReadOnlyField label="Estado" value={data.state} colSpan={4} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h5 className="text-[9px] font-black text-[#004080] uppercase tracking-widest mb-4">DADOS TÉCNICOS</h5>
              <div className="grid grid-cols-12 gap-4">
                <ReadOnlyField label="Nível Pressão" value={(data as any).gasPressureLevel} colSpan={4} suffix=" bar" />
                <ReadOnlyField label="Vazão Média" value={(data as any).averageFlow} colSpan={4} suffix=" Nm³/h" />
                <ReadOnlyField label="Vazão Pico" value={(data as any).peakFlow} colSpan={4} suffix=" Nm³/h" />
                <ReadOnlyField label="Prazo dias" value="até 5 dias úteis" colSpan={6} />
                <ReadOnlyField label="Data Inicial Operação" value={formatDate((data as any).operationStartDate)} colSpan={6} />
              </div>
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
                  <input type="number" name="gasPressureLevel" value={(data as any).gasPressureLevel ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">bar</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={requiredLabelClass}>Vazão Média (24h) :</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="averageFlow" value={(data as any).averageFlow ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={requiredLabelClass}>Vazão de Pico :</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="peakFlow" value={(data as any).peakFlow ?? ''} onChange={handleInputChange} className="w-full h-8 p-1 border border-slate-200 rounded text-center bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Documentação e Anexos */}
      <section className="hide-export">
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
          <table style={tableStyle}>
            <tbody>
              <tr><th style={thStyle}>Prazo dias</th><td style={tdStyle}>até 5 dias úteis</td></tr>
              <tr><th style={thStyle}>Data Inicial de Operação Estimada</th><td style={tdStyle}>{formatDate((data as any).operationStartDate) || '-'}</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <label className="text-[9px] text-slate-500 uppercase font-normal">Prazo dias:</label>
              <input type="text" readOnly value="até 5 dias úteis" className="flex-grow p-2 border border-slate-200 rounded bg-white text-slate-600 text-center font-normal" />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-[9px] text-slate-500 uppercase tracking-tight font-normal">Data Inicial de Operação Estimada:</label>
              <input type="date" name="operationStartDate" value={(data as any).operationStartDate || ''} onChange={handleInputChange} className="flex-grow p-2 border border-slate-200 rounded bg-white text-[#004080] font-bold text-center" />
            </div>
          </div>
        )}
      </section>

      {/* Comentários */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">Comentários</div>
        <div className={`p-4 border border-slate-200 bg-white ${readOnly ? '' : 'rounded-b-lg'}`}>
          {readOnly ? (
            <div className="h-auto text-[10pt] text-slate-700 whitespace-pre-wrap overflow-visible">
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
