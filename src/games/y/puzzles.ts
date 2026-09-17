import type { PuzzleDefinition } from '../../ai-core/puzzles';

// Conceptual guided practice is deliberately distinct from the concrete positions
// assessed by choice/prediction, so its feedback does not reveal those solutions.
const lessons = [
  ['adjacency', 'Ligações, não distâncias', 'O que permite ligar duas peças da mesma cor num grupo?',
    'Olha para as linhas do tabuleiro.',
    ['Um traço entre as intersecções', 'Estarem perto no desenho', 'Terem a mesma letra no nome'],
    'As peças ligam-se pelos traços desenhados. A distância visual e os nomes não definem a adjacência.'],
  ['corner', 'Um canto pertence a dois lados', 'Qual é a regra dos cantos em Y?',
    'Imagina os dois lados a encontrarem-se no canto.',
    ['Contam para os dois lados adjacentes', 'Contam apenas para um lado à escolha', 'Contam para os três lados'],
    'Cada canto pertence aos dois lados adjacentes. O grupo ainda precisa de alcançar o terceiro lado.'],
  ['separate', 'Uma só ligação', 'Qual é a condição de vitória em Y?',
    'Não juntes a contagem de grupos que não estão ligados.',
    ['Um único grupo da mesma cor toca os três lados', 'Três grupos tocam um lado cada', 'Ter mais peças do que o adversário'],
    'A vitória exige um único grupo ligado da mesma cor a tocar os três lados. Grupos separados não somam os seus lados.'],
  ['join', 'A cor faz parte da ligação', 'Podes usar uma peça adversária como parte do teu grupo?',
    'Um grupo reúne peças de uma só cor.',
    ['Não, o caminho tem de usar a tua cor', 'Sim, se estiver entre duas peças tuas', 'Sim, se estiver num canto'],
    'Uma peça adversária não faz parte do teu grupo, mesmo que tenha traços para as tuas peças.'],
  ['swap', 'Quando podes trocar?', 'Quando pode o segundo participante trocar de cores?',
    'A troca é uma alternativa à sua primeira colocação.',
    ['Só na sua primeira oportunidade', 'Depois de qualquer colocação sua', 'Só quando o tabuleiro está quase cheio'],
    'O segundo participante pode trocar na primeira oportunidade. Depois de colocar uma peça, já não pode trocar.'],
  ['win', 'Confirmar o vencedor', 'Depois de uma troca, a quem pertence a vitória de um grupo?',
    'A identidade do participante é diferente da cor.',
    ['Ao participante que agora tem essa cor', 'Sempre ao participante que começou com essa cor', 'Sempre ao primeiro participante'],
    'A vitória pertence a quem tem a cor do grupo vencedor nesse momento, respeitando a troca.'],
] as const;

export const Y_PUZZLES: PuzzleDefinition[] = lessons.map(([family, title, prompt, hint, labels, explanation]) => ({
  id: `y-${family}-1`, gameId: 'y', patternId: 'y:tres-lados', title, prompt, hint,
  correctOptionId: '0', options: labels.map((label, i) => ({ id: String(i), label, explanation })),
}));
