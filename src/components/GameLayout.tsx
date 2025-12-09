import { ReactNode } from 'react';
import { Header } from './Header';
import { RulesPanel } from './RulesPanel';

interface GameLayoutProps {
  titulo: string;
  regras: string[];
  children: ReactNode;
  onVoltar: () => void;
}

export function GameLayout({ titulo, regras, children, onVoltar }: GameLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header titulo={titulo} onVoltar={onVoltar} />
      
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
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

