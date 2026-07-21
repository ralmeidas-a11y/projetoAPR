import { FormData, User, UserRole, StudyStatus } from "../types/types";
import mjml2html from "mjml-browser";
import { formatDate, toTitleCase, normalizeString } from "../utils/utils";

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
  ccEmail?: string;
}

const SYSTEM_EMAIL = "prgc@naturgy.com";

const safeCompare = (a: string, b: string): boolean => {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  return normA === normB;
};

const safeName = (name: string | undefined | null): string => {
  if (!name) return '';
  return toTitleCase(name);
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildStepperMjml = (status?: StudyStatus) => {
  if (!status) return "";

  const steps = [
    {
      label: "Solicitado",
      statuses: [
        StudyStatus.PENDENTE,
        StudyStatus.REJEITADO,
        StudyStatus.EM_ANALISE,
      ],
    },
    { label: "Validado", statuses: [StudyStatus.AGUARDANDO_EXECUCAO] },
    {
      label: "Executando",
      statuses: [StudyStatus.EM_EXECUCAO, StudyStatus.CONTROLE_QUALIDADE],
    },
    { label: "Concluído", statuses: [StudyStatus.CONCLUIDO] },
  ];

  let currentStepIdx = -1;
  steps.forEach((step, idx) => {
    if (step.statuses.includes(status)) {
      currentStepIdx = idx;
    }
  });

  // Se concluído, marca todos como concluídos
  if (status === StudyStatus.CONCLUIDO) currentStepIdx = 3;

  return `
    <mj-section background-color="#ffffff" padding="0 32px 32px 32px">
      <mj-group width="100%">
        ${steps
      .map((step, idx) => {
        const isCompleted =
          idx < currentStepIdx || status === StudyStatus.CONCLUIDO;
        const isActive =
          idx === currentStepIdx && status !== StudyStatus.CONCLUIDO;
        const color = isCompleted
          ? "#10b981"
          : isActive
            ? "#f97316"
            : "#cbd5e1";
        const circleIcon = isCompleted ? "●" : isActive ? "○" : "○";

        return `
            <mj-column width="25%">
              <mj-text align="center" padding="0">
                <div style="font-size: 14px; color: ${color}; font-weight: 900; margin-bottom: 4px;">${circleIcon}</div>
                <div style="font-size: 8px; color: ${color}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${step.label}</div>
              </mj-text>
              <mj-divider border-width="3px" border-color="${color}" padding="10px 0" />
            </mj-column>
          `;
      })
      .join("")}
      </mj-group>
    </mj-section>
  `;
};

const buildRefinedHtmlTemplate = (
  title: string,
  introText: string,
  sections: { title: string; items: { label: string; value: string }[] }[],
  footerText: string[],
  attachments: string[] = [],
  status?: StudyStatus,
  ctaUrl: string = "https://naturgy-apr-portal.web.app",
) => {
  const sectionsMjml = sections
    .map(
      (sec) => `
    <mj-section background-color="#ffffff" padding="28px" border-radius="20px" border="1px solid #f1f5f9">
      <mj-column>
        <mj-text color="#004080" font-size="13px" font-weight="900" text-transform="uppercase" letter-spacing="0.1em" padding-bottom="12px">
          ${sec.title.startsWith("📋") || sec.title.startsWith("📊") || sec.title.startsWith("📝") || sec.title.startsWith("🔑") ? sec.title : "📊 " + sec.title}
        </mj-text>
        <mj-divider border-width="2px" border-color="#f8fafc" padding="0" />
        <mj-table font-size="14px" padding="top: 10px;">
          ${sec.items
          .map(
            (item) => `
            <tr>
              <td style="padding: 10px 0; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px;">${item.label}</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 700; text-align: right;">${item.value}</td>
            </tr>
          `,
          )
          .join("")}
        </mj-table>
      </mj-column>
    </mj-section>
    <mj-section padding="8px"></mj-section>
  `,
    )
    .join("");

  const attachmentsMjml =
    attachments.length > 0
      ? `
    <mj-section background-color="#fff7ed" border="1px dashed #fb923c" border-radius="20px" padding="24px">
      <mj-column>
        <mj-text color="#c2410c" font-size="11px" font-weight="900" text-transform="uppercase" letter-spacing="0.1em" align="center">
          📦 Documentos e Anexos Vinculados
        </mj-text>
        <mj-text align="center">
          ${attachments
        .map(
          (att) => `
            <span style="background-color: #ffffff; color: #9a3412; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 800; display: inline-block; margin: 4px; border: 1px solid #ffedd5;">
              📎 ${att}
            </span>
          `,
        )
        .join("")}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="8px"></mj-section>
  `
      : "";

  const stepperMjml = buildStepperMjml(status);

  // Processo para injetar gradiente no "concluído" se estiver no título ou texto
  const stylizedTitle = title.replace(
    /CONCLUÍDO/g,
    '<span style="color: #10b981;">CONCLUÍDO</span>',
  );
  const stylizedIntro = introText
    .replace(/\n/g, "<br/>")
    .replace(
      /CONCLUÍDA/g,
      '<span style="background-color: #ecfdf5; color: #059669; border: 1px solid #d1fae5; border-radius: 6px; padding: 2px 4px;">CONCLUÍDA</span>',
    );

  const mjmlTemplate = `
<mjml>
  <mj-head>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
    </mj-attributes>
    <mj-style>
      .premium-header {
        background: linear-gradient(135deg, #004080 0%, #002040 100%) !important;
      }
      .rounded-container {
        border-radius: 32px !important;
        overflow: hidden !important;
      }
      .cta-button a {
        background-color: #f97316 !important;
        color: #ffffff !important;
        border-radius: 16px !important;
        font-weight: 900 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f8fafc" width="600px">
    <mj-wrapper padding="40px 10px">
      <mj-section background-color="#ffffff" padding="0" border-radius="32px 32px 0 0" css-class="premium-header">
        <mj-column padding="40px 32px">
          <mj-text color="#ffffff" font-size="26px" font-weight="900" text-transform="uppercase" letter-spacing="-0.04em" line-height="1.1">
            ${stylizedTitle}
          </mj-text>
          <mj-text color="#bfdbfe" font-size="10px" font-weight="900" text-transform="uppercase" letter-spacing="0.2em" padding-top="12px">
            <span style="background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
              Portal Técnico APR • Oficial
            </span>
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section background-color="#ffffff" padding="32px 32px 0 32px">
        <mj-column background-color="#f1f5f9" border-radius="20px" padding="24px" border="1px solid #e2e8f0">
          <mj-text color="#334155" font-size="15px" line-height="1.6" font-weight="500" padding="0">
            ${stylizedIntro}
          </mj-text>
        </mj-column>
      </mj-section>
      
      <mj-section background-color="#ffffff" padding="0 32px">
        <mj-column>
          <mj-text padding="16px 0"></mj-text>
        </mj-column>
      </mj-section>

      <mj-wrapper background-color="#ffffff" padding="0 32px 32px 32px">
        ${stepperMjml}
        ${sectionsMjml}
        ${attachmentsMjml}

        <mj-section padding="24px 0">
          <mj-column>
            <mj-button href="${ctaUrl}" css-class="cta-button" font-size="14px" padding="20px 0" width="100%">
              Acessar Portal Técnico APR
            </mj-button>
          </mj-column>
        </mj-section>
        
        <mj-section padding-top="40px" border-top="2px solid #f1f5f9">
          <mj-column background-color="#f8fafc" border-radius="20px" padding="24px" border="1px solid #f1f5f9">
            <mj-text color="#64748b" font-size="11px" line-height="1.8" font-weight="600" text-transform="uppercase" letter-spacing="0.05em">
              ${footerText.join("<br/>")}
            </mj-text>
            <mj-divider border-width="1px" border-color="#e2e8f0" padding-top="16px" />
            <mj-text color="#94a3b8" font-size="9px" font-weight="800" text-transform="uppercase" letter-spacing="0.3em" align="center">
              © ${new Date().getFullYear()} NATURGY PORTAL TÉCNICO
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-wrapper>
      
      <mj-section background-color="#ffffff" padding="0" border-radius="0 0 32px 32px">
        <mj-column>
          <mj-text padding="1px"></mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>
  `;

  const result = mjml2html(mjmlTemplate);
  return result.html;
};

const safeFormatDate = (dateStr?: string | null) => {
  if (!dateStr) return "N/A";
  return formatDate(dateStr);
};

/**
 * Serviço para envio de notificações por email
 */
export const EmailService = {
  /**
   * Email enviado quando uma solicitação é criada (solicitante → admin)
   */
  generateNewRequestEmail: (
    request: FormData,
    attachmentNames: string[],
    attachmentPaths: string[] = [],
  ): EmailNotificationData => {
    const adminEmail = SYSTEM_EMAIL;
    const attachmentList =
      attachmentNames.length > 0
        ? attachmentNames
          .map((name, idx) => `${idx + 1}. ${name}`)
          .join("\n         ")
        : "Nenhum arquivo anexado";

    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: adminEmail,
      recipientName: "Administrador",
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `🔔 NOVA SOLICITAÇÃO REGISTRADA
───────────────────────────────────────────────────────────
Prezada Equipe APR,
Uma nova solicitação de Análise de Planificação de Rede foi gerada no sistema.

📋 DADOS DA SOLICITAÇÃO
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || "PROV-APR"}
Título: ${request.studyTitle || request.clientName || "Sem título"}
Data:   ${safeFormatDate(request.requestDate)}

👤 INFORMAÇÕES DO SOLICITANTE
───────────────────────────────────────────────────────────
Nome:     ${safeName(request.requesterName) || "Não informado"}
E-mail:   ${request.email}
Área:     ${request.requesterArea || "Não informada"}
Unidade:  ${request.naturgyUnit || "Não informada"}
Telefone: ${request.phone || "Não informado"}

📍 LOCALIZAÇÃO
───────────────────────────────────────────────────────────
Endereço: ${toTitleCase(request.address) || "Não informado"}
Cidade:   ${toTitleCase(request.city) || "Não informada"}
Unidade:  ${request.empresa || "Não informada"}

📝 TIPO DE SOLICITAÇÃO
───────────────────────────────────────────────────────────
Formulário:     ${request.formType || "Não informado"}
Tipo de Estudo: ${request.studyType || "Novo Estudo"}

───────────────────────────────────────────────────────────
📦 ANEXOS:
${attachmentList}

Atenciosamente,
${safeName(request.requesterName) || "Solicitante"}
${request.requesterArea || ""}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        "🔔 Nova Solicitação de APR Registrada",
        "Prezada Equipe APR,\nUma nova solicitação de Análise de Planificação de Rede foi gerada no sistema.",
        [
          {
            title: "Dados da Solicitação",
            items: [
              { label: "Código", value: request.studyNumber || "PROV-APR" },
              {
                label: "Título do Estudo",
                value: request.studyTitle || request.clientName || "Sem título",
              },
              {
                label: "Data de Criação",
                value: formatDate(request.requestDate),
              },
            ],
          },
          {
            title: "Informações do Solicitante",
            items: [
              {
                label: "Nome",
                value: safeName(request.requesterName) || "Não informado",
              },
              { label: "E-mail", value: request.email },
              {
                label: "Área",
                value: request.requesterArea || "Não informada",
              },
              {
                label: "Unidade",
                value: request.naturgyUnit || "Não informada",
              },
              { label: "Telefone", value: request.phone || "Não informado" },
            ],
          },
          {
            title: "Localização",
            items: [
              { label: "Endereço", value: request.address || "Não informado" },
              { label: "Cidade", value: request.city || "Não informada" },
              {
                label: "Unidade",
                value: request.empresa || "Não informada",
              },
            ],
          },
          {
            title: "Tipo de Solicitação",
            items: [
              {
                label: "Formulário",
                value: request.formType || "Não informado",
              },
              {
                label: "Tipo de Estudo",
                value: request.studyType || "Novo Estudo",
              },
            ],
          },
        ],
        [
          "Atenciosamente,",
          "<strong>" + (safeName(request.requesterName) || "Solicitante") + "</strong>",
          request.requesterArea || "",
          "<strong>Naturgy - Portal Técnico APR</strong>",
        ],
        attachmentNames,
        request.status,
      ),
      attachments: attachmentNames,
      attachmentPaths: attachmentPaths,
      senderEmail: request.email,
      senderName: safeName(request.requesterName),
    };
  },

/**
   * Email enviado quando uma solicitação é aprovada (admin → solicitante)
   */
  generateApprovalEmail: (
    request: FormData,
    responsibleName?: string,
    senderEmail?: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const signerName =
      responsibleName || "Equipe GECAT - Naturgy";
    const signerRole = roleDescription || "Equipe GECAT - Naturgy";
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: senderEmail,
      senderName: signerName,
      ccEmail: SYSTEM_EMAIL,
      subject: `✅ Solicitação Aprovada - Estudo Nº ${studyRef || request.id}`,
      body: `✅ SOLICITAÇÃO APROVADA - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Temos a satisfação de informar que sua solicitação de Análise de 
Planificação de Rede foi APROVADA e validada tecnicamente.

Seu estudo será encaminhamento para execução técnica. Um analista 
especializado dará continuidade ao processamento.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local: ${request.address || ""}, ${request.city || ""}
Data de Criação: ${safeFormatDate(request.requestDate)}
Status: AGUARDANDO EXECUÇÃO

📌 INFORMAÇÕES
Para acompanhar o andamento do seu estudo, utilize o Portal Técnico APR.

Atenciosamente,
${signerName}
${signerRole}`,
      htmlBody: buildRefinedHtmlTemplate(
        "✅ Solicitação Aprovada",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Temos a satisfação de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #10b981; font-weight: bold;">APROVADA</span> e validada tecnicamente.<br/><br/>Seu estudo será encaminhamento para execução técnica. Um analista especializado dará continuidade ao processamento.<br/><br/><strong>Para acompanhar o andamento do seu estudo:</strong> utilize o Portal Técnico APR.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value: request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              {
                label: "Data de Criação",
                value: safeFormatDate(request.requestDate),
              },
              {
                label: "Status",
                value: "AGUARDANDO EXECUÇÃO",
              },
            ],
          },
        ],
        [
          "📌 Para acompanhar o andamento do seu estudo, utilize o Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>" + signerRole + "</strong>",
],
        [],
        StudyStatus.AGUARDANDO_EXECUCAO,
      ),
    };
  },

  /**
   * Email enviado quando uma solicitação é rejeitada (admin → solicitante)
   */
  generateRejectionEmail: (
    request: FormData,
    rejectionReason: string,
    responsibleName?: string,
    senderEmail?: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const signerName =
      responsibleName || "Equipe GECAT - Naturgy";
    const signerRole = roleDescription || "Equipe GECAT - Naturgy";
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: senderEmail,
      senderName: signerName,
      ccEmail: SYSTEM_EMAIL,
      subject: `📢 Solicitação Requer Revisão - Estudo Nº ${studyRef || request.id}`,
      body: `📢 SOLICITAÇÃO REQUER REVISÃO - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Sua solicitação de Análise de Planificação de Rede foi analisada e 
requer ajustes antes da aprovação técnica.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local: ${request.address || ""}, ${request.city || ""}
Status: REVISÃO NECESSÁRIA

📝 MOTIVO DA REVISÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rejectionReason}

▶️ INSTRUÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Acesse o Portal Técnico APR
2. Revise as informações conforme orientação
3. Solicite revisão do estudo
4. Reenvie com os ajustes necessários

Para dúvidas ou assistência, entre em contato através do Portal.

Atenciosamente,
${signerName}
${signerRole}`,
      htmlBody: buildRefinedHtmlTemplate(
        "📢 Solicitação Requer Revisão",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Sua solicitação de <strong>Análise de Planificação de Rede</strong> foi analisada e <span style="color: #f97316; font-weight: bold;">requer ajustes</span> antes da aprovação técnica.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value: request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              {
                label: "Motivo da Revisão",
                value: rejectionReason,
              },
            ],
          },
          {
            title: "▶️ Instruções",
            items: [
              {
                label: "1",
                value: "Acesse o Portal Técnico APR",
              },
              {
                label: "2",
                value: "Revise as informações conforme orientação",
              },
              {
                label: "3",
                value: "Solicite revisão do estudo",
              },
              {
                label: "4",
                value: "Reenvie com os ajustes necessários",
              },
            ],
          },
        ],
        [
          "Para dúvidas ou assistência, entre em contato através do Portal.",
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>" + signerRole + "</strong>",
        ],
        [],
        StudyStatus.REJEITADO,
      ),
    };
  },

  /**
   * Email enviado quando a solicitação entra em EXECUÇÃO (analista → solicitante)
   */
  generateExecutionEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `⚙️ Estudo em Execução - Estudo Nº ${studyRef || request.id}`,
      body: `⚙️ ESTUDO EM EXECUÇÃO - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Informamos que seu estudo encontra-se em fase de execução técnica.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local: ${request.address || ""}, ${request.city || ""}
Responsável Técnico: ${analystName}

📌 ORIENTAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nossa equipe técnica está trabalhando no desenvolvimento do estudo.
Você receberá uma notificação quando o processo for concluído.

Em caso de dúvidas, utilize o Portal Técnico APR.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        "⚙️ Estudo em Execução",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Informamos que seu estudo encontra-se em <strong>fase de execução técnica</strong>.<br/><br/>Nossa equipe técnica está trabalhando no desenvolvimento do estudo.<br/>Você receberá uma notificação quando o processo for concluído.`,
        [
          { title: '📋 Dados do Estudo', items: [
            { label: 'Código', value: request.studyNumber || `${request.id}` },
            { label: 'Título', value: request.studyTitle || 'N/I' },
            { label: 'Localização', value: `${request.address || 'N/I'} - ${request.city || 'N/I'}` },
            { label: 'Responsável', value: analystName },
            { label: 'Data', value: new Date().toLocaleDateString('pt-BR') },
          ]},
        ],
        [
          "📌 Em caso de dúvidas, utilize o Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + analystName + "</strong>",
          "<strong>" + (roleDescription || 'Equipe GECAT - Naturgy') + "</strong>",
        ],
        [],
        StudyStatus.EM_EXECUCAO,
      ),
    };
  },

  /**
   * Email enviado quando estudo passa de EM_EXECUCAO para CONTROLE_QUALIDADE (analista → solicitante)
   */
  generateExecutionToQCEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `🔍 Estudo em Controle de Qualidade - Estudo Nº ${studyRef || request.id}`,
      body: `🔍 ESTUDO EM CONTROLE DE QUALIDADE - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Informamos que seu estudo foi concluído pela equipe técnica e agora está 
sendo encaminhado para o Controle de Qualidade (CQ).

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local: ${request.address || ""}, ${request.city || ""}
Responsável Técnico: ${analystName}

📌 PRÓXIMOS PASSOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O estudo será analisado pelo Controle de Qualidade. 
Após a aprovação, você receberá uma notificação com os resultados.

Em caso de dúvidas, utilize o Portal Técnico APR.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        "🔍 Estudo em Controle de Qualidade",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Informamos que seu estudo foi concluído pela equipe técnica e agora está sendo encaminhado para o <strong>Controle de Qualidade (CQ)</strong>.`,
        [
          { title: '📋 Dados do Estudo', items: [
            { label: 'Código', value: request.studyNumber || `${request.id}` },
            { label: 'Título', value: request.studyTitle || 'N/I' },
            { label: 'Localização', value: `${request.address || 'N/I'} - ${request.city || 'N/I'}` },
            { label: 'Responsável', value: analystName },
            { label: 'Data', value: new Date().toLocaleDateString('pt-BR') },
          ]},
        ],
        [
          "📌 O estudo será analisado pelo Controle de Qualidade.",
          "Após a aprovação, você receberá uma notificação com os resultados.",
          "Atenciosamente,",
          `<strong>${analystName}</strong>`,
          `<strong>${roleDescription || 'Equipe GECAT - Naturgy'}</strong>`,
        ],
        [],
        StudyStatus.CONTROLE_QUALIDADE,
      ),
    };
  },

  /**
   * Email enviado quando a solicitação está AGUARDANDO INFORMAÇÕES (analista → solicitante)
   */
  generateAwaitingInfoEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    holdReason?: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `📩 Solicitação de Informações - Estudo Nº ${studyRef || request.id}`,
      body: `📩 SOLICITAÇÃO DE INFORMAÇÕES - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Para dar continuidade ao processamento do seu estudo, solicitamos 
informações adicionais conforme descrito abaixo.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}

📝 INFORMAÇÕES SOLICITADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${holdReason || request.holdReason || "Informações adicionais necessárias para prosseguimento do estudo."}

▶️ INSTRUÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Acesse o Portal Técnico APR
2. Localize seu estudo em "Aguardando Informações"
3. Forneça as informações solicitadas
4. Clique em "Responder" para enviar

⚠️ IMPORTANTE: O processo permanece paralisado até o recebimento 
das informações solicitadas.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        "📩 Solicitação de Informações",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Para dar continuidade ao processamento do seu estudo, solicitamos <strong>informações adicionais</strong> conforme descrito abaixo.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              { label: "Código", value: request.studyNumber || "Não informado" },
              { label: "Título", value: request.studyTitle || request.clientName || "Não informado" },
            ],
          },
          {
            title: "📝 Informações Solicitadas",
            items: [
              { label: "Motivo", value: holdReason || request.holdReason || "Informações adicionais necessárias" },
            ],
          },
          {
            title: "▶️ Instruções",
            items: [
              { label: "1", value: "Acesse o Portal Técnico APR" },
              { label: "2", value: "Localize seu estudo em 'Aguardando Informações'" },
              { label: "3", value: "Forneça as informações solicitadas" },
              { label: "4", value: "Clique em 'Responder' para enviar" },
            ],
          },
        ],
        [
          "⚠️ IMPORTANTE: O processo permanece paralisado até o recebimento das informações solicitadas.",
          "Em caso de dúvidas, utilize o Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + analystName + "</strong>",
          "<strong>" + (roleDescription || 'Equipe GECAT - Naturgy') + "</strong>",
        ],
        [],
        StudyStatus.AGUARDANDO_INFORMACAO,
      ),
    };
  },

  /**
   * Email enviado quando informações são recebidas — analista informa ao solicitante (analista → solicitante)
   */
  generateInfoReceivedEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    holdResponse?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `📨 Informações Recebidas - Estudo Nº ${studyRef || request.id}`,
      body: `📨 INFORMAÇÕES RECEBIDAS - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

As informações solicitadas para o estudo abaixo foram recebidas com sucesso.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Solicitante: ${safeName(request.requesterName)}

📝 INFORMAÇÕES ENVIADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${holdResponse || request.holdResponse || "As informações foram recebidas."}

▶️ PRÓXIMO PASSO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A equipe técnica retomará a execução do estudo.

Atenciosamente,
${analystName}
Equipe GECAT - Naturgy`,
      htmlBody: buildRefinedHtmlTemplate(
        "📨 Informações Recebidas",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>As informações solicitadas para o estudo abaixo foram <strong>recebidas com sucesso</strong>.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              { label: "Código", value: request.studyNumber || "Não informado" },
              { label: "Título", value: request.studyTitle || request.clientName || "Não informado" },
              { label: "Solicitante", value: safeName(request.requesterName) },
            ],
          },
          {
            title: "📝 Informações Enviadas",
            items: [
              { label: "Resposta", value: holdResponse || request.holdResponse || "As informações foram recebidas." },
            ],
          },
        ],
        [
          "▶️ A equipe técnica retomará a execução do estudo.",
          "Atenciosamente,",
          `<strong>${analystName}</strong>`,
          "<strong>Equipe GECAT - Naturgy</strong>",
        ],
        [],
        StudyStatus.EM_EXECUCAO,
      ),
    };
  },

/**
   * Email enviado quando uma solicitação é concluída (admin → solicitante)
   */
  generateCompletionEmail: (
    request: FormData,
    responsibleName?: string,
    senderEmail?: string,
    roleDescription?: string,
    respostaFileNames?: string[],
    additionalCCs?: string,
  ): EmailNotificationData => {
    const signerName =
      responsibleName || roleDescription || "Equipe GECAT - Naturgy";
    const studyRef = request.studyNumber?.trim();
    const completionDate = request.completedAt 
      ? safeFormatDate(request.completedAt)
      : new Date().toLocaleDateString('pt-BR');
    
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: senderEmail,
      senderName: signerName,
      ccEmail: additionalCCs ? `${SYSTEM_EMAIL}; ${additionalCCs}` : SYSTEM_EMAIL,
      subject: `🎉 Estudo Concluído - Estudo Nº ${studyRef || request.id}`,
      body: `🎉 ESTUDO CONCLUÍDO - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Temos a satisfação de informar que sua solicitação de Análise de 
Planificação de Rede foi CONCLUÍDA com sucesso!

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local: ${request.address || ""}, ${request.city || ""}
Data de Conclusão: ${completionDate}

📂 ACESSO AOS RESULTADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Os arquivos com os resultados técnicos estão disponíveis na pasta 
de resposta do seu estudo no Portal Técnico APR.
${respostaFileNames && respostaFileNames.length > 0 ? `\n📄 Arquivos de Resposta:\n${respostaFileNames.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}

▶️ INSTRUÇÕES PARA ACESSO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Acesse o Portal Técnico APR
2. Navegue até "Meus Pedidos"
3. Selecione seu estudo (${request.studyNumber})
4. Clique em "Abrir Pasta" para acessar os resultados
5. Verifique os arquivos de resposta gerados

Em caso de dúvidas ou necessidade de suporte, entre em contato 
através do Portal Técnico APR.

Atenciosamente,
${signerName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        "🎉 Estudo Concluído",
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Temos a satisfação de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #10b981; font-weight: bold;">CONCLUÍDA</span> com sucesso!<br/><br/><strong>📂 Acesso aos Resultados</strong><br/>Os arquivos com os resultados técnicos estão disponíveis na pasta de resposta do seu estudo no Portal Técnico APR.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value: request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              {
                label: "Data de Conclusão",
                value: completionDate,
              },
            ],
          },
          {
            title: "▶️ Instruções para Acesso",
            items: [
              {
                label: "1",
                value: "Acesse o Portal Técnico APR",
              },
              {
                label: "2",
                value: "Navegue até 'Meus Pedidos'",
              },
              {
                label: "3",
                value: `Selecione seu estudo (${request.studyNumber})`,
              },
              {
                label: "4",
                value: "Clique em 'Abrir Pasta' para acessar os resultados",
              },
              {
                label: "5",
                value: "Verifique os arquivos de resposta gerados",
              },
            ],
          },
          ...(respostaFileNames && respostaFileNames.length > 0 ? [{
            title: "📄 Arquivos de Resposta",
            items: respostaFileNames.map((f, i) => ({
              label: `${i + 1}`,
              value: f,
            })),
          }] : []),
        ],
        [
          "Em caso de dúvidas ou necessidade de suporte, entre em contato através do Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>" + (roleDescription || 'Equipe GECAT - Naturgy') + "</strong>",
        ],
        [],
        StudyStatus.CONCLUIDO,
      ),
    };
  },

/**
   * Email enviado quando o analista conclude a execução e envia para Controle de Qualidade
   * (analista → responsável CQ)
   */
  generateQCRequestEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    recipientEmail?: string,
    roleDescription?: string,
    recipientName?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    const completionDate = request.completedAt 
      ? safeFormatDate(request.completedAt)
      : new Date().toLocaleDateString('pt-BR');
    // FIX Bug 5: Usar o nome real do supervisor se fornecido
    const greeting = recipientName ? `Prezado(a) ${recipientName}` : 'Prezado(a) Equipe GECAT - Naturgy';
    return {
      recipientEmail: recipientEmail || SYSTEM_EMAIL,
      recipientName: recipientName || 'Equipe GECAT - Naturgy',
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `🔍 Solicitação de Controle de Qualidade - Estudo Nº ${studyRef || request.id}`,
      body: `🔍 SOLICITAÇÃO DE CONTROLE DE QUALIDADE - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${greeting},

O estudo abaixo foi concluído e está sendo encaminhamento para 
revisão e validação técnica.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Local: ${request.address || ''}, ${request.city || ''}
Analista Responsável: ${analystName}
Data de Conclusão: ${completionDate}

📝 SOLICITAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solicito análise e validação conforme os critérios de Controle de 
Qualidade estabelecidos.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        '🔍 Solicitação de Controle de Qualidade',
        `${greeting},<br/><br/>O estudo abaixo foi concluído e está sendo encaminhamento para <strong>revisão e validação técnica</strong>.`,
        [
          {
            title: '📋 Dados do Estudo',
            items: [
              { label: 'Código', value: request.studyNumber || 'N/A' },
              { label: 'Título', value: request.studyTitle || request.clientName || 'N/A' },
              { label: 'Local', value: `${request.address || ''}, ${request.city || ''}` },
              { label: 'Analista Responsável', value: analystName },
              { label: 'Data de Conclusão', value: completionDate },
            ]
          },
          {
            title: '📝 Solicitação',
            items: [
              { label: 'Ação', value: 'Realizar análise e validação conforme critérios de CQ' },
              { label: 'Status', value: 'CONTROLE DE QUALIDADE' },
            ]
          }
        ],
        [
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>' + (roleDescription || 'Equipe GECAT - Naturgy') + '</strong>'
        ],
        [],
        StudyStatus.CONTROLE_QUALIDADE
      )
    };
  },

/**
   * Email enviado pelo analista ao solicitante quando o estudo é enviado ANTES do CQ
   * (analista → solicitante) — resposta antecipada por prazo
   */
  generatePreQCResponseEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      ccEmail: SYSTEM_EMAIL,
      subject: `📋 Resposta Antecipada do Estudo Nº ${studyRef || request.id}`,
      body: `📋 RESPOSTA ANTECIPADA DO ESTUDO - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${safeName(request.requesterName)},

Informamos que o estudo ${request.studyNumber} está sendo encaminhdo em caráter antecipado, antes da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.

O estudo pasará pelo Controle de Qualidade normalmente. Caso sejam identificadas correções necessárias, uma versão revisada será emitida e encaminhda.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Local: ${request.address || ''}, ${request.city || ''}
Data: ${safeFormatDate(request.requestDate)}

📂 ACESSO AOS RESULTADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Os arquivos com os resultados técnicos estão disponíveis na pasta de resposta do seu estudo.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        '📋 Resposta Antecipada do Estudo',
        `Prezado(a) ${safeName(request.requesterName)},<br/><br/>Informamos que o estudo <strong>${request.studyNumber}</strong> está sendo encaminhdo em caráter <strong>antecipado</strong>, antes da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.<br/><br/>O estudo pasará pelo Controle de Qualidade normalmente. Caso sejam identificadas correções necessárias, <strong>uma versão revisada será emitida e encaminhda</strong>.`,
        [
          {
            title: '📋 Dados do Estudo',
            items: [
              { label: 'Código', value: request.studyNumber || 'N/A' },
              { label: 'Título', value: request.studyTitle || request.clientName || 'N/A' },
              { label: 'Local', value: `${request.address || ''}, ${request.city || ''}` },
              { label: 'Analista Responsável', value: analystName },
              { label: 'Data de Envio', value: new Date().toLocaleDateString('pt-BR') },
            ]
          },
          {
            title: '⚠️ Observação Importante',
            items: [
              { label: 'Situação', value: 'Enviado antes do Controle de Qualidade' },
              { label: 'Motivo', value: 'Prazo de entrega' },
              { label: 'Ação Pendente', value: 'O estudo ainda pasará pelo CQ. Se necessário, nova versão será emitida.' },
            ]
          }
        ],
        [
          '📂 Os arquivos com os resultados técnicos estão disponíveis na pasta de resposta do seu estudo.',
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>' + (roleDescription || 'Equipe GECAT - Naturgy') + '</strong>'
        ],
        [],
        StudyStatus.ENVIADO_SEM_CQ
      )
    };
  },

/**
   * Email enviado pelo analista ao sistema (prgc) informando envio antes do CQ
   * (analista → prgc)
   */
  generatePreQCSysEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    delegatedQcEmail?: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: delegatedQcEmail || SYSTEM_EMAIL,
      recipientName: 'Controle de Qualidade APR',
      senderEmail: analystEmail,
      senderName: analystName,
      subject: `⚠️ Envio Antecipado Antes do CQ - Estudo Nº ${studyRef || request.id}`,
      body: `⚠️ ENVIO ANTECIPADO ANTES DO CONTROLE DE QUALIDADE - Estudo Nº ${studyRef || request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezada Equipe de Controle de Qualidade,

Informo que o estudo ${request.studyNumber} foi enviado ao solicitante ANTES da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.

O estudo está sendo inúmerado para análise no CQ normalmente. Caso sejam identificadas correções necessárias, será emitida nova versão ao solicitante com as devidas ressalvas corrigidas.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Local: ${request.address || ''}, ${request.city || ''}
Analista Responsável: ${analystName}
Data: ${safeFormatDate(request.requestDate)}
Motivo: Prazo de entrega

📝 SOLICITAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solicito a análise e validação conforme os critérios do Controle de Qualidade.

Atenciosamente,
${analystName}
${roleDescription || 'Equipe GECAT - Naturgy'}`,
      htmlBody: buildRefinedHtmlTemplate(
        '⚠️ Envio Antecipado Antes do CQ',
        'Envio antecipado do estudo antes do Controle de Qualidade.',
        [
          {
            title: '📋 Dados do Estudo',
            items: [
              { label: 'Código', value: request.studyNumber || 'N/A' },
              { label: 'Título', value: request.studyTitle || request.clientName || 'N/A' },
              { label: 'Local', value: `${request.address || ''}, ${request.city || ''}` },
              { label: 'Analista Responsável', value: analystName },
              { label: 'Data', value: safeFormatDate(request.requestDate) },
              { label: 'Motivo', value: 'Prazo de entrega' },
            ]
          },
          {
            title: '📝 Solicitação',
            items: [
              { label: 'Status', value: 'ENVIADO SEM CQ → CONTROLE DE QUALIDADE' },
              { label: 'Ação', value: 'Realizar análise e validação conforme critérios CQ' },
            ]
          }
        ],
        [
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>' + (roleDescription || 'Equipe GECAT - Naturgy') + '</strong>'
        ],
        [],
        StudyStatus.CONTROLE_QUALIDADE
      )
    };
  },

  /**
   * Email enviado pelo ADM/QC para o Analista quando o estudo é APROVADO no CQ
   * FIX Bug 8: Adicionado parâmetro withReservations para diferenciar aprovação com ressalvas
   */
  generateQCApprovalAnalystEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    qcName: string,
    observations?: string,
    qcEmail?: string,
    roleDescription?: string,
    withReservations?: boolean,
  ): EmailNotificationData => {
    const signerRole = roleDescription || 'Equipe GECAT - Naturgy';
    const statusLabel = withReservations ? 'APROVADO COM RESSALVAS' : 'APROVADO';
    const emoji = withReservations ? '⚠️✅' : '✅';
    return {
      recipientEmail: analystEmail,
      recipientName: analystName,
      senderEmail: qcEmail,
      senderName: qcName,
      ccEmail: SYSTEM_EMAIL,
      subject: `${emoji} Estudo ${statusLabel} no CQ - Estudo Nº ${request.studyNumber}`,
      body: `${emoji} ESTUDO ${statusLabel} NO CONTROLE DE QUALIDADE - Estudo Nº ${request.studyNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${analystName},

É com satisfação que informamos que o estudo abaixo foi ${statusLabel} 
no Controle de Qualidade.
${withReservations ? '\n⚠️ ATENÇÃO: A aprovação foi concedida COM RESSALVAS. Verifique as observações abaixo e, se aplicável, realize as correções indicadas antes de finalizar o processo.' : ''}

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Aprovado por: ${qcName}

📝 ${withReservations ? 'RESSALVAS E OBSERVAÇÕES' : 'OBSERVAÇÕES'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${observations || "Nenhuma observação adicional."}

▶️ PRÓXIMA AÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${withReservations 
  ? '1. Verifique as ressalvas indicadas acima\n2. Realize as correções necessárias (se aplicável)\n3. Envie o e-mail de conclusão ao solicitante'
  : 'Por favor, finalize o processo enviando o e-mail de conclusão para o solicitante através do Portal Técnico APR.'}

⚠️ O estudo retornou para sua fila com status "${statusLabel} pelo CQ".

Atenciosamente,
${qcName}
${signerRole}`,
      htmlBody: buildRefinedHtmlTemplate(
        `${emoji} Estudo ${statusLabel} no Controle de Qualidade`,
        `Prezado(a) ${analystName},<br/><br/>É com satisfação informar que o estudo abaixo foi <span style="color: ${withReservations ? '#f59e0b' : '#10b981'}; font-weight: bold;">${statusLabel}</span> no Controle de Qualidade.${withReservations ? '<br/><br/><span style="color: #f59e0b; font-weight: bold;">⚠️ APROVAÇÃO COM RESSALVAS - Verifique as observações abaixo.</span>' : ''}<br/><br/>O estudo retornou para sua fila com status <strong>"${statusLabel} pelo CQ"</strong>.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              { label: "Código", value: request.studyNumber || "N/A" },
              { label: "Título", value: request.studyTitle || request.clientName || "N/A" },
              { label: "Aprovado por", value: qcName },
            ]
          },
          {
            title: withReservations ? "⚠️ Ressalvas e Observações" : "📝 Observações",
            items: [
              { label: withReservations ? "Ressalvas" : "Observações", value: observations || "Nenhuma observação adicional." },
            ]
          },
          {
            title: "▶️ Próxima Ação",
            items: [
              { label: "Ação", value: withReservations ? "Verificar ressalvas e realizar correções antes de finalizar" : "Enviar e-mail final ao solicitante e concluir estudo via Portal" },
              { label: "Status", value: `${statusLabel} PELO CQ` },
            ]
          }
        ],
        [
          withReservations ? "⚠️ Verifique as ressalvas antes de finalizar." : "⚠️ Por favor, finalize o processo o quanto antes.",
          "Atenciosamente,",
          "<strong>" + qcName + "</strong>",
          "<strong>" + signerRole + "</strong>"
        ],
        [],
        StudyStatus.APROVADO_CQ
      ),
    };
  },

  /**
   * Email enviado pelo ADM/QC para o Analista quando o estudo é REPROVADO no CQ
   */
  generateQCRejectionAnalystEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    qcName: string,
    reason: string,
    qcEmail?: string,
    roleDescription?: string,
  ): EmailNotificationData => {
    const signerRole = roleDescription || 'Equipe GECAT - Naturgy';
    return {
      recipientEmail: analystEmail,
      recipientName: analystName,
      senderEmail: qcEmail,
      senderName: qcName,
      ccEmail: SYSTEM_EMAIL,
      subject: `❌ Estudo Não Aprovado no CQ - Estudo Nº ${request.studyNumber}`,
      body: `❌ ESTUDO NÃO APROVADO NO CONTROLE DE QUALIDADE - Estudo Nº ${request.studyNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezado(a) ${analystName},

O estudo abaixo foi analisado pelo Controle de Qualidade e 
requer ajustes antes da aprovação final.

📋 DADOS DO ESTUDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Analisado por: ${qcName}

📝 MOTIVO DA NÃO APROVAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${reason}

▶️ AÇÃO NECESSÁRIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Realize as correções indicadas
2. Reenvie o estudo para nova análise do CQ

⚠️ O estudo retornou para sua fila com status "Reprovado pelo CQ".

Atenciosamente,
${qcName}
${signerRole}`,
      htmlBody: buildRefinedHtmlTemplate(
        "❌ Estudo Não Aprovado no CQ",
        `Prezado(a) ${analystName},<br/><br/>O estudo abaixo foi analisado pelo Controle de Qualidade e <span style="color: #ef4444; font-weight: bold;">requer ajustes</span> antes da aprovação final.`,
        [
          {
            title: "📋 Dados do Estudo",
            items: [
              { label: "Código", value: request.studyNumber || "N/A" },
              { label: "Título", value: request.studyTitle || request.clientName || "N/A" },
              { label: "Analisado por", value: qcName },
            ]
          },
          {
            title: "📝 Motivo da Não Aprovação",
            items: [
              { label: "Correções", value: reason },
            ]
          },
          {
            title: "▶️ Ação Necessária",
            items: [
              { label: "1", value: "Realize as correções indicadas" },
              { label: "2", value: "Reenvie o estudo para nova análise do CQ" },
              { label: "Status", value: "REPROVADO PELO CQ" },
            ]
          }
        ],
        [
          "⚠️ O estudo retornou para sua fila para correções.",
          "Após as correções, reenvie o estudo para nova análise do CQ.",
          "Atenciosamente,",
          "<strong>" + qcName + "</strong>",
          "<strong>" + signerRole + "</strong>"
        ],
        [],
        StudyStatus.REPROVADO_CQ
      ),
    };
  },

  /**
   * Email enviado para recuperação de senha
   */
  generatePasswordResetEmail: (
    userEmail: string,
    userName: string,
    resetCode: string,
  ): EmailNotificationData => {
    return {
      recipientEmail: userEmail,
      recipientName: userName,
      subject: `Código de Segurança: ${resetCode} - Portal Técnico APR`,
      body: `🔐 REDEFINIÇÃO DE SENHA
───────────────────────────────────────────────────────────
Prezado(a) ${userName},
Recebemos uma solicitação de redefinição de senha para sua conta no Portal Técnico APR.

🔑 CÓDIGO DE SEGURANÇA
───────────────────────────────────────────────────────────
Código:   ${resetCode}
Validade: 15 minutos

Utilize o código acima para validar sua identidade e prosseguir com a criação da nova senha.
Se você não solicitou esta redefinição, sinta-se à vontade para ignorar este e-mail.

Atenciosamente,
Equipe de Segurança do Portal Técnico APR
Naturgy`,
      htmlBody: buildRefinedHtmlTemplate(
        "🔐 Redefinição de Senha",
        `Prezado(a) ${userName},<br/><br/>Recebemos uma solicitação de redefinição de senha para sua conta no <strong>Portal Técnico APR</strong>.<br/><br/>Utilize o código abaixo para validar sua identidade e prosseguir com a criação da nova senha.`,
        [
          {
            title: "🔑 Código de Segurança",
            items: [
              {
                label: "Código",
                value: `<span style="font-size: 24px; color: #f97316;">${resetCode}</span>`,
              },
              { label: "Validade", value: "15 minutos" },
            ],
          },
        ],
        [
          "Se você não solicitou esta redefinição, sinta-se à vontade para ignorar este e-mail.",
          "<strong>Naturgy - Portal Técnico APR</strong>",
        ],
      ),
    };
  },

  /**
   * Exibe uma tela de preview de email para o usuário enviar
   */
  showEmailPreview: (emailData: EmailNotificationData) => {
    const subject = `ASSUNTO: ${emailData.subject}`;
    const from = `DE: ${emailData.senderEmail || SYSTEM_EMAIL}`;
    const to = `PARA: ${emailData.recipientEmail}`;

    const attachmentsList =
      emailData.attachments && emailData.attachments.length > 0
        ? `\nANEXOS: ${emailData.attachments.map((a, i) => `\n  ${i + 1}. ${a}`).join("")}`
        : "";

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
  /**
   * Converte EmailNotificationData para formato .eml
   */
  buildEmlContent: (emailData: EmailNotificationData): string => {
    const boundary = "----=_Part_0_" + Date.now().toString(16);
    const date = new Date().toUTCString();

    // Header do EML
    let eml = `From: ${emailData.senderName ? `"${emailData.senderName}" <${emailData.senderEmail || SYSTEM_EMAIL}>` : emailData.senderEmail || SYSTEM_EMAIL}\r\n`;
    eml += `To: ${emailData.recipientName ? `"${emailData.recipientName}" <${emailData.recipientEmail}>` : emailData.recipientEmail}\r\n`;
    if (emailData.ccEmail) {
      eml += `Cc: ${emailData.ccEmail}\r\n`;
    }
    eml += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(emailData.subject)))}?=\r\n`;
    eml += `Date: ${date}\r\n`;
    eml += `MIME-Version: 1.0\r\n`;

    if (emailData.htmlBody) {
      // Multipart (Texto + HTML)
      eml += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

      // Parte Texto
      eml += `--${boundary}\r\n`;
      eml += `Content-Type: text/plain; charset=UTF-8\r\n`;
      eml += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      // Conversão simples para quoted-printable
      const plainText = emailData.body.replace(/=/g, '=3D').replace(/\r?\n/g, '\r\n');
      eml += `${plainText}\r\n\r\n`;

      // Parte HTML
      eml += `--${boundary}\r\n`;
      eml += `Content-Type: text/html; charset=UTF-8\r\n`;
      eml += `Content-Transfer-Encoding: base64\r\n\r\n`;
      // HTML em base64 com quebras a cada 76 caracteres
      const b64Html = btoa(unescape(encodeURIComponent(emailData.htmlBody)));
      const chunks = b64Html.match(/.{1,76}/g) || [];
      eml += chunks.join('\r\n') + '\r\n\r\n';

      eml += `--${boundary}--\r\n`;
    } else {
      // ApenasTexto
      eml += `Content-Type: text/plain; charset=UTF-8\r\n`;
      eml += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      const plainText = emailData.body.replace(/=/g, '=3D').replace(/\r?\n/g, '\r\n');
      eml += `${plainText}\r\n`;
    }

    return eml;
  },

  /**
   * Envia email preservando 100% do HTML.
   * Electron: salva .eml temp e abre silenciosamente no cliente nativo.
   * Web: gera .eml e faz download automático (o usuário abre com duplo-clique).
   * O remetente é sempre o email do usuário logado no momento.
   */
  openInOutlook: async (
    emailData: EmailNotificationData,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const emlContent = EmailService.buildEmlContent(emailData);

      // ═══════════════════════════════════════════════════════════
      // PATH 1: Electron Desktop → EML nativo silencioso
      // ═══════════════════════════════════════════════════════════
      if ((window as any).api?.openOutlookEmailHtml) {
        try {
          const result = await (window as any).api.openOutlookEmailHtml({
            to: emailData.recipientEmail,
            subject: emailData.subject,
            html: emailData.htmlBody,
            emlContent: emlContent,
          });

          if (result.success) {
            console.log(
              "%c📧 ARQUIVO EML ABERTO SILENCIOSAMENTE",
              "color: #0078D4; font-weight: bold; font-size: 14px",
            );
            return {
              success: true,
              message: `Draft de email aberto no cliente padrão`,
            };
          }
          console.warn("Electron IPC falhou, usando fallback EML download...");
        } catch (ipcError) {
          console.warn("API Electron falhou:", ipcError);
        }
      }

      // ═══════════════════════════════════════════════════════════
      // PATH 2: Web → Mailto link (Apenas Texto)
      // Abre a janela de "Novo Email" do sistema instantaneamente.
      // E-mail gerado sem arquivos HTML/EML extras, conforme solicitado.
      // ═══════════════════════════════════════════════════════════

      const to = encodeURIComponent(emailData.recipientEmail);
      const subject = encodeURIComponent(emailData.subject);

      // Sanitiza o texto (remove quebras muito complexas ou tags html)
      const plainBody = emailData.body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ');

      const body = encodeURIComponent(plainBody);
      const mailtoLink = `mailto:${to}?subject=${subject}&body=${body}`;

      // FIX Bug 2: Clicar diretamente sem setTimeout para manter user gesture
      console.log("[EmailService] Triggering mailto...");
      
      const link = document.createElement("a");
      link.href = mailtoLink;
      link.id = "mailto-temp-link";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 200);

      console.log(
        "%c📧 MAILTO LINK ACIONADO NO NAVEGADOR",
        "color: #0078D4; font-weight: bold; font-size: 14px",
      );

      return {
        success: true,
        message: `Cliente de e-mail padrão aberto com sucesso.`,
      };
    } catch (error) {
      console.error("Erro ao gerar EML:", error);
      return {
        success: false,
        message: `Erro ao enviar e-mail: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      };
    }
  },

  /**
   * Método unificado de envio de email.
   * Delega para openInOutlook que decide o melhor caminho (Resend web ou EML desktop).
   */
  send: async (
    emailData: EmailNotificationData,
  ): Promise<{ success: boolean; message: string }> => {
    return await EmailService.openInOutlook(emailData);
  },

  /**
   * Valida se um usuário tem acesso a um arquivo específico
   * Solicitantes só podem acessar arquivos em "Solicitação" e "Resposta"
   */
  canUserAccessFile: (
    filePath: string,
    userRole: UserRole,
    userEmail?: string,
    requestOwnerId?: string,
  ): boolean => {
    // Admin e Analista têm acesso total
    if (userRole === UserRole.ADM || userRole === UserRole.ANALISTA) {
      return true;
    }

    // Solicitante só pode acessar pastas "Solicitação" e "Resposta"
    if (userRole === UserRole.SOLICITANTE) {
      const normalizedPath = filePath.toLowerCase().replace(/\\/g, "/");
      const allowedFolders = ["solicitação", "resposta"];

      // Verificar se o caminho contém uma das pastas permitidas
      const hasAllowedFolder = allowedFolders.some(
        (folder) =>
          normalizedPath.includes(`/${folder}/`) ||
          normalizedPath.includes(`\\${folder}\\`) ||
          new RegExp(`[/\\\\]${folder}[/\\\\]`).test(normalizedPath),
      );

      return hasAllowedFolder;
    }

    return false;
  },

  /**
   * Filtra lista de arquivos baseado no acesso do usuário
   */
  filterAccessibleFiles: (
    files: Array<{ name: string; path: string }>,
    userRole: UserRole,
  ): Array<{ name: string; path: string }> => {
    if (userRole === UserRole.ADM || userRole === UserRole.ANALISTA) {
      return files;
    }

    if (userRole === UserRole.SOLICITANTE) {
      return files.filter((file) =>
        EmailService.canUserAccessFile(file.path || file.name, userRole),
      );
    }

    return [];
  },
};
