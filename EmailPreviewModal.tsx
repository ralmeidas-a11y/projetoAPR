import React, { useState } from 'react';
import { EmailNotificationData, EmailService } from '../services/emailService';

interface EmailPreviewModalProps {
  isOpen: boolean;
  emailData: EmailNotificationData;
  onClose: () => void;
  isLoading?: boolean;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  emailData,
  onClose,
  isLoading = false
}) => {
  const [sending, setSending] = useState(false);
  
  if (!isOpen) return null;

  const handleOpenOutlook = async () => {
    setSending(true);
    try {
      const result = await EmailService.openInOutlook(emailData);
      if (result.success) {
        console.log('%c✅ EMAIL ENVIADO', 'color: #16a34a; font-weight: bold; font-size: 14px');
        setTimeout(() => onClose(), 300);
      } else {
        alert('Erro ao abrir cliente de email: ' + result.message);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao processar email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004080] to-[#003060] text-white px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">📧 Preview de E-mail</h2>
            <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Verifique antes de enviar</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Email Metadata */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">De:</span>
              <span className="text-sm font-bold text-[#004080]">{emailData.senderEmail || 'sistema@naturgy.com'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Para:</span>
              <span className="text-sm font-bold text-[#004080]">{emailData.recipientEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Assunto:</span>
              <span className="text-sm font-bold text-slate-700">{emailData.subject}</span>
            </div>
            {emailData.attachments && emailData.attachments.length > 0 && (
              <div className="flex-col items-start pt-3 border-t border-slate-200">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Anexos:</span>
                <div className="flex flex-wrap gap-2">
                  {emailData.attachments.map((attachment, idx) => (
                    <span key={idx} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                      📎 {attachment}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email Content */}
          <div className="space-y-4">
            {emailData.htmlBody ? (
              <div
                className="bg-white p-6 rounded-xl border border-slate-200 overflow-x-auto text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: emailData.htmlBody }}
              />
            ) : (
              <pre className="bg-slate-50 p-6 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                {emailData.body}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-slate-300 text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleOpenOutlook}
            disabled={sending || isLoading}
            className="px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest bg-gradient-to-r from-[#0078D4] to-[#0063B1] text-white hover:from-[#0063B1] hover:to-[#005A9E] shadow-lg active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2"
          >
            {sending || isLoading ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Abrindo Outlook...
              </>
            ) : (
              <>
                <i className="fa-brands fa-microsoft"></i>
                Abrir no Outlook
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
