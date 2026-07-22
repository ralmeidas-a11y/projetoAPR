import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';

export const CCSettingsPanel: React.FC = () => {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await StorageService.getAlwaysCC();
        setEmails(stored);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const save = async (list: string[]) => {
    setEmails(list);
    await StorageService.saveAlwaysCC(list);
  };

  const parseEmails = (raw: string): string[] => {
    return raw.split(';').map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));
  };

  const handleAdd = () => {
    setError('');
    if (!newEmail.trim()) {
      setError('Informe pelo menos um e-mail.');
      return;
    }
    const parsed = parseEmails(newEmail);
    if (parsed.length === 0) {
      setError('Nenhum e-mail válido informado.');
      return;
    }
    const existing = emails.map(e => e.toLowerCase());
    const newOnes = parsed.filter(e => !existing.includes(e.toLowerCase()));
    if (newOnes.length === 0) {
      setError('Todos os e-mails já estão na lista.');
      return;
    }
    save([...emails, ...newOnes]);
    setNewEmail('');
  };

  const handleRemove = (idx: number) => {
    save(emails.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const handleEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditEmail(emails[idx]);
  };

  const handleSaveEdit = () => {
    if (!editEmail.trim()) return;
    const updated = [...emails];
    updated[editingIdx!] = editEmail.trim();
    save(updated);
    setEditingIdx(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-[#004080] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
          <i className="fa-solid fa-envelope-circle-check text-white text-xl"></i>
        </div>
        <div>
          <h2 className="text-xl font-black text-[#004080] uppercase tracking-tight">Cópia Permanente nos E-mails</h2>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Usuários que sempre receberão cópia nos e-mails de conclusão de estudo</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adicionar destinatário</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">E-mail(s)</label>
            <input
              type="text"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="email1@exemplo.com; email2@exemplo.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-[#004080]/5 focus:bg-white focus:border-[#004080] transition-all text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAdd}
              className="w-full py-3 px-6 bg-[#004080] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#003060] transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Adicionar
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-sm"></i>
            <p className="text-red-600 text-xs font-bold">{error}</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatários ({emails.length})</span>
        </div>
        {emails.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-inbox text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm text-slate-400 font-semibold">Nenhum destinatário configurado</p>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">Adicione e-mails acima para begin</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {emails.map((email, idx) => (
              <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                {editingIdx === idx ? (
                  <div className="flex items-center gap-3 flex-1">
                    <i className="fa-solid fa-envelope text-[#004080] text-sm"></i>
                    <input
                      type="text"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      className="flex-1 px-3 py-1.5 bg-white border border-[#004080]/30 rounded-lg outline-none text-sm focus:ring-2 focus:ring-[#004080]/10"
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-600 transition-colors">
                      <i className="fa-solid fa-check"></i>
                    </button>
                    <button onClick={() => setEditingIdx(null)} className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 transition-colors">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#004080]/5 rounded-xl flex items-center justify-center">
                        <i className="fa-solid fa-user text-[#004080] text-xs"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{email}</p>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">Cópia automática na conclusão</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(idx)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-[#004080] hover:text-white transition-all" title="Editar">
                        <i className="fa-solid fa-pen text-[10px]"></i>
                      </button>
                      <button onClick={() => handleRemove(idx)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-500 hover:text-white transition-all" title="Remover">
                        <i className="fa-solid fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
