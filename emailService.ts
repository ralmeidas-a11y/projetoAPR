import { FormData, User, UserRole, StudyStatus } from '../types';

export interface EmailNotificationData {
  recipientEmail: string;
  recipientName?: string;
  senderEmail?: string;
  senderName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: string[];
  attachmentPaths?: string[];
}

const LOGO_PLACEHOLDER = 'cid:apr-logo';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const buildHtmlFromText = (body: string, includeLogo = true) => {
  const safeBody = escapeHtml(body).replace(/\r\n|\r|\n/g, '<br />');
  const logoBlock = includeLogo
    ? `<br /><br /><img src="${LOGO_PLACEHOLDER}" alt="Naturgy" style="height: 40px; max-width: 150px;" />`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    ${safeBody}${logoBlock}
  </body>
</html>`;
};

/**
 * Serviço para envio de notificações por email
 */
export const EmailService = {
  /**
   * Email enviado quando uma solicitação é criada (solicitante → admin)
   */
  generateNewRequestEmail: (request: FormData, attachmentNames: string[], attachmentPaths: string[] = []): EmailNotificationData => {
    const adminEmail = "adm@naturgy.com";
    const attachmentList = attachmentNames.length > 0 
      ? attachmentNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n         ')
      : 'Nenhum arquivo anexado';
    
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: adminEmail,
      recipientName: 'Administrador',
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `Prezada Equipe APR,

Uma nova solicitação de Análise de Planificação de Rede foi gerada no sistema:

═══════════════════════════════════════════════════════════
DADOS DA SOLICITAÇÃO
═══════════════════════════════════════════════════════════

Código:              ${request.studyNumber}
Título do Estudo:    ${request.studyTitle || request.clientName || 'Sem título'}
Data de Criação:     ${new Date(request.requestDate).toLocaleDateString('pt-BR')}

INFORMAÇÕES DO SOLICITANTE
───────────────────────────────────────────────────────────
Nome:                ${request.requesterName}
E-mail:              ${request.email}
Área:                ${request.requesterArea}
Telefone:            ${request.phone || 'Não informado'}

LOCALIZAÇÃO
───────────────────────────────────────────────────────────
Endereço:            ${request.address}
Cidade:              ${request.city}
Unidade Naturgy:     ${request.naturgyUnit}

TIPO DE SOLICITAÇÃO
───────────────────────────────────────────────────────────
Formulário:          ${request.formType}
Tipo de Estudo:      ${request.studyType}

ANEXOS FORNECIDOS
───────────────────────────────────────────────────────────
${attachmentList}

═══════════════════════════════════════════════════════════

Atenciosamente,
${request.requesterName}
${request.requesterArea}
Naturgy - Portal Técnico APR`,
      htmlBody: `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { background-color: #f5f5f5; padding: 20px; }
      .content { background-color: white; padding: 25px; border-radius: 8px; }
      .header { color: #004080; font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #FF8000; padding-bottom: 10px; }
      .section-title { color: #004080; font-weight: bold; margin-top: 15px; margin-bottom: 8px; }
      .field { margin: 8px 0; }
      .label { color: #666; font-weight: bold; width: 150px; display: inline-block; }
      .value { color: #333; }
      .attachments { background-color: #f9f9f9; padding: 12px; margin-top: 10px; border-left: 4px solid #FF8000; }
      .footer { color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <div class="header">🔔 Nova Solicitação de APR Registrada</div>
        
        <p>Prezado Administrador,</p>
        <p>Uma nova solicitação de <strong>Análise de Planificação de Rede</strong> foi gerada no sistema:</p>
        
        <div class="section-title">📋 DADOS DA SOLICITAÇÃO</div>
        <div class="field"><span class="label">Código:</span> <span class="value"><strong>${request.studyNumber}</strong></span></div>
        <div class="field"><span class="label">Título:</span> <span class="value">${request.studyTitle || request.clientName || 'Sem título'}</span></div>
        <div class="field"><span class="label">Data:</span> <span class="value">${new Date(request.requestDate).toLocaleDateString('pt-BR')}</span></div>
        
        <div class="section-title">👤 SOLICITANTE</div>
        <div class="field"><span class="label">Nome:</span> <span class="value">${request.requesterName}</span></div>
        <div class="field"><span class="label">E-mail:</span> <span class="value">${request.email}</span></div>
        <div class="field"><span class="label">Área:</span> <span class="value">${request.requesterArea}</span></div>
        <div class="field"><span class="label">Telefone:</span> <span class="value">${request.phone || 'Não informado'}</span></div>
        
        <div class="section-title">📍 LOCALIZAÇÃO</div>
        <div class="field"><span class="label">Endereço:</span> <span class="value">${request.address}</span></div>
        <div class="field"><span class="label">Cidade:</span> <span class="value">${request.city}</span></div>
        <div class="field"><span class="label">Unidade:</span> <span class="value">${request.naturgyUnit}</span></div>
        
        <div class="attachments">
          <strong>📎 Anexos Fornecidos:</strong>
          <ul style="margin: 8px 0; padding-left: 20px;">
            ${attachmentNames.length > 0 
              ? attachmentNames.map(name => `<li>${name}</li>`).join('')
              : '<li style="color: #999;">Nenhum arquivo anexado</li>'
            }
          </ul>
        </div>
        
        <p style="margin-top: 20px; color: #FF8000;"><strong>⏳ A solicitação aguarda validação no Portal Técnico APR.</strong></p>
        
        <div class="footer">
          <p><strong>Atenciosamente,</strong></p>
          <p>${request.requesterName}</p>
          <p>${request.requesterArea}</p>
          <p style="margin-top: 15px;"><img src="${LOGO_PLACEHOLDER}" alt="Naturgy" style="height: 40px; max-width: 150px;" /></p>
        </div>
      </div>
    </div>
  </body>
</html>
      `,
      attachments: attachmentNames,
      attachmentPaths
      ,
      senderEmail: request.email,
      senderName: request.requesterName
    };
  },

  /**
   * Email enviado quando uma solicitação é aprovada (admin → solicitante)
   */
  generateApprovalEmail: (request: FormData, responsibleName?: string): EmailNotificationData => {
    const signerName = responsibleName || 'Equipe de Gestão de Análise de Planificação de Rede';
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: request.requesterName,
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `Prezado(a) ${request.requesterName},

Temos o prazer de informar que sua solicitação de Análise de Planificação de Rede foi APROVADA!

═══════════════════════════════════════════════════════════
DETALHES DA SOLICITAÇÃO
═══════════════════════════════════════════════════════════

Código:              ${request.studyNumber}
Título:              ${request.studyTitle || request.clientName}
Local:               ${request.address}, ${request.city}
Data de Aprovação:   ${new Date().toLocaleDateString('pt-BR')}
Status:              ✅ APROVADA - AGUARDANDO EXECUÇÃO

═══════════════════════════════════════════════════════════

Sua solicitação foi validada com sucesso e será encaminhada para execução técnica.
Um analista especializado iniciará o processamento do seu estudo em breve.

Para consultar o status e acompanhar o progresso, acesse o Portal Técnico APR.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`,
      htmlBody: `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { background-color: #f5f5f5; padding: 20px; }
      .content { background-color: white; padding: 25px; border-radius: 8px; }
      .header { color: #107C10; font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #107C10; padding-bottom: 10px; }
      .status-badge { display: inline-block; background-color: #107C10; color: white; padding: 8px 15px; border-radius: 5px; font-weight: bold; margin-top: 10px; }
      .section-title { color: #004080; font-weight: bold; margin-top: 15px; margin-bottom: 8px; }
      .field { margin: 8px 0; }
      .label { color: #666; font-weight: bold; width: 150px; display: inline-block; }
      .value { color: #333; }
      .footer { color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <div class="header">✅ Sua Solicitação foi APROVADA!</div>
        
        <p>Prezado(a) ${request.requesterName},</p>
        <p>Temos o prazer de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #107C10; font-weight: bold;">APROVADA</span>!</p>
        
        <div class="section-title">📋 DETALHES</div>
        <div class="field"><span class="label">Código:</span> <span class="value"><strong>${request.studyNumber}</strong></span></div>
        <div class="field"><span class="label">Título:</span> <span class="value">${request.studyTitle || request.clientName}</span></div>
        <div class="field"><span class="label">Local:</span> <span class="value">${request.address}, ${request.city}</span></div>
        <div class="field"><span class="label">Data:</span> <span class="value">${new Date().toLocaleDateString('pt-BR')}</span></div>
        
        <div class="status-badge">✓ AGUARDANDO EXECUÇÃO</div>
        
        <p style="margin-top: 20px; line-height: 1.6;">
          Sua solicitação foi validada com sucesso e será encaminhada para <strong>execução técnica</strong>.
          Um analista especializado iniciará o processamento do seu estudo em breve.
        </p>
        
        <p><strong>Para acompanhar o progresso:</strong> acesse o Portal Técnico APR</p>
        
        <div class="footer">
          <p><strong>Atenciosamente,</strong></p>
          <p>${signerName}</p>
          <p style="margin-top: 15px;"><img src="${LOGO_PLACEHOLDER}" alt="Naturgy" style="height: 40px; max-width: 150px;" /></p>
        </div>
      </div>
    </div>
  </body>
</html>
      `,
    };
  },

  /**
   * Email enviado quando uma solicitação é rejeitada (admin → solicitante)
   */
  generateRejectionEmail: (request: FormData, rejectionReason: string, responsibleName?: string): EmailNotificationData => {
    const signerName = responsibleName || 'Equipe de Gestão de Análise de Planificação de Rede';
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: request.requesterName,
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `Prezado(a) ${request.requesterName},

Esta é uma SOLICITAÇÃO DE REVISÃO de Análise de Planificação de Rede.

Sua solicitação passou pela análise inicial. Porém, foi identificada a necessidade de ajustes antes de procedermos:

═══════════════════════════════════════════════════════════
INFORMAÇÕES DA SOLICITAÇÃO
═══════════════════════════════════════════════════════════

Código:              ${request.studyNumber}
Título:              ${request.studyTitle || request.clientName}
Local:               ${request.address}, ${request.city}
Data da Análise:     ${new Date().toLocaleDateString('pt-BR')}
Status:              ⚠️ REVISÃO NECESSÁRIA

═══════════════════════════════════════════════════════════

MOTIVO DA REVISÃO SOLICITADA
───────────────────────────────────────────────────────────
${rejectionReason}

═══════════════════════════════════════════════════════════

PRÓXIMOS PASSOS
───────────────────────────────────────────────────────────
1. Revise as informações e documentação conforme indicado acima
2. Acesse o Portal Técnico APR e solicite REVISÃO do estudo
3. Reenvie a solicitação com as informações ajustadas
4. A equipe técnica analisará novamente

Para dúvidas ou assistência, entre em contato conosco através do portal.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`,
      htmlBody: `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { background-color: #f5f5f5; padding: 20px; }
      .content { background-color: white; padding: 25px; border-radius: 8px; }
      .header { color: #D93026; font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #D93026; padding-bottom: 10px; }
      .status-badge { display: inline-block; background-color: #FFA500; color: white; padding: 8px 15px; border-radius: 5px; font-weight: bold; margin-top: 10px; }
      .reason-box { background-color: #fff3cd; border-left: 4px solid #FFA500; padding: 15px; margin: 15px 0; }
      .section-title { color: #004080; font-weight: bold; margin-top: 15px; margin-bottom: 8px; }
      .field { margin: 8px 0; }
      .label { color: #666; font-weight: bold; width: 150px; display: inline-block; }
      .value { color: #333; }
      .steps { margin: 15px 0; }
      .step { margin: 10px 0; line-height: 1.6; }
      .footer { color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <div class="header">⚠️ SOLICITAÇÃO DE REVISÃO</div>
        
        <p>Prezado(a) ${request.requesterName},</p>
        <p><strong>Esta é uma SOLICITAÇÃO DE REVISÃO.</strong></p>
        <p>Sua solicitação de <strong>Análise de Planificação de Rede</strong> passou pela análise inicial. Porém, foi identificada a necessidade de ajustes:</p>
        
        <div class="section-title">📋 DADOS</div>
        <div class="field"><span class="label">Código:</span> <span class="value"><strong>${request.studyNumber}</strong></span></div>
        <div class="field"><span class="label">Título:</span> <span class="value">${request.studyTitle || request.clientName}</span></div>
        <div class="field"><span class="label">Local:</span> <span class="value">${request.address}, ${request.city}</span></div>
        
        <div class="status-badge">⚠️ REVISÃO NECESSÁRIA</div>
        
        <div class="reason-box">
          <strong style="color: #D93026;">Motivo da Revisão Solicitada:</strong>
          <p style="margin: 10px 0; white-space: pre-wrap;"> ${rejectionReason}</p>
        </div>
        
        <div class="section-title">📝 PRÓXIMOS PASSOS:</div>
        <div class="steps">
          <div class="step">1️⃣ Revise as informações e documentação conforme indicado</div>
          <div class="step">2️⃣ Acesse o Portal Técnico APR</div>
          <div class="step">3️⃣ Solicite REVISÃO do estudo</div>
          <div class="step">4️⃣ Reenvie com os ajustes necessários</div>
          <div class="step">5️⃣ Nossa equipe analisará novamente</div>
        </div>
        
        <p style="color: #666; font-style: italic;">Para dúvidas, entre em contato através do Portal Técnico APR.</p>
        
        <div class="footer">
          <p><strong>Atenciosamente,</strong></p>
          <p>${signerName}</p>
          <p style="margin-top: 15px;"><img src="${LOGO_PLACEHOLDER}" alt="Naturgy" style="height: 40px; max-width: 150px;" /></p>
        </div>
      </div>
    </div>
  </body>
</html>
      `,
    };
  },

  /**
   * Email enviado quando uma solicitação é concluída (admin → solicitante)
   */
  generateCompletionEmail: (request: FormData, responsibleName?: string): EmailNotificationData => {
    const signerName = responsibleName || 'Equipe de Gestão de Análise de Planificação de Rede';
    const body = `Prezado(a) ${request.requesterName},

Temos o prazer de informar que sua solicitação de Análise de Planificação de Rede foi CONCLUÍDA!

═══════════════════════════════════════════════════════════
DETALHES DA SOLICITAÇÃO
═══════════════════════════════════════════════════════════

Código:              ${request.studyNumber}
Título:              ${request.studyTitle || request.clientName}
Local:               ${request.address}, ${request.city}
Data de Conclusão:   ${new Date().toLocaleDateString('pt-BR')}
Status:              ✅ CONCLUÍDO

═══════════════════════════════════════════════════════════

Sua solicitação foi processada com sucesso! Os resultados técnicos da Análise 
de Planificação de Rede estão disponíveis para consulta.

ACESSO AOS RESULTADOS
───────────────────────────────────────────────────────────
Os arquivos com os resultados e análises foram salvos na pasta de resposta
do seu estudo no SharePoint. Você pode acessá-los através do Portal Técnico APR.

═══════════════════════════════════════════════════════════

Para dúvidas sobre os resultados, entre em contato com nossa equipe técnica
através do Portal Técnico APR.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`;
    const htmlBody = `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { background-color: #f5f5f5; padding: 20px; }
      .content { background-color: white; padding: 25px; border-radius: 8px; }
      .header { color: #107C10; font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #107C10; padding-bottom: 10px; }
      .status-badge { display: inline-block; background-color: #107C10; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold; margin-top: 15px; font-size: 16px; }
      .section-title { color: #004080; font-weight: bold; margin-top: 15px; margin-bottom: 8px; }
      .field { margin: 8px 0; }
      .label { color: #666; font-weight: bold; width: 150px; display: inline-block; }
      .value { color: #333; }
      .steps { margin: 15px 0; }
      .step { margin: 10px 0; line-height: 1.6; background-color: #f0f7f4; padding: 10px; border-left: 4px solid #107C10; }
      .access-box { background-color: #e8f5e9; border-left: 4px solid #107C10; padding: 15px; margin: 15px 0; }
      .footer { color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <div class="header">✅ Seu Estudo foi CONCLUÍDO!</div>
        
        <p>Prezado(a) ${request.requesterName},</p>
        <p>Temos o prazer de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #107C10; font-weight: bold;">CONCLUÍDA</span>!</p>
        
        <div class="section-title">📋 DETALHES</div>
        <div class="field"><span class="label">Código:</span> <span class="value"><strong>${request.studyNumber}</strong></span></div>
        <div class="field"><span class="label">Título:</span> <span class="value">${request.studyTitle || request.clientName}</span></div>
        <div class="field"><span class="label">Local:</span> <span class="value">${request.address}, ${request.city}</span></div>
        <div class="field"><span class="label">Data:</span> <span class="value">${new Date().toLocaleDateString('pt-BR')}</span></div>
        
        <div class="status-badge">✓ CONCLUÍDO COM SUCESSO</div>
        
        <div class="access-box">
          <strong style="color: #107C10; font-size: 16px;">📂 Acesso aos Resultados</strong>
          <p style="margin: 10px 0; line-height: 1.6;">
            Os arquivos com os resultados técnicos da Análise de Planificação de Rede estão disponíveis
            na pasta de resposta do seu estudo no SharePoint. Você pode acessá-los através do Portal Técnico APR.
          </p>
        </div>
        
        <div class="section-title">📝 PRÓXIMOS PASSOS:</div>
        <div class="steps">
          <div class="step">1️⃣ Acesse o Portal Técnico APR</div>
          <div class="step">2️⃣ Navegue até "Meus Pedidos"</div>
          <div class="step">3️⃣ Abra seu estudo (${request.studyNumber})</div>
          <div class="step">4️⃣ Clique em "Abrir Pasta" para acessar os resultados</div>
          <div class="step">5️⃣ Verifique os arquivos de resposta gerados</div>
        </div>
        
        <p style="color: #666; font-style: italic; margin-top: 20px;">
          <strong>Precisa de ajuda?</strong> Entre em contato com nossa equipe técnica através do Portal Técnico APR.
        </p>
        
        <div class="footer">
          <p><strong>Atenciosamente,</strong></p>
          <p>${signerName}</p>
          <p style="margin-top: 15px;"><img src="${LOGO_PLACEHOLDER}" alt="Naturgy" style="height: 40px; max-width: 150px;" /></p>
        </div>
      </div>
    </div>
  </body>
</html>
    `;
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: request.requesterName,
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body,
      htmlBody,
    };
  },

  /**
   * Exibe uma tela de preview de email para o usuário enviar
   */
  showEmailPreview: (emailData: EmailNotificationData) => {
    const subject = `ASSUNTO: ${emailData.subject}`;
    const from = `DE: ${emailData.senderEmail || 'sistema@naturgy.com'}`;
    const to = `PARA: ${emailData.recipientEmail}`;
    
    const attachmentsList = emailData.attachments && emailData.attachments.length > 0
      ? `\nANEXOS: ${emailData.attachments.map((a, i) => `\n  ${i + 1}. ${a}`).join('')}`
      : '';
    
    const preview = `
═══════════════════════════════════════════════════════════
PREVIEW DE E-MAIL
═══════════════════════════════════════════════════════════
${from}
${to}
${subject}
${attachmentsList}

───────────────────────────────────────────────────────────
${emailData.body}
═══════════════════════════════════════════════════════════
    `;
    
    return preview;
  },

  /**
   * Abre o cliente de email padrão (Outlook/Gmail/etc) com o email pré-preenchido
   * Funciona via mailto: link no navegador/Electron
   */
  openInOutlook: async (emailData: EmailNotificationData): Promise<{ success: boolean; message: string }> => {
    try {
      // Tentar usar o Electron IPC para abrir Outlook desktop
      if ((window as any).api?.openOutlookEmail) {
        try {
          const result = await (window as any).api.openOutlookEmail({
            to: emailData.recipientEmail,
            subject: emailData.subject,
            body: emailData.body,
            htmlBody: emailData.htmlBody,
            attachments: emailData.attachmentPaths || [],
            from: emailData.senderEmail || undefined
          });
          
          if (result.success) {
            console.log('%c📧 OUTLOOK DESKTOP ABERTO', 'color: #0078D4; font-weight: bold; font-size: 14px');
            return { success: true, message: `Outlook aberto para ${emailData.recipientEmail}` };
          }
          return { success: false, message: result.message || 'Falha ao abrir o Outlook' };
        } catch (ipcError) {
          console.warn('API openOutlookEmail falhou, cancelando fallback para mailto');
          return { success: false, message: 'Falha ao abrir o Outlook via integração local' };
        }
      }

      // Fallback: usar mailto link
      const subject = encodeURIComponent(emailData.subject);
      const bodyText = emailData.body + 
        (emailData.attachments && emailData.attachments.length > 0 
          ? `\n\n${'='.repeat(60)}\nANEXOS: \n${emailData.attachments.map((a, i) => `${i + 1}. ${a}`).join('\n')}` 
          : '');
      const body = encodeURIComponent(bodyText);
      
      const mailtoLink = `mailto:${emailData.recipientEmail}?subject=${subject}&body=${body}`;
      
      // Abrir com elemento <a> para melhor compatibilidade
      if ((window as any).api?.openExternalLink) {
        await (window as any).api.openExternalLink(mailtoLink);
      } else if (typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = mailtoLink;
        a.click();
      }
      
      console.log('%c📧 CLIENTE DE EMAIL ACIONADO', 'color: #004080; font-weight: bold; font-size: 14px');
      console.log(`Para: ${emailData.recipientEmail}`);
      console.log(`Assunto: ${emailData.subject}`);
      if (emailData.attachments?.length) {
        console.log(`Anexos: ${emailData.attachments.join(', ')}`);
      }
      
      return { 
        success: true, 
        message: `Cliente de e-mail aberto para ${emailData.recipientEmail}` 
      };
    } catch (error) {
      console.error('Erro ao abrir email:', error);
      return { 
        success: false, 
        message: `Erro ao abrir e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      };
    }
  },

  /**
   * Envia o email via Outlook usando integração com API IPC do Electron
   * Para produção, substituir pela integração com serviço de email real (SendGrid, AWS SES, etc)
   */
  send: async (emailData: EmailNotificationData): Promise<{ success: boolean; message: string }> => {
    try {
      // Tenta usar API do Electron se disponível
      if ((window as any).api?.sendEmailViaPowerShell) {
        return await (window as any).api.sendEmailViaPowerShell(emailData);
      }
      
      // Fallback: abrir no cliente de email padrão
      return await EmailService.openInOutlook(emailData);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return { 
        success: false, 
        message: `Erro ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      };
    }
  },

  /**
   * Valida se um usuário tem acesso a um arquivo específico
   * Solicitantes só podem acessar arquivos em "Solicitação" e "Resposta"
   */
  canUserAccessFile: (filePath: string, userRole: UserRole, userEmail?: string, requestOwnerId?: string): boolean => {
    // Admin e Analista têm acesso total
    if (userRole === UserRole.ADM || userRole === UserRole.ANALISTA) {
      return true;
    }
    
    // Solicitante só pode acessar pastas "Solicitação" e "Resposta"
    if (userRole === UserRole.SOLICITANTE) {
      const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
      const allowedFolders = ['solicitação', 'resposta'];
      
      // Verificar se o caminho contém uma das pastas permitidas
      const hasAllowedFolder = allowedFolders.some(folder => 
        normalizedPath.includes(`/${folder}/`) || 
        normalizedPath.includes(`\\${folder}\\`) ||
        new RegExp(`[/\\\\]${folder}[/\\\\]`).test(normalizedPath)
      );
      
      return hasAllowedFolder;
    }
    
    return false;
  },

  /**
   * Filtra lista de arquivos baseado no acesso do usuário
   */
  filterAccessibleFiles: (files: Array<{ name: string; path: string }>, userRole: UserRole): Array<{ name: string; path: string }> => {
    if (userRole === UserRole.ADM || userRole === UserRole.ANALISTA) {
      return files;
    }
    
    if (userRole === UserRole.SOLICITANTE) {
      return files.filter(file => EmailService.canUserAccessFile(file.path || file.name, userRole));
    }
    
    return [];
  }
};
