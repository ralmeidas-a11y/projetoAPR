
import React from 'react';
import { FormType, FormOption } from './types';

export const FORM_OPTIONS: FormOption[] = [
  {
    id: FormType.RESIDENTIAL_COMMERCIAL,
    label: 'Clientes Residenciais / Comerciais',
    description: 'Estudos de viabilidade para condomínios, residências individuais e pequenos negócios.',
    icon: 'fa-house-user'
  },
  {
    id: FormType.EXPANSION_AREAS,
    label: 'Gaseificações Totais ou Parciais de Áreas em expansão ou novos Municípios',
    description: 'Planejamento de infraestrutura para novas malhas urbanas e distritos municipais.',
    icon: 'fa-city'
  },
  {
    id: FormType.THERMO_GENERATION,
    label: 'Termogeração (UTEs)',
    description: 'Projetos técnicos para Usinas Termelétricas e cogeração de energia de grande porte.',
    icon: 'fa-industry'
  },
  {
    id: FormType.LARGE_CLIENTS,
    label: 'Grandes Clientes (Industrial/GNV/Climatização/Etc.)',
    description: 'Demandas industriais, postos de GNV e sistemas centralizados de climatização.',
    icon: 'fa-gas-pump'
  }
];

export const MUNICIPALITIES_RJ = [
  "Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói",
  "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis",
  "Volta Redonda", "Magé", "Itaboraí", "Mesquita", "Nova Friburgo", "Barra Mansa",
  "Cabo Frio", "Macaé", "Nilópolis", "Teresópolis", "Queimados", "Resende",
  "Angra dos Reis", "Itaguaí", "Araruama", "Maricá", "Rio das Ostras"
].sort();

export const MUNICIPALITIES_SP = [
  "São Paulo", "Guarulhos", "Campinas", "São Bernardo do Campo", "Santo André",
  "São José dos Campos", "Osasco", "Ribeirão Preto", "Sorocaba", "Mauá",
  "São José do Rio Preto", "Mogi das Cruzes", "Santos", "Diadema", "Jundiaí",
  "Piracicaba", "Carapicuíba", "Bauru", "Itaquaquecetuba", "São Vicente",
  "Franca", "Guarujá", "Praia Grande", "Taubaté", "Limeira", "Suzano"
].sort();

export const REQUESTER_AREAS = [
  "Delegação Centro Sul",
  "Delegação Comercial Lagos e Zona Fluminense",
  "Delegação Leste",
  "Delegação Leste Fluminense Litorânea",
  "Delegação Leste Fluminense Serrana",
  "Delegação Norte",
  "Delegação Norte Fluminense Litorânea",
  "Delegação Oeste",
  "Delegação Sul Fluminense e Baixada",
  "GENE - Gerência de Novas Edificações",
  "GERAT-Regulação e Aprovisionamento de Tarifas",
  "Gerência Comercial - GNSPS",
  "GESET - Gerência de Novas Edificações Rio",
  "GESET-LE - Gerência de Serviços Técnicos LESTE",
  "Operacional - SPS",
  "ST Zona Metropolitana RJ"
].sort();

// Domínios corporativos permitidos para autenticação
// Adicione novos domínios conforme necessário
export const CORPORATE_EMAIL_DOMAINS = [
  '@naturgy.com',           // Principal
  '@br.gasnatural.com',     // Corporativo Brasil
  '@gasnatural.com',        // Corporativo Internacional
  '@naturgygroup.com',      // Grupo Naturgy
  '@gmail.com',             // Adicionado para teste conforme solicitado
];

// Função helper para validar domínio corporativo
export const isValidCorporateEmail = (email: string): boolean => {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return CORPORATE_EMAIL_DOMAINS.some(domain => lowerEmail.endsWith(domain));
};

// Função helper para obter lista de domínios formatada para mensagens
export const getFormattedDomains = (): string => {
  return CORPORATE_EMAIL_DOMAINS.map(d => `${d}`).join(' ou ');
};
export const APP_NAME = 'Análise de Planificação de Rede';
import logoImg from './logo.png';

export const NaturgyLogo = () => {
  return (
    <div className="flex items-center justify-center">
      <img
        src={logoImg}
        alt="Naturgy Logo"
        style={{
          maxWidth: '180px',
          height: 'auto',
          objectFit: 'contain',
          backgroundColor: 'transparent'
        }}
        onError={(e) => {
          console.error('Erro ao carregar logo:', e);
        }}
      />
    </div>
  );
};

export const HeaderTitle = () => (
  <h1 className="text-2xl md:text-3xl font-bold text-[#004080] leading-tight">
    Solicitação de Estudo de Rede de Distribuição de Gás
  </h1>
);
