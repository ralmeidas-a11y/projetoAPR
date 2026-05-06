export { RescomLetterModel } from './RescomLetterModel';
export { IndustrialLetterModel } from './IndustrialLetterModel';
export { GaseificaLetterModel } from './GaseificaLetterModel';
export { GaseificaParcLetterModel } from './GaseificaParcLetterModel';
export { GenericoLetterModel } from './GenericoLetterModel';
export { RenovacaonLetterModel } from './RenovacaonLetterModel';
export { TermoEletricoLetterModel } from './TermoEletricoLetterModel';
import { RescomLetterModel } from './RescomLetterModel';
import { IndustrialLetterModel } from './IndustrialLetterModel';
import { GaseificaLetterModel } from './GaseificaLetterModel';
import { GaseificaParcLetterModel } from './GaseificaParcLetterModel';
import { GenericoLetterModel } from './GenericoLetterModel';
import { RenovacaonLetterModel } from './RenovacaonLetterModel';
import { TermoEletricoLetterModel } from './TermoEletricoLetterModel';
export const getLetterModel = (subType: string) => {

  const st = subType?.trim();

  // Mapping provided by user
  switch (st) {
    case 'Comercial':
    case 'Residencial':
    case 'Grande Comércio':
    case 'Residencial/Comercial':
      return RescomLetterModel;

    case 'Industrial':
    case 'Climatização':
    case 'GNV':
    case 'GNC':
    case 'Cogeração':
    case 'Industrial/Geração Continua':
    case 'Geração de Ponta':
    case 'Geração Contínua':
    case ' Setorização ERDs':
    case 'Expansão GNV':
    case 'Estação de Liquefação - GNL':
    case 'GNV Frota':
    case 'Geração':
    case 'Geração de Emergência':
      return IndustrialLetterModel;

    case 'Termogeração':
      return TermoEletricoLetterModel;

    case 'MECOM':
    case 'Gaseificação Total':
      return GaseificaLetterModel;

    case 'Gaseificação Parcial':
      return GaseificaParcLetterModel;
    case 'Renovação':
    case 'Simulação':
    case 'Programado':
    case 'Infra-estrutura':
    case 'Reforço':
    case 'Remanejamento':
      return RenovacaonLetterModel;
    case 'Análise de Pressões e Vazões':
    case 'Levantamento de Dados':
    case 'Consulta Avulsas':
    case 'Emergencial':
    case 'Mapas Temático':
    case 'Definir':
      return GenericoLetterModel;
    default:
      // Fallback logic using normalization for safety
      const normalized = (st || '').toLowerCase();
      if (normalized === 'gaseificação parcial') return GaseificaParcLetterModel;
      if (normalized.includes('gaseifica')) return GaseificaLetterModel;
      if (normalized.includes('industrial') || normalized.includes('geração') || normalized.includes('gnv') || normalized.includes('gnc')) return IndustrialLetterModel;
      if (normalized.includes('termo')) return TermoEletricoLetterModel;
      if (normalized.includes('renovação') || normalized.includes('reforço') || normalized.includes('remanejamento')) return RenovacaonLetterModel;
      if (normalized.includes('residencial') || normalized.includes('comercial')) return RescomLetterModel;

      return GenericoLetterModel;
  }
};