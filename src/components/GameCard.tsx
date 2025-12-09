interface GameCardProps {
  titulo: string;
  descricao: string;
  emoji: string;
  corFundo: string;
  onClick: () => void;
}

export function GameCard({ titulo, descricao, emoji, corFundo, onClick }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className={`game-card w-full text-left ${corFundo}`}
    >
      <div className="relative z-10">
        <div className="text-6xl mb-4 animate-float">{emoji}</div>
        <h2 className="text-2xl font-bold text-white text-shadow mb-2">{titulo}</h2>
        <p className="text-white/80 text-sm">{descricao}</p>
        
        <div className="mt-4 flex items-center text-white/90 text-sm font-medium">
          <span>Jogar agora</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      {/* Decoração de fundo */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
        <div className="text-9xl transform translate-x-8 -translate-y-4">{emoji}</div>
      </div>
    </button>
  );
}

