
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

export enum StudyStatus {
  PENDENTE = 'Pendente',
  EM_ANALISE = 'Em Análise',
  VALIDADO = 'Validado',
  AGUARDANDO_EXECUCAO = 'Aguardando Execução',
  EM_EXECUCAO = 'Em Execução',
  CONTROLE_QUALIDADE = 'Controle de Qualidade',
  CONCLUIDO = 'Concluído',
  REJEITADO = 'Rejeitado',
  CANCELADO = 'Cancelado'
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

export interface FormData {
  id: string;
  studyNumber: string;
  status: StudyStatus;
  user_id: string;
  formType: FormType;
  rejectionReason?: string;
  assignedTo?: string;
  
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
  pressMaxUTE?: number | '';
  pressMinUTE?: number | '';
  instantFlow?: number | '';
  qdc?: number | '';
  pressMaxUPGN?: number | '';
  pressMinUPGN?: number | '';

  numClientsRes?: number | '';
  flowUnitRes?: number | '';
  totalFlowRes?: number | '';
  numClientsCom?: number | '';
  flowUnitCom?: number | '';
  totalFlowCom?: number | '';

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
  
  // Validation fields
  gasType?: string;
  mapReceived?: boolean;
  relevantStudy?: boolean;
  gniName?: string;
  studySubType?: string;
  difficulty?: string;
  validatorObservations?: string;
}
