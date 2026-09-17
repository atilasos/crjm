/** Identity and public selection are independent of implemented features.
 * Keep the existing selection until the edition's activation ticket is complete.
 * Register new games with selection: 'integration' and only real capabilities.
 */
export type GameCapability = 'local' | 'ai' | 'tutor' | 'review' | 'puzzles' | 'training' | 'strategy' | 'tournament' | 'progress';
export type GameSelection = 'current' | 'archive' | 'integration';
export type BrowsableSelection = Exclude<GameSelection, 'integration'>;
export const SCHOOL_CYCLES = ['1.º Ciclo', '2.º Ciclo', '3.º Ciclo', 'Secundário'] as const;

export interface GameDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly accent: string;
  readonly mark: string;
  readonly cycles: readonly (typeof SCHOOL_CYCLES)[number][];
  readonly selection: GameSelection;
  readonly capabilities: readonly GameCapability[];
}

const EXISTING_CAPABILITIES = ['local', 'ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'tournament', 'progress'] as const;

export const GAME_CATALOG = [
  {
    id: 'gatos-caes',
    name: 'Gatos & Cães',
    description: 'Jogo de colocação: coloca peças sem que gatos fiquem ao lado de cães. Ganha quem fizer a última jogada!',
    accent: 'var(--jogo-gatos)',
    cycles: ['1.º Ciclo'],
    mark: '🐱',
    selection: 'archive',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'dominorio',
    name: 'Dominório',
    description: 'Coloca dominós no tabuleiro: um joga na vertical, outro na horizontal. Ganha quem colocar a última peça!',
    accent: 'var(--jogo-dominorio)',
    cycles: ['1.º Ciclo', '2.º Ciclo'],
    mark: '🁓',
    selection: 'current',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'quelhas',
    name: 'Quelhas',
    description: 'Coloca segmentos no tabuleiro: um joga na vertical, outro na horizontal. ATENÇÃO: Perde quem fizer a última jogada!',
    accent: 'var(--jogo-quelhas)',
    cycles: ['1.º Ciclo', '2.º Ciclo', '3.º Ciclo'],
    mark: '▮',
    selection: 'current',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'produto',
    name: 'Produto',
    description: 'Maximiza a pontuação dos teus grupos num tabuleiro hexagonal. Sabota o adversário unindo os grupos dele!',
    accent: 'var(--jogo-produto)',
    cycles: ['2.º Ciclo', '3.º Ciclo', 'Secundário'],
    mark: '×',
    selection: 'current',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'atari-go',
    name: 'Atari Go',
    description: 'Variante simplificada do Go: rodeia as pedras adversárias. A primeira captura vence o jogo!',
    accent: 'var(--jogo-atari)',
    cycles: ['3.º Ciclo', 'Secundário'],
    mark: '●',
    selection: 'current',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'nex',
    name: 'Nex',
    description: 'Jogo de conexão com peças neutras. Liga as tuas margens opostas antes do adversário!',
    accent: 'var(--jogo-nex)',
    cycles: ['Secundário'],
    mark: '⬡',
    selection: 'archive',
    capabilities: EXISTING_CAPABILITIES,
  },
  {
    id: 'faisca',
    name: 'Faísca',
    description: 'Coloca uma peça e aponta para a próxima casa. Deixa o adversário sem jogada válida!',
    accent: 'var(--tinta)',
    cycles: ['1.º Ciclo', '2.º Ciclo'],
    mark: '➤',
    selection: 'integration',
    capabilities: ['local', 'ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'progress'],
  },
  {
    id: 'y',
    name: 'Y',
    description: 'Liga os três lados do tabuleiro com um único grupo de peças da tua cor.',
    accent: 'var(--tinta)',
    cycles: ['Secundário'],
    mark: 'Y',
    selection: 'integration',
    capabilities: ['local', 'ai', 'tutor', 'review', 'progress'],
  },
] as const satisfies readonly GameDefinition[];

export type GameId = (typeof GAME_CATALOG)[number]['id'];
export type GameWithCapability<C extends GameCapability> = {
  [G in (typeof GAME_CATALOG)[number] as G['id']]: C extends G['capabilities'][number] ? G['id'] : never;
}[GameId];

export const GAME_IDS: GameId[] = GAME_CATALOG.map(game => game.id);
export const GAME_NAMES = Object.fromEntries(GAME_CATALOG.map(game => [game.id, game.name])) as Record<GameId, string>;

export function getGame(id: string): (GameDefinition & { id: GameId }) | undefined {
  return GAME_CATALOG.find(game => game.id === id);
}

export function isGameAvailable(game: GameDefinition, capability: GameCapability, includeIntegration = false, selection: BrowsableSelection = 'current'): boolean {
  if (!game.capabilities.includes(capability)) return false;
  if (selection === 'archive') return game.selection === 'archive';
  // Until #38 activates the complete edition, the public default keeps all six
  // existing games. Explicit integration preview already separates the archive.
  return game.selection === 'current' || (includeIntegration
    ? game.selection === 'integration'
    : game.selection === 'archive');
}

export function getGamesFor(capability: GameCapability, includeIntegration = false, selection: BrowsableSelection = 'current'): Array<GameDefinition & { id: GameId }> {
  return GAME_CATALOG.filter(game => isGameAvailable(game, capability, includeIntegration, selection));
}

/** The profile retains archived progress, without advertising unfinished games. */
export function getProfileGames(includeIntegration = false): Array<GameDefinition & { id: GameId }> {
  return GAME_CATALOG.filter((game: GameDefinition) =>
    game.capabilities.includes('progress') && (game.selection !== 'integration' || includeIntegration)
  );
}

/** Explicit preview applies to every app route; it never activates an edition. */
export function isIntegrationPreview(search = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get('integracao') === '1';
}
