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
  ): EmailNotificationData => {
    const signerName =
      responsibleName || "Equipe de Gestão de Análise de Planificação de Rede";
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `✅ SUA SOLICITAÇÃO FOI APROVADA!
───────────────────────────────────────────────────────────
Prezado(a) ${safeName(request.requesterName)},
Temos o prazer de informar que sua solicitação de Análise de Planificação de Rede foi APROVADA!
Sua solicitação foi validada com sucesso e será encaminhada para execução técnica.
Um analista especializado iniciará o processamento do seu estudo em breve.

📋 DETALHES
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local:  ${request.address || ""}, ${request.city || ""}
Data:   ${safeFormatDate(request.requestDate)}
Status: AGUARDANDO EXECUÇÃO

Para acompanhar o progresso, acesse o Portal Técnico APR.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        "✅ Sua Solicitação foi APROVADA!",
        `Prezado(a) ${safeName(request.requesterName)},\nTemos o prazer de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #107C10; font-weight: bold;">APROVADA</span>!\n\nSua solicitação foi validada com sucesso e será encaminhada para <strong>execução técnica</strong>.\nUm analista especializado iniciará o processamento do seu estudo em breve.\n\n<strong>Para acompanhar o progresso:</strong> acesse o Portal Técnico APR.`,
        [
          {
            title: "📋 DETALHES",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value:
                  request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              { label: "Data", value: safeFormatDate(request.requestDate) },
              { label: "Status", value: "AGUARDANDO EXECUÇÃO" },
            ],
          },
        ],
        [
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>Naturgy - Portal Técnico APR</strong>",
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
  ): EmailNotificationData => {
    const signerName =
      responsibleName || "Equipe de Gestão de Análise de Planificação de Rede";
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `⚠️ SOLICITAÇÃO DE REVISÃO
───────────────────────────────────────────────────────────
Prezado(a) ${safeName(request.requesterName)},
Sua solicitação passou pela análise inicial. Porém, foi identificada a necessidade de ajustes antes de procedermos.

📋 DADOS DA SOLICITAÇÃO
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local:  ${request.address || ""}, ${request.city || ""}
Status: REVISÃO NECESSÁRIA

📝 MOTIVO DA REVISÃO SOLICITADA
───────────────────────────────────────────────────────────
${rejectionReason}

▶️ PRÓXIMOS PASSOS
───────────────────────────────────────────────────────────
1️⃣ Revise as informações e documentação conforme indicado
2️⃣ Acesse o Portal Técnico APR
3️⃣ Solicite REVISÃO do estudo
4️⃣ Reenvie com os ajustes necessários
5️⃣ Nossa equipe analisará novamente

Para dúvidas ou assistência, entre em contato conosco através do portal.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        "⚠️ SOLICITAÇÃO DE REVISÃO",
        `Prezado(a) ${safeName(request.requesterName)},\n<strong>Esta é uma SOLICITAÇÃO DE REVISÃO.</strong>\nSua solicitação de <strong>Análise de Planificação de Rede</strong> passou pela análise inicial. Porém, foi identificada a necessidade de ajustes.`,
        [
          {
            title: "📋 DADOS",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value:
                  request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              { label: "Motivo da Revisão", value: rejectionReason },
            ],
          },
          {
            title: "📝 PRÓXIMOS PASSOS",
            items: [
              {
                label: "1️⃣",
                value: "Revise as informações e documentação conforme indicado",
              },
              { label: "2️⃣", value: "Acesse o Portal Técnico APR" },
              { label: "3️⃣", value: "Solicite REVISÃO do estudo" },
              { label: "4️⃣", value: "Reenvie com os ajustes necessários" },
              { label: "5️⃣", value: "Nossa equipe analisará novamente" },
            ],
          },
        ],
        [
          "Para dúvidas, entre em contato através do Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>Naturgy - Portal Técnico APR</strong>",
        ],
        [],
        StudyStatus.REJEITADO,
      ),
    };
  },

  /**
   * Email enviado quando uma solicitação é concluída (admin → solicitante)
   */
  generateCompletionEmail: (
    request: FormData,
    responsibleName?: string,
  ): EmailNotificationData => {
    const signerName =
      responsibleName || "Equipe de Gestão de Análise de Planificação de Rede";
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      subject: `Solicitação de Estudo Nº ${studyRef || request.id}`,
      body: `✅ SEU ESTUDO FOI CONCLUÍDO!
───────────────────────────────────────────────────────────
Prezado(a) ${safeName(request.requesterName)},
Temos o prazer de informar que sua solicitação de Análise de Planificação de Rede foi CONCLUÍDA!

📋 DETALHES
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || "Não informado"}
Título: ${request.studyTitle || request.clientName || "Não informado"}
Local:  ${request.address || ""}, ${request.city || ""}
Data:   ${safeFormatDate(request.requestDate)}

📂 ACESSO AOS RESULTADOS
───────────────────────────────────────────────────────────
Os arquivos com os resultados técnicos estão disponíveis na pasta de resposta do seu estudo.

📝 PRÓXIMOS PASSOS
───────────────────────────────────────────────────────────
1️⃣ Acesse o Portal Técnico APR
2️⃣ Navegue até "Meus Pedidos"
3️⃣ Abra seu estudo (${request.studyNumber})
4️⃣ Clique em "Abrir Pasta" para acessar os resultados
5️⃣ Verifique os arquivos de resposta gerados

Precisa de ajuda? Entre em contato com nossa equipe técnica através do portal.

Atenciosamente,
${signerName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        "✅ Seu Estudo foi CONCLUÍDO!",
        `Prezado(a) ${safeName(request.requesterName)},\nTemos o prazer de informar que sua solicitação de <strong>Análise de Planificação de Rede</strong> foi <span style="color: #107C10; font-weight: bold;">CONCLUÍDA</span>!\n\n<strong>📂 Acesso aos Resultados</strong>\nOs arquivos com os resultados técnicos da Análise de Planificação de Rede estão disponíveis na pasta de resposta do seu estudo. Você pode acessá-los através do Portal Técnico APR.`,
        [
          {
            title: "📋 DETALHES",
            items: [
              {
                label: "Código",
                value: request.studyNumber || "Não informado",
              },
              {
                label: "Título",
                value:
                  request.studyTitle || request.clientName || "Não informado",
              },
              {
                label: "Local",
                value: `${request.address || ""}, ${request.city || ""}`,
              },
              { label: "Data", value: safeFormatDate(request.requestDate) },
            ],
          },
          {
            title: "📝 PRÓXIMOS PASSOS",
            items: [
              { label: "1️⃣", value: "Acesse o Portal Técnico APR" },
              { label: "2️⃣", value: 'Navegue até "Meus Pedidos"' },
              {
                label: "3️⃣",
                value: `Abra seu estudo (${request.studyNumber})`,
              },
              {
                label: "4️⃣",
                value: 'Clique em "Abrir Pasta" para acessar os resultados',
              },
              {
                label: "5️⃣",
                value: "Verifique os arquivos de resposta gerados",
              },
            ],
          },
        ],
        [
          "Precisa de ajuda? Entre em contato com nossa equipe técnica através do Portal Técnico APR.",
          "Atenciosamente,",
          "<strong>" + signerName + "</strong>",
          "<strong>Naturgy - Portal Técnico APR</strong>",
        ],
        [],
        StudyStatus.CONCLUIDO,
      ),
    };
  },

/**
   * Email enviado quando o analista conclude a execução e envia para Controle de Qualidade
   * (analista → prgc sistema)
   */
  generateQCRequestEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    recipientEmail?: string,
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: recipientEmail || SYSTEM_EMAIL,
      recipientName: 'Controle de Qualidade APR',
      senderEmail: analystEmail,
      senderName: analystName,
      subject: `📋 Solicitação de Controle de Qualidade: Estudo Nº ${studyRef || request.id}`,
      body: `📋 SOLICITAÇÃO DE CONTROLE DE QUALIDADE
───────────────────────────────────────────────────────────
Prezada Equipe de Controle de Qualidade,

Informo que o estudo ${request.studyNumber} foi concluído e está sendo encaminhado para revisão no Controle de Qualidade.

📋 DADOS DO ESTUDO
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Analista Responsável: ${analystName}
Data: ${safeFormatDate(request.requestDate)}

Solicito a análise e validação conforme os critérios do Controle de Qualidade.

Atenciosamente,
${analystName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        '📋 Solicitação de Controle de Qualidade',
        `Prezada Equipe de Controle de Qualidade,<br/><br/>Informo que o estudo <strong>${request.studyNumber}</strong> foi concluído e está sendo encaminhado para revisão no <strong>Controle de Qualidade</strong>.`,
        [
          {
            title: '📋 DADOS DO ESTUDO',
            items: [
              { label: 'Código', value: request.studyNumber || 'N/A' },
              { label: 'Título', value: request.studyTitle || request.clientName || 'N/A' },
              { label: 'Local', value: `${request.address || ''}, ${request.city || ''}` },
              { label: 'Analista Responsável', value: analystName },
              { label: 'Data de Envio', value: new Date().toLocaleDateString('pt-BR') },
            ]
          },
          {
            title: '📝 AÇÃO NECESSÁRIA',
            items: [
              { label: 'Status', value: 'CONTROLE DE QUALIDADE' },
              { label: 'Ação', value: 'Realizar análise e validação conforme critérios CQ.' },
            ]
          }
        ],
        [
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>Naturgy - Portal Técnico APR</strong>'
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
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: request.email,
      recipientName: safeName(request.requesterName),
      senderEmail: analystEmail,
      senderName: analystName,
      subject: `Resposta Antecipada do Estudo Nº ${studyRef || request.id}`,
      body: `📋 RESPOSTA ANTECIPADA DO ESTUDO
───────────────────────────────────────────────────────────
Prezado(a) ${safeName(request.requesterName)},

Informamos que o estudo ${request.studyNumber} está sendo encaminhado em caráter antecipado, antes da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.

O estudo passará pelo Controle de Qualidade normalmente. Caso sejam identificadas correções necessárias, uma versão revisada será emitida e encaminhada.

📋 DADOS DO ESTUDO
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Local:  ${request.address || ''}, ${request.city || ''}
Data:   ${safeFormatDate(request.requestDate)}

📂 ACESSO AOS RESULTADOS
───────────────────────────────────────────────────────────
Os arquivos com os resultados técnicos estão disponíveis na pasta de resposta do seu estudo.

Atenciosamente,
${analystName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        '📋 Resposta Antecipada do Estudo',
        `Prezado(a) <strong>${safeName(request.requesterName)}</strong>,<br/><br/>Informamos que o estudo <strong>${request.studyNumber}</strong> está sendo encaminhado em caráter <strong>antecipado</strong>, antes da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.<br/><br/>O estudo passará pelo Controle de Qualidade normalmente. Caso sejam identificadas correções necessárias, <strong>uma versão revisada será emitida e encaminhada</strong>.`,
        [
          {
            title: '📋 DADOS DO ESTUDO',
            items: [
              { label: 'Código', value: request.studyNumber || 'N/A' },
              { label: 'Título', value: request.studyTitle || request.clientName || 'N/A' },
              { label: 'Local', value: `${request.address || ''}, ${request.city || ''}` },
              { label: 'Analista Responsável', value: analystName },
              { label: 'Data de Envio', value: new Date().toLocaleDateString('pt-BR') },
            ]
          },
          {
            title: '⚠️ OBSERVAÇÃO IMPORTANTE',
            items: [
              { label: 'Situação', value: 'Enviado antes do Controle de Qualidade' },
              { label: 'Motivo', value: 'Prazo de entrega' },
              { label: 'Ação Pendente', value: 'O estudo ainda passará pelo CQ. Se necessário, nova versão será emitida.' },
            ]
          }
        ],
        [
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>Naturgy - Portal Técnico APR</strong>'
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
  ): EmailNotificationData => {
    const studyRef = request.studyNumber?.trim();
    return {
      recipientEmail: SYSTEM_EMAIL,
      recipientName: 'Controle de Qualidade APR',
      senderEmail: analystEmail,
      senderName: analystName,
      subject: `⚠️ Envio Antecipado Antes do CQ: Estudo Nº ${studyRef || request.id}`,
      body: `⚠️ ENVIO ANTECIPADO ANTES DO CONTROLE DE QUALIDADE
───────────────────────────────────────────────────────────
Prezada Equipe de Controle de Qualidade,

Informo que o estudo ${request.studyNumber} foi enviado ao solicitante ANTES da conclusão do processo de Controle de Qualidade, em função do prazo de entrega.

O estudo está sendo encaminhado para análise no CQ normalmente. Caso sejam identificadas correções necessárias, será emitida nova versão ao solicitante com as devidas ressalvas corrigidas.

📋 DADOS DO ESTUDO
───────────────────────────────────────────────────────────
Código: ${request.studyNumber || 'N/A'}
Título: ${request.studyTitle || request.clientName || 'N/A'}
Analista Responsável: ${analystName}
Data: ${safeFormatDate(request.requestDate)}
Motivo: Prazo de entrega

Solicito a análise e validação conforme os critérios do Controle de Qualidade.

Atenciosamente,
${analystName}
Naturgy - Portal Técnico APR`,
      htmlBody: buildRefinedHtmlTemplate(
        '⚠️ Envio Antecipado Antes do CQ',
        `Prezada Equipe de Controle de Qualidade,<br/><br/>Informo que o estudo <strong>${request.studyNumber}</strong> foi enviado ao solicitante <strong>ANTES</strong> da conclusão do processo de Controle de Qualidade, em função do <strong>prazo de entrega</strong>.<br/><br/>O estudo está sendo encaminhado para análise no CQ normalmente. Caso sejam identificadas correções necessárias, será emitida <strong>nova versão ao solicitante</strong> com as devidas ressalvas corrigidas.`,
        [
          {
            title: '📋 DADOS DO ESTUDO',
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
            title: '📝 AÇÃO NECESSÁRIA',
            items: [
              { label: 'Status', value: 'ENVIADO SEM CQ → CONTROLE DE QUALIDADE' },
              { label: 'Ação', value: 'Realizar análise e validação. Se reprovado, analista deve gerar nova documentação corrigida.' },
            ]
          }
        ],
        [
          'Atenciosamente,',
          '<strong>' + analystName + '</strong>',
          '<strong>Naturgy - Portal Técnico APR</strong>'
        ],
        [],
        StudyStatus.CONTROLE_QUALIDADE
      )
    };
  },

  /**
   * Email enviado pelo ADM/QC para o Analista quando o estudo é APROVADO no CQ
   */
  generateQCApprovalAnalystEmail: (
    request: FormData,
    analystEmail: string,
    analystName: string,
    qcName: string,
    observations?: string,
  ): EmailNotificationData => {
    return {
      recipientEmail: analystEmail,
      recipientName: analystName,
      subject: `✅ Estudo APROVADO no CQ: ${request.studyNumber}`,
      body: `Prezado(a) ${analystName},

Informamos que o estudo ${request.studyNumber} foi APROVADO no Controle de Qualidade por ${qcName}.

O estudo retornou para sua fila com o status "Aprovado pelo CQ".
Por favor, realize o envio formal do e-mail de conclusão para o solicitante através do painel técnico para encerrar o processo.

Observações do QC:
${observations || "Nenhuma observação adicional."}

Atenciosamente,
Controle de Qualidade APR
Naturgy`,
      htmlBody: buildRefinedHtmlTemplate(
        "✅ Estudo APROVADO no Controle de Qualidade",
        `Prezado(a) <strong>${analystName}</strong>,<br/><br/>Informamos que o estudo <strong>${request.studyNumber}</strong> foi <span style="color: #10b981; font-weight: bold;">APROVADO</span> no Controle de Qualidade por <strong>${qcName}</strong>.<br/><br/>O estudo retornou para sua fila com o status <strong>"Aprovado pelo CQ"</strong>.`,
        [
          {
            title: "📋 DADOS DO ESTUDO",
            items: [
              { label: "Código", value: request.studyNumber || "N/A" },
              { label: "Cliente", value: request.studyTitle || request.clientName || "N/A" },
              { label: "Aprovado por", value: qcName },
            ]
          },
          {
            title: "📝 PRÓXIMAS AÇÕES",
            items: [
              { label: "Status Atual", value: "APROVADO PELO CQ" },
              { label: "Ação Necessária", value: "Enviar e-mail final ao solicitante e concluir estudo." },
              { label: "Observações", value: observations || "Nenhuma observação." },
            ]
          }
        ],
        [
          "Por favor, finalize o processo no portal o quanto antes.",
          "Atenciosamente,",
          "<strong>Controle de Qualidade APR</strong>",
          "<strong>Naturgy</strong>"
        ],
        [],
        StudyStatus.APROVADO_CQ
      ),
      senderEmail: undefined, // Will be filled by the caller with supervisor email
      senderName: qcName,
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
  ): EmailNotificationData => {
    return {
      recipientEmail: analystEmail,
      recipientName: analystName,
      subject: `❌ Estudo REPROVADO no CQ: ${request.studyNumber}`,
      body: `Prezado(a) ${analystName},

Informamos que o estudo ${request.studyNumber} foi REPROVADO no Controle de Qualidade por ${qcName}.

O estudo retornou para sua fila com o status "Reprovado pelo CQ".
Você deve realizar as correções indicadas abaixo e reenviar para o Controle de Qualidade.

Motivo da Reprovação:
${reason}

Atenciosamente,
Controle de Qualidade APR
Naturgy`,
      htmlBody: buildRefinedHtmlTemplate(
        "❌ Estudo REPROVADO no Controle de Qualidade",
        `Prezado(a) <strong>${analystName}</strong>,<br/><br/>Informamos que o estudo <strong>${request.studyNumber}</strong> foi <span style="color: #ef4444; font-weight: bold;">REPROVADO</span> no Controle de Qualidade por <strong>${qcName}</strong>.<br/><br/>O estudo retornou para sua fila com o status <strong>"Reprovado pelo CQ"</strong> para correções.`,
        [
          {
            title: "📋 DADOS DO ESTUDO",
            items: [
              { label: "Código", value: request.studyNumber || "N/A" },
              { label: "Cliente", value: request.studyTitle || request.clientName || "N/A" },
              { label: "Reprovado por", value: qcName },
            ]
          },
          {
            title: "📝 MOTIVO DA REPROVAÇÃO",
            items: [
              { label: "Motivo/Ajustes", value: reason },
            ]
          }
        ],
        [
          "Após as correções, reenvie o estudo para nova análise do CQ.",
          "Atenciosamente,",
          "<strong>Controle de Qualidade APR</strong>",
          "<strong>Naturgy</strong>"
        ],
        [],
        StudyStatus.REPROVADO_CQ
      ),
      senderEmail: undefined, // Will be filled by the caller with supervisor email
      senderName: qcName,
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

      // Melhoria para acionar o mailto: de forma mais robusta no navegador
      console.log("[EmailService] Triggering mailto...");
      
      const link = document.createElement("a");
      link.href = mailtoLink;
      link.id = "mailto-temp-link";
      document.body.appendChild(link);
      
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
      }, 50);

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
