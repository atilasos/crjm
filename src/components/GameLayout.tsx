import type { ReactNode } from 'react';
import { Header } from './Header';
import { RulesPanel } from './RulesPanel';
import { getGame, type GameId } from '../games/catalog';
import { useTranslation } from '../i18n/LanguageProvider';

interface GameLayoutProps {
  titulo: string;
  regras: string[];
  children: ReactNode;
  onVoltar: () => void;
  gameId?: GameId;
}

export function GameLayout({ titulo, regras, children, onVoltar, gameId }: GameLayoutProps) {
  const { t } = useTranslation();
  const archived = gameId && getGame(gameId)?.selection === 'archive';
  return (
    <div className="min-h-screen flex flex-col">
      <Header titulo={titulo} onVoltar={onVoltar} voltarLabel={archived ? 'Voltar ao Arquivo' : undefined} />
      
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {archived && <p className="mb-4 rounded-lg border p-3 [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)]">
            <strong>{t('Arquivo')}</strong>{' — '}{t('Arquivo jogável: continua a jogar e a aprender, com todo o teu progresso.')}
          </p>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Área do jogo */}
            <div className="lg:col-span-2">
              {children}
            </div>
            
            {/* Painel de regras */}
            <div className="lg:col-span-1">
              <RulesPanel titulo={titulo} regras={regras} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
