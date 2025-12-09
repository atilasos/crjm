interface HeaderProps {
  titulo?: string;
  onVoltar?: () => void;
}

export function Header({ titulo, onVoltar }: HeaderProps) {
  return (
    <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
        {onVoltar && (
          <button
            onClick={onVoltar}
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            aria-label="Voltar à página inicial"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Voltar</span>
          </button>
        )}
        
        <div className="flex-1 flex items-center justify-center gap-3">
          <span className="text-3xl">🎲</span>
          <h1 className="text-xl md:text-2xl font-bold text-white text-shadow">
            {titulo || 'Jogos Matemáticos'}
          </h1>
        </div>
        
        {onVoltar && <div className="w-20" />} {/* Spacer para centrar o título */}
      </div>
    </header>
  );
}

