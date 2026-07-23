import React from 'react';
import { FormData, User } from '../../types/types';
interface LetterModelProps {
  data: FormData;
  allUsers: User[];
  currentUser: User | null;
  reference: React.RefObject<HTMLDivElement>;
}
export const GenericoLetterModel: React.FC<LetterModelProps> = ({ data, allUsers, currentUser, reference }) => {
  const docDate = new Date().toISOString();
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
  const analystName = toTitleCase(assignedUser?.name || data.assignedToName || data.analystName || currentUser?.name || 'Responsável Técnico').trim();
  const analystCompany = toTitleCase(assignedUser?.company || data.analystCompany || 'Empresa').trim();
  const analystRole = toTitleCase(assignedUser?.roleDescription || data.analystRole || 'Cargo').trim();
  const analystGB = (assignedUser?.gb || data.analystGB || currentUser?.gb || assignedUser?.sap || data.assignedTo || 'SISTEMA').trim();

  const isNotExecutor = currentUser && assignedUser && currentUser.id !== assignedUser.id;
  const signerName = isNotExecutor ? (currentUser.name || analystName) : analystName;
  const signerGB = isNotExecutor ? (currentUser.gb || analystGB) : analystGB;

  const validUntilDate = (() => {
    const d = new Date(docDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('pt-BR');
  })();
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
                      <div><span className="font-black">Município:</span> <span className="whitespace-normal break-words">{data.city || '-'}</span></div>
                      <div><span className="font-black">Empresa:</span> <span className="whitespace-normal break-words">{data.clientName || data.studyTitle || '-'}</span></div>
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
              </tbody>
            </table>
            <div className="mt-2 p-3 bg-slate-50 border border-black rounded shadow-inner min-h-[60px]">
              <span className="font-black uppercase text-[9px] text-slate-400 mb-1 block">Resumo da Solicitação:</span>
              <span className="text-[11px] leading-tight whitespace-normal break-words block">{(data as any).OBSERVS || '-'}</span>
            </div>
          </div>
        </div>
        <div className="border border-black flex-grow flex flex-col">
          <div className="bg-slate-200 h-6 flex items-center px-3 border-b border-black">
            <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Relatório de Entrega:</span>
          </div>
          <div className="p-6 flex flex-col gap-1 text-[9px] font-bold text-slate-900 leading-normal whitespace-pre-wrap">
            {(data.responseObservations || '').split('\n').filter(l => l.trim()).map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0">{i + 1}-)</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
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
            {`Documento gerado pelo gb ${signerGB} ${signerName === 'Responsável Técnico' ? '' : signerName} em ${new Date(docDate).toLocaleDateString('pt-BR')} às ${new Date(docDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      </div>
    </div>
  );
};