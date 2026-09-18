import type { PuzzleDefinition } from '../../ai-core/puzzles';

export const FAISCA_PUZZLES: PuzzleDefinition[] = [
  {
    id: 'fa-abertura-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'A seta da abertura',
    prompt: 'O tabuleiro está vazio. Podes escolher a primeira casa, mas o que tens de verificar antes de colocar a peça?',
    hint: 'A liberdade de escolher a casa inicial não elimina a regra do destino.', correctOptionId: 'destino',
    options: [
      { id: 'destino', label: 'A seta termina numa casa vazia dentro do tabuleiro', explanation: 'Certo: a distância é exata e a direção é ortogonal, mesmo na abertura.' },
      { id: 'fora', label: 'A seta pode terminar fora do tabuleiro', explanation: 'Uma seta para fora é inválida, também na primeira jogada.' },
      { id: 'diagonal', label: 'A primeira seta tem de ser diagonal', explanation: 'Faísca só permite as quatro direções ortogonais.' },
    ],
  },
  {
    id: 'fa-obrigatoria-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'Quem escolhe a próxima casa?',
    prompt: 'O adversário acabou de jogar uma seta válida. Onde colocas agora a tua peça?',
    hint: 'Segue a seta da última peça à sua distância exata.', correctOptionId: 'alvo',
    options: [
      { id: 'livre', label: 'Em qualquer casa vazia', explanation: 'A colocação só é livre na abertura.' },
      { id: 'alvo', label: 'Na casa indicada pela última seta', explanation: 'Certo: essa é a casa obrigatória. Escolhes a distância e a direção da tua peça.' },
      { id: 'origem', label: 'Por cima da última peça', explanation: 'Uma casa ocupada não aceita outra peça.' },
    ],
  },
  {
    id: 'fa-salto-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'Uma peça pelo caminho',
    prompt: 'Tens uma peça de distância 2. Na direção escolhida, a casa intermédia está ocupada e o destino está vazio dentro do tabuleiro. Podes jogar da casa obrigatória?',
    hint: 'Distingue a casa intermédia da casa de destino.', correctOptionId: 'sim',
    options: [
      { id: 'sim', label: 'Sim, a seta pode saltar a peça intermédia', explanation: 'Certo: só o destino tem de estar vazio; não há captura da peça saltada.' },
      { id: 'nao', label: 'Não, qualquer peça bloqueia a seta', explanation: 'As casas intermédias ocupadas não impedem uma jogada de Faísca.' },
      { id: 'captura', label: 'Sim, e retiras a peça saltada', explanation: 'Faísca não tem capturas. A peça intermédia fica no tabuleiro.' },
    ],
  },
  {
    id: 'fa-reservas-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'A distância que já gastaste',
    prompt: 'Já usaste as tuas cinco peças de distância 2. Há uma casa vazia exatamente a essa distância. Podes apontar para lá com uma peça de distância 1?',
    hint: 'O número da peça é a distância exata, não um máximo.', correctOptionId: 'nao',
    options: [
      { id: 'sim', label: 'Sim, podes esticar a seta', explanation: 'Não podes alterar a distância indicada na peça.' },
      { id: 'nao', label: 'Não, precisarias de uma peça de distância 2', explanation: 'Certo: a geometria e as reservas têm de permitir a mesma jogada.' },
      { id: 'emprestar', label: 'Sim, usas uma peça do adversário', explanation: 'Cada jogador só pode usar as suas próprias reservas.' },
    ],
  },
  {
    id: 'fa-destino-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'Destino ocupado',
    prompt: 'A tua seta termina numa casa ocupada, mas existe uma casa vazia logo a seguir. O que acontece se tentares essa jogada?',
    hint: 'A seta não desliza até encontrar uma casa vazia.', correctOptionId: 'recusa',
    options: [
      { id: 'salta', label: 'O destino avança automaticamente uma casa', explanation: 'A distância da peça é exata. O destino não se ajusta.' },
      { id: 'recusa', label: 'A jogada é recusada sem gastar a peça nem mudar o turno', explanation: 'Certo: um destino ocupado torna a jogada inválida e o estado mantém-se.' },
      { id: 'perde', label: 'Perdes imediatamente por tentar', explanation: 'Uma tentativa inválida não é uma jogada nem uma derrota automática.' },
    ],
  },
  {
    id: 'fa-final-1', gameId: 'faisca', patternId: 'faisca:proxima-casa', title: 'Ainda há peças, mas há resposta?',
    prompt: 'Fazes uma jogada válida. Na nova casa obrigatória, o adversário tem peças mas nenhuma seta disponível termina numa casa vazia dentro do tabuleiro. Quem vence?',
    hint: 'Ter peças não basta: é preciso conseguir fazer uma jogada válida.', correctOptionId: 'tu',
    options: [
      { id: 'tu', label: 'Tu, porque o adversário ficou sem jogada válida', explanation: 'Certo: perde quem não consegue jogar no seu turno, mesmo que conserve peças.' },
      { id: 'passa', label: 'Ninguém: o adversário passa a vez', explanation: 'Não se passa a vez em Faísca. A impossibilidade de jogar termina a partida.' },
      { id: 'ele', label: 'O adversário, porque ainda tem peças', explanation: 'As peças restantes só ajudam se permitirem uma seta válida a partir da casa obrigatória.' },
    ],
  },
];
