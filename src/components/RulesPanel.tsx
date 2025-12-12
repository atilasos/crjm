import { useState } from 'react';

interface RulesPanelProps {
  titulo: string;
  regras: string[];
}

export function RulesPanel({ titulo, regras }: RulesPanelProps) {
  const [aberto, setAberto] = useState(true);

  return (
    <div className="rules-panel">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="flex items-center gap-2">
          <span className="text-2xl">📜</span>
          Regras de {titulo}
        </h3>
        <svg
          className={`w-5 h-5 text-indigo-600 transition-transform ${aberto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {aberto && (
        <ul className="mt-4 space-y-3">
          {regras.map((regra, index) => (
            <li key={index} className="text-gray-700">
              {regra}
            </li>
          ))}
        </ul>
      )}
      
      <div className="mt-6 pt-4 border-t border-indigo-100">
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <span>💡</span>
          <span>Dica: Pensa bem antes de cada jogada!</span>
        </p>
      </div>
    </div>
  );
}

