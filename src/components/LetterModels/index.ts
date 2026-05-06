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
  const normalizedSubType = (subType || '').toLowerCase();

  if (normalizedSubType === 'gaseificação parcial') {
    return GaseificaParcLetterModel;
  }
  if (normalizedSubType.includes('gaseifica')) {
    return GaseificaLetterModel;
  }
  
  if (normalizedSubType.includes('industrial') || normalizedSubType === 'geração' || normalizedSubType === 'cogeração' || normalizedSubType.includes('geração contínua') || normalizedSubType.includes('geração de emergência') || normalizedSubType.includes('geração de ponta')) {
    return IndustrialLetterModel;
  }

  if (normalizedSubType === 'termogeração') {
    return TermoEletricoLetterModel;
  }

  if (normalizedSubType.includes('renovação') || normalizedSubType.includes('renovacaon') || normalizedSubType.includes('reforço')) {
    return RenovacaonLetterModel;
  }

  if (normalizedSubType.includes('residencial') || normalizedSubType.includes('comercial') || normalizedSubType.includes('comércio')) {
    return RescomLetterModel;
  }

  // Fallback para qualquer outro (ex: Emergencial, Levantamento de Dados, etc) que use uma estrutura mais genérica
  return GenericoLetterModel;
};
