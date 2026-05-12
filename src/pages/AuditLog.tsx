import React, { useState, useEffect } from 'react';
import { useDialog } from '../components/AppDialog';

interface AuditEntry {
  ID: number;
  StudyNumber: string;
  ActionType: string;
  FieldChanged: string;
  OldValue: string;
  NewValue: string;
  UserId: string;
  UserName: string;
  UserEmail: string;
  Timestamp: string;
}

interface AuditLogProps {
  currentUser: any;
}

export const AuditLog: React.FC<AuditLogProps> = ({ currentUser }) => {
  const { showAlert } = useDialog();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStudyNumber, setFilterStudyNumber] = useState('');
  const [filterActionType, setFilterActionType] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    console.log('[AuditLog] Starting fetch...');
    try {
      const params = new URLSearchParams();
      if (filterStudyNumber) params.append('studyNumber', filterStudyNumber);
      if (filterActionType) params.append('actionType', filterActionType);
      if (filterUser) params.append('userId', filterUser);
      params.append('limit', '200');

      const res = await fetch(`/api/audit?${params.toString()}`);
      console.log('[AuditLog] Response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[AuditLog] Data received:', data.length, 'records');
        console.log('[AuditLog] Sample records:', data.slice(0, 3));
        setLogs(data);
      }
    } catch (err) {
      console.error('[AuditLog] Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const studyMatch = !filterStudyNumber || 
      (log.StudyNumber && log.StudyNumber.toLowerCase().includes(filterStudyNumber.toLowerCase()));
    const userMatch = !filterUser || 
      (log.UserName && log.UserName.toLowerCase().includes(filterUser.toLowerCase())) ||
      (log.UserEmail && log.UserEmail.toLowerCase().includes(filterUser.toLowerCase())) ||
      (log.UserId && log.UserId.toLowerCase().includes(filterUser.toLowerCase()));
    const actionMatch = !filterActionType || log.ActionType === filterActionType;
    return studyMatch && userMatch && actionMatch;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      'CREATE': 'bg-green-100 text-green-700 border-green-200',
      'UPDATE': 'bg-blue-100 text-blue-700 border-blue-200',
      'STATUS_CHANGE': 'bg-amber-100 text-amber-700 border-amber-200',
      'DELETE': 'bg-red-100 text-red-700 border-red-200',
      'ASSIGN': 'bg-purple-100 text-purple-700 border-purple-200',
      'LOGIN': 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return styles[action] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const statusCodeToText: Record<string, string> = {
    '100': 'Em Análise',
    '200': 'Aguardando Execução',
    '205': 'Em Execução',
    '210': 'Concluído',
    '215': 'Aprovado pelo CQ',
    '220': 'Cancelado',
    '225': 'Enviado sem CQ',
    '240': 'Aguardando Informações',
    '280': 'Controle de Qualidade',
    '290': 'Reprovado pelo CQ',
    '330': 'Em Análise',
  };

  const extractAuditValue = (value: string, field: string): string => {
    if (!value || value === 'null' || value === 'Criação') return 'Criação';
    
    // Status is stored as JSON for historical reasons
    if (field === 'status') {
      if (value.startsWith('{')) {
        try {
          const parsed = JSON.parse(value);
          return parsed.status || '-';
        } catch { return value; }
      }
      return statusCodeToText[value] || value;
    }

    // Deadlines are ISO strings, but might contain Justification text
    if (field === 'prazo' && value !== '-') {
      try {
        let datePart = value;
        let justificationPart = '';
        if (value.includes(' (Justificativa:')) {
            const parts = value.split(' (Justificativa:');
            datePart = parts[0];
            justificationPart = ' (Justificativa:' + parts[1];
        }
        
        const date = new Date(datePart);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('pt-BR') + justificationPart;
        }
      } catch { return value; }
    }
    
    return value;
  };

  const formatAuditChange = (log: AuditEntry) => {
    const oldRaw = extractAuditValue(log.OldValue, log.FieldChanged);
    const newRaw = extractAuditValue(log.NewValue, log.FieldChanged);
    
    const isCreation = log.ActionType === 'CREATE' || !log.OldValue || log.OldValue === 'null';
    
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Campo: {log.FieldChanged || 'Geral'}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-red-600 line-through opacity-70">{isCreation ? 'Novo' : oldRaw}</span>
          <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
          <span className="text-green-600 font-bold">{newRaw}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-[#004080] rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-clipboard-list text-white text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#004080]">Log de Auditoria</h2>
            <p className="text-slate-500 text-sm mt-1">Histórico de alterações no sistema</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-semibold text-slate-500 mb-2 block">Buscar por Estudo</label>
            <input
              type="text"
              value={filterStudyNumber}
              onChange={(e) => setFilterStudyNumber(e.target.value)}
              placeholder="Ex: 2026000001"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#004080]"
            />
          </div>
          <div className="w-48">
            <label className="text-[10px] font-semibold text-slate-500 mb-2 block">Tipo de Ação</label>
            <select
              value={filterActionType}
              onChange={(e) => setFilterActionType(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#004080]"
            >
              <option value="">Todas</option>
              <option value="CREATE">Criação</option>
              <option value="UPDATE">Alteração</option>
              <option value="STATUS_CHANGE">Mudança de Status</option>
              <option value="ASSIGN">Atribuição</option>
              <option value="DELETE">Exclusão</option>
            </select>
          </div>
          <div className="w-48">
            <label className="text-[10px] font-semibold text-slate-500 mb-2 block">Usuário</label>
            <input
              type="text"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="ID do usuário"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#004080]"
            />
          </div>
          
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-5 py-3.5 text-[10px] font-semibold text-slate-500 text-left">Data/Hora</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold text-slate-500 text-left">Estudo</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold text-slate-500 text-left">Ação</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold text-slate-500 text-left">Usuário</th>
                <th className="px-5 py-3.5 text-[10px] font-semibold text-slate-500 text-left">Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#004080]"></i>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 text-sm">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.ID} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-200">
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-600">{formatDate(log.Timestamp)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-[#004080]">{log.StudyNumber || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-1 rounded text-[9px] font-medium border ${getActionBadge(log.ActionType)}`}>
                        {log.ActionType === 'CREATE' ? 'Criação' : 
                         log.ActionType === 'UPDATE' ? 'Alteração' : 
                         log.ActionType === 'STATUS_CHANGE' ? 'Status' :
                         log.ActionType === 'DELETE' ? 'Exclusão' : 
                         log.ActionType === 'ASSIGN' ? 'Atribuição' : log.ActionType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="text-xs font-medium text-[#004080]">{log.UserName || '-'}</p>
                        <p className="text-[10px] text-blue-600">{log.UserEmail || (log.UserId ? log.UserId : '-')}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[10px]">
                        {(log.ActionType === 'STATUS_CHANGE' || log.ActionType === 'UPDATE' || log.ActionType === 'CREATE') ? (
                          formatAuditChange(log)
                        ) : log.OldValue && log.NewValue ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500">
                              De: <span className="text-red-600">{String(log.OldValue).substring(0, 100)}</span>
                            </span>
                            <span className="text-slate-500">
                              Para: <span className="text-green-600">{String(log.NewValue).substring(0, 100)}</span>
                            </span>
                          </div>
                        ) : log.OldValue ? (
                          <span className="text-red-600">Removido: {String(log.OldValue).substring(0, 100)}</span>
                        ) : log.NewValue ? (
                          <span className="text-green-600">Adicionado: {String(log.NewValue).substring(0, 100)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Total: {filteredLogs.length} de {logs.length} registros
          </span>
          <button
            onClick={() => { setFilterStudyNumber(''); setFilterActionType(''); setFilterUser(''); fetchLogs(); }}
            className="px-4 py-2 text-[10px] text-slate-500 hover:text-slate-700"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};