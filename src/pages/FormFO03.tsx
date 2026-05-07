import React, { useEffect, useState, useRef } from 'react';
import { FormData } from '../types/types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from '../constants/constants';
import { formatDate } from '../utils/utils';
import { LocationPickerModal } from '../components/LocationPickerModal';

interface FormFO03Props {
  data: FormData;
  onChange: (data: Partial<FormData>) => void;
  readOnly?: boolean;
}

export const FormFO03: React.FC<FormFO03Props> = ({ data, onChange, readOnly = false }) => {
  const [showPressureTooltip, setShowPressureTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleLocationSelect = (location: {
    address: string;
    neighborhood: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => {
    onChange({
      address: location.address,
      neighborhood: location.neighborhood,
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (readOnly) return;
    const { name, value, type } = e.target;
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }

    onChange({ [name]: processedValue });
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

  useEffect(() => {
    if (readOnly) return;
    const updates: Partial<FormData> = {};

    const totalFlow = (Number(data.instantConsumption) || 0) + (Number(data.consumptionIncrement) || 0);
    if (totalFlow !== data.totalPredictedFlow) {
      updates.totalPredictedFlow = totalFlow;
    }

    const flowValue = updates.totalPredictedFlow ?? data.totalPredictedFlow;
    const normalizedFlow = (typeof flowValue === 'number') ? flowValue : 0;

    const monthlyCons = normalizedFlow *
      (Number(data.workHours) || 0) *
      (Number(data.workDaysPerWeek) || 0) * 4;

    if (monthlyCons !== data.monthlyConsumption) {
      updates.monthlyConsumption = parseFloat(monthlyCons.toFixed(2));
    }

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
  }, [data.instantConsumption, data.consumptionIncrement, data.workHours, data.workDaysPerWeek, data.requestDate, data.totalPredictedFlow, readOnly]);

  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];

  const requiredLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-normal pb-0.5";
  const standardLabelClass = "text-[9px] text-[#004080] shrink-0 uppercase tracking-tight font-normal pb-0.5";
  const inputBaseClass = "flex-grow p-1 rounded outline-none font-normal h-8 text-[10pt] mb-0.5";

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

      {/* Header Title Section */}
      <div className="bg-[#004080] text-white text-center py-2.5 px-4 rounded-lg font-black uppercase tracking-widest text-[11px] shadow-md mb-6">
        ESTUDO ADR PARA CLIENTES INDUSTRIAIS, GNV, COGERAÇÃO, GERAÇÃO, CLIMATIZAÇÃO E GRANDES COMÉRCIOS
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
          <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Naturgy :</label>
              <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                {naturgyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Tipo de Estudo :</label>
              <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                {studyTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Data Solicitação:</label>
              <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>

            {data.studyType === 'Revisão de Estudo' && (
              <div className="col-span-12 flex flex-col gap-1 animate-in slide-in-from-left-2 duration-300">
                <label className={`${requiredLabelClass}`}>Estudo Anterior :</label>
                <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} placeholder="Código do estudo anterior" />
              </div>
            )}

            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Resp. Solicitação:</label>
              <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Telefone:</label>
              <input name="phone" value={data.phone || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} placeholder="(XX) XXXXX-XXXX" />
            </div>
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Área Solicitante:</label>
              <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione a área...</option>
                {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>e-mail:</label>
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
              <ReadOnlyField label="Cliente" value={data.clientName} colSpan={8} />
              <ReadOnlyField label="Mercado" value={data.marketCategory} colSpan={4} />
              <ReadOnlyField label="Endereço" value={data.address} colSpan={12} />
              <ReadOnlyField label="Cidade/Município" value={data.city} colSpan={8} />
              <ReadOnlyField label="Bairro" value={data.neighborhood} colSpan={4} />
              <ReadOnlyField label="Tipo Arquivos" value={data.fileType} colSpan={6} />
              <ReadOnlyField label="Ponto de Entrega" value={data.deliveryPoint} colSpan={6} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h5 className="text-[9px] font-black text-[#004080] uppercase tracking-widest mb-4">DADOS TÉCNICOS</h5>
              <div className="grid grid-cols-12 gap-4">
                <ReadOnlyField label="Consumo Instantâneo" value={data.instantConsumption} colSpan={3} suffix=" m³/h" />
                <ReadOnlyField label="Horas Trabalho" value={data.workHours} colSpan={3} suffix=" hora" />
                <ReadOnlyField label="Dias Trabalho/Sem" value={data.workDaysPerWeek} colSpan={3} suffix=" dia" />
                <ReadOnlyField label="Consumo Mensal" value={data.monthlyConsumption} colSpan={3} suffix=" m³" />
                <ReadOnlyField label="Incremento" value={data.consumptionIncrement} colSpan={4} suffix=" Nm³/h" />
                <ReadOnlyField label="Vazão Total Prevista" value={data.totalPredictedFlow} colSpan={4} suffix=" Nm³/h" />
                <ReadOnlyField label="Pressão Mínima" value={data.minPressure} colSpan={2} suffix=" bar" />
                <ReadOnlyField label="Faixa Pressão" value={data.suggestedPressureRange} colSpan={2} />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Cliente:</label>
              <input name="clientName" value={data.clientName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Mercado:</label>
              <select name="marketCategory" value={data.marketCategory || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                {marketOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="col-span-12 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Endereço:</label>
              <div className="flex items-center gap-2">
                <input name="address" value={data.address || ''} onChange={handleInputChange} disabled={readOnly} className={`${inputBaseClass} border border-slate-200 bg-white flex-grow`} />
                {(data.latitude && data.longitude) ? (
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                  >
                    <i className="fa-solid fa-map-marked-alt mr-1"></i>
                    {readOnly ? 'Ver no Mapa' : 'Buscar no Mapa'}
                  </button>
                ) : (
                  !readOnly && (
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(true)}
                      className="px-3 py-1.5 bg-[#004080] text-white text-xs font-bold uppercase rounded hover:bg-[#003060] transition-colors whitespace-nowrap"
                    >
                      <i className="fa-solid fa-map-marked-alt mr-1"></i>
                      Buscar no Mapa
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Cidade/Município:</label>
              <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Bairro:</label>
              <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} />
            </div>
            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Tipo Arquivos:</label>
              <select name="fileType" value={data.fileType || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                {fileTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="col-span-12 md:col-span-6 flex flex-col gap-1">
              <label className={`${requiredLabelClass}`}>Ponto de Entrega:</label>
              <select name="deliveryPoint" value={data.deliveryPoint || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`}>
                <option value="">Selecione...</option>
                {deliveryPointOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            {/* Technical Data Grid Section */}
            <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mt-2 border-t border-slate-100 pt-3">
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Consumo Instantâneo:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="instantConsumption" value={data.instantConsumption ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">m³/h</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Horas de trabalho:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="workHours" value={data.workHours ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">hora</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Consumo previsto (mês):</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="monthlyConsumption" value={data.monthlyConsumption ?? ''} readOnly className="w-full p-1 border border-slate-200 bg-slate-50 rounded text-center h-8 text-[#004080]" />
                  <span className="text-[8px] font-bold text-slate-400">m³</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Incremento:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="consumptionIncrement" value={data.consumptionIncrement ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Dias trab/semana:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="workDaysPerWeek" value={data.workDaysPerWeek ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">dia</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Vazão Total Prevista:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="totalPredictedFlow" value={data.totalPredictedFlow ?? ''} readOnly className="w-full p-1 border border-slate-200 bg-slate-50 rounded text-center h-8" />
                  <span className="text-[8px] font-bold text-slate-400">Nm³/h</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Pressão Mínima:</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="minPressure" value={data.minPressure ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" />
                  <span className="text-[8px] font-bold text-slate-400">bar</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className={`${standardLabelClass}`}>Faixa de pressão sugerida:</label>
                <select name="suggestedPressureRange" value={data.suggestedPressureRange || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white text-[9px]`}>
                  <option value="">Selecione...</option>
                  {pressureRangeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* DADOS BASE PARA EXPANSÃO (CLIENTE EM SERVIÇO) */}
      <section className="bg-white border border-slate-200">
        <div className="bg-[#004080] text-white px-4 py-1.5 flex items-center justify-between rounded-t">
          <span className="font-bold text-[10px] uppercase">DADOS BASE PARA EXPANSÃO DE CONSUMO EM UM CLIENTE EM SERVIÇO</span>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <div
                onClick={() => onChange({ hasExpansion: !data.hasExpansion })}
                className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${data.hasExpansion ? 'bg-orange-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${data.hasExpansion ? 'right-1' : 'left-1'}`} />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-tight">Habilitar</span>
            </div>
          )}
        </div>

        {readOnly ? (
          data.hasExpansion ? (
            <table style={tableStyle}>
              <tbody>
                <tr><th style={thStyle}>Nome da Indústria</th><td style={tdStyle}>{data.industryName || '-'}</td></tr>
                <tr><th style={thStyle}>Cidade/Município</th><td style={tdStyle}>{data.city || '-'}</td></tr>
                <tr><th style={thStyle}>Bairro</th><td style={tdStyle}>{data.neighborhood || '-'}</td></tr>
                <tr><th style={thStyle}>Consumo Atual</th><td style={tdStyle}>{data.currentConsumption || '0'} m³/h</td></tr>
                <tr><th style={thStyle}>Pressão Contratual</th><td style={tdStyle}>{data.contractualPressure || '0'} bar</td></tr>
                <tr><th style={thStyle}>Faixa de Pressão Atual</th><td style={tdStyle}>{data.currentPressureRange || '-'}</td></tr>
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-slate-50/50">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Não houve expansão de consumo informada para este estudo.</span>
            </div>
          )
        ) : (
          <div className={`p-4 grid grid-cols-12 gap-x-4 gap-y-3 transition-all duration-300 ${!data.hasExpansion ? 'opacity-40 grayscale' : ''}`}>
            <div className="col-span-12 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Nome da Indústria:</label>
              <input name="industryName" value={data.industryName || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} disabled={!data.hasExpansion} />
            </div>
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Cidade/Município:</label>
              <input name="city" list="municipalities" value={data.city || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} disabled={!data.hasExpansion} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Bairro:</label>
              <input name="neighborhood" value={data.neighborhood || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white`} disabled={!data.hasExpansion} />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Consumo Atual:</label>
              <div className="flex items-center gap-2">
                <input type="number" name="currentConsumption" value={data.currentConsumption ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" disabled={!data.hasExpansion} />
                <span className="text-[8px] font-bold text-slate-400">m³/h</span>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Pressão Contratual:</label>
              <div className="flex items-center gap-2">
                <input type="number" name="contractualPressure" value={data.contractualPressure ?? ''} onChange={handleInputChange} className="w-full p-1 border border-slate-200 rounded text-center h-8 bg-white" disabled={!data.hasExpansion} />
                <span className="text-[8px] font-bold text-slate-400">bar</span>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={`${standardLabelClass}`}>Faixa de Pressão Atual:</label>
              <select name="currentPressureRange" value={data.currentPressureRange || ''} onChange={handleInputChange} className={`${inputBaseClass} border border-slate-200 bg-white text-[9px]`} disabled={!data.hasExpansion}>
                <option value="">Selecione...</option>
                {pressureRangeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Documentação e Anexos */}
      <section className="hide-export">
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Documentação e Anexos</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          {!readOnly && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white"
            >
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
                <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
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
          )}

          {data.selectedFiles && data.selectedFiles.length > 0 && (
            <div className={`grid grid-cols-1 ${!readOnly ? 'md:grid-cols-2' : ''} gap-3 mt-4`}>
              {data.selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    <i className="fa-solid fa-file-lines text-[#004080] shrink-0 text-xs"></i>
                    <span className="text-xs font-medium text-slate-700 break-all">{file.name}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:text-red-500 transition-colors text-slate-300"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
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

      {/* CONSIDERAÇÕES E PRAZOS */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h4 className="font-bold text-[#004080] mb-4 uppercase text-[9px]">Considerações sobre a solicitação</h4>
        {readOnly ? (
          <table style={tableStyle}>
            <tbody>
              <tr><th style={thStyle}>Prazo dias</th><td style={tdStyle}>até 5 dias úteis</td></tr>
              <tr><th style={thStyle}>Data entrega estimada</th><td style={tdStyle}>{formatDate(data.estimatedDeliveryDate) || '-'}</td></tr>
            </tbody>
          </table>
        ) : (
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
        )}
      </section>

      {/* COMENTÁRIOS */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">COMENTÁRIOS:</div>
        <div className={`p-4 border border-slate-200 bg-white ${readOnly ? '' : 'rounded-b'}`}>
          {readOnly ? (
            <div className="h-auto text-[10pt] text-slate-700 whitespace-pre-wrap overflow-visible">
              {data.comments || 'Nenhum comentário registrado.'}
            </div>
          ) : (
            <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} rows={6} className="w-full p-4 border border-slate-300 rounded outline-none bg-white font-normal text-slate-700" placeholder="Insira detalhes sobre o processo produtivo, GNV ou necessidades de pressão específicas..." />
          )}
        </div>
      </section>

      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        initialLocation={{
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          neighborhood: data.neighborhood,
          city: data.city
        }}
        readOnly={readOnly}
      />

    </div>
  );
};
