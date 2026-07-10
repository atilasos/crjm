import {
  PATTERN_CARDS,
  STARTER_ACHIEVEMENTS,
  STARTER_MISSIONS,
  type AchievementCategory,
} from '../ai-core/gamification';
import { useGamification } from './gamification/GamificationProvider';
import { GameProgressBars, GAME_LABELS } from './gamification/GameProgressBars';
import { Header } from './Header';

interface PerfilPageProps {
  onVoltar: () => void;
}

const ACHIEVEMENT_GROUPS: Array<{ category: AchievementCategory; title: string }> = [
  { category: 'onboarding', title: 'Primeiros passos' },
  { category: 'aprendizagem', title: 'Aprendizagem' },
  { category: 'consistencia', title: 'Consistência' },
  { category: 'por-jogo', title: 'Por jogo' },
];

function currentWeekKey(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function formatStreak(days: number): string {
  return `streak ${Math.max(0, days)} dia(s)`;
}

export function PerfilPage({ onVoltar }: PerfilPageProps) {
  const { claimMissionReward, isReady, level, levelTitle, missions, profile, xpWindow } = useGamification();
  const shieldUsedThisWeek = profile.streakShieldWeeks.includes(currentWeekKey());
  const missionHistory = Object.entries(profile.missionClaims)
    .map(([claimKey, claim]) => {
      const separator = claimKey.lastIndexOf(':');
      const missionId = separator > 0 ? claimKey.slice(0, separator) : claimKey;
      return {
        mission: STARTER_MISSIONS.find((candidate) => candidate.id === missionId),
        claim,
      };
    })
    .filter((item): item is { mission: NonNullable<typeof item.mission>; claim: typeof item.claim } => Boolean(item.mission))
    .sort((a, b) => b.claim.claimedAt.localeCompare(a.claim.claimedAt))
    .slice(0, 5);

  return (
    <div className="min-h-screen">
      <Header titulo="Perfil do Jogador" onVoltar={onVoltar} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-6 text-white backdrop-blur-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Perfil</p>
              <h2 className="text-3xl font-bold">{isReady ? levelTitle : 'A sincronizar...'}</h2>
              <p className="mt-1 text-white/80">
                {isReady ? `Nível ${level} · ${profile.totalXp} XP total · ${formatStreak(profile.streakDays)}` : 'A carregar dados do jogador...'}
              </p>
              <p className="mt-2 text-sm text-amber-200">
                🛡️ Escudo semanal: {shieldUsedThisWeek ? 'usado — renova na próxima segunda-feira' : 'disponível para proteger um dia em falta'}
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="flex justify-between text-xs text-white/80">
                <span>XP atual</span>
                <span>{isReady ? `${profile.totalXp - xpWindow.current} / ${xpWindow.next - xpWindow.current}` : '- / -'}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 transition-all duration-500 ${!isReady ? 'animate-pulse opacity-50' : ''}`}
                  style={{
                    width: isReady ? `${Math.min(
                      100,
                      ((profile.totalXp - xpWindow.current) / Math.max(1, xpWindow.next - xpWindow.current)) * 100,
                    )}%` : '0%',
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-white/70">{isReady ? `+${profile.sessionXp} XP acumulado nesta sessão` : 'A calcular sessão...'}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <GameProgressBars isReady={isReady} gameProgress={profile.gameProgress} />

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-lg font-bold">Missões</p>
              <div className="mt-4 space-y-3">
                {!isReady ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3 animate-pulse">
                    <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-white/10 rounded w-3/4 mb-3"></div>
                    <div className="h-2 bg-white/15 rounded-full w-full"></div>
                  </div>
                ) : missions.map((mission) => (
                  <div key={mission.id} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{mission.title}</p>
                      <span className="text-xs text-white/70">
                        {mission.progress}/{mission.target}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/75">{mission.description}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-green-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
                      />
                    </div>
                    {mission.completed && (
                      <button
                        type="button"
                        onClick={() => claimMissionReward(mission.id)}
                        disabled={mission.claimed}
                        className="mt-3 min-h-12 w-full rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-default disabled:bg-white/15 disabled:text-white/60"
                      >
                        {mission.claimed ? 'Recompensa recebida' : `Receber +${mission.rewardXp} XP`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-white/15 pt-4">
                <p className="text-sm font-bold">Histórico de recompensas</p>
                {missionHistory.length === 0 ? (
                  <p className="mt-2 text-sm text-white/60">Ainda não recebeste recompensas de missões.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {missionHistory.map(({ mission, claim }) => (
                      <li key={`${mission.id}:${claim.claimedAt}`} className="flex items-center justify-between gap-3 text-sm text-white/75">
                        <span>{mission.title}</span>
                        <span className="whitespace-nowrap text-xs text-emerald-200">
                          +{mission.rewardXp} XP · {new Date(claim.claimedAt).toLocaleDateString('pt-PT')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-lg font-bold">Atividade Recente</p>
              <div className="mt-4 space-y-3">
                {!isReady ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-black/10 p-3 animate-pulse">
                      <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-white/10 rounded w-3/4"></div>
                    </div>
                  ))
                ) : profile.recentEvents.length === 0 ? (
                  <p className="text-sm text-white/60 text-center py-4">Ainda não há atividade recente.</p>
                ) : (
                  [...profile.recentEvents].reverse().slice(0, 5).map((event, i) => (
                    <div key={`${event.at}-${i}`} className="rounded-2xl border border-white/10 bg-black/10 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">
                          {event.type === 'game_completed'
                            ? 'Partida jogada'
                            : event.type === 'review_completed'
                              ? 'Revisão concluída'
                              : 'Puzzle resolvido'}
                        </p>
                        <p className="text-xs text-white/70">
                          {GAME_LABELS[event.gameId] || event.gameId}
                          {event.type === 'game_completed' && (
                            <span className={event.won ? 'text-emerald-400' : 'text-white/50'}>
                              {event.won ? ' • Vitória' : ' • Derrota'}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-white/50 whitespace-nowrap">
                        {new Date(event.at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold">Conquistas</p>
            <span className="text-sm text-white/70">
              {isReady ? `${Object.keys(profile.achievements).length}/${STARTER_ACHIEVEMENTS.length}` : '-/-'}
            </span>
          </div>
          <div className="mt-5 space-y-7">
            {ACHIEVEMENT_GROUPS.map((group) => (
              <section key={group.category} aria-labelledby={`achievement-${group.category}`}>
                <h3 id={`achievement-${group.category}`} className="text-sm font-black uppercase tracking-[0.16em] text-amber-200">
                  {group.title}
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {STARTER_ACHIEVEMENTS.filter((achievement) => achievement.category === group.category).map((achievement) => {
                    const unlocked = profile.achievements[achievement.id];
                    return (
                      <div
                        key={achievement.id}
                        className={`rounded-2xl border p-4 ${
                          unlocked
                            ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
                            : 'border-white/10 bg-black/10 text-white'
                        } ${!isReady ? 'animate-pulse opacity-70' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{achievement.title}</p>
                          <span className="text-xs font-medium">{unlocked ? '✓' : '🔒'}</span>
                        </div>
                        <p className={`mt-2 text-sm ${unlocked ? 'text-emerald-900/80' : 'text-white/75'}`}>
                          {achievement.description}
                        </p>
                        <p className={`mt-3 text-xs ${unlocked ? 'text-emerald-800' : 'text-white/60'}`}>
                          +{achievement.xp} XP {achievement.gameId ? `· ${GAME_LABELS[achievement.gameId]}` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold">Cartões de estratégia</p>
              <p className="mt-1 text-sm text-white/70">Descobre um padrão, usa-o com apoio e depois sozinho em três situações diferentes.</p>
            </div>
            <span className="text-sm text-white/70">
              {Object.keys(profile.patterns).length}/{PATTERN_CARDS.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PATTERN_CARDS.map((card) => {
              const progress = profile.patterns[card.id];
              const stateLabel = progress?.state === 'mastered'
                ? '⭐ Dominado'
                : progress?.state === 'used_alone'
                  ? '✅ Usado sozinho'
                  : progress?.state === 'used_with_help'
                    ? '🛠️ Usado com ajuda'
                    : progress?.state === 'seen'
                      ? '👁️ Visto'
                      : '🔒 Ainda não descoberto';
              return (
                <article
                  key={card.id}
                  className={`rounded-2xl border p-4 ${progress ? 'border-sky-300/60 bg-sky-950/30' : 'border-white/10 bg-black/10'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{card.title}</p>
                    <span className="text-xs text-white/60">Fase {card.minimumPhase}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/75">{card.description}</p>
                  <p className="mt-3 text-xs font-medium text-sky-200">{stateLabel}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
