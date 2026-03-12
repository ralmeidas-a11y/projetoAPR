
import React, { useRef } from 'react';
import { FormData } from '../types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from '../constants';

interface FormFO02Props {
  data: FormData;
  onChange: (data: Partial<FormData>) => void;
  readOnly?: boolean;
}

export const FormFO02: React.FC<FormFO02Props> = ({ data, onChange, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBR = (num: number | string | undefined) => {
    if (num === undefined || num === null || num === '') return "0,00";
    const val = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(val)) return "0,00";
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const handleGridChange = (rowKey: string, colKey: string, value: string) => {
    if (readOnly) return;
    const numValue = value === '' ? '' : parseFloat(value);
    const updatedGrid = { ...data.gridDataFO02 };
    if (!updatedGrid[rowKey]) updatedGrid[rowKey] = { atuais: '', y2: '', y5: '', y20: '', totalQ: '' };
    
    updatedGrid[rowKey] = {
      ...updatedGrid[rowKey],
      [colKey]: numValue
    };
    onChange({ gridDataFO02: updatedGrid });
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

  const gridCellBase = "border-slate-200 flex items-center h-14 overflow-hidden bg-white";
  const colLeft = "justify-start text-left p-3";
  const colCenter = "justify-center text-center p-0";
  const inputGridClass = "w-full h-full text-center border-none focus:ring-0 outline-none bg-transparent p-0 m-0 block appearance-none";

  // Ordered Alphabetically: Comerciais, GNV, Grandes comércios, Industrias, Outros, Residenciais
  const rows = [
    { key: 'comerciais', label: 'Comerciais:' },
    { key: 'gnv', label: 'GNV:' },
    { key: 'grandesComercios', label: 'Grandes comércios:' },
    { key: 'industrias', label: 'Industrias:' },
    { key: 'outros', label: 'Outros:' },
    { key: 'residenciais', label: 'Residenciais:' }
  ];

  const calculateTotals = (col: 'atuais' | 'y2' | 'y5' | 'y20' | 'totalQ') => {
    return rows.reduce((acc, row) => {
      const val = data.gridDataFO02?.[row.key]?.[col];
      return acc + (Number(val) || 0);
    }, 0);
  };

  const municipalities = [...MUNICIPALITIES_RJ, ...MUNICIPALITIES_SP];

  return (
    <div className={`space-y-8 ${readOnly ? 'pointer-events-none opacity-90' : ''}`} style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif' }}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section */}
      <div className="bg-[#004080] text-white text-center py-2 px-4 rounded font-bold uppercase tracking-wide text-xs">
        ESTUDO ADR PARA GASEIFICAÇÕES TOTAIS OU PARCIAIS DE ÁREAS EM EXPANSÃO OU NOVOS MUNICÍPIOS
      </div>



      {/* Dados do Solicitante */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Dados do Solicitante</div>
        <div className="p-6 border border-slate-200 rounded-b-lg grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-slate-500 uppercase">Naturgy:</label>
            <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} disabled={readOnly} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal">
              <option value="">Selecione...</option>
              <option value="Capital">Capital</option>
              <option value="Interior">Interior</option>
              <option value="SPS">SPS</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Tipo de Estudo:</label>
            <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} disabled={readOnly} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal">
              <option value="">Selecione...</option>
              <option value="Novo Estudo">Novo Estudo</option>
              <option value="Revisão de Estudo">Revisão de Estudo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Data da Solicitação:</label>
            <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" />
          </div>
          {data.studyType === 'Revisão de Estudo' && (
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-[9px] font-normal text-[#004080] uppercase">Estudo Anterior:</label>
              <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" placeholder="Código do estudo anterior para revisão" />
            </div>
          )}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Resp. Solicitação:</label>
            <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" placeholder="Nome Completo" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Telefone:</label>
            <input name="phone" value={data.phone || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" placeholder="(XX) XXXXX-XXXX" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Área Solicitante:</label>
            <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} disabled={readOnly} className="p-2 border border-slate-300 rounded outline-none bg-white font-normal">
              <option value="">Selecione a área...</option>
              {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">E-mail:</label>
            <input type="email" name="email" value={data.email || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" />
          </div>
        </div>
      </section>

      {/* Dados Base do Estudo */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Dados Base do Estudo</div>
        <div className="p-6 border border-slate-200 rounded-b-lg grid grid-cols-1 md:grid-cols-4 gap-4 bg-white">
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Título Projeto:</label>
            <input name="studyTitle" value={data.studyTitle || ''} onChange={handleInputChange} readOnly={readOnly} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Estado:</label>
            <select name="state" value={data.state || ''} onChange={handleInputChange} disabled={readOnly} className="p-2 border border-slate-300 rounded outline-none bg-white font-normal">
              <option value="">Selecione...</option>
              <option value="Outros">Outros</option>
              <option value="Rio de Janeiro">Rio de Janeiro</option>
              <option value="Rio/São Paulo">Rio/São Paulo</option>
              <option value="São Paulo">São Paulo</option>
            </select>
          </div>
          <div className="md:col-span-3 flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Cidade/Município:</label>
            <input 
              name="city" 
              list="municipalities"
              value={data.city || ''} 
              onChange={handleInputChange} 
              readOnly={readOnly}
              className="p-2 border border-slate-300 rounded outline-none font-normal bg-white" 
              placeholder="Digite o nome da cidade para sugestões..."
            />
          </div>
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-[9px] font-normal text-[#004080] uppercase">Tipo de Gaseificação:</label>
            <select name="gasificationType" value={data.gasificationType || ''} onChange={handleInputChange} disabled={readOnly} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal">
              <option value="">Selecione...</option>
              <option value="Parcial">Parcial</option>
              <option value="Total">Total</option>
            </select>
          </div>
        </div>
      </section>

      {/* Matriz de Clientes (FO.02) */}
      <section className="overflow-x-auto">
        <div className="bg-white text-[10px] p-2 text-center font-bold border-x border-t border-slate-200 uppercase tracking-widest">Crescimento cumulativo m³/(n)/h</div>
        <div className="grid grid-cols-6 border border-slate-200 min-w-[800px] bg-white">
          <div className={`${gridCellBase} ${colLeft} border-b border-r bg-white font-bold text-[9px] uppercase`}>Clientes previstos captar</div>
          <div className={`${gridCellBase} ${colCenter} border-b border-r bg-white font-bold`}>Atuais</div>
          <div className={`${gridCellBase} ${colCenter} border-b border-r bg-white font-bold`}>2 Anos</div>
          <div className={`${gridCellBase} ${colCenter} border-b border-r bg-white font-bold`}>5 Anos</div>
          <div className={`${gridCellBase} ${colCenter} border-b border-r bg-white font-bold`}>20 Anos</div>
          <div className={`${gridCellBase} ${colCenter} border-b bg-white font-bold text-[9px] uppercase`}>Q total previsto m³/(n)/h</div>

          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <div className={`${gridCellBase} ${colLeft} border-b border-r font-medium`}>{row.label}</div>
              <div className={`${gridCellBase} ${colCenter} border-b border-r`}>
                <input type="number" value={data.gridDataFO02?.[row.key]?.atuais ?? ''} onChange={(e) => handleGridChange(row.key, 'atuais', e.target.value)} disabled={readOnly} className={inputGridClass} />
              </div>
              <div className={`${gridCellBase} ${colCenter} border-b border-r`}>
                <input type="number" value={data.gridDataFO02?.[row.key]?.y2 ?? ''} onChange={(e) => handleGridChange(row.key, 'y2', e.target.value)} disabled={readOnly} className={inputGridClass} />
              </div>
              <div className={`${gridCellBase} ${colCenter} border-b border-r`}>
                <input type="number" value={data.gridDataFO02?.[row.key]?.y5 ?? ''} onChange={(e) => handleGridChange(row.key, 'y5', e.target.value)} disabled={readOnly} className={inputGridClass} />
              </div>
              <div className={`${gridCellBase} ${colCenter} border-b border-r`}>
                <input type="number" value={data.gridDataFO02?.[row.key]?.y20 ?? ''} onChange={(e) => handleGridChange(row.key, 'y20', e.target.value)} disabled={readOnly} className={inputGridClass} />
              </div>
              <div className={`${gridCellBase} ${colCenter} border-b bg-white font-bold`}>
                <input type="number" value={data.gridDataFO02?.[row.key]?.totalQ ?? ''} onChange={(e) => handleGridChange(row.key, 'totalQ', e.target.value)} disabled={readOnly} className={inputGridClass} />
              </div>
            </React.Fragment>
          ))}

          <div className={`${gridCellBase} ${colLeft} border-r font-bold bg-white`}>Totais:</div>
          <div className={`${gridCellBase} ${colCenter} border-r font-bold bg-white text-[#004080]`}>{calculateTotals('atuais')}</div>
          <div className={`${gridCellBase} ${colCenter} border-r font-bold bg-white text-[#004080]`}>{calculateTotals('y2')}</div>
          <div className={`${gridCellBase} ${colCenter} border-r font-bold bg-white text-[#004080]`}>{calculateTotals('y5')}</div>
          <div className={`${gridCellBase} ${colCenter} border-r font-bold bg-white text-[#004080]`}>{calculateTotals('y20')}</div>
          <div className={`${gridCellBase} ${colCenter} font-bold bg-[#004080] text-white`}>{formatBR(calculateTotals('totalQ'))}</div>
        </div>
      </section>

      {/* Technical Requirements */}
      <section className="p-6 border border-slate-200 rounded-lg bg-white">
        <h4 className="font-bold text-[#004080] mb-4 uppercase text-xs">Requisitos técnicos para instalação de infraestrutura:</h4>
        <ul className="space-y-3 text-[9pt] text-slate-600 list-none">
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">a.</span>
            <span>Deverá ser realizado levantamento de mercado potencial nas áreas de implantação de novos sistemas de distribuição de gás.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">b.</span>
            <span>Deverá ser realizada e entregue juntamente com a solicitação de estudo uma análise sócio-economica da área a ser abastecida, para que seja justificado o dimensionamento da rede nos períodos de imediato até 20 anos.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">c.</span>
            <span>Deverá ser avaliado o interesse em instalar equipamentos de climatização e/ou cogeração nos possíveis consumidores industriais, grandes estabelecimentos comerciais e postos GNV.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#004080]">d.</span>
            <span>Para melhor distribuição dos fluxos e dimensionamento das redes de gás, os grandes clientes (Industrial/GNV/Climatização/Geração, etc.) devem ser mapeados e solicitados com arquivos KMZ ou tabela com suas respectivas coordenadas UTM.</span>
          </li>
        </ul>
      </section>

      {/* Documentação e Anexos */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Documentação e Anexos</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          {!readOnly && (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#004080]">Anexe arquivos KMZ ou tabelas de coordenadas</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">PDF, KMZ, JPG, PNG, DWG (Max. 10MB)</p>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".pdf,.kmz,.jpg,.jpeg,.png,.dwg" />
            </div>
          )}

          {data.selectedFiles && data.selectedFiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {data.selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <i className="fa-solid fa-file-lines text-[#004080]"></i>
                    <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  {!readOnly && (
                    <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors text-slate-300"><i className="fa-solid fa-xmark"></i></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Comentários */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-2 font-normal rounded-t-lg uppercase">Comentários</div>
        <div className="p-4 border border-slate-200 rounded-b-lg bg-white">
          <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} disabled={readOnly} rows={6} className="w-full p-4 border border-slate-300 rounded-lg outline-none bg-white font-normal text-slate-700" placeholder="Insira aqui observações relevantes sobre o estudo..." />
        </div>
      </section>

      
    </div>
  );
};
