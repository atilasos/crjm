import { criarEstadoInicial, getCorJogador, jogadaComputador } from '../logic';
import type { NexState, Posicao } from '../types';
import type { AIDifficulty, NexAiAction, NexPackedState } from './types';

function resolveCurrentPlayer(toPlay: 0 | 1, swapEfetuado: boolean): 'jogador1' | 'jogador2' {
  if (!swapEfetuado) {
    return toPlay === 0 ? 'jogador1' : 'jogador2';
  }
  return toPlay === 0 ? 'jogador2' : 'jogador1';
}

export function unpackPackedState(packed: NexPackedState): NexState {
  const swapDisponivel = (packed.flags & 1) !== 0;
  const swapEfetuado = (packed.flags & 2) !== 0;
  const primeiraJogada = (packed.flags & 4) !== 0;
  const jogadorAtual = resolveCurrentPlayer(packed.toPlay, swapEfetuado);
  const state = criarEstadoInicial('vs-computador');

  for (let x = 0; x < packed.board.length / 11; x++) {
    for (let y = 0; y < 11; y++) {
      const cell = packed.board[x * 11 + y];
      state.tabuleiro[x]![y] =
        cell === 1 ? 'preta' : cell === 2 ? 'branca' : cell === 3 ? 'neutra' : 'vazia';
    }
  }

  return {
    ...state,
    jogadorAtual,
    primeiraJogada,
    swapDisponivel,
    swapEfetuado,
  };
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.x === b.x && a.y === b.y;
}

function collectDifferences(before: NexState, after: NexState) {
  const currentColor = getCorJogador(before, before.jogadorAtual);
  const ownAdded: Posicao[] = [];
  const neutralAdded: Posicao[] = [];
  const neutralToOwn: Posicao[] = [];
  const ownToNeutral: Posicao[] = [];

  for (let x = 0; x < before.tabuleiro.length; x++) {
    const beforeRow = before.tabuleiro[x];
    const afterRow = after.tabuleiro[x];
    if (!beforeRow || !afterRow) continue;
    for (let y = 0; y < beforeRow.length; y++) {
      const prev = beforeRow[y];
      const next = afterRow[y];
      if (prev === next) continue;
      const pos = { x, y };

      if (prev === 'vazia' && next === currentColor) ownAdded.push(pos);
      else if (prev === 'vazia' && next === 'neutra') neutralAdded.push(pos);
      else if (prev === 'neutra' && next === currentColor) neutralToOwn.push(pos);
      else if (prev === currentColor && next === 'neutra') ownToNeutral.push(pos);
    }
  }

  return { ownAdded, neutralAdded, neutralToOwn, ownToNeutral };
}

export function inferAction(before: NexState, after: NexState): NexAiAction | null {
  if (before.swapDisponivel) {
    return after.swapEfetuado ? { type: 'swap' } : { type: 'recusar_swap' };
  }

  const diff = collectDifferences(before, after);
  if (diff.ownAdded.length === 1 && diff.neutralAdded.length === 1) {
    const own = diff.ownAdded[0];
    const neutral = diff.neutralAdded[0];
    if (!own || !neutral) return null;
    return { type: 'colocar', own, neutral };
  }

  if (diff.neutralToOwn.length === 2 && diff.ownToNeutral.length === 1) {
    const [n1, n2] = diff.neutralToOwn;
    const sacrifice = diff.ownToNeutral[0];
    if (!n1 || !n2 || !sacrifice) return null;
    return { type: 'substituir', n1, n2, sacrifice };
  }

  return null;
}

export function chooseFallbackActionFromState(
  state: NexState,
  _difficulty: AIDifficulty,
): NexAiAction | null {
  const nextState = jogadaComputador(state);
  return inferAction(state, nextState);
}

export function chooseFallbackActionFromPacked(
  packed: NexPackedState,
  difficulty: AIDifficulty,
): NexAiAction | null {
  return chooseFallbackActionFromState(unpackPackedState(packed), difficulty);
}
