import React from 'react';
import { FormData, User } from '../../types/types';

interface LetterModelProps {
  data: FormData;
  allUsers: User[];
  currentUser: User | null;
  reference: React.RefObject<HTMLDivElement>;
}

export const GaseificaParcLetterModel: React.FC<LetterModelProps> = ({ data, allUsers, currentUser, reference }) => {
  const docDate = data.cartaGeneratedAt || data.completedAt || new Date().toISOString();

  const assignedUser = allUsers.find(u => {
    const matchId = u.id === data.assignedTo;
    const matchEmail = u.email?.toLowerCase() === data.assignedTo?.toLowerCase();
    const matchGB = u.gb?.toLowerCase() === data.assignedTo?.toLowerCase();
    const matchSAP = u.sap && data.assignedTo?.replace(/^0+/, '') === u.sap.replace(/^0+/, '');
    return matchId || matchEmail || matchGB || matchSAP;
  }) || (data.assignedTo === currentUser?.id || data.assignedTo === currentUser?.email ? currentUser : null);

  const toTitleCase = (str: string) => {
    if (!str || str === 'Responsável Técnico' || str === 'Empresa' || str === 'Cargo') return str;
    return str.toLowerCase().split(' ').map(word => {
      if (word.length <= 2 && ['da', 'de', 'do', 'das', 'dos', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const analystName = toTitleCase(assignedUser?.name || data.assignedToName || data.analystName || 'Responsável Técnico').trim();
  const analystCompany = toTitleCase(assignedUser?.company || data.analystCompany || 'Empresa').trim();
  const analystRole = toTitleCase(assignedUser?.roleDescription || data.analystRole || 'Cargo').trim();
  const analystGB = (assignedUser?.gb || data.analystGB || assignedUser?.sap || data.assignedTo || 'SISTEMA').trim();

  const validUntilDate = (() => {
    const d = new Date(docDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('pt-BR');
  })();

  const formatCurrency = (value: any) => {
    if (value === undefined || value === null || isNaN(Number(value))) return '0,00';
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div
      ref={reference}
      className="bg-white p-12 shadow-2xl relative flex flex-col min-h-[1122px] w-[794px] overflow-hidden shrink-0 mb-20 mt-4"
      style={{ fontVariantLigatures: 'none' }}
    >
      <div className="absolute left-[-352px] top-[600px] -translate-y-1/2 -rotate-90 w-[800px] flex justify-center items-end h-10">
        <span className="text-[9px] font-black text-[#004080] uppercase tracking-[1em] select-none whitespace-nowrap leading-none">
          PE.05306-FO.06 Rev.01/23.11 • Resposta de Estudo de Rede
        </span>
      </div>

      <div className="flex justify-between items-start mb-2 ml-10">
        <div className="flex flex-col">
          <span className="text-[14px] font-black text-slate-900 tracking-tight">{data.studyNumber?.replace('PROV-', '')}</span>
          <span className="text-[14px] font-black text-[#004080] uppercase mt-1 tracking-tight">GEGAT - Análise e Planificação da Rede</span>
        </div>
        <div className="flex flex-col items-end">
          <img src="/logo.png" alt="Naturgy" className="h-28 object-contain mb-1" />
        </div>
      </div>

      <div className="ml-10 space-y-4 flex-grow flex flex-col">
        <div className="border border-black">
          <div className="bg-slate-200 px-3 py-0.5 border-b border-black">
            <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Dados da Solicitação:</span>
          </div>
          <div className="p-3">
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }} className="text-[11px] leading-tight font-medium text-slate-800">
              <tbody>
                <tr>
                  <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                    <span className="font-black">Área:</span> <span className="whitespace-normal break-words">{data.requesterArea || '-'}</span>
                  </td>
                  <td rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'left', paddingLeft: '8px', height: '36px' }}>
                    <div style={{ display: 'inline-block', backgroundColor: '#E53935', color: 'white', fontWeight: '900', fontSize: '10px', border: '1px solid black', padding: '2px 4px' }}>
                      Estudo Válido até: {validUntilDate}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                    <span className="font-black">Solicitante:</span> <span className="whitespace-normal break-words">{data.requesterName || '-'}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ width: '40%', verticalAlign: 'top', paddingBottom: '4px' }}>
                    <div className="flex flex-col gap-[4px]">
                      <div><span className="font-black">Mercado:</span> <span className="whitespace-normal break-words">{data.studySubType || '-'}</span></div>
                      <div><span className="font-black">Cliente:</span> <span className="whitespace-normal break-words">{data.clientName || data.studyTitle || '-'}</span></div>
                    </div>
                  </td>
                  <td style={{ width: '26%', verticalAlign: 'top', paddingBottom: '0px' }}>
                    {/* Vazia */}
                  </td>
                  <td style={{ width: '34%', verticalAlign: 'top', paddingBottom: '0px', paddingLeft: '8px' }}>
                    <div className="flex flex-col gap-[4px]">
                      <div><span className="font-black">Data:</span> {new Date(docDate).toLocaleDateString('pt-BR')}</div>
                      <div><span className="font-black">Código Estudo:</span> {data.studyNumber?.replace('PROV-', '') || '-'}</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ verticalAlign: 'top', paddingBottom: '2px' }}>
                    <span className="font-black">Município:</span> <span className="whitespace-normal break-words">{data.city || '-'}</span>
                  </td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '2px', paddingLeft: '8px' }}>
                    <span className="font-black">Bairro:</span> <span className="whitespace-normal break-words">{data.neighborhood || '-'}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex gap-2 items-stretch mt-2">
              <div className="p-3 bg-slate-50 border border-black rounded shadow-inner min-h-[60px] flex-grow">
                <span className="font-black uppercase text-[9px] text-slate-400 mb-1 block">Localização:</span>
                <span className="text-[11px] leading-tight whitespace-normal break-words block">{data.address || '-'}</span>
              </div>
              
              <div className="flex flex-col gap-1 w-[200px] shrink-0">
                {/* Nº Clientes Residenciais */}
                <div className="border border-black overflow-hidden bg-white">
                  <div className="bg-[#f0f0f0] px-2 py-0.5 border-b border-black text-center">
                    <span className="text-[10px] font-black uppercase text-slate-800">Nº Clientes Residenciais</span>
                  </div>
                  <div className="flex divide-x divide-black text-[10px] font-black">
                    <div className="w-1/2 py-1 text-center">{data.numClientsRes || 0}</div>
                    <div className="w-1/2 py-1 text-center">{formatCurrency(data.totalFlowRes)} m³/h</div>
                  </div>
                </div>

                {/* Nº Clientes Comerciais */}
                <div className="border border-black overflow-hidden bg-white">
                  <div className="bg-[#f0f0f0] px-2 py-0.5 border-b border-black text-center">
                    <span className="text-[10px] font-black uppercase text-slate-800">Nº Cli. Com. Ind. Gnv. Etc</span>
                  </div>
                  <div className="flex divide-x divide-black text-[10px] font-black">
                    <div className="w-1/2 py-1 text-center">{data.numClientsCom || 0}</div>
                    <div className="w-1/2 py-1 text-center">{formatCurrency(data.totalFlowCom)} m³/h</div>
                  </div>
                </div>

                {/* Vazão Total */}
                <div className="border border-black overflow-hidden bg-white">
                  <div className="bg-[#f0f0f0] px-2 py-0.5 border-b border-black text-center leading-tight">
                    <span className="text-[10px] font-black uppercase text-slate-800">Vazão Total Informada m³/h</span>
                  </div>
                  <div className="py-1 text-center text-[10px] font-black">
                    {formatCurrency(data.vazaoSol || data.totalFlow)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-stretch mt-2 flex-grow min-h-[300px]">
          <div className="border border-black w-[70%] flex flex-col">
            <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Redes Dimensionadas:</span>
            </div>
            <div className="p-0 flex-grow">
              <table className="w-full text-center border-collapse text-[8px] font-black table-auto h-full">
                <thead className="bg-white border-b border-black">
                  <tr className="divide-x divide-black uppercase">
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Extensão (m)</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Ø (mm)</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Material</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Pressão</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Gás</th>
                    <th className="py-1 px-1 whitespace-normal break-words align-middle text-center" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Válvulas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black bg-blue-50/30">
                    <td colSpan={6} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px 0' }} className="text-center font-black uppercase text-[7px] text-blue-700 tracking-tighter">
                      {data.plannedExtensions?.[0]?.networkType || data.networkDescription || 'Rede Externa'}
                    </td>
                  </tr>
                  {(data.plannedExtensions && data.plannedExtensions.length > 0) ? data.plannedExtensions.map((ext, idx) => (
                    <tr key={idx} className="divide-x divide-black uppercase border-b border-black/10 text-center" style={{ textAlign: 'center' }}>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.extension}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.diameter}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.material}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.pressure}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.gasType}</td>
                      <td className="py-2 px-1 whitespace-normal break-words" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{ext.valves}</td>
                    </tr>
                  )) : (
                    <tr className="divide-x divide-black"><td colSpan={6} className="p-2"></td></tr>
                  )}
                  {Array.from({ length: Math.max(0, 10 - (data.plannedExtensions?.length || 0)) }).map((_, i) => (
                    <tr key={`fake-${i}`} className="divide-x divide-black">
                      <td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td><td className="py-1">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-black w-[30%] flex flex-col">
            <table className="w-full h-full text-center border-collapse text-[10px] font-black table-fixed">
              <tbody>
                <tr className="bg-slate-200 border-b border-black">
                  <td colSpan={2} className="py-1 px-1 leading-tight uppercase">ERM Distrital Projetada</td>
                </tr>
                <tr className="bg-slate-200 border-b border-black">
                  <td colSpan={2} className="py-0.5 px-1 uppercase text-[9px]">Pressões</td>
                </tr>
                <tr className="bg-slate-200 border-b border-black divide-x divide-black uppercase">
                  <td className="py-0.5 px-1 w-1/2">Entrada</td>
                  <td className="py-0.5 px-1 w-1/2">Saída</td>
                </tr>
                <tr className="bg-white border-b border-black divide-x divide-black h-6">
                  <td className="py-0.5 px-1 uppercase">
                    {(() => {
                      const isBP = data.responseUnit === 'mbar' || 
                                   ['BP-N', 'BP-P', 'BPN', 'BPP'].some(b => 
                                     (data.responsePressureBase || '').toString().toUpperCase().includes(b) || 
                                     (data.responseCalculatedPressure || '').toString().toUpperCase().includes(b)
                                   );
                      const unit = isBP ? 'mbar' : 'bar';
                      return (data as any).regSizingInPress ? `${(data as any).regSizingInPress} ${unit}` : '';
                    })()}
                  </td>
                  <td className="py-0.5 px-1 uppercase">
                    {(() => {
                      const isBP = data.responseUnit === 'mbar' || 
                                   ['BP-N', 'BP-P', 'BPN', 'BPP'].some(b => 
                                     (data.responsePressureBase || '').toString().toUpperCase().includes(b) || 
                                     (data.responseCalculatedPressure || '').toString().toUpperCase().includes(b)
                                   );
                      const unit = isBP ? 'mbar' : 'bar';
                      return (data as any).regSizingOutPress ? `${(data as any).regSizingOutPress} ${unit}` : '';
                    })()}
                  </td>
                </tr>
                <tr className="bg-slate-200 border-b border-black">
                  <td colSpan={2} className="py-0.5 px-1 uppercase text-[9px]">Vazão Inicial</td>
                </tr>
                <tr className="bg-white border-b border-black h-6">
                  <td colSpan={2} className="py-0.5 px-1 text-blue-700">
                    {(data as any).regSizingFlow ? `${formatCurrency((data as any).regSizingFlow)} m³/h` : 'm³/h'}
                  </td>
                </tr>
                <tr className="bg-slate-200 border-b border-black">
                  <td colSpan={2} className="py-0.5 px-1 uppercase text-[9px]">Vazão Futura</td>
                </tr>
                <tr className="bg-white h-6">
                  <td colSpan={2} className="py-0.5 px-1 text-blue-700">
                    {(data as any).regSizingFutureFlow ? `${formatCurrency((data as any).regSizingFutureFlow)} m³/h` : 'm³/h'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-black flex h-8 items-center text-[10px] font-black mt-2">
          <div className="bg-slate-200 h-full flex items-center px-4 border-r border-black shrink-0">
            <span className="uppercase text-slate-800">Pressões Normativas:</span>
          </div>
          <div className="flex-grow flex justify-around px-8">
            <span>Máx.: {data.responseMaxPo ?? ' - '} {(data.responseUnit === 'mbar' || (data.responseCalculatedPressure || '').toString().toUpperCase().includes('BP-N') || (data.responsePressureBase || '').toString().toUpperCase().includes('BP-N')) ? 'mbar' : 'bar'}</span>
            <span>Min.: {data.responseMin ?? ' - '} {(data.responseUnit === 'mbar' || (data.responseCalculatedPressure || '').toString().toUpperCase().includes('BP-N') || (data.responsePressureBase || '').toString().toUpperCase().includes('BP-N')) ? 'mbar' : 'bar'}</span>
            <span>Garantia: {data.responseGarantia ?? ' - '} {(data.responseUnit === 'mbar' || (data.responseCalculatedPressure || '').toString().toUpperCase().includes('BP-N') || (data.responsePressureBase || '').toString().toUpperCase().includes('BP-N')) ? 'mbar' : 'bar'}</span>
          </div>
        </div>

        <div className="border border-black min-h-[140px] mt-2">
          <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
            <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Pontos de Interligações:</span>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[10px] font-medium text-slate-700 leading-snug">
            {(data.interconnectionPoints && data.interconnectionPoints.length > 0) ? data.interconnectionPoints.map((p, i) => (
              <div key={i} className="whitespace-normal break-words">
                • Rede {p.pressure} Ø {p.diameter} {p.material}, {p.location || 'Local a confirmar'}, {p.comment}.
              </div>
            )) : (
              <span className="italic text-slate-300">Conforme indicado em projeto / croqui.</span>
            )}
          </div>
        </div>

        <div className="border border-black min-h-[200px] flex flex-col mt-2">
          <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
            <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Condições e Observações:</span>
          </div>
          <div className="p-6 flex flex-col gap-1 text-[9px] font-bold text-red-500 italic leading-normal whitespace-pre-wrap">
            {(data.responseObservations || '').split('\n').filter(l => l.trim()).map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0">{i + 1}-)</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-grow"></div>

        <div className="pt-8 flex justify-around items-end">
          <div className="flex flex-col items-center">
            <div className="w-56 border-t border-black mb-1"></div>
            <span className="text-[12px] font-black text-slate-900">
              {analystName}
            </span>
            <span className="text-[10px] font-bold text-slate-900 tracking-tighter text-center">
              {analystCompany} - {analystRole}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-56 border-t border-black mb-1"></div>
            <span className="text-[12px] font-black text-slate-900">Ricardo Solon</span>
            <span className="text-[10px] font-bold text-slate-900 tracking-tighter text-center">Chefe da Análise e Planificação da Rede</span>
          </div>
        </div>

        <div className="pt-10 flex flex-col items-end gap-1 mt-4">
          <p className="text-[9px] font-black text-slate-900 tracking-widest text-right italic">
            {`Documento gerado pelo gb ${analystGB} ${analystName === 'Responsável Técnico' ? '' : analystName} em ${new Date(docDate).toLocaleDateString('pt-BR')} às ${new Date(docDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      </div>
    </div>
  );
};
