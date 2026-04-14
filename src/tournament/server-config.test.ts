import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_TOURNAMENT_SERVER_URL,
  normalizeTournamentServerUrl,
  PRESET_TOURNAMENT_SERVERS,
  toTournamentAdminUrl,
  toTournamentHttpBaseUrl,
  toTournamentSpectatorUrl,
} from './server-config';

describe('tournament server config helpers', () => {
  test('normalizes whitespace and trailing slash', () => {
    expect(normalizeTournamentServerUrl('  wss://cidh.infantinho.xyz/  ')).toBe('wss://cidh.infantinho.xyz');
  });

  test('maps websocket urls to browser-safe admin urls', () => {
    expect(toTournamentHttpBaseUrl('wss://cidh.infantinho.xyz')).toBe('https://cidh.infantinho.xyz');
    expect(toTournamentHttpBaseUrl('ws://192.168.1.15:4000')).toBe('http://192.168.1.15:4000');
  });

  test('builds admin endpoints from tournament server urls', () => {
    expect(toTournamentAdminUrl('wss://cidh.infantinho.xyz')).toBe('https://cidh.infantinho.xyz/admin');
    expect(toTournamentSpectatorUrl('ws://192.168.1.15:4000/')).toBe('http://192.168.1.15:4000/admin/spectator');
  });

  test('defaults to no external tournament server when unconfigured', () => {
    expect(DEFAULT_TOURNAMENT_SERVER_URL).toBe('');
    expect(PRESET_TOURNAMENT_SERVERS).toEqual([
      { label: 'Servidor personalizado...', url: 'custom' },
    ]);
  });
});
