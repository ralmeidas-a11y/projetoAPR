import { useState, useEffect } from 'react';
import { User, UserRole } from '../types/types';

interface SystemSettingsProps {
  user: User;
}

export function SystemSettings({ user }: SystemSettingsProps) {
  const [folderBasePath, setFolderBasePath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!isLoading && !folderBasePath) {
      fetchConfig();
    }
  }, [isLoading, folderBasePath]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.folderBasePath) {
        setFolderBasePath(data.folderBasePath);
      }
    } catch (err) {
      console.error('[SystemSettings] Error fetching config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const cleanPath = folderBasePath.trim();

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderBasePath: cleanPath }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao salvar: ' + data.error });
      }
    } catch (err) {
      console.error('[SystemSettings] Error saving:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestFolder = async () => {
    if (!folderBasePath) {
      setMessage({ type: 'error', text: 'Defina o caminho base primeiro' });
      return;
    }

    const cleanPath = folderBasePath.trim();
    const testPath = `${cleanPath}\\TESTE`;

    try {
      setMessage({ type: 'success', text: 'Criando pasta de teste: TESTE' });

      const res = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: testPath }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Pasta Teste criada dentro do caminho configurado!' });
      } else {
        setMessage({ type: 'error', text: 'Erro: ' + data.error });
      }
    } catch (err) {
      console.error('[handleTestFolder] Error:', err);
      setMessage({ type: 'error', text: 'Erro ao testar caminho' });
    }
  };

  if (user.role !== UserRole.ADM) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500 font-bold">Acesso restrito</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300 p-8">
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm max-w-2xl mx-auto w-full">
        <h2 className="text-xl font-black text-[#004080] uppercase tracking-tight mb-6 flex items-center gap-3">
          <i className="fa-solid fa-gear"></i>
          Configurações do Sistema
        </h2>

        <div className="space-y-6">


          <div className="p-5 border border-slate-200 rounded-2xl">
            <h3 className="text-sm font-black text-[#004080] uppercase mb-4">Pastas de Estudo</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  Caminho onde as pastas de mapas serão criadas
                </label>
                <input
                  type="text"
                  value={folderBasePath}
                  onChange={(e) => setFolderBasePath(e.target.value)}
                  placeholder="C:\Users\Users\Caminho\Local\Pastas"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

              </div>

              <div className="flex gap-3 pt-2">

              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'success'
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
              <i className={`fa-solid ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-6 py-3 bg-[#004080] text-white rounded-xl text-sm font-bold hover:bg-[#003060] transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk mr-2"></i>
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}