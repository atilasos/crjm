import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatStreak, PerfilPage } from './PerfilPage';
import { GamificationProvider } from './gamification/GamificationProvider';

describe('PerfilPage', () => {
  test('organiza conquistas e explica streak, escudo e histórico', () => {
    const html = renderToStaticMarkup(
      <GamificationProvider>
        <PerfilPage onVoltar={() => undefined} />
      </GamificationProvider>,
    );

    for (const heading of ['Primeiros passos', 'Aprendizagem', 'Consistência', 'Por jogo']) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('Escudo semanal');
    expect(html).toContain('disponível');
    expect(html).toContain('Histórico de recompensas');
    expect(html).toContain('Ainda não recebeste recompensas de missões.');
    expect(formatStreak(0)).toBe('streak 0 dia(s)');
  });
});
