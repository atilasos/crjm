import { aplicarJogada, colocarPeca, criarEstadoInicial, getGrupo } from './logic';
import type { YState } from './types';
import type { StrategySolution } from '../../server/learner-core/strategy-challenges';

// Worked positions on the validated championship graph. Every prefix is legal.
function position(blue: string[], red: string[]): YState {
  let state = criarEstadoInicial();
  for (let i = 0; i < blue.length; i++) {
    for (const node of [blue[i], red[i]]) {
      if (!node) continue;
      const next = colocarPeca(state, node);
      if (next === state || next.estado !== 'a-jogar') throw new Error('invalid Y exercise prefix');
      state = next;
    }
  }
  return state;
}

const choices = (labels: string[], variant: number) => {
  const options = labels.map((label, i) => ({ id: String(i), label }));
  const offset = variant % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
};

/** Six distinct situations, each with a stable identity for delayed retrieval. */
export function getYChallenge(variant: number): StrategySolution {
  let state: YState;
  let family: string, skill: string, question: string, prediction: string, hint: string, explanation: string;
  let labels: string[], predictions: string[], answer: string, predicted: string;
  switch (variant % 6) {
    case 0: {
      state = position(['E3'], ['M1']);
      family = 'adjacency'; skill = 'Seguir as ligações desenhadas';
      question = 'Onde colocas Azul para ligar diretamente à peça E3?';
      labels = ['D3', 'E2', 'A5'];
      const sizes = labels.map(node => getGrupo(colocarPeca(state, node).tabuleiro, 'E3').nos.size);
      answer = String(sizes.indexOf(2)); predicted = String(sizes[Number(answer)]! - 1);
      prediction = 'Quantas peças terá o grupo de E3 depois dessa colocação?'; predictions = ['1', '2', '3'];
      hint = 'Segue os traços entre as intersecções. Estar perto não basta.';
      explanation = 'D3 liga a E3 por um traço: o grupo passa a ter duas peças. E2 está perto de E3, mas não há ligação direta.';
      break;
    }
    case 1: {
      state = position(['A1'], []);
      family = 'corner'; skill = 'Reconhecer os lados de um canto';
      question = 'Que lados toca a peça azul em A1?';
      labels = ['Superior e esquerdo', 'Superior e direito', 'Os três lados'];
      answer = getGrupo(state.tabuleiro, 'A1').lados.has('esquerdo') ? '0' : '1';
      predicted = String(getGrupo(state.tabuleiro, 'A1').lados.size - 1);
      prediction = 'Quantos lados toca este grupo?'; predictions = ['1', '2', '3'];
      hint = 'Um canto pertence aos dois lados que aí se encontram.';
      explanation = 'A1 pertence aos lados superior e esquerdo. Tocar dois lados ainda não é vencer.';
      break;
    }
    case 2: {
      state = position(['A5', 'G1', 'G9'], ['C3', 'C5', 'I5']);
      family = 'separate'; skill = 'Distinguir grupos separados';
      question = 'Azul já tem um grupo vencedor nesta posição?'; labels = ['Não', 'Sim', 'Basta ter três peças'];
      const groups = ['A5', 'G1', 'G9'].map(node => getGrupo(state.tabuleiro, node));
      answer = groups.some(group => group.lados.size === 3) ? '1' : '0';
      predicted = String(groups.length - 1);
      prediction = 'Quantos grupos azuis separados vês?'; predictions = ['1', '2', '3'];
      hint = 'Segue apenas peças da mesma cor ligadas por traços. Não somes lados de grupos separados.';
      explanation = 'Há três grupos azuis separados. Cada um toca um lado; nenhum grupo toca os três lados.';
      break;
    }
    case 3: {
      state = position(['C1', 'E3'], ['M1', 'L1']);
      family = 'join'; skill = 'Unir dois grupos';
      question = 'Onde colocas Azul para unir C1 e E3 nesta jogada?'; labels = ['E2', 'D3', 'A5'];
      const joined = labels.map(node => getGrupo(colocarPeca(state, node).tabuleiro, 'C1').nos.has('E3'));
      answer = String(joined.indexOf(true));
      predicted = String(getGrupo(colocarPeca(state, labels[Number(answer)]!).tabuleiro, 'C1').nos.size - 1);
      prediction = 'Quantas peças terá o grupo que contém C1?'; predictions = ['1', '2', '3'];
      hint = 'Procura uma intersecção vazia com traços para ambos os grupos.';
      explanation = 'D3 tem ligações para C1 e E3. A colocação une as três peças num grupo; a proximidade de E2 não chega.';
      break;
    }
    case 4: {
      state = position(['A5'], []);
      family = 'swap'; skill = 'Prever a troca de cores';
      question = 'És o segundo participante e queres ficar com Azul. Que ação fazes agora?';
      labels = ['Colocar em B4', 'Trocar cores', 'Retirar A5'];
      const swapped = aplicarJogada(state, { type: 'swap' });
      answer = swapped.cores.jogador2 === 'azul' ? '1' : '0';
      predicted = swapped.jogadorAtual === 'jogador1' && swapped.cores.jogador1 === 'vermelho' && swapped.tabuleiro.A5 === 'azul' ? '0' : '1';
      prediction = 'O que acontece imediatamente após a troca?';
      predictions = ['O primeiro joga Vermelho; A5 continua Azul', 'O segundo joga Azul e retira A5', 'O primeiro joga Azul; A5 muda para Vermelho'];
      hint = 'A troca muda a cor de cada participante, sem mover nem repintar a peça inicial.';
      explanation = 'O segundo participante fica com Azul. O primeiro volta a jogar, agora com Vermelho; a peça azul permanece em A5.';
      break;
    }
    default: {
      state = position(['A1', 'B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8'],
        ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3']);
      family = 'win'; skill = 'Completar a ligação aos três lados';
      question = 'Qual destas colocações vence imediatamente para Azul?'; labels = ['A5', 'C4', 'A9'];
      const results = labels.map(node => colocarPeca(state, node));
      answer = String(results.findIndex(next => next.estado === 'vitoria-jogador1'));
      predicted = results[Number(answer)]!.estado === 'vitoria-jogador1' ? '0' : '1';
      prediction = 'Quem vence após essa colocação?'; predictions = ['Primeiro participante (Azul)', 'Segundo participante (Vermelho)', 'A partida continua.'];
      hint = 'O grupo que parte de A1 já toca dois lados. Procura a ligação ao lado direito.';
      explanation = 'Colocar em A9 liga o grupo de A1 ao lado direito. Esse único grupo toca os três lados e o primeiro participante vence já.';
    }
  }
  return {
    challenge: {
      id: `strategy-v1:y:${variant}`, gameId: 'y', familyId: `y:${family}`, skill,
      prompt: 'Observa o tabuleiro oficial de Y. Escolhe e prevê antes de conferir.',
      facts: [], question, options: choices(labels, variant), prediction, predictions: choices(predictions, variant + 1),
      diagram: { yState: state, caption: 'Azul: círculo. Vermelho: losango. Os traços são as ligações; podes deslizar o tabuleiro para ver todas as intersecções.' },
    },
    answer, prediction: predicted, hint, explanation,
  };
}
