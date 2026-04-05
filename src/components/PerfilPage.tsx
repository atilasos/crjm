import { STARTER_ACHIEVEMENTS } from '../ai-core/gamification';
import { useGamification } from './gamification/GamificationProvider';
import { GameProgressBars } from './gamification/GameProgressBars';
import { Header } from './Header';

interface PerfilPageProps {
  onVoltar: () => void;
}

export function PerfilPage({ onVoltar }: PerfilPageProps) {
  const { level, levelTitle, missions, profile, xpWindow } = useGamification();

  return (
    <div className="min-h-screen">
      <Header titulo="Perfil do Jogador" onVoltar={onVoltar} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-6 text-white backdrop-blur-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Perfil</p>
              <h2 className="text-3xl font-bold">{levelTitle}</h2>
              <p className="mt-1 text-white/80">
                Nível {level} · {profile.totalXp} XP total · streak {Math.max(profile.streakDays, 1)} dia(s)
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="flex justify-between text-xs text-white/80">
                <span>XP atual</span>
                <span>{profile.totalXp - xpWindow.current} / {xpWindow.next - xpWindow.current}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((profile.totalXp - xpWindow.current) / Math.max(1, xpWindow.next - xpWindow.current)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-white/70">+{profile.sessionXp} XP acumulado nesta sessão</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <GameProgressBars gameProgress={profile.gameProgress} />

          <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
            <p className="text-lg font-bold">Missões</p>
            <div className="mt-4 space-y-3">
              {missions.map((mission) => (
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
                      className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-green-500"
                      style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold">Conquistas</p>
            <span className="text-sm text-white/70">
              {Object.keys(profile.achievements).length}/{STARTER_ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {STARTER_ACHIEVEMENTS.map((achievement) => {
              const unlocked = profile.achievements[achievement.id];
              return (
                <div
                  key={achievement.id}
                  className={`rounded-2xl border p-4 ${
                    unlocked
                      ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
                      : 'border-white/10 bg-black/10 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{achievement.title}</p>
                    <span className="text-xs font-medium">
                      {unlocked ? '✓' : '🔒'}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm ${unlocked ? 'text-emerald-900/80' : 'text-white/75'}`}>
                    {achievement.description}
                  </p>
                  <p className={`mt-3 text-xs ${unlocked ? 'text-emerald-800' : 'text-white/60'}`}>
                    +{achievement.xp} XP {achievement.gameId ? `· ${achievement.gameId}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
