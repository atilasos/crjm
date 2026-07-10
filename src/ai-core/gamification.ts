import type { GameId } from './types';

export type AchievementCategory =
  | 'onboarding'
  | 'aprendizagem'
  | 'consistencia'
  | 'por-jogo';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  xp: number;
  gameId?: GameId;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly';
  targetLabel: string;
  rewardXp: number;
  gameId?: GameId;
}

export interface PatternCardDefinition {
  id: string;
  gameId: GameId;
  title: string;
  description: string;
  minimumPhase: 'A' | 'B' | 'C' | 'D';
}

export const STARTER_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_game',
    title: 'Primeiro Jogo',
    description: 'Completa a tua primeira partida.',
    category: 'onboarding',
    xp: 10,
  },
  {
    id: 'first_win',
    title: 'Primeira Vitória',
    description: 'Ganha a tua primeira partida contra o desafio proposto.',
    category: 'onboarding',
    xp: 12,
  },
  {
    id: 'first_review',
    title: 'Primeira Revisão',
    description: 'Termina uma revisão pós-jogo completa.',
    category: 'aprendizagem',
    xp: 15,
  },
  {
    id: 'first_puzzle',
    title: 'Primeiro Desafio',
    description: 'Resolve o teu primeiro puzzle estratégico.',
    category: 'onboarding',
    xp: 10,
  },
  {
    id: 'top3_move',
    title: 'Pensador',
    description: 'Usa sozinho um padrão estratégico numa decisão concreta.',
    category: 'aprendizagem',
    xp: 10,
  },
  {
    id: 'after_hint_recovery',
    title: 'Sem Medo',
    description: 'Resolve corretamente um puzzle depois de consultar a pista.',
    category: 'aprendizagem',
    xp: 12,
  },
  {
    id: 'three_clean_games',
    title: 'Estratega',
    description: 'Completa três partidas respeitando todas as regras.',
    category: 'aprendizagem',
    xp: 15,
  },
  {
    id: 'review_streak_3',
    title: 'Refletor',
    description: 'Faz 3 revisões completas em sequência.',
    category: 'consistencia',
    xp: 20,
  },
  {
    id: 'pattern_collector_5',
    title: 'Colecionador de Estratégias',
    description: 'Descobre cinco padrões estratégicos.',
    category: 'aprendizagem',
    xp: 15,
  },
  {
    id: 'comeback_win',
    title: 'Recuperação',
    description: 'Vence num jogo em que já tinhas registado uma derrota.',
    category: 'aprendizagem',
    xp: 18,
  },
  {
    id: 'explain_move',
    title: 'Explicador',
    description: 'Escolhe a decisão certa e confirma a explicação sem recorrer à pista.',
    category: 'aprendizagem',
    xp: 15,
  },
  {
    id: 'improvement_streak',
    title: 'Em Crescimento',
    description: 'Domina um padrão usando-o sozinho em três contextos diferentes.',
    category: 'aprendizagem',
    xp: 20,
  },
  {
    id: 'daily_streak_3',
    title: '3 Dias',
    description: 'Treina em três dias seguidos, usando o escudo quando precisares.',
    category: 'consistencia',
    xp: 12,
  },
  {
    id: 'daily_streak_7',
    title: 'Semana Completa',
    description: 'Mantém uma sequência de sete dias de treino.',
    category: 'consistencia',
    xp: 20,
  },
  {
    id: 'weekly_mission',
    title: 'Missão Cumprida',
    description: 'Conclui e reclama uma missão semanal.',
    category: 'consistencia',
    xp: 15,
  },
  {
    id: 'atari_hunter',
    title: 'Caçador de Liberdades',
    description: 'Reconhece e executa uma captura imediata em Atari Go.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'atari-go',
  },
  {
    id: 'double_atari', title: 'Duplo Atari', description: 'Reconhece duas ameaças de captura simultâneas.',
    category: 'por-jogo', xp: 15, gameId: 'atari-go',
  },
  {
    id: 'ladder_spotter', title: 'Leitor de Escadas', description: 'Lê corretamente uma sequência forçada em escada.',
    category: 'por-jogo', xp: 15, gameId: 'atari-go',
  },
  {
    id: 'center_keeper', title: 'Dono do Centro', description: 'Usa o centro para preservar mobilidade em Gatos & Cães.',
    category: 'por-jogo', xp: 12, gameId: 'gatos-caes',
  },
  {
    id: 'block_master', title: 'Mestre do Bloqueio', description: 'Reconhece e guarda uma jogada garantida.',
    category: 'por-jogo', xp: 15, gameId: 'gatos-caes',
  },
  {
    id: 'parity_guardian', title: 'Guardião da Paridade', description: 'Usa contagem par/ímpar para controlar uma região.',
    category: 'por-jogo', xp: 15, gameId: 'dominorio',
  },
  {
    id: 'last_move_master', title: 'Última Peça', description: 'Lê corretamente um corredor forçado até ao fim.',
    category: 'por-jogo', xp: 15, gameId: 'dominorio',
  },
  {
    id: 'opening_reader', title: 'Leitor de Aberturas', description: 'Reconhece uma estrutura de espelhamento na abertura.',
    category: 'por-jogo', xp: 15, gameId: 'dominorio',
  },
  {
    id: 'misere_mind', title: 'Mestre Misère', description: 'Planeia um final sem ficar com a última jogada.',
    category: 'por-jogo', xp: 15, gameId: 'quelhas',
  },
  {
    id: 'endgame_architect', title: 'Arquiteto do Fim', description: 'Controla um isolamento forçado em Quelhas.',
    category: 'por-jogo', xp: 18, gameId: 'quelhas',
  },
  {
    id: 'balanced_builder',
    title: 'Equilíbrio Perfeito',
    description: 'Fecha uma partida de Produto com dois grupos fortes e equilibrados.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'produto',
  },
  {
    id: 'elegant_saboteur', title: 'Sabotador Elegante', description: 'Usa uma fusão adversária para alterar os fatores do produto.',
    category: 'por-jogo', xp: 15, gameId: 'produto',
  },
  {
    id: 'bridge_builder',
    title: 'Construtor de Pontes',
    description: 'Cria uma ligação decisiva em Nex sem ajuda forte.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'nex',
  },
  {
    id: 'triple_threat', title: 'Tripla Ameaça', description: 'Reconhece três rotas de ligação que não podem ser todas bloqueadas.',
    category: 'por-jogo', xp: 18, gameId: 'nex',
  },
];

export const PATTERN_CARDS: PatternCardDefinition[] = [
  { id: 'gatos-caes:centro', gameId: 'gatos-caes', title: 'Centro', description: 'Controlar casas centrais na abertura.', minimumPhase: 'A' },
  { id: 'gatos-caes:casa-em-disputa', gameId: 'gatos-caes', title: 'Casa em disputa', description: 'Reconhecer uma casa útil para os dois lados.', minimumPhase: 'B' },
  { id: 'gatos-caes:jogada-garantida', gameId: 'gatos-caes', title: 'Jogada garantida', description: 'Guardar uma casa que só o teu lado pode ocupar.', minimumPhase: 'C' },
  { id: 'dominorio:paridade', gameId: 'dominorio', title: 'Paridade', description: 'Controlar o par e o ímpar nas regiões livres.', minimumPhase: 'A' },
  { id: 'dominorio:corte', gameId: 'dominorio', title: 'Corte', description: 'Dividir o tabuleiro em zonas independentes.', minimumPhase: 'B' },
  { id: 'dominorio:corredor', gameId: 'dominorio', title: 'Corredor', description: 'Ler uma sequência forçada de dominós.', minimumPhase: 'C' },
  { id: 'dominorio:espelhamento', gameId: 'dominorio', title: 'Espelhamento', description: 'Usar simetria para preservar respostas.', minimumPhase: 'D' },
  { id: 'quelhas:misere-final', gameId: 'quelhas', title: 'Final misère', description: 'Planear de trás para a frente para não jogar por último.', minimumPhase: 'A' },
  { id: 'quelhas:simetria', gameId: 'quelhas', title: 'Simetria', description: 'Espelhar sem entregar a última jogada.', minimumPhase: 'B' },
  { id: 'quelhas:fratura', gameId: 'quelhas', title: 'Fratura', description: 'Separar o tabuleiro em componentes.', minimumPhase: 'C' },
  { id: 'quelhas:isolamento-forcado', gameId: 'quelhas', title: 'Isolamento forçado', description: 'Obrigar o adversário a jogar sozinho numa região.', minimumPhase: 'D' },
  { id: 'produto:equilibrio', gameId: 'produto', title: 'Equilíbrio', description: 'Manter os dois maiores grupos com tamanhos próximos.', minimumPhase: 'A' },
  { id: 'produto:fusao-adversaria', gameId: 'produto', title: 'Fusão adversária', description: 'Unir grupos rivais para reduzir o produto.', minimumPhase: 'B' },
  { id: 'produto:grupo-isolado', gameId: 'produto', title: 'Grupo isolado', description: 'Proteger um segundo grupo com potencial.', minimumPhase: 'C' },
  { id: 'atari-go:atari', gameId: 'atari-go', title: 'Atari', description: 'Reconhecer um grupo com uma liberdade.', minimumPhase: 'A' },
  { id: 'atari-go:ladder', gameId: 'atari-go', title: 'Escada', description: 'Ler uma sequência forçada de ameaças.', minimumPhase: 'B' },
  { id: 'atari-go:net', gameId: 'atari-go', title: 'Rede', description: 'Capturar por envolvimento sem atari direto.', minimumPhase: 'C' },
  { id: 'atari-go:double-atari', gameId: 'atari-go', title: 'Duplo atari', description: 'Ameaçar dois grupos ao mesmo tempo.', minimumPhase: 'C' },
  { id: 'atari-go:snapback', gameId: 'atari-go', title: 'Snapback', description: 'Usar um sacrifício para recuperar a captura.', minimumPhase: 'D' },
  { id: 'nex:ponte', gameId: 'nex', title: 'Ponte', description: 'Criar uma ligação virtual com duas rotas.', minimumPhase: 'A' },
  { id: 'nex:ameaca-dupla', gameId: 'nex', title: 'Ameaça dupla', description: 'Abrir dois caminhos de ligação.', minimumPhase: 'B' },
  { id: 'nex:tripla-ameaca', gameId: 'nex', title: 'Tripla ameaça', description: 'Criar três respostas que não podem ser bloqueadas.', minimumPhase: 'C' },
  { id: 'nex:bloqueio-central', gameId: 'nex', title: 'Bloqueio central', description: 'Cortar o caminho mínimo rival no centro.', minimumPhase: 'C' },
];

export const STARTER_MISSIONS: MissionDefinition[] = [
  {
    id: 'daily-play-2',
    title: 'Joga 2 partidas',
    description: 'Mantém o ritmo de treino com duas partidas completas.',
    frequency: 'daily',
    targetLabel: '2 partidas',
    rewardXp: 6,
  },
  {
    id: 'daily-review-1',
    title: 'Faz 1 revisão',
    description: 'Consolida um erro ou padrão logo após jogar.',
    frequency: 'daily',
    targetLabel: '1 revisão',
    rewardXp: 8,
  },
  {
    id: 'daily-puzzle-2',
    title: 'Resolve 2 puzzles',
    description: 'Pratica duas decisões estratégicas curtas.',
    frequency: 'daily',
    targetLabel: '2 puzzles',
    rewardXp: 8,
  },
  {
    id: 'daily-hints-2',
    title: 'Treina com poucas pistas',
    description: 'Completa atividade hoje usando no máximo duas pistas.',
    frequency: 'daily',
    targetLabel: 'até 2 pistas',
    rewardXp: 6,
  },
  {
    id: 'weekly-review-5',
    title: 'Completa 5 revisões',
    description: 'Cria um hábito semanal de reflexão pós-jogo.',
    frequency: 'weekly',
    targetLabel: '5 revisões',
    rewardXp: 18,
  },
  {
    id: 'weekly-two-game-wins',
    title: 'Ganha em 2 jogos diferentes',
    description: 'Transfere o teu raciocínio entre dois jogos.',
    frequency: 'weekly',
    targetLabel: '2 jogos',
    rewardXp: 18,
  },
  {
    id: 'weekly-three-patterns',
    title: 'Descobre 3 padrões',
    description: 'Avança três cartões de estratégia durante a semana.',
    frequency: 'weekly',
    targetLabel: '3 padrões',
    rewardXp: 18,
  },
  {
    id: 'weekly-strategy-up',
    title: 'Faz crescer a estratégia',
    description: 'Avança pelo menos um cartão ou barra de estratégia.',
    frequency: 'weekly',
    targetLabel: '1 progresso',
    rewardXp: 12,
  },
];
