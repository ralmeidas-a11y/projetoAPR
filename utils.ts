export const formatToLocalTime = (date: Date | string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(date));
};

export const formatDateTimeBR = (date: Date | string | undefined | null) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d).replace(',', '');
  } catch {
    return '-';
  }
};

export const getGMT3Date = () => {
  const date = new Date();
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
};

export const getGMT3ISOString = () => {
  const date = new Date();
  return date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00';
};

export const formatDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return '-';
  // Assumes yyyy-mm-dd
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

import { REQUESTER_AREAS } from './constants';

export const normalizeArea = (area: string | undefined | null) => {
  if (!area) return '';
  
  const clean = area
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Tenta encontrar uma correspondência exata na lista oficial (ignorando acentos/case)
  const official = REQUESTER_AREAS.find(officialArea => {
    const officialClean = officialArea
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    
    // Suporte especial para Zone vs Zona se necessário, mas o find aqui já resolve
    // se o texto for similar o suficiente. Para ser mais robusto:
    return officialClean === clean || officialClean.replace(/\bzona\b/g, 'zone') === clean.replace(/\bzona\b/g, 'zone');
  });

  return official || area.trim(); // Retorna o oficial se achou, senão o original limpo
};

export const isWithinLast12Months = (dateStr: string | undefined | null) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(now.getFullYear() - 1);
  return date > twelveMonthsAgo;
};
