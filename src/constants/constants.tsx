
import React from 'react';
import { FormType, FormOption } from '../types/types';

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
import logoImg from '../assets/logo.png';

export const NaturgyLogo = () => {
  return (
    <div className="flex items-center justify-center">
      <img
        src={logoImg}
        alt="Naturgy Logo"
        style={{
          maxWidth: '150px',
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

export const NETWORK_GROUPS = [
  { "grupoRede": 0, "descricao": "Não Definido ou Inexistente" },
  { "grupoRede": 10001, "descricao": "City Gate Guapimirim" },
  { "grupoRede": 10002, "descricao": "City Gate Pirai" },
  { "grupoRede": 10003, "descricao": "City Gate ESBAMA" },
  { "grupoRede": 10004, "descricao": "City Gate Resende" },
  { "grupoRede": 10005, "descricao": "City Gate Rio das Flores" },
  { "grupoRede": 10006, "descricao": "City Norte Fluminense" },
  { "grupoRede": 10007, "descricao": "Mário Lago" },
  { "grupoRede": 10008, "descricao": "GASCABO" },
  { "grupoRede": 10009, "descricao": "GASCAM" },
  { "grupoRede": 10010, "descricao": "City Gate Campos dos Goytacazes" },
  { "grupoRede": 10011, "descricao": "City Gate TEVOL" },
  { "grupoRede": 10012, "descricao": "Sete Bocas" },
  { "grupoRede": 10013, "descricao": "Rede Alta Grande Rio I" },
  { "grupoRede": 10014, "descricao": "City Gate Reduc" },
  { "grupoRede": 10015, "descricao": "ER Presidente Kennedy" },
  { "grupoRede": 10016, "descricao": "City Gate Japeri" },
  { "grupoRede": 10017, "descricao": "ER Itambi" },
  { "grupoRede": 10018, "descricao": "ER Pirai" },
  { "grupoRede": 10019, "descricao": "ER Barra Mansa" },
  { "grupoRede": 10020, "descricao": "City Gate Campos" },
  { "grupoRede": 10099, "descricao": "AP-36 Resende" },

  { "grupoRede": 90000, "descricao": "Servidão de Média para Baixa" },
  { "grupoRede": 90001, "descricao": "Servidão de Alta para Média" },
  { "grupoRede": 90002, "descricao": "Rede Média Rio de Janeiro" },
  { "grupoRede": 90003, "descricao": "Rede Baixa Municipio  Rio de Janeiro" },
  { "grupoRede": 90004, "descricao": "Rede Alta Grande Rio de Janeiro" },
  { "grupoRede": 90005, "descricao": "Rede Média Até 2bar Rio de Janeiro" },
  { "grupoRede": 90006, "descricao": "-" },
  { "grupoRede": 90007, "descricao": "Rede Santa Mônica" },
  { "grupoRede": 90008, "descricao": "Rede Mandala" },
  { "grupoRede": 90009, "descricao": "Rede Barra Palace e Barra Peck" },
  { "grupoRede": 90010, "descricao": "Rede Novo Leblon" },
  { "grupoRede": 90011, "descricao": "Rede Pedra de Itauna" },
  { "grupoRede": 90012, "descricao": "Rede Pontoes da Barra" },
  { "grupoRede": 90013, "descricao": "Rede Alfa Barra" },
  { "grupoRede": 90014, "descricao": "Rede Nova Ipanema" },
  { "grupoRede": 90015, "descricao": "Rede Jardim Europa" },
  { "grupoRede": 90016, "descricao": "Rede Barra Shopping" },
  { "grupoRede": 90017, "descricao": "Rede Parque das Rosas" },
  { "grupoRede": 90018, "descricao": "Servidão de Alta para Baixa" },
  { "grupoRede": 90019, "descricao": "Rede As Terrazas" },
  { "grupoRede": 90020, "descricao": "Rede Vivendas da Barra" },
  { "grupoRede": 90021, "descricao": "Rede Barramares" },
  { "grupoRede": 90022, "descricao": "Rede Atlântico Sul" },
  { "grupoRede": 90023, "descricao": "Rede Santa Lúcia" },
  { "grupoRede": 90024, "descricao": "Rede Jardim Clube da Barra" },
  { "grupoRede": 90025, "descricao": "Rede Santa Helena" },
  { "grupoRede": 90026, "descricao": "Rede Porto dos Cabritos" },
  { "grupoRede": 90027, "descricao": "Rede Aldeia do Mar" },
  { "grupoRede": 90028, "descricao": "Rede Vivendas" },
  { "grupoRede": 90029, "descricao": "Rede Oceanique" },
  { "grupoRede": 90030, "descricao": "Rede Barra Bella" },
  { "grupoRede": 90031, "descricao": "Rede Wimbledon Park" },
  { "grupoRede": 90032, "descricao": "Rede Riviera Del Fiori" },
  { "grupoRede": 90033, "descricao": "Rede Jardim Nova Barra" },
  { "grupoRede": 90034, "descricao": "Rede Irmãos Araújo" },
  { "grupoRede": 90035, "descricao": "Rede Vivendas do Bosque" },
  { "grupoRede": 90036, "descricao": "Rede Santa Marina" },
  { "grupoRede": 90037, "descricao": "Rede Barra Sul" },
  { "grupoRede": 90038, "descricao": "Rede Geriba Quality Service" },
  { "grupoRede": 90039, "descricao": "Rede Solar da Montanha" },
  { "grupoRede": 90040, "descricao": "Rede Village das Figueiras" },
  { "grupoRede": 90041, "descricao": "Rede Parque Gabinal" },
  { "grupoRede": 90042, "descricao": "Rede Village Ouro Preto II" },
  { "grupoRede": 90043, "descricao": "Rede Village Alvorada" },
  { "grupoRede": 90044, "descricao": "Rede Village Suzano" },
  { "grupoRede": 90045, "descricao": "Rede Caça e Pesca" },

  { "grupoRede": 90046, "descricao": "Rede MP Resende" },
  { "grupoRede": 90047, "descricao": "Rede MP Barra Mansa" },
  { "grupoRede": 90048, "descricao": "Rede MP Volta Redonda" },
  { "grupoRede": 90049, "descricao": "Rede MP Barra do Piraí" },
  { "grupoRede": 90050, "descricao": "Rede MP Piraí" },
  { "grupoRede": 90051, "descricao": "Rede MP Engenheiro Paulo De Frontin" },
  { "grupoRede": 90052, "descricao": "Rede MP Paracambi" },
  { "grupoRede": 90053, "descricao": "Rede MP Itaguai - Santa Cruz" },
  { "grupoRede": 90054, "descricao": "Rede MP Nova Iguaçu" },
  { "grupoRede": 90055, "descricao": "Rede MP Belford Roxo" },
  { "grupoRede": 90056, "descricao": "Rede MP Mesquita" },
  { "grupoRede": 90057, "descricao": "Rede MP Nova Friburgo" },
  { "grupoRede": 90058, "descricao": "Rede MP Petrópolis" },
  { "grupoRede": 90059, "descricao": "Rede MP Guapimirim" },
  { "grupoRede": 90060, "descricao": "Rede MP Duque de Caxias" },
  { "grupoRede": 90061, "descricao": "Rede MP Ilha do Governador" },
  { "grupoRede": 90062, "descricao": "Rede MP Niteroi" },
  { "grupoRede": 90063, "descricao": "Rede MP São Gonçalo" },
  { "grupoRede": 90064, "descricao": "Rede MP Itaboraí" },
  { "grupoRede": 90065, "descricao": "Rede MP Rio de Janeiro Subsistemas" },
  { "grupoRede": 90066, "descricao": "Rede MP São João de Meriti" },
  { "grupoRede": 90067, "descricao": "Rede MP Cabo Frio - São Pedro" },
  { "grupoRede": 90068, "descricao": "Rede MP Arraial do Cabo" },
  { "grupoRede": 90069, "descricao": "Rede MP Campos dos Goytacazes" },
  { "grupoRede": 90070, "descricao": "Rede MP Macaé" },
  { "grupoRede": 90071, "descricao": "Rede MP Rio das Ostras" },
  { "grupoRede": 90072, "descricao": "Rede MP Três Rios" },
  { "grupoRede": 90073, "descricao": "Rede MP Tatui" },
  { "grupoRede": 90074, "descricao": "Rede MP Estradao" },
  { "grupoRede": 90075, "descricao": "Rede MP Porto Feliz" },
  { "grupoRede": 90076, "descricao": "Rede MP Tiete" },
  { "grupoRede": 90077, "descricao": "Rede AP - até 7 bar - Cerquilho" },
  { "grupoRede": 90078, "descricao": "Rede AP - até 7 bar - Laranjal Paulista" },
  { "grupoRede": 90079, "descricao": "Rede AP - até 7 bar - Araçariguama" },
  { "grupoRede": 90080, "descricao": "Rede MP - Salto" },
  { "grupoRede": 90081, "descricao": "Rede MP - São Roque" },
  { "grupoRede": 90082, "descricao": "Rede MP - Mairinque" },
  { "grupoRede": 90083, "descricao": "Rede MP - Alumínio" },
  { "grupoRede": 90084, "descricao": "Rede MP - Pirapitingui" },
  { "grupoRede": 90085, "descricao": "Rede MP - Sorocaba / Votorantim" },
  { "grupoRede": 90086, "descricao": "Rede MP - Boituva" },
  { "grupoRede": 90087, "descricao": "Rede AP - até 7 bar - Boituva - Iperó" },
  { "grupoRede": 90088, "descricao": "Rede AP - até 7 bar - Botucatu" },
  { "grupoRede": 90089, "descricao": "Rede AP - até 7 bar - Avaré" },
  { "grupoRede": 90090, "descricao": "Rede AP - até 7 bar - Distrito Industrial" },
  { "grupoRede": 90091, "descricao": "Rede AP - até 19 - Tatui / Cesário Lange" },
  { "grupoRede": 90092, "descricao": "Rede AP - até 19 - Sorocaba / Votorantim" },
  { "grupoRede": 90093, "descricao": "Rede AP - até 35 bar - Tronco Principal" },
  { "grupoRede": 90094, "descricao": "Rede MP Teresópolis" },
  { "grupoRede": 90095, "descricao": "Rede MP - Itu" },
  { "grupoRede": 90096, "descricao": "Rede BP Barra da Tijuca" },
  { "grupoRede": 90097, "descricao": "Rede MP - Manaus" },
  { "grupoRede": 90098, "descricao": "Rede AP-A - Itapetininga" },
  { "grupoRede": 90099, "descricao": "Rede AP-7 Resende" },
  { "grupoRede": 90100, "descricao": "Sistema GNC Avaré - SP até 4 bar" },
  { "grupoRede": 90101, "descricao": "Sistema GNC Angatuba - SP até 4 bar" },
  { "grupoRede": 90102, "descricao": "Sistema GNC Ibiúna I - SP até 4 bar" },
  { "grupoRede": 90103, "descricao": "Sistema GNC Itapeva - SP até 4 bar" },
  { "grupoRede": 90104, "descricao": "Sistema GNC Bofete - SP até 4 bar" },
  { "grupoRede": 90105, "descricao": "Sistema GNC Itararé - SP até 4 bar" },
  { "grupoRede": 90106, "descricao": "Sistema GNC Salto da Pirapora - SP até 4 bar" },
  { "grupoRede": 90107, "descricao": "Sistema GNC - Teresópolis" },
  { "grupoRede": 90108, "descricao": "Sistema GNC Nova Campina - SP até 4 bar" },
  { "grupoRede": 90109, "descricao": "Sistema Cajati - SP até 4 bar" },
  { "grupoRede": 90110, "descricao": "Sistema GNC Cajati II - SP até 4 bar" },
  { "grupoRede": 90111, "descricao": "Sistema GNC São Manuel - SP até 4 bar" },
  { "grupoRede": 90112, "descricao": "Sistema GNC Itaperuna- RJ até 4 bar" },
  { "grupoRede": 90113, "descricao": "Sistema GNC Itararé II - SP até 4 bar" },
  { "grupoRede": 90114, "descricao": "Rede MP Botucatu" },
  { "grupoRede": 90115, "descricao": "Rede MPGN Ilo-Peru" },
  { "grupoRede": 90116, "descricao": "Rede MPGN Moquegua-Peru" },
  { "grupoRede": 90117, "descricao": "Rede MPGN Arequipa-Peru" },
  { "grupoRede": 90118, "descricao": "Rede MPGN Tacna-Peru" },
  { "grupoRede": 90119, "descricao": "Rede MP Conchas" },
  { "grupoRede": 90120, "descricao": "Rede MP Itapetininga" },
  { "grupoRede": 90121, "descricao": "Rede AP-7   -   Itu / Porto Feliz" },
  { "grupoRede": 90122, "descricao": "Sistema GNC - Itaipava" },
  { "grupoRede": 90123, "descricao": "Rede MP Magé" },
  { "grupoRede": 90124, "descricao": "Rede City Gate Vale Azul" },
  { "grupoRede": 90125, "descricao": "Rede MP/GN - Armação dos Búzios" },
  { "grupoRede": 90126, "descricao": "Rede MP/GN - Valença" },
  { "grupoRede": 90127, "descricao": "Rede MP/GN - Quisamá" },
  { "grupoRede": 90128, "descricao": "Rede MP/GN - Japeri" },
  { "grupoRede": 90129, "descricao": "Sistema GNC Maricá - RJ até 4 bar" },
  { "grupoRede": 90130, "descricao": "Rede AP-B   19/35 Bar - Gasoduto Laranjal Paulista - Botucatu" },
  { "grupoRede": 90131, "descricao": "Sistema GNC Cachoeiras de Macacu - RJ até 4 bar" },
  { "grupoRede": 90132, "descricao": "Sistema GNC Angra dos Reis - RJ até 4 bar" },
  { "grupoRede": 90133, "descricao": "Sistema GNC Araruama - RJ até 4 bar" },
  { "grupoRede": 90134, "descricao": "Sistema GNC Mangaratiba - RJ até 4 bar" },
  { "grupoRede": 90135, "descricao": "Sistema GNC Saquarema - RJ até 4 bar" },
  { "grupoRede": 90136, "descricao": "Sistema GNC Itaperuna - RJ até 4 bar" },
  { "grupoRede": 90137, "descricao": "Rede AP-7   -   Ibiúna" },
  { "grupoRede": 90138, "descricao": "Rede MP - Paraíba Do Sul" },
  { "grupoRede": 90139, "descricao": "Rede MPB Campo Grande" },
  { "grupoRede": 90140, "descricao": "Rede APB - Prov 07" },
  { "grupoRede": 90141, "descricao": "Rede APB - Prov 08" },
  { "grupoRede": 90142, "descricao": "Rede APB - Prov 09" },
  { "grupoRede": 90143, "descricao": "Rede APB - Prov 10" },

  { "grupoRede": 99001, "descricao": "Rede 60 psi Arequipa" },
  { "grupoRede": 99002, "descricao": "Rede 60 psi Ilo" },
  { "grupoRede": 99003, "descricao": "Rede 60 psi Tacna" },
  { "grupoRede": 99004, "descricao": "Rede 60 psi Moquegua" },
  { "grupoRede": 99005, "descricao": "Doutor Carvalhães" },
  { "grupoRede": 99006, "descricao": "Cidade Universitária" },
  { "grupoRede": 99007, "descricao": "Queimados II" },
  { "grupoRede": 99008, "descricao": "Camboata GLP" },
  { "grupoRede": 99009, "descricao": "São Pedro Alcantara GLP" },
  { "grupoRede": 99010, "descricao": "Joaquim Costa Lima GLP" },
  { "grupoRede": 99011, "descricao": "Praça Professora Camisão" },
  { "grupoRede": 99012, "descricao": "São Conrado I e II" },
  { "grupoRede": 99013, "descricao": "Jackson de Figueiredo I e II" },
  { "grupoRede": 99014, "descricao": "Rodolfo Campos" },
  { "grupoRede": 99015, "descricao": "Vivenda e Beton" },
  { "grupoRede": 99016, "descricao": "Tapera" },
  { "grupoRede": 99017, "descricao": "Tevol-Esbama" },
  { "grupoRede": 99018, "descricao": "Japeri-Pres.Kennedy-Modulação" },

  { "grupoRede": 99999, "descricao": "Ubicación Genérico" }
];

export const PRESSURE_BASES = [
  { "base": "AP-72", "descricao": "Alta Pressão - 72 Bar", "pmin": 7, "pmax": 72, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-36", "descricao": "Alta Pressão - 36 Bar", "pmin": 7, "pmax": 36, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-16", "descricao": "Alta Pressão - 16 Bar", "pmin": 7, "pmax": 16, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-12", "descricao": "Alta Pressão - 12 Bar", "pmin": 5, "pmax": 12, "pgarantia": 5, "unidade": "bar", "tipo": "GN" },
  { "base": "MP-N", "descricao": "Média Pressão - Gás Natural", "pmin": 1, "pmax": 4, "pgarantia": 1, "unidade": "bar", "tipo": "GN" },
  { "base": "BP-N", "descricao": "Baixa Pressão - Gás Natural", "pmin": 19, "pmax": 22, "pgarantia": 19, "unidade": "mbar", "tipo": "GN" },
  { "base": "MP-P", "descricao": "Média Pressão - GLP", "pmin": 1, "pmax": 4, "pgarantia": 1, "unidade": "bar", "tipo": "GP" },
  { "base": "AP-45", "descricao": "Alta Pressão - 45 Bar", "pmin": 7, "pmax": 45, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-32", "descricao": "Alta Pressão - 32 Bar", "pmin": 7, "pmax": 32, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-24", "descricao": "Alta Pressão - 24 Bar", "pmin": 7, "pmax": 24, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-28", "descricao": "Alta Pressão - 28 Bar", "pmin": 7, "pmax": 28, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-42", "descricao": "Alta Pressão - 42 Bar", "pmin": 7, "pmax": 42, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "BP-P", "descricao": "Baixa Pressão - GLP", "pmin": 8, "pmax": 12, "pgarantia": 8, "unidade": "mbar", "tipo": "GP" },
  { "base": "AP-38", "descricao": "Alta Pressão - 38 Bar", "pmin": 6, "pmax": 38, "pgarantia": 14, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-43", "descricao": "Alta Pressão - 43 Bar", "pmin": 43, "pmax": 35, "pgarantia": 35, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-55", "descricao": "Alta Pressão - 55 Bar", "pmin": 35, "pmax": 55, "pgarantia": 35, "unidade": "bar", "tipo": "GN" },
  { "base": "MP-A", "descricao": "Média Pressão - Gás Natural", "pmin": 1, "pmax": 2, "pgarantia": 1, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-26", "descricao": "Alta Pressão - 26 Bar", "pmin": 7, "pmax": 26, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-A", "descricao": "AP-A", "pmin": 5, "pmax": 19, "pgarantia": 5, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-B", "descricao": "AP-B", "pmin": 19, "pmax": 99, "pgarantia": 7, "unidade": "bar", "tipo": "GN" },
  { "base": "MP-B", "descricao": "MP-B", "pmin": 1, "pmax": 4, "pgarantia": 1, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-7", "descricao": "AP-7", "pmin": 5, "pmax": 7, "pgarantia": 5, "unidade": "bar", "tipo": "GN" },
  { "base": "AP-35", "descricao": "Alta Pressão - 35 Bar", "pmin": 7, "pmax": 35, "pgarantia": 7, "unidade": "bar", "tipo": "GN" }
];

export const STANDARDIZED_CONDITIONS_BLOCKS = {
  "Bloco 1": {
    "descricao": "Cliente COM rede BP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Dimensionamento de Rede de acordo com Anexo A – Procedimento de Cálculo e Dimensionamento de Redes / NT-200 – BRA.",
      "Localização do Cliente segundo croqui enviado ao GEGAT-Análise e Planificação da Rede, devendo ser confirmada no local."
    ]
  },
  "Bloco 2": {
    "descricao": "Servidão MP COM rede MP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Deverão ser instalados reguladores MP/BP e válvulas no P.I. para fornecimento às unidades em BPGN e garantir a segurança.",
      "Dimensionamento de Rede de acordo com Anexo A – Procedimento de Cálculo e Dimensionamento de Redes / NT-200 – BRA.",
      "Localização do Cliente segundo croqui enviado ao GEGAT-Análise e Planificação da Rede, devendo ser confirmada no local."
    ]
  },
  "Bloco 3": {
    "descricao": "Servidão MP SEM rede MP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Deverá ser instalada válvula de segurança, logo após o ponto de interligação com a rede existente.",
      "Deverão ser instalados reguladores MP/BP e válvulas no P.I. para fornecimento às unidades em BPGN e garantir a segurança.",
      "Dimensionamento de Rede de acordo com Anexo A – Procedimento de Cálculo e Dimensionamento de Redes / NT-200 – BRA.",
      "Localização do Cliente e/ou extensão de rede estimadas segundo croqui enviado ao GEGAT-Análise e Planificação da Rede, devendo ser confirmada no local."
    ]
  },
  "Bloco 4": {
    "descricao": "Servidão BP COM rede MP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Deverá ser instalada válvula de segurança, logo após o ponto de interligação com a rede existente.",
      "Deverá ser instalado equipamento de regulagem para fornecimento ao Cliente na Pressão solicitada.",
      "Dimensionamento de Rede de acordo com Anexo A – Procedimento de Cálculo e Dimensionamento de Redes / NT-200 – BRA."
    ]
  },
  "Bloco 5": {
    "descricao": "Servidão BP SEM rede MP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Deverá ser instalada válvula de segurança, logo após o ponto de interligação com a rede existente.",
      "Deverá ser instalado equipamento de regulagem para fornecimento ao Cliente na Pressão solicitada.",
      "Dimensionamento de Rede de acordo com Anexo A – Procedimento de Cálculo e Dimensionamento de Redes / NT-200 – BRA.",
      "Localização do Cliente e/ou extensão de rede estimadas segundo croqui enviado ao GEGAT-Análise e Planificação da Rede, devendo ser confirmada no local."
    ]
  },
  "Bloco 6": {
    "descricao": "Cliente residencial com rede MP em frente",
    "itens": [
      "Deverá ser confeccionado \"Livro de Obra\" e enviado ao GEGAT-Gestão Cartográfica conforme os critérios das PE.00082.GN-DG.",
      "Deverá ser instalado equipamento de regulagem para fornecimento ao Cliente na Pressão solicitada.",
      "Localização do Cliente segundo croqui enviado ao GEGAT-Análise e Planificação da Rede, devendo ser confirmada no local."
    ]
  },
  "Bloco 7": {
    "descricao": "Critérios de Projeto e Dimensionamento",
    "itens": [
      "Dimensionamento de Rede de acordo com Anexo 1 – Procedimento de Cálculo e Dimensionamento de Redes / PE.05306-PT.01.",
      "Estudo preliminar, deverá ser realizado levantamento de mercado potencial na área em estudo, verificando existência de mercado industrial e GNV, para confirmação do diâmetro da rede projetada.",
      "Todos os ramais serão de 20 mm PE.",
      "Pode-se utilizar tubulações com diâmetros superiores sem necessidade de revisão, mantendo características de dimensionamento.",
      "Foi utilizada vazão para GNV’s de [VAZÃO_MP] m³/h (MP) e [VAZÃO_AP] m³/h (AP).",
      "Distribuição de válvulas de acordo com PE.03141.BR-CN item 9.2.",
      "Para melhora do sistema de APA de Campos dos Goytacazes é aconselhável Licenciamento Ambiental para operar em 16 bar.",
      "Pressão de rede externa MPB e interna MPA operada até 1,5 bar conforme normativa.",
      "Pressão de garantia para o cliente é de 1 bar conforme normativa."
    ]
  },
  "Bloco 8": {
    "descricao": "Interligação e Condições de Rede",
    "itens": [
      "Deverá ser Instalada válvula de segurança, logo após o ponto de interligação com a rede existente.",
      "Interligação em rede projetada PRESGAS Ø [DIÂMETRO] mm [MATERIAL] – Estudo [NÚMERO_ESTUDO] .",
      "Parte da tubulação projetada Ø [DIÂMETRO] mm [MATERIAL] é comum ao Estudo [NÚMERO_ESTUDO].",
      "A rede encontra-se fora de serviço e aguardando ligação do City-Gate.",
      "Ponto de interligação em rede com pressão máxima de operação de 2,0 bar.",
      "Ponto de interligação em rede fora de serviço. Aguardar a conversão da tubulação 350 mm Aço Linha Cabuçu para o sistema GN. Contactar o GEGAT-Análise e Planificação da Rede após análise para viabilidade de abastecimento do cliente, para que sejam tomadas as providências de energização da tubulação.",
      "Ponto de Interligação em rede projetada 200 mm PE no Estudo 078/02.2007 Rev.2 - Estudo de Gaseificação MP/GN Três Rios.",
      "Ponto de interligação em rede existente, conforme informação passada na solicitação do estudo. Caso necessário, deverão ser efetuadas sondagens ao longo do logradouro, no mesmo trecho para constatar se há tubo existente.",
      "Segundo informações do GEOGAS, possivelmente já exista rede no local; realizar sondagem para evitar paralelismo.",
      "Interligação em rede projetada MP-N Ø [DIÂMETRO] mm PE – Estudo 103/03.2009 Rev.5.",
      "Interligar as redes de acordo com configuração anterior do sistema ou conforme proposto pelo estudo para manter a confiabilidade da rede.",
      "Verificar a existência de rede neste logradouro, pois não possuímos informações de cadastro. Caso necessário, realizar sondagens e comunicar ao GEGAT."
    ]
  },
  "Bloco 9": {
    "descricao": "Licenciamento, Reforços e Prazos",
    "itens": [
      "Deve ser verificada a extensão do ramal; se for superior a 100 m deverá ser realizado Licenciamento Ambiental junto ao INEA (antiga FEEMA).",
      "Deve ser realizado Licenciamento Ambiental junto ao INEA (antiga FEEMA) para a licença de instalação das redes a serem construídas em AP 7 bar PE 100.",
      "Deverá aguardar conclusão do reforço Alta pressão Novas Fontes Avenida Brasil fase 2 trecho 1 – 6 Km 8” Aço AP-12 e Avenida Brasil fase 3 – 6 Km 10” Aço AP-12.",
      "Aguardar conclusão da adequação da ERM Largo do Tanque.",
      "Aguardar a adequação entre a fábrica e o bairro de Botafogo da tubulação 350 mm Aço Linha Fábrica -Botafogo.",
      "Deverá aguardar Novas Fontes 3 - Fase 3 e Fase 2 - Trecho 2 (Rede AP-12 - 6,0 Km - 10\" AC e 5,0 Km - 8\" AC, respectively).",
      "Deverá aguardar Novas Fontes - (Reforço Washington Luís - Rede AP-12 - 10 Km - 20\").",
      "Aguardar a conclusão da adequação da Linha MP/GN Fábrica-Botafogo.",
      "Aguardar construção do Reforço Presidente Kennedy, AP-12.",
      "Aguardar construção do Reforço Novas Fontes - Avenida Brasil Fase 4.",
      "Aguardar construção do reforço Largo do Tanque - 3 Km - 8\" Aço - AP-12.",
      "Aguardar a construção do Reforço Campo Grande - AP12.",
      "Deverá aguardar Reforço Rialto.",
      "Deverá aguardar a efetiva operação do City Gate e sua rede construída."
    ]
  },
  "Bloco 10": {
    "descricao": "Interdições e Limites (GNV / Estudos)",
    "itens": [
      "Deverá ser obedecido o limite de Postos GNV previstos na rede MPGN/Niterói e deverão ser executadas as redes tronco previstas no Estudo 274/09.2002 Rev. 6 - Revisão de Traçado.",
      "A ligação deste Posto deverá obedecer o limite estabelecido no Estudo 238/06.2007 Rev. 7 - Planilha E.",
      "Deverão ser observados os limites para o Mercado GNV, Itaboraí 17 postos, Niterói 25 postos, em São Gonçalo 31 postos e Região Oceânica 06 postos.",
      "Deverá ser obedecido o limite de 06 Postos GNV projetados no Estudo de Gaseificação MPGN do Município de Três Rios na revisão mais recente do Estudo 078/02.2007.",
      "A ligação deste Posto deverá obedecer o limite estabelecido para Volta Redonda revisão mais recente do Estudo 228/04.2006, Estudo de Gaseificação GNV MP/GN.",
      "O reforço de rede AP 35 projetado nos estudos 422 e 423/10.2009, 2.000 m de 8\" aço, permite a inclusão de 02 (dois) postos GNV na área de abrangência do city-gate Resende, nos municípios de Itatiaia, Resende, Porto Real e Quatis.",
      "Nestes municípios registramos 03 (três) consultas de postos GNV, o Posto Presidente, Posto Jardim Itatiaia e Posto Gold de Resende.",
      "A ligação deste Posto deverá obedecer o limite estabelecido na revisão mais recente do Estudo 077/02.2011.",
      "A ligação deste Posto deverá obedecer o limite estabelecido para Teresópolis na revisão mais recente do Estudo 103/03.2009.",
      "A quantidade de postos não deverá exceder o Relatório de Capacidade da Rede AP - Metropolitano e Guapimirim."
    ]
  },
  "Bloco 11": {
    "descricao": "Notas Operacionais e Avaliações",
    "itens": [
      "Deverão ser instalados reguladores MP/BP e válvulas no P.I. para fornecimento as unidades em BPGN e garantir a segurança.",
      "Custo estimado, considerando uma travessia especial na RFFSA.",
      "Deverá ser instalada na entrada do Condomínio, ERS MPGN/BPGN, para fornecimento aos Clientes em BPGN e garantir a segurança.",
      "Conforme análise a viabilidade de substituição do Posto Marque's Peter - Rua José Domingues, 250 - Encantado será para o Posto Tio Luiz - Rodovia Presidente Dutra Km 185, 22.251 - Comendador Soares - Nova Iguaçú.",
      "Deverá ser instalada válvula nos pontos indicados em croqui.",
      "Deverá ser efetuada adequação da ERD-Xerém para a vazão de [VAZÃO_ERM] m³/h.",
      "Deverá ser executado reforço de [EXTENSÃO_REFORÇO] metros rede em [DIÂMETRO_REFORÇO] mm AC próximo à ERM-Novas Fontes 1 em direção ao Distrito Industrial de Santa Cruz, conforme indicado em croqui.",
      "Deverá ser executado trecho de [EXTENSÃO_TRECHO] m de rede projetada diâmetro [DIÂMETRO_TRECHO] mm PE entre a Rua Santa Rosa e Rua Vital Brasil Filho esquina com Rua Padre Francisco Lana, referente a trecho de rede tronco prevista no Estudo 274/09.2002 Rev. 6.",
      "Esta carta cancela o estudo anterior [ESTUDO_ANTERIOR] Rev. [VERSÃO], carta Sepla [CÓDIGO_SEPLA].",
      "O traçado proposto tem caráter preliminar. Para confirmação do traçado definitivo, deverá ser elaborado estudo de traçado/projeto básico.",
      "Em função das melhorias do modelo matemático, foi possível viabilizar o cliente mantendo a confiabilidade do sistema.",
      "Nota técnica Sistema de distribuição Baixa Pressão Metropolitano (restrições e recomendações operacionais).",
      "O Posto [NOME_POSTO] foi verificado em modelo matemático e mantido como Posto Base.",
      "O posto está apto para ser transformado em Posto Base sem objeções da área técnica.",
      "Foi verificado que a rede possui capacidade para absorver a mudança de consumo sem alterar as condições de operação."
    ]
  }
};

export const HeaderTitle = () => (
  <h1 className="text-2xl md:text-3xl font-bold text-[#004080] leading-tight">
    Solicitação de Estudo de Rede de Distribuição de Gás
  </h1>
);
