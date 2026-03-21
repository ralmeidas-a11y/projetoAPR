import React, { useState, useCallback, useContext, createContext, ReactNode } from 'react';

// ============================================================
// Types
// ============================================================
type DialogType = 'alert' | 'confirm' | 'success' | 'error' | 'warning' | 'info';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogState extends DialogOptions {
  visible: boolean;
  resolve?: (value: boolean) => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isBanner?: boolean;
  onAction?: () => void;
  onClose?: () => void;
  actionLabel?: string;
}

interface DialogContextValue {
  showAlert: (message: string, title?: string, type?: DialogType) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showToast: (message: string, type?: ToastItem['type']) => void;
  showBanner: (message: string, type?: ToastItem['type'], onAction?: () => void, actionLabel?: string, onClose?: () => void) => void;
}

// =====================================
// Context
// =====================================
const DialogContext = createContext<DialogContextValue>({
  showAlert: async () => {},
  showConfirm: async () => false,
  showToast: () => {},
  showBanner: () => {},
});

export const useDialog = () => useContext(DialogContext);

// =====================================
// Icons per type
// =====================================
const typeConfig: Record<DialogType, { icon: string; iconClass: string; btnClass: string; bg: string }> = {
  alert:   { icon: 'fa-circle-info',      iconClass: 'text-[#004080]', btnClass: 'bg-[#004080] hover:bg-blue-800',  bg: 'bg-blue-50'   },
  info:    { icon: 'fa-circle-info',      iconClass: 'text-[#004080]', btnClass: 'bg-[#004080] hover:bg-blue-800',  bg: 'bg-blue-50'   },
  success: { icon: 'fa-circle-check',     iconClass: 'text-green-500',  btnClass: 'bg-green-600 hover:bg-green-700', bg: 'bg-green-50'  },
  error:   { icon: 'fa-circle-xmark',     iconClass: 'text-red-500',    btnClass: 'bg-red-600 hover:bg-red-700',     bg: 'bg-red-50'    },
  warning: { icon: 'fa-triangle-exclamation', iconClass: 'text-orange-500', btnClass: 'bg-orange-500 hover:bg-orange-600', bg: 'bg-orange-50' },
  confirm: { icon: 'fa-circle-question',  iconClass: 'text-[#004080]', btnClass: 'bg-[#004080] hover:bg-blue-800',  bg: 'bg-blue-50'   },
};

const toastConfig: Record<ToastItem['type'], { icon: string; cls: string }> = {
  success: { icon: 'fa-circle-check',     cls: 'bg-green-600'  },
  error:   { icon: 'fa-circle-xmark',     cls: 'bg-red-600'    },
  info:    { icon: 'fa-circle-info',      cls: 'bg-[#004080]'  },
  warning: { icon: 'fa-triangle-exclamation', cls: 'bg-orange-500' },
};

// =====================================
// Provider
// =====================================
export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({ visible: false, message: '' });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = useCallback((message: string, title?: string, type: DialogType = 'alert'): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({ visible: true, message, title, type, resolve: () => resolve() });
    });
  }, []);

  const showConfirm = useCallback((message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ visible: true, message, title, type: 'confirm', resolve });
    });
  }, []);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, isBanner: false }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const showBanner = useCallback((message: string, type: ToastItem['type'] = 'info', onAction?: () => void, actionLabel: string = 'Ver', onClose?: () => void) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, isBanner: true, onAction, actionLabel, onClose }]);
  }, []);

  const handleClose = (result: boolean) => {
    dialog.resolve?.(result);
    setDialog(prev => ({ ...prev, visible: false }));
  };

  const cfg = typeConfig[dialog.type || 'alert'];

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showToast, showBanner }}>
      {children}

      {/* ── Modal Dialog ── */}
      {dialog.visible && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className={`${cfg.bg} px-6 pt-6 pb-4 flex items-start gap-4`}>
              <div className={`text-3xl ${cfg.iconClass} shrink-0 mt-0.5`}>
                <i className={`fa-solid ${cfg.icon}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                {dialog.title && (
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">{dialog.title}</h3>
                )}
                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{dialog.message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 flex justify-end gap-3 bg-white border-t border-slate-100">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => handleClose(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wide hover:bg-slate-50 transition-all active:scale-95"
                >
                  {dialog.cancelLabel || 'Cancelar'}
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                className={`px-6 py-2.5 rounded-xl text-white font-black text-xs uppercase tracking-wide shadow transition-all active:scale-95 ${cfg.btnClass}`}
              >
                {dialog.confirmLabel || (dialog.type === 'confirm' ? 'Confirmar' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[20000] flex flex-col gap-2 w-full max-w-2xl px-4 pointer-events-none" aria-live="polite">
        {toasts.map(toast => {
          const tc = toastConfig[toast.type] || toastConfig.info;
          return (
            <div
              key={toast.id}
              className={`${tc.cls} text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-4 text-xs font-black animate-in slide-in-from-top-4 duration-300 pointer-events-auto border border-white/20 backdrop-blur-md`}
            >
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <i className={`fa-solid ${tc.icon} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="leading-tight uppercase tracking-tight text-white text-[9px]">{toast.message}</p>
              </div>
              
              {toast.onAction && (
                <button
                  onClick={() => {
                    toast.onAction?.();
                    toast.onClose?.();
                    setToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="px-4 py-2 bg-white text-slate-900 rounded-lg text-[10px] uppercase font-black hover:bg-slate-100 transition-all active:scale-95 shadow-sm shrink-0"
                >
                  {toast.actionLabel}
                </button>
              )}

              <button 
                onClick={() => {
                  toast.onClose?.();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 group"
                title="Fechar"
              >
                <i className="fa-solid fa-xmark text-white/40 group-hover:text-white text-lg"></i>
              </button>
            </div>
          );
        })}
      </div>
    </DialogContext.Provider>
  );
};
