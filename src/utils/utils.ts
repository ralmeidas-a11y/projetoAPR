import { User } from '../types/types';

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

export const formatDate = (dateStr: any) => {
  if (!dateStr) return '-';
  
  let dStr = typeof dateStr === 'string' ? dateStr : '';
  
  // Excel numeric date (days since 1899-12-30)
  if (typeof dateStr === 'number' || (typeof dateStr === 'string' && !isNaN(Number(dateStr)) && !dateStr.includes('-'))) {
    const numericDate = Number(dateStr);
    if (numericDate > 10000) { // Safety check to avoid small numbers if any
      const jsDate = new Date((numericDate - 25569) * 86400 * 1000);
      try {
        dStr = jsDate.toISOString().split('T')[0];
      } catch (e) {
        return String(dateStr);
      }
    }
  }

  if (dateStr instanceof Date) {
    try {
      dStr = dateStr.toISOString().split('T')[0];
    } catch (e) {
      return '-';
    }
  } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dStr = dateStr.split('T')[0];
  }

  if (!dStr) return String(dateStr);

  // Assumes yyyy-mm-dd
  const parts = dStr.split('-');
  if (parts.length !== 3) return dStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

import { REQUESTER_AREAS, AREA_CODE_MAPPING } from '../constants/constants';

export const normalizeArea = (area: string | undefined | null) => {
  if (!area) return '';

  const trimmedArea = area.trim();
  
  // Se for um código numérico e temos o mapeamento, retornamos a descrição
  if (AREA_CODE_MAPPING[trimmedArea]) {
    return AREA_CODE_MAPPING[trimmedArea];
  }
  
  const clean = trimmedArea
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Tenta encontrar uma correspondência exata na lista oficial (ignorando acentos/case)
  const official = REQUESTER_AREAS.find(officialArea => {
    const officialClean = officialArea
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    
    return officialClean === clean || officialClean.replace(/\bzona\b/g, 'zone') === clean.replace(/\bzona\b/g, 'zone');
  });

  return official || trimmedArea; // Retorna o oficial se achou, senão o original limpo
};

export const isWithinLast12Months = (dateStr: string | undefined | null) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(now.getFullYear() - 1);
  return date > twelveMonthsAgo;
};


/**
 * Robust check to see if a request ID matches the current user.
 * Matches by ID (local), Email (corporate), or SAP (legacy system).
 */
export const isAssignedToMe = (assignedToId: string | undefined | null, currentUser: User | null | undefined) => {
  if (!assignedToId || !currentUser) return false;
  
  const idLower = assignedToId.trim().toLowerCase();
  const userIdLower = currentUser.id.toLowerCase();
  const userEmailLower = currentUser.email?.toLowerCase().trim();
  const userSapLower = currentUser.sap?.toLowerCase().trim().replace(/^0+/, '');
  const userGbLower = currentUser.gb?.toLowerCase().trim();
  const idSapClean = idLower.replace(/^0+/, '');

  if (idLower === userIdLower) return true;
  if (userEmailLower && idLower === userEmailLower) return true;
  if (userSapLower && idSapClean === userSapLower) return true;
  if (userGbLower && idLower === userGbLower) return true;
  
  return false;
};

/**
 * Adds business days (skipping weekends) to a date.
 */
export const addBusinessDays = (date: Date | string, days: number): Date => {
  const result = new Date(date);
  if (isNaN(result.getTime())) return new Date();
  
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      added++;
    }
  }
  return result;
};

/**
 * Calculates the deadline based on FormType.
 * FO.02: 7 calendar days.
 * Others: 5 business days.
 */
export const calculateDeadline = (requestDate: string | undefined | null, formType: string): string => {
  if (!requestDate) return '';
  
  let d: Date;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(requestDate)) {
    const [day, month, year] = requestDate.split('/').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(requestDate);
  }

  if (isNaN(d.getTime())) return '';

  let deadlineDate: Date;
  if (formType === 'PE.00492-FO.02') {
    // 7 calendar days
    deadlineDate = new Date(d);
    deadlineDate.setDate(deadlineDate.getDate() + 7);
  } else {
    // 5 business days
    deadlineDate = addBusinessDays(d, 5);
  }

  return deadlineDate.toISOString().split('T')[0];
};

/**
 * Robust check for system-assigned/shared tasks (Free Queue).
 * Includes "ADRSIS", "ADRSIS - SISTEMA", "PRGC" and empty IDs.
 */
export const isSystemAssigned = (id: string | undefined | null) => {
  if (!id) return true;
  const clean = id.trim().toUpperCase();
  return clean === 'ADRSIS' || 
         clean === 'ADRSIS - SISTEMA' || 
         clean === 'PRGC' || 
         clean === 'SISTEMA' ||
         clean === 'ADRSIS- SISTEMA';
};

/**
 * Converte uma string para Title Case (primeira letra maiúscula de cada palavra),
 * tratando corretamente acentos e eliminando excessos de espaços.
 */
export function toTitleCase(str: string | undefined): string {
  if (!str) return '';
  const exceptions = ['de', 'da', 'do', 'das', 'dos', 'em', 'com', 'para', 'a', 'o'];
  
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (word.length === 0) return '';
      // Support for Unicode letters (matching accents correctly)
      if (index === 0 || !exceptions.includes(word)) {
        return word.replace(/^./u, (match) => match.toUpperCase());
      }
      return word;
    })
    .join(' ');
}

export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Verifica se um prazo (deadline) está vencido ou vence hoje.
 */
export const isExpiringOrOverdue = (deadlineStr: string | undefined | null) => {
  if (!deadlineStr) return false;
  
  try {
    let dStr = String(deadlineStr).trim();
    
    // Suporte para datas em formato Excel
    if (!isNaN(Number(dStr)) && !dStr.includes('-') && !dStr.includes('/')) {
      const excelDate = Number(dStr);
      if (excelDate > 40000) {
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        dStr = jsDate.toISOString().split('T')[0];
      }
    }

    let deadline: Date;
    if (dStr.includes('/')) {
      const [d, m, y] = dStr.split('/').map(Number);
      deadline = new Date(y, m - 1, d);
    } else {
      deadline = new Date(dStr);
      // Ajustar para o fuso local se a string for apenas YYYY-MM-DD (evita problemas de timezone)
      if (dStr.length === 10) {
        const [y, m, d] = dStr.split('-').map(Number);
        deadline = new Date(y, m - 1, d);
      }
    }
    
    if (isNaN(deadline.getTime())) return false;
    
    deadline.setHours(0, 0, 0, 0);
    
    // Data atual em SP
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    today.setHours(0, 0, 0, 0);
    
    return deadline <= today;
  } catch {
    return false;
  }
};
