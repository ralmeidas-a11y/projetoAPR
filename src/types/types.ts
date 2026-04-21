
export enum FormType {
  RESIDENTIAL_COMMERCIAL = 'PE.00492-FO.01',
  EXPANSION_AREAS = 'PE.00492-FO.02',
  THERMO_GENERATION = 'PE.00492-FO.04',
  LARGE_CLIENTS = 'PE.00492-FO.03'
}

export enum UserRole {
  SOLICITANTE = 'Solicitante',
  ANALISTA = 'Analista',
  ADM = 'Administrador'
}

export interface InterconnectionPoint {
  id: string;
  pressure: string;
  material: string;
  diameter: string;
  location: string;
  comment: string;
}

export interface PlannedExtension {
  id: string;
  material: string;
  diameter: string;
  extension: number | '';
  networkType: string;
  valves: number;
  pressure: string;
  gasType: string;
  status: string;
}

export enum StudyStatus {
  PENDENTE = 'Pendente',
  EM_ANALISE = 'Em Análise',
  VALIDADO = 'Validado',
  AGUARDANDO_EXECUCAO = 'Aguardando Execução',
  EM_EXECUCAO = 'Em Execução',
  AGUARDANDO_INFORMACAO = 'Aguardando Informações',
  CONTROLE_QUALIDADE = 'Controle de Qualidade',
  APROVADO_CQ = 'Aprovado pelo CQ',
  REPROVADO_CQ = 'Reprovado pelo CQ',
  ENVIADO_SEM_CQ = 'Enviado sem CQ',
  CONCLUIDO = 'Concluído',
  REJEITADO = 'Rejeitado',
  CANCELADO = 'Cancelado',
  ABERTO = 'Aberto'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone?: string;
  area?: string;
  naturgyUnit?: string;
  profileComplete?: boolean;
  permissions?: ('validar' | 'executar' | 'controle_qualidade')[];
  folderPath?: string;
  createdAt?: string;
  lastAccess?: string;
  requiresPasswordChange?: boolean;
  password?: string;
  company?: string;
  roleDescription?: string;
  gb?: string;
  sap?: string;
  isActive?: boolean;
}

export interface ElectronAPI {
  getCorporateEmail: () => Promise<string | null>;
  checkUserFolder: (userName: string) => Promise<{ exists: boolean; synced: boolean; userFolderPath?: string }>;
  createUserFolder: (userName: string) => Promise<{ success: boolean; userFolderPath: string; error?: string }>;
  createRequestFolder: (folderData: any) => Promise<{ success: boolean; baseFolderPath?: string; message: string }>;
  openFolder: (folderPath: string) => Promise<{ success: boolean; message: string }>;
  listFolderContents: (folderPath: string) => Promise<{ success: boolean; files: any[] }>;
  openDevTools: () => Promise<{ success: boolean; message: string }>;
  readFile: (filePath: string) => Promise<{ success: boolean; base64?: string; mime?: string; name?: string; message?: string }>;
  minimizeWindow: () => Promise<{ success: boolean; message?: string }>;
  closeApp: () => Promise<{ success: boolean; message?: string }>;
  saveFile: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; message?: string; targetPath?: string }>;
  saveFileData: (fileName: string, base64Data: string, targetDir: string) => Promise<{ success: boolean; targetPath?: string; message?: string }>;
}

declare global {
  interface Window {
    api?: ElectronAPI;
  }
}

export interface FolderAccess {
  name: string;
  path: string;
  visibleTo: UserRole[];
  label: string;
  icon: string;
}

export interface FormOption {
  id: FormType;
  label: string;
  description: string;
  icon: string;
}

export interface QCIteration {
  status: string;
  date: string;
  reviewer?: string;
}

export interface QCControlData {
  qcRequestDate?: string;
  qcValidationDate?: string;
  qcStatusCQ?: 'Definir' | 'Aprovado' | 'Reprovado';
  qcSupervisor?: string;
  qcCriticalFailures?: Record<string, number>;
  qcSecondaryFailures?: Record<string, number>;
  qcIterations?: QCIteration[];
  qcComments?: string;
  qcFinalStatus?: string;
  fromQCModal?: boolean; // Flag para indicar que veio do modal de CQ
}

export interface FormData {
  id: string;
  studyNumber: string;
  status: StudyStatus;
  user_id: string;
  formType: FormType;
  rejectionReason?: string;
  assignedTo?: string;
  createdAt?: string;
  
  // Dados do Solicitante
  naturgyUnit?: string;
  studyType?: string;
  previousStudy?: string;
  requesterName?: string;
  requestDate?: string;
  requesterArea?: string;
  phone?: string;
  email?: string;

  // Dados Base do Estudo
  studyTitle?: string;
  marketCategory?: string;
  address?: string;
  number?: string;
  city?: string;
  neighborhood?: string;
  empresa?: string;
  networkType?: string;
  mapLocation?: string;
  pressure?: string;
  fileType?: string;

  // FO.02
  state?: string;
  gasificationType?: string;
  gridDataFO02?: {
    [key: string]: {
      atuais: number | '';
      y2: number | '';
      y5: number | '';
      y20: number | '';
      totalQ: number | '';
    }
  };

  // FO.03 (Large Clients - industrial/GNV/etc)
  clientName?: string;
  deliveryPoint?: string;
  instantConsumption?: number | '';
  workHours?: number | '';
  monthlyConsumption?: number | '';
  consumptionIncrement?: number | '';
  workDaysPerWeek?: number | '';
  totalPredictedFlow?: number | '';
  minPressure?: number | '';
  suggestedPressureRange?: string;
  
  sapIsuCode?: string;
  industryName?: string;
  currentConsumption?: number | '';
  contractualPressure?: number | '';
  currentPressureRange?: string;

  // FO.04 (UTE - Termogeração)
  uteName?: string;
  gasPressureLevel?: number | '';
  averageFlow?: number | '';
  peakFlow?: number | '';
  operationStartDate?: string;
  pressMaxUTE?: number | '';

  pressMinUTE?: number | '';
  instantFlow?: number | '';
  qdc?: number | '';
  pressMaxUPGN?: number | '';
  pressMinUPGN?: number | '';

  numClientsRes?: number | '';
  numClientsCom?: number | '';
  unitFlow?: number | '';
  flowUnitRes?: number | ''; // Added for backward compatibility
  penetrationFactor?: number | '';
  diversificationFactor?: number | '';
  totalFlowRes?: number | '';
  totalFlowCom?: number | '';
  totalClients?: number | '';
  penetration?: number | '';
  diversification?: number | '';
  totalFlow?: number | '';
  technicalMetadata?: {
    calculatedPressure?: string;
    [key: string]: any;
  };
  calcMode?: 'auto' | 'manual';

  deadlineDays?: number;
  estimatedDeliveryDate?: string;
  comments?: string;

  selectedFiles?: any[]; // Arquivos enviados pelo solicitante
  categorizedFiles?: { [category: string]: any[] }; // Arquivos gerados pelo analista (Resposta, Cálculos, Outros)
  executionStartTime?: number;
  totalExecutionTime?: number; // em segundos
  startedAt?: string;
  completedAt?: string;
  hasExpansion?: boolean;
  updatedAt?: string;
  lastAnalystAlertDate?: string; // Data (YYYY-MM-DD) do último alerta exibido ao analista
  lastAdminAlertDate?: string;   // Data (YYYY-MM-DD) do último alerta exibido ao ADM
  alertConfirmations?: string[]; // Histórico de confirmações (Read Receipts)
  
  // Validation fields
  gasType?: string;
  mapReceived?: boolean;
  relevantStudy?: boolean;
  gniName?: string;
  studySubType?: string;
  difficulty?: string;
  validatorObservations?: string;
  validationDate?: string;
  networkGroup?: number;
  networkDescription?: string;
  responsePressureBase?: string;
  responseMaxPo?: number;
  responseMin?: number;
  responseGarantia?: number;
  responseUnit?: string;
  responseCalculatedPressure?: number | string;
  responseObservations?: string;
  
  interconnectionPoints?: InterconnectionPoint[];
  plannedExtensions?: PlannedExtension[];

  // Regulator Sizing
  regSizingActive?: boolean;
  regSizingFlow?: string;
  regSizingCost?: string;
  regSizingInPress?: string;
  regSizingOutPress?: string;
  regSizingFutureFlow?: string;
  analystCompany?: string;
  analystRole?: string;
  analystGB?: string;
  cartaGeneratedAt?: string;

  // Quality Control
  qcData?: QCControlData;
  analystName?: string;
  assignedToName?: string;
  holdReason?: string;
  holdResponse?: string;
  holdResponseSeen?: boolean;
  holdRequestSeen?: boolean;
  qcRequestDate?: string;
  responseMemo?: string;
}
