import React, { useRef } from 'react';
import { FormData } from '../types/types';
import { REQUESTER_AREAS, MUNICIPALITIES_RJ, MUNICIPALITIES_SP } from '../constants/constants';
import { formatDate } from '../utils/utils';

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

  const inputGridClass = "w-full h-full text-center border-none focus:ring-0 outline-none bg-transparent p-0 m-0 block appearance-none";

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

  const standardLabelClass = "text-[9px] font-bold text-[#004080] uppercase tracking-tight pb-0.5";
  const requiredLabelClass = "text-[9px] font-bold text-[#004080] uppercase tracking-tight pb-0.5";

  // Table styles for readOnly mode
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '10pt', fontFamily: 'Arial, sans-serif' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '9px', color: '#004080', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.025em', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '10pt', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

  // Grid table styles
  const gridThStyle: React.CSSProperties = { padding: '10px', fontSize: '9px', color: '#004080', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.025em', textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', backgroundColor: '#fff' };
  const gridTdStyle: React.CSSProperties = { padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', height: '56px', textAlign: 'center', verticalAlign: 'middle' };

  const ReadOnlyField = ({ label, value, colSpan = 12 }: { label: string; value: any; colSpan?: number }) => (
    <div className={`col-span-${colSpan} flex flex-col border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm`}>
      <label className="text-[8px] text-[#004080] font-extrabold uppercase tracking-widest mb-1.5 opacity-70">{label}</label>
      <div className="text-[10pt] font-bold text-slate-800 break-words leading-tight">{value || '-'}</div>
    </div>
  );

  return (
    <div className={`${readOnly ? 'w-full' : 'max-w-4xl mx-auto'} space-y-6 ${readOnly ? 'pb-4' : 'pb-20'}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      <datalist id="municipalities">
        {municipalities.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* Header Title Section */}
      <div className="bg-[#004080] text-white text-center py-2.5 px-4 rounded-lg font-black uppercase tracking-widest text-[11px] shadow-md mb-6">
        ESTUDO ADR PARA GASEIFICAÇÕES TOTAIS OU PARCIAIS DE ÁREAS EM EXPANSÃO OU NOVOS MUNICÍPIOS
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
            {data.additionalCCs && <ReadOnlyField label="Cópia para" value={data.additionalCCs} colSpan={12} />}
          </div>
        ) : (<>
          <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={standardLabelClass}>Naturgy:</label>
              <select name="naturgyUnit" value={data.naturgyUnit || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal h-10">
                <option value="">Selecione...</option>
                <option value="Capital">Capital</option>
                <option value="Interior">Interior</option>
                <option value="SPS">SPS</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Tipo de Estudo:</label>
              <select name="studyType" value={data.studyType || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal h-10">
                <option value="">Selecione...</option>
                <option value="Novo Estudo">Novo Estudo</option>
                <option value="Revisão de Estudo">Revisão de Estudo</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Data da Solicitação:</label>
              <input type="date" name="requestDate" value={data.requestDate || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" />
            </div>
            {data.studyType === 'Revisão de Estudo' && (
              <div className="col-span-12 flex flex-col gap-1">
                <label className={requiredLabelClass}>Estudo Anterior:</label>
                <input name="previousStudy" value={data.previousStudy || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" placeholder="Código do estudo anterior para revisão" />
              </div>
            )}
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={requiredLabelClass}>Resp. Solicitação:</label>
              <input name="requesterName" value={data.requesterName || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" placeholder="Nome Completo" />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>Telefone:</label>
              <input name="phone" value={data.phone || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" placeholder="(XX) XXXXX-XXXX" />
            </div>
            <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
              <label className={requiredLabelClass}>Área Solicitante:</label>
              <select name="requesterArea" value={data.requesterArea || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none bg-white font-normal h-10">
                <option value="">Selecione a área...</option>
                {REQUESTER_AREAS.map(area => (<option key={area} value={area}>{area}</option>))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={requiredLabelClass}>E-mail:</label>
              <input type="email" name="email" value={data.email || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" />
            </div>
          </div>

          {/* Cópia para terceiros */}
          {!readOnly && (
            <div className="px-4 pb-3 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={data.additionalCCs !== undefined && data.additionalCCs !== ''}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleInputChange({ target: { name: 'additionalCCs', value: ' ' } } as any);
                      } else {
                        handleInputChange({ target: { name: 'additionalCCs', value: '' } } as any);
                      }
                    }}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-[#004080] peer-checked:border-[#004080] transition-all flex items-center justify-center">
                    <i className={`fa-solid fa-check text-[10px] text-white transition-opacity ${data.additionalCCs ? 'opacity-100' : 'opacity-0'}`}></i>
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#004080] transition-colors">Adicionar cópia para outros usuários</span>
              </label>
              {data.additionalCCs !== undefined && data.additionalCCs !== '' && (
                <div className="flex items-center gap-2 ml-8">
                  <i className="fa-solid fa-envelope text-slate-300 text-xs"></i>
                  <input
                    type="text"
                    name="additionalCCs"
                    value={data.additionalCCs || ''}
                    onChange={handleInputChange}
                    className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10 text-xs flex-1"
                    placeholder="email1@exemplo.com; email2@exemplo.com"
                  />
                </div>
              )}
            </div>
          )}
        </>)}
      </section>

      {/* Dados Base do Estudo */}
      <section className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-[#004080] text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-wider">Dados Base do Estudo</div>
        {readOnly ? (
          <div className="p-5 grid grid-cols-12 gap-4 bg-[#f8fbff]/50">
            <ReadOnlyField label="Título Projeto" value={data.studyTitle} colSpan={12} />
            <ReadOnlyField label="Estado" value={data.state} colSpan={4} />
            <ReadOnlyField label="Cidade/Município" value={data.city} colSpan={4} />
            <ReadOnlyField label="Tipo de Gaseificação" value={data.gasificationType} colSpan={4} />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-12 gap-x-4 gap-y-3 bg-white">
            <div className="col-span-12 flex flex-col gap-1">
              <label className={requiredLabelClass}>Título Projeto:</label>
              <input name="studyTitle" value={data.studyTitle || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10" />
            </div>
            <div className="col-span-12 md:col-span-3 flex flex-col gap-1">
              <label className={standardLabelClass}>Estado:</label>
              <select name="state" value={data.state || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded outline-none bg-white font-normal h-10">
                <option value="">Selecione...</option>
                <option value="Rio de Janeiro">Rio de Janeiro</option>
                <option value="São Paulo">São Paulo</option>
                <option value="Rio/São Paulo">Rio/São Paulo</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-5 flex flex-col gap-1">
              <label className={requiredLabelClass}>Cidade/Município:</label>
              <input
                name="city"
                list="municipalities"
                value={data.city || ''}
                onChange={handleInputChange}
                className="p-2 border border-slate-300 rounded outline-none font-normal bg-white h-10"
                placeholder="Digite o nome da cidade para sugestões..."
              />
            </div>
            <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
              <label className={standardLabelClass}>Tipo de Gaseificação:</label>
              <select name="gasificationType" value={data.gasificationType || ''} onChange={handleInputChange} className="p-2 border border-slate-300 rounded bg-white outline-none font-normal h-10">
                <option value="">Selecione...</option>
                <option value="Parcial">Parcial</option>
                <option value="Total">Total</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Matriz de Clientes (FO.02) */}
      <section className="overflow-x-auto border border-slate-200">
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest text-center">Crescimento cumulativo m³/(n)/h</div>
        <table style={{ ...tableStyle, minWidth: '650px', fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={{ ...gridThStyle, textAlign: 'left' }}>Clientes previstos captar</th>
              <th style={gridThStyle}>Atuais</th>
              <th style={gridThStyle}>2 Anos</th>
              <th style={gridThStyle}>5 Anos</th>
              <th style={gridThStyle}>20 Anos</th>
              <th style={{ ...gridThStyle, borderRight: 'none' }}>Q total previsto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td style={{ ...gridTdStyle, textAlign: 'left', padding: '10px', fontWeight: 500 }}>{row.label}</td>
                <td style={gridTdStyle}>
                  {readOnly ? (
                    <span style={{ fontWeight: 600, color: '#334155' }}>{data.gridDataFO02?.[row.key]?.atuais || '-'}</span>
                  ) : (
                    <input type="number" value={data.gridDataFO02?.[row.key]?.atuais ?? ''} onChange={(e) => handleGridChange(row.key, 'atuais', e.target.value)} className={inputGridClass} />
                  )}
                </td>
                <td style={gridTdStyle}>
                  {readOnly ? (
                    <span style={{ fontWeight: 600, color: '#334155' }}>{data.gridDataFO02?.[row.key]?.y2 || '-'}</span>
                  ) : (
                    <input type="number" value={data.gridDataFO02?.[row.key]?.y2 ?? ''} onChange={(e) => handleGridChange(row.key, 'y2', e.target.value)} className={inputGridClass} />
                  )}
                </td>
                <td style={gridTdStyle}>
                  {readOnly ? (
                    <span style={{ fontWeight: 600, color: '#334155' }}>{data.gridDataFO02?.[row.key]?.y5 || '-'}</span>
                  ) : (
                    <input type="number" value={data.gridDataFO02?.[row.key]?.y5 ?? ''} onChange={(e) => handleGridChange(row.key, 'y5', e.target.value)} className={inputGridClass} />
                  )}
                </td>
                <td style={gridTdStyle}>
                  {readOnly ? (
                    <span style={{ fontWeight: 600, color: '#334155' }}>{data.gridDataFO02?.[row.key]?.y20 || '-'}</span>
                  ) : (
                    <input type="number" value={data.gridDataFO02?.[row.key]?.y20 ?? ''} onChange={(e) => handleGridChange(row.key, 'y20', e.target.value)} className={inputGridClass} />
                  )}
                </td>
                <td style={{ ...gridTdStyle, borderRight: 'none' }}>
                  {readOnly ? (
                    <span style={{ fontWeight: 'bold', color: '#004080' }}>{formatBR(data.gridDataFO02?.[row.key]?.totalQ)}</span>
                  ) : (
                    <input type="number" value={data.gridDataFO02?.[row.key]?.totalQ ?? ''} onChange={(e) => handleGridChange(row.key, 'totalQ', e.target.value)} className={inputGridClass} />
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...gridTdStyle, textAlign: 'left', padding: '10px', fontWeight: 'bold', color: '#004080', textTransform: 'uppercase', borderBottom: 'none' }}>Totais:</td>
              <td style={{ ...gridTdStyle, fontWeight: 'bold', color: '#004080', padding: '10px', borderBottom: 'none' }}>{formatBR(calculateTotals('atuais'))}</td>
              <td style={{ ...gridTdStyle, fontWeight: 'bold', color: '#004080', padding: '10px', borderBottom: 'none' }}>{formatBR(calculateTotals('y2'))}</td>
              <td style={{ ...gridTdStyle, fontWeight: 'bold', color: '#004080', padding: '10px', borderBottom: 'none' }}>{formatBR(calculateTotals('y5'))}</td>
              <td style={{ ...gridTdStyle, fontWeight: 'bold', color: '#004080', padding: '10px', borderBottom: 'none' }}>{formatBR(calculateTotals('y20'))}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', backgroundColor: '#004080', color: '#fff', textAlign: 'center', borderBottom: 'none' }}>{formatBR(calculateTotals('totalQ'))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Requisitos Técnicos */}
      <section className="p-6 border border-slate-200 rounded-lg bg-white">
        <h4 className="font-bold text-[#004080] mb-4 uppercase text-[9px]">Requisitos técnicos para instalação de infraestrutura:</h4>
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
      <section className="hide-export">
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">Documentação e Anexos</div>
        <div className="p-6 border border-slate-200 rounded-b-lg bg-white space-y-4">
          {!readOnly && (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF8000] transition-all cursor-pointer group bg-white text-center">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#FF8000] group-hover:bg-white transition-all shadow-sm">
                <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#004080]">Anexe arquivos KMZ ou tabelas de coordenadas</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">PDF, KMZ, JPG, PNG, DWG (Max. 10MB)</p>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".pdf,.kmz,.jpg,.jpeg,.png,.dwg" />
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
                    <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors text-slate-300">
                      <i className="fa-solid fa-xmark text-xs"></i>
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

      {/* Comentários */}
      <section>
        <div className="bg-[#004080] text-white px-4 py-1.5 font-bold rounded-t text-[10px] uppercase">Comentários</div>
        <div className={`p-4 border border-slate-200 bg-white ${readOnly ? '' : 'rounded-b-lg'}`}>
          {readOnly ? (
            <div className="h-auto text-[10pt] text-slate-700 whitespace-pre-wrap overflow-visible">
              {data.comments || 'Nenhum comentário registrado.'}
            </div>
          ) : (
            <textarea name="comments" value={data.comments || ''} onChange={handleInputChange} rows={6} className="w-full p-4 border border-slate-300 rounded-lg outline-none bg-white font-normal text-slate-700" placeholder="Insira aqui observações relevantes sobre o estudo..." />
          )}
        </div>
      </section>
    </div>
  );
};
