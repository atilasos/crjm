export interface TournamentServerPreset {
  label: string;
  url: string;
}

export const PRESET_TOURNAMENT_SERVERS: TournamentServerPreset[] = [
  { label: 'CRJM MacBook Pro', url: 'wss://crjm-macbookpro.infantinho.xyz' },
  { label: 'CIDH', url: 'wss://cidh.infantinho.xyz' },
  { label: 'Servidor personalizado...', url: 'custom' },
];

export const DEFAULT_TOURNAMENT_SERVER_URL = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_TOURNAMENT_SERVER_URL || PRESET_TOURNAMENT_SERVERS[0]?.url || '')
  : (PRESET_TOURNAMENT_SERVERS[0]?.url || '');

export function normalizeTournamentServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function toTournamentHttpBaseUrl(raw: string): string {
  const normalized = normalizeTournamentServerUrl(raw);

  if (normalized.startsWith('wss://')) {
    return `https://${normalized.slice(6)}`;
  }

  if (normalized.startsWith('ws://')) {
    return `http://${normalized.slice(5)}`;
  }

  return normalized;
}

export function toTournamentAdminUrl(raw: string): string {
  return `${toTournamentHttpBaseUrl(raw)}/admin`;
}

export function toTournamentSpectatorUrl(raw: string): string {
  return `${toTournamentHttpBaseUrl(raw)}/admin/spectator`;
}
