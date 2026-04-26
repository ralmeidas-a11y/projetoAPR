
export interface VazaoUnitItem {
  id: string;
  categoria: string;
  tipoConsumo: string;
  vazao: number;
}

export interface DiversificacaoItem {
  id: string;
  faixa: string;
  fator: number;
}

export const VAZAO_UNITARIA_DATA: VazaoUnitItem[] = [
  { id: 'v1', categoria: 'Alta Densidade', tipoConsumo: 'Água Quente (Fria + Aquecedor)', vazao: 0.120 },
  { id: 'v2', categoria: 'Média Densidade', tipoConsumo: 'Água Quente (Fria + Aquecedor)', vazao: 0.090 },
  { id: 'v3', categoria: 'Baixa Densidade', tipoConsumo: 'Água Quente (Fria + Aquecedor)', vazao: 0.060 },
  { id: 'v4', categoria: 'Geral', tipoConsumo: 'Apenas Fogão (Água Fria)', vazao: 0.040 }
];

export const DIVERSIFICACAO_DATA: DiversificacaoItem[] = [
  { id: 'd1', faixa: '1 a 100 unidades', fator: 1.00 },
  { id: 'd2', faixa: '101 a 250 unidades', fator: 0.88 },
  { id: 'd3', faixa: '251 a 500 unidades', fator: 0.82 },
  { id: 'd4', faixa: '501 a 750 unidades', fator: 0.75 },
  { id: 'd5', faixa: '751 a 1000 unidades', fator: 0.63 },
  { id: 'd6', faixa: '1001 a 2000 unidades', fator: 0.56 },
  { id: 'd7', faixa: '2001 a 3000 unidades', fator: 0.50 },
  { id: 'd8', faixa: 'Acima de 3000 unidades', fator: 0.47 }
];
