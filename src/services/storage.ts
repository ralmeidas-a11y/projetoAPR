import { getGMT3ISOString } from '../utils/utils';
import { PRESSURE_BASES } from '../constants/constants';
import logoImg from '../assets/logo.png';
import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import { User, UserRole, FormData, StudyStatus } from '../types/types';

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
      .select('id, name, email, role, area, naturgy_unit, password, requires_password_change, permissions, created_at, company, role_description, gb')
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
      createdAt: u.created_at,
      company: u.company,
      roleDescription: u.role_description,
      gb: u.gb
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
      company: user.company,
      role_description: user.roleDescription,
      gb: user.gb,
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
      company: data.company,
      roleDescription: data.role_description,
      gb: data.gb,
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

  // === Helper for Integrated Table Mapping ===
  mapToIntegratedRequest: (request: FormData): any => {
    // Helper to get pressure base details
    const pBase = PRESSURE_BASES.find(b => b.base === request.responsePressureBase || b.base === request.pressure);
    
    // Helper for Area/Organ mapping
    const areaMapping: Record<string, number> = {
      "Operacional - SPS": 931,
      "ST Zona Metropolitana RJ": 915,
      "GESET-LE - Gerência de Serviços Técnicos LESTE": 914,
      "GESET - Gerência de Novas Edificações Rio": 913,
      "Gerência Comercial - GNSPS": 912,
      "GERAT-Regulação e Aprovisionamento de Tarifas": 911,
      "GENE - Gerência de Novas Edificações": 910
    };

    // Helper for Study Type mapping (TIPO_EST)
    const typeMapping: Record<string, number> = {
      "Residencial": 310,
      "Comercial": 320,
      "Industrial": 330,
      "GNV": 340,
      "Termogeração": 350
    };

    // Status mapping
    const statusMapping: Record<string, number> = {
      [StudyStatus.PENDENTE]: 100,
      [StudyStatus.EM_ANALISE]: 150,
      [StudyStatus.AGUARDANDO_EXECUCAO]: 200,
      [StudyStatus.EM_EXECUCAO]: 300,
      [StudyStatus.AGUARDANDO_INFORMACAO]: 400,
      [StudyStatus.CONCLUIDO]: 500,
      [StudyStatus.REJEITADO]: 600,
      [StudyStatus.CANCELADO]: 700
    };

    // Calculation for DiaOpeMes (Work days per week * 4 weeks approx)
    const workDays = typeof request.workDaysPerWeek === 'number' ? request.workDaysPerWeek : 0;
    const diaOpeMes = workDays * 4;

    // Sum economic data
    const numRes = (typeof request.numClientsRes === 'number' ? request.numClientsRes : 0);
    const numComInd = (typeof request.numClientsCom === 'number' ? request.numClientsCom : 0);
    const vazaoComInd = (typeof request.totalFlowCom === 'number' ? request.totalFlowCom : 0) + 
                        (typeof request.instantConsumption === 'number' ? request.instantConsumption : 0);

    const getDiversificationFactor = (total: number) => {
      if (total <= 0) return 0;
      if (total < 100) return 1.00;
      if (total < 250) return 0.88;
      if (total < 500) return 0.82;
      if (total < 750) return 0.75;
      if (total < 1000) return 0.63;
      if (total < 2000) return 0.56;
      if (total < 3000) return 0.50;
      return 0.47;
    };

    // Difficulty mapping
    const difficultyMapping: Record<string, number> = {
      "Fácil": 1,
      "Médio": 2,
      "Difícil": 3
    };

    // Generate a numeric ID from UUID if it's not already numeric
    // Using a simple hash if request.id is UUID
    let numericId = 0;
    if (request.id) {
       if (/^\d+$/.test(request.id)) {
         numericId = parseInt(request.id);
       } else {
         // Hash UUID to numeric
         let hash = 0;
         for (let i = 0; i < request.id.length; i++) {
           hash = ((hash << 5) - hash) + request.id.charCodeAt(i);
           hash |= 0;
         }
         numericId = Math.abs(hash);
       }
    }

    return {
      "id": numericId,
      "NRO_ESTUDO": request.studyNumber,
      "FK_MODELO": "",
      "EMPRESA": request.naturgyUnit === 'SPS' ? 'SPS' : (request.city === 'Rio de Janeiro' ? 'CEG' : 'CEGRIO'),
      "DAT_EN_SEP": request.requestDate || "",
      "NRO_EST_AN": request.previousStudy || request.studyNumber,
      "SOL_ORGAO": areaMapping[request.requesterArea || ""] || 0,
      "SOL_RESPON": request.requesterName || "",
      "MEMORANDO": "",
      "MEMO_NUM": "",
      "MEMO_DATA": "",
      "TITULO": request.studyTitle || "",
      "LOCALIZ": `${request.address || ""}${request.number ? ", " + request.number : ""}`,
      "GRUPO_EST": request.networkGroup || 0,
      "TIPO_EST": typeMapping[request.studyType || ""] || 0,
      "DAT_IN_SEP": request.startedAt || "",
      "DAT_SA_SEP": request.completedAt || "",
      "PRESSAO": request.pressure || "",
      "RESP_SEPLA": request.analystGB || "",
      "STATUS": statusMapping[request.status] || 0,
      "OBSERVS": `${request.comments || ""}${request.validatorObservations ? "\nValid.: " + request.validatorObservations : ""}`,
      "OPERADOR_M": "",
      "DATA_M": "",
      "Bairro": request.neighborhood || "",
      "Municipio": request.city || "",
      "TPGASS": request.gasType || "",
      "PRESGAS": request.pressure || "",
      "NumEconomias": numRes,
      "VazaoSol": request.totalFlowRes || 0,
      "VazaoInsta": request.instantConsumption || 0,
      "UnidSol": "m³/h",
      "ConsMens": request.monthlyConsumption || 0,
      "QDC": request.qdc || 0,
      "PresSolMax": pBase?.pmax || 0,
      "PresSolMin": pBase?.pmin || 0,
      "HorOpeIni": "",
      "HorOpeFin": "",
      "DiaOpeMes": diaOpeMes,
      "ObsEstudSol": "",
      "PresClieMax": request.responsePressureBase ? `${pBase?.pmax || ""} bar` : "",
      "PresClieMin": request.responsePressureBase ? `${pBase?.pmin || ""} bar` : "",
      "PresClieGarant": request.responsePressureBase ? `${pBase?.pgarantia || ""} bar` : "",
      "CODCARSEP": 0,
      "PresSol": request.pressure || "",
      "StatusEntrega": "",
      "ObservaResp": request.responseObservations || "",
      "RegulardoSN": request.regSizingActive || false,
      "ReguladroVazao": request.regSizingFlow || "",
      "HoraFunciona": "",
      "CriadorRegistro": "",
      "DataCriaReg": "",
      "PressaoResposta": request.responsePressureBase || "",
      "CustoRegulador": request.regSizingCost || "0,00",
      "PressaoEntrada": parseFloat(request.regSizingInPress || "0") || 0,
      "unidPresEnt": "bar",
      "PressaoSaida": parseFloat(request.regSizingOutPress || "0") || 0,
      "unidPresSai": "bar",
      "VazaoFutura": parseFloat(request.regSizingFutureFlow || "0") || 0,
      "fd": getDiversificationFactor(numRes),
      "fp": 1,
      "vu": 0.09,
      "Diversificar": request.totalFlowRes || 0,
      "dtEntregaPrevista": request.estimatedDeliveryDate || "",
      "EmailContato": request.email || "",
      "EntradaReal": request.requestDate || "",
      "carta_sepla": "",
      "EMAIL_ENVIADO": request.status === StudyStatus.CONCLUIDO,
      "DAT_PREN_INI_OP": "",
      "CROQUI": request.mapReceived || false,
      "PRESCALC": typeof request.responseCalculatedPressure === 'number' ? request.responseCalculatedPressure : 0,
      "PRAZ_EST_CONST": 0,
      "CONSUMO_ESTIMADO": 0,
      "PRESSAO_INICIAL": 0,
      "PRESSAO_FINAL": 0,
      "PRESSAO_ABSOLUTA": 0,
      "PRESSAO_ATM": 0,
      "CODIGO_PASTA": 0,
      "TIP_ES": 0,
      "GRUPORED": request.networkGroup || 0,
      "SIGEP": "FALSO",
      "BAIXA_SIGEP": "FALSO",
      "Preparacion": "",
      "Simulacao": "",
      "Supervision": "",
      "Tempo": "",
      "TempoEstimado": "",
      "RedeExtTotal": "",
      "OperadorConta": "",
      "IDSIGEP": request.studyNumber,
      "IDSIGEPVINC": "",
      "NumEconomiasComIndEtc": numComInd,
      "VazaoSolComIndEtc": vazaoComInd,
      "UnidSolComIndEtc": "m³/h",
      "ESTRERERIDO": "",
      "GrauDificult": difficultyMapping[request.difficulty || ""] || 0,
      "REGGNV": 0,
      "EstudoRelevante": request.relevantStudy || false
    };
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
      .select(`
        *,
        interconnection_points(*),
        planned_extensions(*),
        fo02_grid_data(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      return [];
    }

    return (data || []).map(r => {
      const formData: FormData = {
        ...r.data, // Fallback e metadados de arquivos
        id: r.id,
        studyNumber: r.study_number,
        status: r.status as StudyStatus,
        user_id: r.user_id,
        formType: r.form_type,
        year: r.year,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        holdReason: r.hold_reason || r.data?.holdReason,
        holdResponse: r.hold_response || r.data?.holdResponse,
        holdResponseSeen: r.hold_response_seen ?? r.data?.holdResponseSeen,
        
        // Mapeamento de colunas para Camel Case
        naturgyUnit: r.naturgy_unit || r.data?.naturgyUnit,
        studyType: r.study_type || r.data?.studyType,
        previousStudy: r.previous_study || r.data?.previousStudy,
        requesterName: r.requester_name || r.data?.requesterName,
        requestDate: r.request_date || r.data?.requestDate,
        requesterArea: r.requester_area || r.data?.requesterArea,
        phone: r.phone || r.data?.phone,
        email: r.email || r.data?.email,
        studyTitle: r.study_title || r.data?.studyTitle,
        marketCategory: r.market_category || r.data?.marketCategory,
        address: r.address || r.data?.address,
        number: r.number || r.data?.number,
        city: r.city || r.data?.city,
        neighborhood: r.neighborhood || r.data?.neighborhood,
        networkType: r.network_type || r.data?.networkType,
        mapLocation: r.map_location || r.data?.mapLocation,
        pressure: r.pressure || r.data?.pressure,
        fileType: r.file_type || r.data?.fileType,
        state: r.state || r.data?.state,
        gasificationType: r.gasification_type || r.data?.gasificationType,
        clientName: r.client_name || r.data?.clientName,
        deliveryPoint: r.delivery_point || r.data?.deliveryPoint,
        instantConsumption: r.instant_consumption || r.data?.instantConsumption,
        workHours: r.work_hours || r.data?.workHours,
        monthlyConsumption: r.monthly_consumption || r.data?.monthlyConsumption,
        consumptionIncrement: r.consumption_increment || r.data?.consumptionIncrement,
        workDaysPerWeek: r.work_days_per_week || r.data?.workDaysPerWeek,
        totalPredictedFlow: r.total_predicted_flow || r.data?.totalPredictedFlow,
        minPressure: r.min_pressure || r.data?.minPressure,
        suggestedPressureRange: r.suggested_pressure_range || r.data?.suggestedPressureRange,
        sapIsuCode: r.sap_isu_code || r.data?.sapIsuCode,
        industryName: r.industry_name || r.data?.industryName,
        currentConsumption: r.current_consumption || r.data?.currentConsumption,
        contractualPressure: r.contractual_pressure || r.data?.contractualPressure,
        currentPressureRange: r.current_pressure_range || r.data?.currentPressureRange,
        uteName: r.ute_name || r.data?.uteName,
        pressMaxUTE: r.press_max_ute || r.data?.pressMaxUTE,
        pressMinUTE: r.press_min_ute || r.data?.pressMinUTE,
        instantFlow: r.instant_flow || r.data?.instantFlow,
        qdc: r.qdc || r.data?.qdc,
        pressMaxUPGN: r.press_max_upgn || r.data?.pressMaxUPGN,
        pressMinUPGN: r.press_min_upgn || r.data?.pressMinUPGN,
        numClientsRes: r.num_clients_res || r.data?.numClientsRes,
        flowUnitRes: r.flow_unit_res || r.data?.flowUnitRes,
        totalFlowRes: r.total_flow_res || r.data?.totalFlowRes,
        numClientsCom: r.num_clients_com || r.data?.numClientsCom,
        flowUnitCom: r.flow_unit_com || r.data?.flowUnitCom,
        totalFlowCom: r.total_flow_com || r.data?.totalFlowCom,
        deadlineDays: r.deadline_days || r.data?.deadlineDays,
        estimatedDeliveryDate: r.estimated_delivery_date || r.data?.estimatedDeliveryDate,
        comments: r.comments || r.data?.comments,
        executionStartTime: r.execution_start_time || r.data?.executionStartTime,
        totalExecutionTime: r.total_execution_time || r.data?.totalExecutionTime,
        startedAt: r.started_at || r.data?.startedAt,
        completedAt: r.completed_at || r.data?.completedAt,
        hasExpansion: r.has_expansion ?? r.data?.hasExpansion,
        gasType: r.gas_type || r.data?.gasType,
        mapReceived: r.map_received ?? r.data?.mapReceived,
        relevantStudy: r.relevant_study ?? r.data?.relevantStudy,
        gniName: r.gni_name || r.data?.gniName,
        studySubType: r.study_sub_type || r.data?.studySubType,
        difficulty: r.difficulty || r.data?.difficulty,
        validatorObservations: r.validator_observations || r.data?.validatorObservations,
        networkGroup: r.network_group || r.data?.networkGroup,
        networkDescription: r.network_description || r.data?.networkDescription,
        responsePressureBase: r.response_pressure_base || r.data?.responsePressureBase,
        responseMaxPo: r.response_max_po || r.data?.responseMaxPo,
        responseMin: r.response_min || r.data?.responseMin,
        responseGarantia: r.response_garantia || r.data?.responseGarantia,
        responseUnit: r.response_unit || r.data?.responseUnit,
        responseCalculatedPressure: r.response_calculated_pressure || r.data?.responseCalculatedPressure,
        responseObservations: r.response_observations || r.data?.responseObservations,
        regSizingActive: r.reg_sizing_active ?? r.data?.regSizingActive,
        regSizingFlow: r.reg_sizing_flow || r.data?.regSizingFlow,
        regSizingCost: r.reg_sizing_cost || r.data?.regSizingCost,
        regSizingInPress: r.reg_sizing_in_press || r.data?.regSizingInPress,
        regSizingOutPress: r.reg_sizing_out_press || r.data?.regSizingOutPress,
        regSizingFutureFlow: r.reg_sizing_future_flow || r.data?.regSizingFutureFlow,
        analystCompany: r.analyst_company || r.data?.analystCompany,
        analystRole: r.analyst_role || r.data?.analystRole,
        analystGB: r.analyst_gb || r.data?.analystGB,
        cartaGeneratedAt: r.carta_generated_at || r.data?.cartaGeneratedAt,
        qcData: r.qc_data || r.data?.qcData,
        analystName: r.analyst_name || r.data?.analystName,
        qcRequestDate: r.qc_request_date || r.data?.qcRequestDate
      };

      // Interconnection Points
      if (r.interconnection_points && r.interconnection_points.length > 0) {
        formData.interconnectionPoints = r.interconnection_points.map((ip: any) => ({
          id: ip.id,
          pressure: ip.pressure,
          material: ip.material,
          diameter: ip.diameter,
          location: ip.location,
          comment: ip.comment
        }));
      }

      // Planned Extensions
      if (r.planned_extensions && r.planned_extensions.length > 0) {
        formData.plannedExtensions = r.planned_extensions.map((pe: any) => ({
          id: pe.id,
          material: pe.material,
          diameter: pe.diameter,
          extension: pe.extension,
          networkType: pe.network_type,
          valves: pe.valves,
          pressure: pe.pressure,
          gasType: pe.gas_type,
          status: pe.status
        }));
      }

      // FO02 Grid Data
      if (r.fo02_grid_data && r.fo02_grid_data.length > 0) {
        const gridData: any = {};
        r.fo02_grid_data.forEach((gd: any) => {
          gridData[gd.category] = {
            atuais: gd.atuais,
            y2: gd.y2,
            y5: gd.y5,
            y20: gd.y20,
            totalQ: gd.total_q
          };
        });
        formData.gridDataFO02 = gridData;
      }

      return formData;
    });
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
      hold_reason: request.holdReason,
      hold_response: request.holdResponse,
      hold_response_seen: request.holdResponseSeen ?? false,
      updated_at: getGMT3ISOString(),
      
      // Novas Colunas
      naturgy_unit: request.naturgyUnit,
      study_type: request.studyType,
      previous_study: request.previousStudy,
      requester_name: request.requesterName,
      request_date: request.requestDate || null,
      requester_area: request.requesterArea,
      phone: request.phone,
      email: request.email,
      study_title: request.studyTitle,
      market_category: request.marketCategory,
      address: request.address,
      number: request.number,
      city: request.city,
      neighborhood: request.neighborhood,
      network_type: request.networkType,
      map_location: request.mapLocation,
      pressure: request.pressure,
      file_type: request.fileType,
      state: request.state,
      gasification_type: request.gasificationType,
      client_name: request.clientName,
      delivery_point: request.deliveryPoint,
      instant_consumption: request.instantConsumption || null,
      work_hours: request.workHours || null,
      monthly_consumption: request.monthlyConsumption || null,
      consumption_increment: request.consumptionIncrement || null,
      work_days_per_week: request.workDaysPerWeek || null,
      total_predicted_flow: request.totalPredictedFlow || null,
      min_pressure: request.minPressure || null,
      suggested_pressure_range: request.suggestedPressureRange,
      sap_isu_code: request.sapIsuCode,
      industry_name: request.industryName,
      current_consumption: request.currentConsumption || null,
      contractual_pressure: request.contractualPressure || null,
      current_pressure_range: request.currentPressureRange,
      ute_name: request.uteName,
      press_max_ute: request.pressMaxUTE || null,
      press_min_ute: request.pressMinUTE || null,
      instant_flow: request.instantFlow || null,
      qdc: request.qdc || null,
      press_max_upgn: request.pressMaxUPGN || null,
      press_min_upgn: request.pressMinUPGN || null,
      num_clients_res: request.numClientsRes || null,
      flow_unit_res: request.flowUnitRes || null,
      total_flow_res: request.totalFlowRes || null,
      num_clients_com: request.numClientsCom || null,
      flow_unit_com: request.flowUnitCom || null,
      total_flow_com: request.totalFlowCom || null,
      deadline_days: request.deadlineDays || null,
      estimated_delivery_date: request.estimatedDeliveryDate || null,
      comments: request.comments,
      execution_start_time: request.executionStartTime || null,
      total_execution_time: request.totalExecutionTime || null,
      started_at: request.startedAt || null,
      completed_at: request.completedAt || null,
      has_expansion: request.hasExpansion ?? null,
      gas_type: request.gasType,
      map_received: request.mapReceived ?? null,
      relevant_study: request.relevantStudy ?? null,
      gni_name: request.gniName,
      study_sub_type: request.studySubType,
      difficulty: request.difficulty,
      validator_observations: request.validatorObservations,
      network_group: request.networkGroup || null,
      network_description: request.networkDescription,
      response_pressure_base: request.responsePressureBase,
      response_max_po: request.responseMaxPo || null,
      response_min: request.responseMin || null,
      response_garantia: request.responseGarantia || null,
      response_unit: request.responseUnit,
      response_calculated_pressure: typeof request.responseCalculatedPressure === 'number' ? request.responseCalculatedPressure : null,
      response_observations: request.responseObservations,
      reg_sizing_active: request.regSizingActive ?? null,
      reg_sizing_flow: request.regSizingFlow,
      reg_sizing_cost: request.regSizingCost,
      reg_sizing_in_press: request.regSizingInPress,
      reg_sizing_out_press: request.regSizingOutPress,
      reg_sizing_future_flow: request.regSizingFutureFlow,
      analyst_company: request.analystCompany,
      analyst_role: request.analystRole,
      analyst_gb: request.analystGB,
      carta_generated_at: request.cartaGeneratedAt || null,
      qc_data: request.qcData || null,
      analyst_name: request.analystName,
      qc_request_date: request.qcRequestDate || null
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
          .filter(f => cat !== 'Resposta' || !f.name.startsWith('CARTA_')) // Não deletar a carta resposta recém gerada
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

    // Sincronizar Tabelas Secundárias
    try {
      // 1. Interconnection Points
      await supabase.from('interconnection_points').delete().eq('request_id', request.id);
      if (request.interconnectionPoints && request.interconnectionPoints.length > 0) {
        const ipRows = request.interconnectionPoints.map(ip => ({
          request_id: request.id,
          pressure: ip.pressure,
          material: ip.material,
          diameter: ip.diameter,
          location: ip.location,
          comment: ip.comment
        }));
        await supabase.from('interconnection_points').insert(ipRows);
      }

      // 2. Planned Extensions
      await supabase.from('planned_extensions').delete().eq('request_id', request.id);
      if (request.plannedExtensions && request.plannedExtensions.length > 0) {
        const peRows = request.plannedExtensions.map(pe => ({
          request_id: request.id,
          material: pe.material,
          diameter: pe.diameter,
          extension: pe.extension || null,
          network_type: pe.networkType,
          valves: pe.valves || 0,
          pressure: pe.pressure,
          gas_type: pe.gasType,
          status: pe.status
        }));
        await supabase.from('planned_extensions').insert(peRows);
      }

      // 3. Grid Data (FO.02)
      await supabase.from('fo02_grid_data').delete().eq('request_id', request.id);
      if (request.gridDataFO02) {
        const gdRows = Object.entries(request.gridDataFO02).map(([cat, val]) => ({
          request_id: request.id,
          category: cat,
          atuais: val.atuais || null,
          y2: val.y2 || null,
          y5: val.y5 || null,
          y20: val.y20 || null,
          total_q: val.totalQ || null
        }));
        await supabase.from('fo02_grid_data').insert(gdRows);
      }
    } catch (syncErr) {
      console.warn('[StorageService] Erro ao sincronizar tabelas secundárias:', syncErr);
    }
    
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

    // Sincronizar com Tabela Integrada
    try {
      const integratedRow = StorageService.mapToIntegratedRequest(request);
      await supabase.from('integrated_requests').upsert(integratedRow);
    } catch (intErr) {
      console.warn('[StorageService] Erro ao sincronizar com tabela integrada:', intErr);
    }

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

  uploadFile: async (studyNumber: string, category: string, file: File) => {
    const folderPath = getRequestPath(studyNumber, category);
    const filePath = `${folderPath}/${file.name}`;
    const { error } = await supabase.storage
      .from('request-files')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;
  },

  uploadCartaResposta: async (request: FormData, pdfBlob: Blob) => {
    try {
      const folderPath = getRequestPath(request.studyNumber, 'Resposta');
      const fileName = `CARTA_${request.studyNumber.replace('PROV-', '')}.pdf`;
      const fullPath = `${folderPath}/${fileName}`;
      
      const { error } = await supabase.storage
        .from('request-files')
        .upload(fullPath, pdfBlob, { upsert: true });

      if (error) throw error;
      console.log('[StorageService] Carta Resposta uploaded successfully to', fullPath);
      return true;
    } catch (err) {
      console.error('[StorageService] Error uploading Carta Resposta:', err);
      throw err;
    }
  },

  deleteCartaResposta: async (studyNumber: string) => {
    try {
      const folderPath = getRequestPath(studyNumber, 'Resposta');
      const fileName = `CARTA_${studyNumber.replace('PROV-', '')}.pdf`;
      const fullPath = `${folderPath}/${fileName}`;
      
      const { error } = await supabase.storage
        .from('request-files')
        .remove([fullPath]);

      if (error) throw error;
      console.log('[StorageService] Carta Resposta deleted successfully:', fullPath);
      return true;
    } catch (err) {
      console.error('[StorageService] Error deleting Carta Resposta:', err);
      return false;
    }
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
