import { checkYLaboratory } from './y-laboratory-flow';
import { checkFaiscaLaboratory } from './faisca-laboratory-flow';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { playYAgainstComputer, checkYTutor, checkYReview } from './y-browser-flow';
import { checkFaiscaTutor, playFaiscaAgainstComputer, playFaiscaLocalExample } from './faisca-browser-flow';

const PORT = 3200 + (process.pid % 1000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = `/tmp/crjm-e2e-learner-core-${process.pid}.sqlite`;
const LEGACY_PROFILE_KEY = 'crjm.gamification.v1';
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

async function launchBrowser(): Promise<Browser> {
  if (process.env.HUB_CDP_URL) return chromium.connectOverCDP(process.env.HUB_CDP_URL);
  const configuredChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  if (configuredChannel) {
    return chromium.launch({ headless: true, channel: configuredChannel });
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
      console.warn('[e2e:learner-core] Chromium Playwright ausente; a usar channel=chrome.');
      return chromium.launch({ headless: true, channel: 'chrome' });
    }
    throw error;
  }
}

const legacyProfile = {
  totalXp: 42,
  sessionXp: 0,
  streakDays: 3,
  lastActiveDate: '2026-04-06',
  achievements: {},
  gameProgress: {
    'gatos-caes': { played: 4, wins: 2, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
    dominorio: { played: 2, wins: 1, reviews: 1, rules: 1, strategy: 1, mastery: 1 },
    quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    nex: { played: 3, wins: 1, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
  },
  recentEvents: [
    { type: 'game_completed', gameId: 'dominorio', at: '2026-04-06T10:00:00.000Z', won: true },
    { type: 'review_completed', gameId: 'dominorio', at: '2026-04-06T10:10:00.000Z' },
  ],
};

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }

  throw new Error('learner-core test server did not become ready');
}

async function expectText(page: import('playwright').Page, text: string): Promise<void> {
  try {
    await page.waitForFunction(
      (expected) => document.querySelector('main')?.innerText.includes(expected) ?? false,
      text,
      { timeout: 30000 },
    );
  } catch (error) {
    const mainText = await page.locator('main').innerText().catch(() => '<main> indisponível');
    console.error(`Texto E2E em falta: ${JSON.stringify(text)}\n--- <main> ---\n${mainText}`);
    throw error;
  }
}

async function main() {
  await rm(DB_PATH, { force: true });

  const server: ChildProcessWithoutNullStreams = spawn('bun', ['src/index.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CRJM_LEARNER_DB_PATH: DB_PATH,
      CRJM_SESSION_SECRET: 'e2e-learner-core-secret',
    },
    stdio: 'pipe',
  });

  let shutdown = false;
  const stopServer = async () => {
    if (shutdown) return;
    shutdown = true;
    server.kill('SIGTERM');
    await rm(DB_PATH, { force: true });
  };

  server.on('exit', (code) => {
    if (!shutdown && code !== 0) {
      console.error(`learner-core e2e server exited early with code ${code}`);
    }
  });

  try {
    await waitForServer();

    const browser = await launchBrowser();
    const context = await browser.newContext({ locale: 'pt-PT', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await page.addInitScript(
      (values: string[]) => {
        const [key, value] = values;
        if (!key || value === undefined) return;
        window.localStorage.setItem(key, value);
      },
      [LEGACY_PROFILE_KEY, JSON.stringify(legacyProfile)],
    );

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();

    await expectText(page, '42 XP total');
    await expectText(page, '6/29');
    await expectText(page, '2 partidas');
    await expectText(page, '1 revisões');
    await expectText(page, 'Atividade Recente');
    await expectText(page, 'Partida jogada');
    await expectText(page, 'Revisão concluída');
    // The 25 existing pattern cards plus one each for Faísca and Y.
    await expectText(page, '0/27');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '42 XP total');
    await expectText(page, '6/29');

    const commandResult = await page.evaluate(async () => {
      const gameResponse = await fetch('/api/learner/events/game-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'dominorio', won: true, difficultyLevel: 2 }),
        credentials: 'include',
      });

      const reviewResponse = await fetch('/api/learner/events/review-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'dominorio' }),
        credentials: 'include',
      });

      return {
        game: await gameResponse.json(),
        review: await reviewResponse.json(),
      };
    });

    if (commandResult.game.dashboard.profile.totalXp !== 60) {
      throw new Error(`expected totalXp 60 after game command, got ${commandResult.game.dashboard.profile.totalXp}`);
    }
    if (commandResult.review.dashboard.profile.totalXp !== 70) {
      throw new Error(`expected totalXp 70 after review command, got ${commandResult.review.dashboard.profile.totalXp}`);
    }
    const levelSnapshot = commandResult.game.dashboard.levelProgress?.dominorio?.[2];
    if (!levelSnapshot || levelSnapshot.wins !== 1 || levelSnapshot.played !== 1 || levelSnapshot.bestWinStreak !== 1) {
      throw new Error(`expected level progress N2 {played:1, wins:1}, got ${JSON.stringify(levelSnapshot)}`);
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '70 XP total');
    await expectText(page, '3 partidas');
    await expectText(page, '2 revisões');
    await expectText(page, '5/29');
    await expectText(page, 'Atividade Recente');

    const localValue = await page.evaluate((key) => window.localStorage.getItem(key), LEGACY_PROFILE_KEY);
    if (localValue !== null) {
      throw new Error('expected legacy local profile to be cleared after successful import');
    }

    const archivedProgress = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    for (const gameId of ['gatos-caes', 'nex'] as const) {
      if (JSON.stringify(archivedProgress.gameProgress[gameId]) !== JSON.stringify(legacyProfile.gameProgress[gameId])) {
        throw new Error(`O progresso legado de ${gameId} não foi preservado.`);
      }
    }
    await page.goto(`${BASE_URL}/#/faisca`, { waitUntil: 'networkidle' });
    await checkFaiscaTutor(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Já praticaste a próxima casa com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.', { exact: true }).waitFor();
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Reload revealed a solution');
    const assisted = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (assisted.patterns['faisca:proxima-casa'].state !== 'used_with_help' || assisted.patterns['faisca:proxima-casa'].soloContextIds.length) throw new Error('Hint became independent evidence');
    await playFaiscaLocalExample(page);
    await page.getByRole('status').filter({ hasText: 'Venceu Vermelho!' }).waitFor();
    if (!await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).isDisabled()) throw new Error('Partida terminada ainda permite jogar.');
    await page.waitForFunction(async () => {
      const dashboard = await (await fetch('/api/learner/dashboard')).json();
      return dashboard.gameProgress.faisca.played === 1;
    });
    const afterFaisca = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (afterFaisca.profile.totalXp !== 83 || afterFaisca.gameProgress.faisca.wins !== 0) throw new Error('Resultado local de Faísca não respeita a prática existente.');
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex']) {
      if (JSON.stringify(afterFaisca.gameProgress[gameId]) !== JSON.stringify(archivedProgress.gameProgress[gameId])) throw new Error(`Faísca alterou ${gameId}.`);
    }
    if (await page.locator('[data-thinking-tutor]').count()) throw new Error('Tutor remains active after the match');
    const review = page.getByRole('region', { name: 'Revisão rápida pós-jogo' });
    await review.getByText('Decisão da partida: turno 22, Vermelho.', { exact: true }).waitFor();
    await review.getByText('Colocar em a3: distância 2, Baixo → a1.', { exact: true }).waitFor();
    await review.getByText('Consequência verificada pelas regras: 0 respostas legais para o adversário.', { exact: true }).waitFor();
    await review.getByText('Colocar em a3: distância 3, Direita → d3.', { exact: true }).waitFor();
    await review.getByText('Consequência verificada pelas regras: 3 respostas legais para o adversário.', { exact: true }).waitFor();
    await review.getByText('Jogada realizada', { exact: true }).waitFor();
    await review.getByText('Alternativa legal', { exact: true }).waitFor();
    await review.getByText('Ver a posição antes da decisão', { exact: true }).click();
    await review.getByRole('img', { name: 'a3: Casa obrigatória', exact: true }).waitFor();
    if (await review.getByRole('group', { name: 'Posição antes da decisão' }).locator('[data-player]').count() < 1) throw new Error('Review did not retain a real position');
    // The server saves the review, but the acknowledgement is lost. Retrying
    // the visible action must not grant a second reward.
    const reviewUrl = '**/api/learner/events/review-completed';
    await page.route(reviewUrl, async route => {
      await route.fetch();
      await route.fulfill({ status: 503, body: '{}' });
    });
    await review.getByRole('button', { name: 'Marcar revisão concluída (+10 XP)', exact: true }).click();
    await review.getByRole('alert').waitFor();
    await page.unroute(reviewUrl);
    await review.getByRole('button', { name: 'Marcar revisão concluída (+10 XP)', exact: true }).click();
    await review.getByRole('button', { name: 'Revisão registada', exact: true }).waitFor();
    if (!await review.getByRole('button', { name: 'Revisão registada', exact: true }).isDisabled()) throw new Error('Review can be rewarded twice');
    const reviewed = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (reviewed.gameProgress.faisca.reviews !== 1 || reviewed.profile.totalXp !== afterFaisca.profile.totalXp + 10) throw new Error('Review reward is wrong');
    if (reviewed.patterns['faisca:proxima-casa'].state !== 'used_with_help') throw new Error('Review erased assistance');
    Object.assign(afterFaisca, reviewed);
    await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Vez de Azul' }).waitFor();
    if (await page.getByRole('region', { name: 'Revisão rápida pós-jogo' }).count() || await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Restart retained review or hints');
    await page.goto(`${BASE_URL}/#/y`, { waitUntil: 'networkidle' });
    await checkYTutor(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Já praticaste os três lados com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.', { exact: true }).waitFor();
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Y: reload revealed a solution');
    await page.getByLabel('O meu perfil corresponde a:').selectOption('jogador2');
    const yBoard = page.getByRole('group', { name: 'Intersecções de Y' });
    const placeY = (id: string) => yBoard.getByRole('button', { name: new RegExp(`^${id}:`) }).click();
    await placeY('A1');
    await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click();
    const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
    const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
    for (let i = 0; i < path.length; i++) { await placeY(replies[i]!); await placeY(path[i]!); }
    await page.getByRole('status').filter({ hasText: 'Venceu Jogador 2 com Azul!' }).waitFor();
    await page.waitForFunction(async () => {
      const dashboard = await (await fetch('/api/learner/dashboard')).json();
      return dashboard.gameProgress.y.played === 1;
    });
    const afterY = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    // The first assisted Y pattern adds the existing +3 XP practice reward.
    if (afterY.profile.totalXp !== 114 || afterY.gameProgress.y.wins !== 1) throw new Error('Y não atribuiu a vitória ao participante do perfil após troca.');
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'faisca']) {
      if (JSON.stringify(afterY.gameProgress[gameId]) !== JSON.stringify(afterFaisca.gameProgress[gameId])) throw new Error(`Y alterou ${gameId}.`);
    }
    await checkYReview(page, 'jogador2', true);
    const yReview = page.getByRole('region', { name: 'Revisão rápida pós-jogo' });
    // Lost acknowledgement: retry the same real decision, without a second reward.
    await page.route(reviewUrl, async route => {
      await route.fetch();
      await route.fulfill({ status: 503, body: '{}' });
    });
    await yReview.getByRole('button', { name: 'Marcar revisão concluída (+10 XP)', exact: true }).click();
    await yReview.getByRole('alert').waitFor();
    await page.unroute(reviewUrl);
    await yReview.getByRole('button', { name: 'Marcar revisão concluída (+10 XP)', exact: true }).click();
    await yReview.getByRole('button', { name: 'Revisão registada', exact: true }).waitFor();
    const yReviewed = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (yReviewed.profile.totalXp !== afterY.profile.totalXp + 10 || yReviewed.gameProgress.y.reviews !== 1) throw new Error('Y: duplicated or missing review reward');
    if (yReviewed.patterns['y:tres-lados'].state !== 'used_with_help' || yReviewed.patterns['y:tres-lados'].soloContextIds.length) throw new Error('Y: guided review became independent evidence');
    Object.assign(afterY, yReviewed);
    await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    if (await page.getByRole('region', { name: 'Revisão rápida pós-jogo' }).count() || await page.locator('[data-tutor-solution]').count()) throw new Error('Y: restart retained review or example');
    let faiscaWins = 0;
    let faiscaPlayed = 1;
    const winsByLevel = { 1: 0, 2: 0 };
    for (const level of [1, 2] as const) {
      for (const human of ['jogador1', 'jogador2'] as const) {
        await page.goto(`${BASE_URL}/#/faisca`, { waitUntil: 'networkidle' });
        const won = await playFaiscaAgainstComputer(page, human, level);
        faiscaWins += Number(won);
        winsByLevel[level] += Number(won);
        faiscaPlayed++;
        await page.waitForFunction(async count => {
          const dashboard = await (await fetch('/api/learner/dashboard')).json();
          return dashboard.gameProgress.faisca.played === count;
        }, faiscaPlayed);
      }
    }
    const afterTraining = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (afterTraining.gameProgress.faisca.wins !== faiscaWins) throw new Error('Vitórias não correspondem ao lado do aluno.');
    for (const level of [1, 2] as const) {
      const progress = afterTraining.levelProgress.faisca[level];
      if (progress.played !== 2 || progress.wins !== winsByLevel[level]) throw new Error(`Progresso errado em Faísca N${level}.`);
    }
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'y']) {
      if (JSON.stringify(afterTraining.gameProgress[gameId]) !== JSON.stringify(afterY.gameProgress[gameId])) throw new Error(`IA de Faísca alterou ${gameId}.`);
    }
    let yPlayed = afterTraining.gameProgress.y.played;
    let yWins = afterTraining.gameProgress.y.wins;
    const yWinsByLevel = { 1: 0, 2: 0 };
    for (const level of [1, 2] as const) {
      for (const human of ['jogador1', 'jogador2'] as const) {
        await page.goto(`${BASE_URL}/#/y`, { waitUntil: 'networkidle' });
        const won = await playYAgainstComputer(page, human, level);
        yWins += Number(won);
        yWinsByLevel[level] += Number(won);
        yPlayed++;
        await page.waitForFunction(async count => {
          const dashboard = await (await fetch('/api/learner/dashboard')).json();
          return dashboard.gameProgress.y.played === count;
        }, yPlayed);
      }
    }
    const afterYTraining = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (afterYTraining.gameProgress.y.wins !== yWins) throw new Error('Y: vitórias atribuídas ao participante errado.');
    for (const level of [1, 2] as const) {
      const progress = afterYTraining.levelProgress.y[level];
      if (progress.played !== 2 || progress.wins !== yWinsByLevel[level]) throw new Error(`Y: progresso errado em N${level}.`);
    }
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'faisca']) {
      if (JSON.stringify(afterYTraining.gameProgress[gameId]) !== JSON.stringify(afterTraining.gameProgress[gameId])) throw new Error(`IA de Y alterou ${gameId}.`);
    }
    await checkFaiscaLaboratory(page, BASE_URL);
    await checkYLaboratory(page, BASE_URL);
    Object.assign(afterYTraining, await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json()));
    const storageState = await context.storageState();
    await context.close();
    const resumed = await browser.newContext({ storageState });
    const resumedPage = await resumed.newPage();
    await resumedPage.goto(`${BASE_URL}/#/perfil`, { waitUntil: 'networkidle' });
    await expectText(resumedPage, 'Faísca');
    const learning = resumedPage.getByRole('heading', { name: 'O que já consigo fazer sem ajuda', exact: true }).locator('..');
    await learning.getByRole('heading', { name: 'Faísca', exact: true }).locator('..').locator('[data-strategy-progress="independent"]').waitFor();
    await learning.getByRole('heading', { name: 'Y', exact: true }).locator('..').locator('[data-strategy-progress="independent"]').waitFor();
    await expectText(resumedPage, `${afterYTraining.profile.totalXp} XP total`);
    const yCard = resumedPage.getByText('Y', { exact: true }).locator('../..');
    await yCard.getByText(`${yPlayed} partidas · 1 revisões`, { exact: true }).waitFor();
    await yCard.getByText(`Vitórias: ${yWins}`, { exact: true }).waitFor();
    const repeated = await resumedPage.evaluate(async legacy => {
      const response = await fetch('/api/learner/import-local-profile', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: legacy }),
      });
      return { status: response.status, body: await response.json() };
    }, legacyProfile);
    if (repeated.status !== 200) throw new Error(`Importação repetida: HTTP ${repeated.status}`);
    const resumedProfile = await resumedPage.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (JSON.stringify(resumedProfile) !== JSON.stringify(afterYTraining)) throw new Error('Nova sessão ou importação repetida alterou o perfil.');
    await resumedPage.goto(`${BASE_URL}/#/faisca`, { waitUntil: 'networkidle' });
    await resumedPage.getByText('Já praticaste a próxima casa com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.', { exact: true }).waitFor();
    if (resumedProfile.gameProgress.faisca.reviews !== 1 || resumedProfile.patterns['faisca:proxima-casa'].soloContextIds.length) throw new Error('New session lost guided review evidence');
    await resumedPage.goto(`${BASE_URL}/#/y`, { waitUntil: 'networkidle' });
    await resumedPage.getByText('Já praticaste os três lados com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.', { exact: true }).waitFor();
    if (await resumedPage.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0' || await resumedPage.locator('[data-tutor-solution]').count()) throw new Error('Y: new session revealed help');
    if (resumedProfile.gameProgress.y.reviews !== 1 || resumedProfile.patterns['y:tres-lados'].soloContextIds.length) throw new Error('Y: new session lost guided review evidence');
    await resumed.close();
    await browser.close();
    console.log('Learner-core V1 e2e flow passed');
  } finally {
    await stopServer();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
