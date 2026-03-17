import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import { User, UserRole, FormData, StudyStatus } from './types';
import { getGMT3ISOString } from './utils';
import logoImg from './logo.png';

// ADM inicial - o Supabase lidará com a persistência real
const DEFAULT_ADM_EMAIL = 'prgc@naturgy.com';

export const getRequestPath = (studyNumber: string, category?: string) => {
  if (!studyNumber) return 'Solicitacoes_APR/Unknown';

  // Normalize: remove PROV- if present
  const baseWithoutProv = studyNumber.replace(/^PROV-/, '');
  
  // Extract base and revision (e.g. APR-2024-0001-REV1)
  const revMatch = baseWithoutProv.match(/(APR-\d{4}-\d+)-REV(\d+)$/i);
  
  let baseIdentifier = baseWithoutProv;
  let revSuffix = 'REV0';
  
  if (revMatch) {
    baseIdentifier = revMatch[1];
    revSuffix = `REV${revMatch[2]}`;
  } else {
    // If it's a base study (APR-2024-0001), it might not have -REV suffix, but we want it in REV0
    const baseMatch = baseWithoutProv.match(/APR-\d{4}-\d+/i);
    if (baseMatch) {
      baseIdentifier = baseMatch[0];
    }
  }
  
  // Extract year from the baseIdentifier (format APR-YYYY-...)
  const yearMatch = baseIdentifier.match(/APR-(\d{4})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  
  let path = `Solicitacoes_APR/${year}/${baseIdentifier}/${revSuffix}`;
  
  if (category) {
    path += `/${category}`;
  }
  
  return path;
};

export const StorageService = {
  // === Profiles (Users) Management ===
  
  getUsers: async (): Promise<User[]> => {
    console.log('Fetching users from Supabase...');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase error fetching users:', error);
      return [];
    }

    // Mapear de Snake Case (DB) para Camel Case (App)
    return (data || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      area: u.area,
      naturgyUnit: u.naturgy_unit,
      password: u.password,
      profileComplete: true,
      requiresPasswordChange: u.requires_password_change,
      permissions: u.permissions || [],
      createdAt: u.created_at
    }));
  },

  saveUser: async (user: User): Promise<User> => {
    const profileData = {
      id: user.id && user.id.length > 0 ? user.id : crypto.randomUUID(),
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role,
      area: user.area,
      naturgy_unit: user.naturgyUnit,
      password: user.password,
      permissions: user.permissions || [],
      requires_password_change: user.requiresPasswordChange ?? false,
      updated_at: getGMT3ISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) throw error;
    
    return {
      ...user,
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      area: data.area,
      naturgyUnit: data.naturgy_unit,
      permissions: data.permissions || [],
      requiresPasswordChange: data.requires_password_change,
      profileComplete: true
    };
  },

  deleteUser: async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
  },

  // === Password Reset Flow ===

  requestPasswordReset: async (email: string): Promise<string> => {
    const emailLower = email.toLowerCase().trim();
    
    // 1. Verificar se o usuário existe
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .single();
      
    if (fetchError || !user) {
      throw new Error('E-mail não encontrado no sistema.');
    }

    // 2. Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15); // 15 minutos de validade

    // 3. Salvar no banco
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        reset_token: code,
        reset_token_expires: expiry.toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;
    return code;
  },

  verifyResetToken: async (email: string, token: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('reset_token, reset_token_expires')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) return false;
    
    const isTokenMatch = data.reset_token === token;
    const isNotExpired = new Date(data.reset_token_expires) > new Date();

    return isTokenMatch && isNotExpired;
  },

  updateUserPassword: async (email: string, newPasswordHash: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        password: newPasswordHash,
        reset_token: null,
        reset_token_expires: null,
        requires_password_change: false,
        updated_at: getGMT3ISOString()
      })
      .eq('email', email.toLowerCase().trim());

    if (error) throw error;
  },

  // === Requests Management ===

  getRequests: async (): Promise<FormData[]> => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      return [];
    }

    return (data || []).map(r => ({
      ...r.data,
      id: r.id,
      studyNumber: r.study_number,
      status: r.status as StudyStatus,
      user_id: r.user_id,
      formType: r.form_type,
      year: r.year,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  addRequest: async (request: FormData, providedPdf?: File | Blob) => {
    const cleanRequest = { ...request };
    if (cleanRequest.selectedFiles) {
      cleanRequest.selectedFiles = cleanRequest.selectedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified
      }));
    }
    if (cleanRequest.categorizedFiles) {
      const cleanCategorized: any = {};
      for (const [cat, files] of Object.entries(cleanRequest.categorizedFiles)) {
        cleanCategorized[cat] = (files || []).map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified
        }));
      }
      cleanRequest.categorizedFiles = cleanCategorized;
    }

    const requestRow = {
      id: request.id,
      study_number: request.studyNumber,
      status: request.status,
      user_id: request.user_id,
      form_type: request.formType,
      year: request.studyNumber.match(/APR-(\d{4})/)?.[1] || new Date().getFullYear().toString(),
      data: cleanRequest,
      updated_at: getGMT3ISOString()
    };

    const baseFolder = getRequestPath(request.studyNumber);
    
    // Ensure folders "exist" in Supabase Storage UI by uploading a hidden .keep file
    const ensureFolder = async (folder: string) => {
      const keepBlob = new Blob([''], { type: 'text/plain' });
      await supabase.storage.from('request-files').upload(`${folder}/.keep`, keepBlob, { upsert: true });
    };
    
    await ensureFolder(getRequestPath(request.studyNumber, 'Solicitacao'));
    await ensureFolder(getRequestPath(request.studyNumber, 'Resposta'));
    await ensureFolder(getRequestPath(request.studyNumber, 'Calculos'));
    await ensureFolder(getRequestPath(request.studyNumber, 'Outros'));
    
    // 0. Limpeza: Deletar arquivos do Storage que foram removidos no App
    // Para garantir que "mudanças feitas no app reflitam no dashboard"
    const categoriesToCleanup = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
    for (const cat of categoriesToCleanup) {
      const folderPath = getRequestPath(request.studyNumber, cat);
      const { data: currentStorageFiles } = await supabase.storage.from('request-files').list(folderPath);
      
      if (currentStorageFiles) {
        // Obter lista de nomes que o App enviou para esta categoria
        let appFileNames: string[] = [];
        if (cat === 'Solicitacao') {
          appFileNames = (request.selectedFiles || []).map(f => f.name);
        } else {
          appFileNames = (request.categorizedFiles?.[cat] || []).map(f => f.name);
        }

        const filesToDelete = currentStorageFiles
          .filter(f => f.name !== '.keep' && !f.name.startsWith('Formulario')) // Não deletar o keep nem o formulário oficial aqui
          .filter(f => !appFileNames.includes(f.name));

        if (filesToDelete.length > 0) {
          console.log(`[StorageService] Deleting ${filesToDelete.length} files from ${cat} because they were removed in the App.`);
          await supabase.storage.from('request-files').remove(filesToDelete.map(f => `${folderPath}/${f.name}`));
        }
      }
    }

    // 1. Upload files currently in selection (Requester)
    if (request.selectedFiles && request.selectedFiles.length > 0) {
      for (const file of request.selectedFiles) {
          if (file instanceof File || (file && typeof file === 'object' && 'base64' in file)) {
            const filePath = `${baseFolder}/Solicitacao/${file.name}`;
            let fileData: any = file;
            
            if (!(file instanceof File) && file.base64) {
              const byteCharacters = atob(file.base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              fileData = new Blob([byteArray], { type: file.type || 'application/pdf' });
            }

            const { error: uploadError } = await supabase.storage
              .from('request-files')
              .upload(filePath, fileData, { upsert: true });

            if (uploadError) console.error(`[StorageService] Error uploading ${file.name}:`, uploadError);
          }
      }
    }

    // 2. Categorized Files (Analista)
    if (request.categorizedFiles) {
      for (const [category, files] of Object.entries(request.categorizedFiles)) {
        if (files && files.length > 0) {
          for (const file of files) {
            if (file instanceof File || (file && typeof file === 'object' && 'base64' in file)) {
              const filePath = `${baseFolder}/${category}/${file.name}`;
              let fileData: any = file;
              
              if (!(file instanceof File) && file.base64) {
                const byteCharacters = atob(file.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                fileData = new Blob([byteArray], { type: file.type || 'application/pdf' });
              }
              const { error: uploadError } = await supabase.storage
                .from('request-files')
                .upload(filePath, fileData, { upsert: true });

              if (uploadError) console.error(`[StorageService] Error uploading ${file.name} to ${category}:`, uploadError);
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from('requests')
      .upsert(requestRow);

    if (error) throw error;
    
    // 3. Sincronização Automática: Garantir que a lista de arquivos no Banco reflita o Storage REAL
    // Buscamos o que está no storage agora (após os uploads acima) para as 4 categorias
    const categories = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
    const updatedCategorizedFiles: any = {};
    
    for (const cat of categories) {
      const folderPath = getRequestPath(request.studyNumber, cat);
      const { data: storageFiles } = await supabase.storage.from('request-files').list(folderPath);
      
      if (storageFiles) {
        updatedCategorizedFiles[cat] = storageFiles
          .filter(f => f.name !== '.keep')
          .map(f => ({
            name: f.name,
            size: f.metadata?.size || 0,
            type: f.metadata?.mimetype || 'application/octet-stream',
            lastModified: new Date(f.created_at).getTime()
          }));
      }
    }

    // Atualizamos o registro no banco com a lista fidedigna do storage
    const finalData = { 
      ...cleanRequest, 
      selectedFiles: updatedCategorizedFiles['Solicitacao'] || [],
      categorizedFiles: updatedCategorizedFiles 
    };

    await supabase
      .from('requests')
      .update({ data: finalData })
      .eq('id', request.id);

    // Alinhado com a solicitação do usuário: Sempre que houver edição/adição, 
    // regeneramos o PDF para garantir que o arquivo no storage reflita os dados mais recentes.
    await StorageService.uploadOfficialForm({ ...request, data: finalData } as any, providedPdf);
    
    return { ...request, data: finalData };
  },

  deleteRequest: async (requestId: string) => {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);
    
    if (error) throw error;
  },

  renameRequestFolder: async (oldStudyNumber: string, newStudyNumber: string) => {
    const oldPath = getRequestPath(oldStudyNumber);
    const newPath = getRequestPath(newStudyNumber);
    
    const { data: files, error: listError } = await supabase.storage
      .from('request-files')
      .list(oldPath, { recursive: true } as any);

    if (listError) return;

    if (files) {
      for (const file of files) {
        const sourcePath = `${oldPath}/${file.name}`;
        const destPath = `${newPath}/${file.name}`;
        await supabase.storage.from('request-files').copy(sourcePath, destPath);
        await supabase.storage.from('request-files').remove([sourcePath]);
      }
    }
  },

  uploadOfficialForm: async (request: FormData, providedPdf?: File | Blob) => {
    try {
      const folderPath = getRequestPath(request.studyNumber, 'Solicitacao');
      const fileName = `Formulario - ${request.studyNumber}.pdf`;
      const fullPath = `${folderPath}/${fileName}`;

      if (providedPdf) {
        console.log(`[StorageService] Using true DOM Snapshot PDF for: ${fullPath}`);
        
        // Se este for o PDF oficial (sem PROV-) e o estudo foi validado agora,
        // limpamos o PDF provisório se ele existir.
        if (!request.studyNumber.startsWith('PROV-')) {
          const provFileName = `Formulario - PROV-${request.studyNumber}.pdf`;
          const provFullPath = `${folderPath}/${provFileName}`;
          await supabase.storage.from('request-files').remove([provFullPath]);
        }

        const { error } = await supabase.storage.from('request-files').upload(fullPath, providedPdf, { upsert: true });
        
        if (error) throw error;
        console.log('[StorageService] DOM Snapshot PDF uploaded successfully');
        return;
      }

      // === Sem PDF fornecido: tentar reutilizar o PDF provisório ===
      // Isso acontece ao validar: após moveStorageFolder, o arquivo PROV- foi movido 
      // para a nova pasta mas ainda com o nome antigo. Aqui o "renomeamos" via copy+delete.
      if (!request.studyNumber.startsWith('PROV-')) {
        const provFileName = `Formulario - PROV-${request.studyNumber}.pdf`;
        const provFullPath = `${folderPath}/${provFileName}`;

        console.log(`[StorageService] No PDF provided. Trying to reuse PROV- snapshot: ${provFullPath}`);

        // Tenta copiar o arquivo PROV- para o nome oficial
        const { error: copyErr } = await supabase.storage
          .from('request-files')
          .copy(provFullPath, fullPath);

        if (!copyErr) {
          // Renomeação bem-sucedida: remove o arquivo PROV-
          await supabase.storage.from('request-files').remove([provFullPath]);
          console.log(`[StorageService] Successfully renamed ${provFileName} -> ${fileName}`);
          return; // ✅ Preserva o PDF de alta qualidade do snapshot original
        } else {
          console.warn(`[StorageService] PROV- PDF not found or copy failed: ${copyErr.message}. Checking if official PDF already exists...`);
          
          // Verifica se o PDF oficial já existe (ex: segunda chamada)
          const { data: existing } = await supabase.storage.from('request-files').list(folderPath);
          if (existing?.some(f => f.name === fileName)) {
            console.log(`[StorageService] Official PDF ${fileName} already exists. Skipping generation.`);
            return; // Nada a fazer
          }
        }
      }

      console.log(`[StorageService] Generating Fallback PDF with manual coords: ${fullPath}`);

      const doc = new jsPDF();
      let y = 35;

      const checkPageBreak = (needed: number = 7) => {
        if (y + needed > 280) {
          doc.addPage();
          y = 20;
          return true;
        }
        return false;
      };

      const addSectionHeader = (title: string) => {
        checkPageBreak(15);
        doc.setFillColor(0, 64, 128); // Naturgy Blue
        doc.rect(20, y, 170, 7, 'F');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 25, y + 5);
        y += 10;
        doc.setTextColor(60, 60, 60);
      };

      // Improved renderField with multi-line support and grid alignment
      const renderField = (label: string, value: any, half: boolean = false, startY?: number) => {
        const currentY = startY || y;
        const xOffset = half ? 85 : 0;
        const colWidth = half ? 80 : 165;
        const val = value?.toString() || '-';
        
        // Label
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 64, 128);
        doc.setFontSize(7);
        doc.text(label.toUpperCase(), 25 + xOffset, currentY);
        
        // Value with word wrap
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        const wrappedVal = doc.splitTextToSize(val, colWidth);
        doc.text(wrappedVal, 25 + xOffset, currentY + 5);
        
        const lines = Array.isArray(wrappedVal) ? wrappedVal.length : 1;
        const fieldHeight = 5 + (lines * 4) + 2;
        
        if (!half) {
          y += fieldHeight;
        }
        return fieldHeight;
      };

      // Header Professional
      doc.setFillColor(0, 64, 128);
      doc.rect(20, 15, 12, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('I', 25, 23);

      doc.setTextColor(0, 64, 128);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text('SOLICITAÇÃO TÉCNICA APR', 35, 22);
      
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('PORTAL INTEGRADO NATURGY', 35, 26);

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      doc.text(`CÓDIGO: ${request.studyNumber}`, 190, 20, { align: 'right' });
      doc.text(`DATA: ${request.requestDate ? new Date(request.requestDate).toLocaleDateString('pt-BR') : '-'}`, 190, 24, { align: 'right' });

      doc.setDrawColor(0, 64, 128);
      doc.setLineWidth(0.5);
      doc.line(20, 31, 190, 31);

      // SECTION 1: IDENTIFICAÇÃO DO SOLICITANTE
      addSectionHeader('Identificação do Solicitante');
      const startS1 = y - 3;
      renderField('Naturgy Unit', request.naturgyUnit, true);
      renderField('Tipo de Estudo', request.studyType);
      
      if (request.studyType?.includes('Revisão')) {
        renderField('Estudo Anterior', request.previousStudy);
      }
      
      let rowY = y;
      const h1 = renderField('Nome do Solicitante', request.requesterName, true, rowY);
      const h2 = renderField('Área Solicitante', request.requesterArea, false, rowY);
      y = rowY + Math.max(h1, h2);
      
      rowY = y;
      const h3 = renderField('E-mail', request.email, true, rowY);
      const h4 = renderField('Telefone', request.phone, false, rowY);
      y = rowY + Math.max(h3, h4);
      
      doc.setDrawColor(220, 220, 220);
      doc.rect(20, startS1, 170, y - startS1 + 2);
      y += 8;

      // SECTION 2: DADOS BASE DO ESTUDO
      addSectionHeader('Dados Base do Estudo');
      const startS2 = y - 3;
      renderField('Título / Cliente', request.studyTitle || request.clientName || request.uteName);
      
      rowY = y;
      const hb1 = renderField('Endereço', request.address, true, rowY);
      const hb2 = renderField('Número', request.number || '-', false, rowY);
      y = rowY + Math.max(hb1, hb2);
      
      rowY = y;
      const hb3 = renderField('Bairro', request.neighborhood, true, rowY);
      const hb4 = renderField('Cidade/Município', request.city, false, rowY);
      y = rowY + Math.max(hb3, hb4);
      
      rowY = y;
      const hb5 = renderField('Estado', request.state || '-', true, rowY);
      const hb6 = renderField('Tipo de Gás', request.gasType || 'Natural', false, rowY);
      y = rowY + Math.max(hb5, hb6);
      
      renderField('Faixa de Pressão Sugerida', request.suggestedPressureRange);
      
      doc.rect(20, startS2, 170, y - startS2 + 2);
      y += 8;

      // SECTION 3: ESPECÍFICOS POR FORMULÁRIO
      if (request.formType === 'PE.00492-FO.01') {
        addSectionHeader('Cargas e Mercado (FO.01)');
        const startS3 = y - 3;
        renderField('Tipo de Rede', request.networkType, true);
        renderField('Pressão da Rede', request.pressure);
        renderField('Mapa Localização', request.mapLocation, true);
        renderField('Tipo de Arquivo', request.fileType);
        
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text('DISTRIBUIÇÃO DE CONSUMO PREVISTO', 25, y);
        y += 5;
        
        if (request.marketCategory?.includes('Residencial')) {
          rowY = y;
          renderField('Mercado', 'Residencial', true, rowY);
          renderField('Qtd Clientes', request.numClientsRes, false, rowY);
          y += 10;
          rowY = y;
          renderField('Vazão Unit.', `${request.flowUnitRes || 0} m³/h`, true, rowY);
          renderField('Total Previsto', `${request.totalFlowRes || 0} m³/h`, false, rowY);
          y += 10;
        }
        if (request.marketCategory?.includes('Comercial')) {
          rowY = y;
          renderField('Mercado', 'Comercial', true, rowY);
          renderField('Qtd Clientes', request.numClientsCom, false, rowY);
          y += 10;
          rowY = y;
          renderField('Vazão Unit.', `${request.flowUnitCom || 0} m³/h`, true, rowY);
          renderField('Total Previsto', `${request.totalFlowCom || 0} m³/h`, false, rowY);
          y += 10;
        }
        doc.rect(20, startS3, 170, y - startS3 + 2);
      }
      else if (request.formType === 'PE.00492-FO.02') {
        addSectionHeader('Expansão e Gaseificação (FO.02)');
        const startS3 = y - 3;
        renderField('Tipo Gaseificação', request.gasificationType);
        
        y += 5;
        doc.setFillColor(245, 245, 245);
        doc.rect(25, y, 160, 6, 'F');
        doc.setFontSize(7);
        doc.setTextColor(0, 64, 128);
        doc.text('CATEGORIA', 27, y + 4);
        doc.text('ATUAIS', 75, y + 4);
        doc.text('2 ANOS', 105, y + 4);
        doc.text('5 ANOS', 135, y + 4);
        doc.text('20 ANOS', 165, y + 4);
        y += 8;

        if (request.gridDataFO02) {
          Object.entries(request.gridDataFO02).forEach(([key, val]: [string, any]) => {
            checkPageBreak(8);
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(8);
            const labels: any = { res: 'Residencial', com: 'Comercial', ind: 'Industrial', gnv: 'GNV', generation: 'Geração' };
            doc.text(labels[key] || key.toUpperCase(), 27, y);
            doc.text(val.atuais?.toString() || '0', 75, y);
            doc.text(val.y2?.toString() || '0', 105, y);
            doc.text(val.y5?.toString() || '0', 135, y);
            doc.text(val.y20?.toString() || '0', 165, y);
            doc.setDrawColor(240, 240, 240);
            doc.line(25, y + 2, 185, y + 2);
            y += 7;
          });
        }
        doc.setDrawColor(220, 220, 220);
        doc.rect(20, startS3, 170, y - startS3 + 2);
      }
      else if (request.formType === 'PE.00492-FO.03') {
        addSectionHeader('Consumo Industrial / GNV (FO.03)');
        const startS3 = y - 3;
        renderField('Mercado', request.marketCategory, true);
        renderField('Ponto Entrega', request.deliveryPoint);
        
        rowY = y;
        renderField('Pico Instantâneo', `${request.instantConsumption || 0} m³/h`, true, rowY);
        renderField('Incremento Nm3/h', `${request.consumptionIncrement || 0} Nm³/h`, false, rowY);
        y += 12;
        
        rowY = y;
        renderField('Horas Trab./Dia', `${request.workHours || 0} h`, true, rowY);
        renderField('Dias Trab./Sem', `${request.workDaysPerWeek || 0} dias`, false, rowY);
        y += 12;

        renderField('Vazão Prevista', `${request.totalPredictedFlow || 0} Nm³/h`, true);
        renderField('Consumo Mensal', `${request.monthlyConsumption || 0} m³`);
        renderField('Pressão Mínima', `${request.minPressure || 0} bar`);
        
        doc.rect(20, startS3, 170, y - startS3 + 2);
      }
      else if (request.formType === 'PE.00492-FO.04') {
        addSectionHeader('Termogeração e Co-Geração (FO.04)');
        const startS3 = y - 3;
        renderField('Nome da UTE', request.uteName);
        renderField('Localização (UTM)', request.mapLocation);
        
        rowY = y;
        renderField('Pressão Máx UTE', `${request.pressMaxUTE || 0} bar`, true, rowY);
        renderField('Pressão Mín UTE', `${request.pressMinUTE || 0} bar`, false, rowY);
        y += 12;

        rowY = y;
        renderField('Pressão Mín UPGN', `${request.pressMinUPGN || 0} bar`, true, rowY);
        renderField('Vazão Inst.', `${request.instantFlow || 0} Nm³/h`, false, rowY);
        y += 12;

        renderField('QDC (Vazão Diária)', `${request.qdc || 0} m³/dia`);
        
        doc.rect(20, startS3, 170, y - startS3 + 2);
      }

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('DOCUMENTO OFICIAL GERADO PELO SISTEMA INTEGRADO DE PLANEJAMENTO DE REDE - PORTAL APR', 105, 285, { align: 'center' });
      doc.text(`NATURGY BRASIL | EMISSÃO: ${new Date().toLocaleString('pt-BR')} | COD: ${request.studyNumber}`, 105, 290, { align: 'center' });

      const blob = doc.output('blob');
      const { error } = await supabase.storage.from('request-files').upload(fullPath, blob, { upsert: true });
      
      if (error) throw error;
      console.log('[StorageService] Professional High-Fidelity PDF uploaded successfully');
    } catch (err) {
      console.error('[StorageService] PDF generation failed:', err);
    }
  },

  moveStorageFolder: async (oldNumber: string, newNumber: string) => {
    try {
      const oldRoot = getRequestPath(oldNumber);
      const newRoot = getRequestPath(newNumber);
      
      if (oldRoot === newRoot) return;
      
      console.log(`[StorageService] Moving storage files from ${oldRoot} to ${newRoot}`);
      
      const categories = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
      
      for (const cat of categories) {
        const oldPath = `${oldRoot}/${cat}`;
        const newPath = `${newRoot}/${cat}`;
        
        const { data: files, error: listErr } = await supabase.storage.from('request-files').list(oldPath);
        
        if (listErr) {
          console.warn(`[StorageService] Could not list files in ${oldPath}`);
          continue;
        }
        
        if (files && files.length > 0) {
          for (const file of files) {
            if (file.name === '.keep') {
              // Automatically remove .keep during move
              await supabase.storage.from('request-files').remove([`${oldPath}/${file.name}`]);
              continue;
            }
            
            const source = `${oldPath}/${file.name}`;
            const dest = `${newRoot}/${cat}/${file.name}`;
            
            const { error: copyErr } = await supabase.storage.from('request-files').copy(source, dest);
            if (!copyErr) {
              await supabase.storage.from('request-files').remove([source]);
            } else {
              console.error(`[StorageService] Error copying ${source} to ${dest}:`, copyErr);
            }
          }
        }
      }
      
      // Attempt to remove empty source folders (Supabase storage doesn't really have empty folders, but we clean up)
      console.log(`[StorageService] Folder migration complete`);
    } catch (err) {
      console.error('[StorageService] Critical error during folder move:', err);
    }
  },

  // === Supabase Storage Helpers ===
  
  syncFilesFromStorage: async (studyNumber: string) => {
    try {
      if (!studyNumber) return null;
      
      const categories = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
      const updatedCategorizedFiles: any = {};
      
      for (const cat of categories) {
        const folderPath = getRequestPath(studyNumber, cat);
        const { data: storageFiles } = await supabase.storage.from('request-files').list(folderPath);
        
        if (storageFiles) {
          updatedCategorizedFiles[cat] = storageFiles
            .filter(f => f.name !== '.keep')
            .map(f => ({
              name: f.name,
              size: f.metadata?.size || 0,
              type: f.metadata?.mimetype || 'application/octet-stream',
              lastModified: new Date(f.created_at).getTime()
            }));
        }
      }

      // Buscar registro atual no banco
      const { data: dbRow } = await supabase
        .from('requests')
        .select('*')
        .eq('study_number', studyNumber)
        .single();
      
      if (!dbRow) return null;

      const currentData = dbRow.data as FormData;
      
      // Verificar se houve mudança real (comparação simples de nomes e quantidades)
      const currentSolicitacao = currentData.selectedFiles || [];
      const newSolicitacao = updatedCategorizedFiles['Solicitacao'] || [];
      
      const hasChanges = JSON.stringify(currentData.categorizedFiles) !== JSON.stringify(updatedCategorizedFiles);

      if (hasChanges) {
        console.log(`[StorageService] Sync triggered for ${studyNumber}. Discrepancy detected.`);
        const finalData = { 
          ...currentData, 
          selectedFiles: newSolicitacao,
          categorizedFiles: updatedCategorizedFiles 
        };

        await supabase
          .from('requests')
          .update({ data: finalData })
          .eq('study_number', studyNumber);
          
        return finalData;
      }
      return currentData;
    } catch (err) {
      console.error('[StorageService] Sync failed:', err);
      return null;
    }
  },

  getRequestFiles: async (studyNumber: string, category: string = 'Solicitacao'): Promise<any[]> => {
    const folderPath = getRequestPath(studyNumber, category);

    // Trigger sync in background or immediately? Let's do it immediately for the first load to ensure accuracy
    await StorageService.syncFilesFromStorage(studyNumber);

    const { data, error } = await supabase.storage
      .from('request-files')
      .list(folderPath);

    if (error) {
      console.error('Error listing files:', error);
      return [];
    }

    return (data || []).map(f => ({
      name: f.name,
      size: f.metadata?.size,
      type: f.metadata?.mimetype,
      category,
      fullPath: `${folderPath}/${f.name}`
    }));
  },

  getFileUrl: async (fullPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('request-files')
      .createSignedUrl(fullPath, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    return data.signedUrl;
  },

  deleteFile: async (fullPath: string) => {
    const { error } = await supabase.storage
      .from('request-files')
      .remove([fullPath]);
    
    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  migrateRequestsToStorage: async (onProgress?: (msg: string) => void) => {
    try {
      if (onProgress) onProgress('Sincronizando e Normalizando pastas...');
      const { data: requests, error } = await supabase.from('requests').select('*');
      if (error) throw error;

      for (const row of (requests || [])) {
        const studyData = row.data as FormData;
        const studyNumber = studyData.studyNumber;
        if (!studyNumber) continue;

        // Se for REVISÃO, o root correto AGORA é com o /REVx (que definimos na nova função getRequestPath)
        const targetRoot = getRequestPath(studyNumber);

        const year = studyNumber.match(/APR-(\d{4})/)?.[1] || new Date().getFullYear().toString();
        const baseStudyId = studyNumber.split('-REV')[0].replace('PROV-', '');
        
        // Caminhos antigos que precisamos varrer para mover para o novo (com REVx)
        const possibleOldRootPaths = [
          `Solicitacoes_APR/${year}/${baseStudyId}`,          // Base study path (antigo) - agora é movido para REV0
          `Solicitacoes_APR/${year}/${baseStudyId}/REV1`,     // Revisão (caminho bugado com REV1 explícito as vezes)
          `Solicitacoes_APR/${year}/PROV-${baseStudyId}`      // Estudo Provisório caminho antigo
        ];

        const categories = ['Solicitacao', 'Resposta', 'Calculos', 'Outros'];
        
        for (const oldRoot of possibleOldRootPaths) {
          if (oldRoot === targetRoot) continue;

          for (const cat of categories) {
            const oldPath = `${oldRoot}/${cat}`;
            const { data: files } = await supabase.storage.from('request-files').list(oldPath);
            
            if (files && files.length > 0) {
              for (const file of files) {
                if (file.name === '.keep') continue;
                const source = `${oldPath}/${file.name}`;
                const dest = `${targetRoot}/${cat}/${file.name}`;
                
                // Copy then remove (move)
                const { error: copyErr } = await supabase.storage.from('request-files').copy(source, dest);
                if (!copyErr) {
                  await supabase.storage.from('request-files').remove([source]);
                }
              }
            }
          }
        }

        // Ensure target root exists - logic removed to prevent .keep pollution
        // Supabase folders are virtual, they "exist" if a file is inside.
      }

      if (onProgress) onProgress('Sincronização e Normalização concluída!');
      return true;
    } catch (err) {
      console.error('Migration error:', err);
      if (onProgress) onProgress('Erro na migração.');
      return false;
    }
  }
};
