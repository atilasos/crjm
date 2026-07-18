export interface TournamentServerPreset {
  label: string;
  url: string;
}

const productionTournamentServerUrl =
  typeof window !== 'undefined' && window.location.hostname === 'crjmai.infantinho.xyz'
    ? 'wss://crjmai-torneio.infantinho.xyz'
    : '';

const configuredTournamentServerUrl =
  productionTournamentServerUrl ||
  (typeof import.meta !== 'undefined'
    ? (
        import.meta.env?.BUN_PUBLIC_TOURNAMENT_SERVER_URL ||
        import.meta.env?.VITE_TOURNAMENT_SERVER_URL ||
        ''
      )
    : '');

export const PRESET_TOURNAMENT_SERVERS: TournamentServerPreset[] = [
  ...(configuredTournamentServerUrl
    ? [{ label: 'Servidor configurado da escola', url: configuredTournamentServerUrl }]
    : []),
  { label: 'Servidor personalizado...', url: 'custom' },
];

export const DEFAULT_TOURNAMENT_SERVER_URL = configuredTournamentServerUrl;

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
