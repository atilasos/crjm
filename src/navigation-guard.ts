// Guarda de navegação para páginas que não podem ser abandonadas por acidente
// (ex.: torneio a decorrer, onde sair fecha a ligação WebSocket).
// Aplica-se apenas à navegação por hash (botão retroceder/avançar do browser);
// a navegação programática continua livre para fluxos deliberados como desligar.

let bloqueioAtivo: (() => boolean) | null = null;

export function registarBloqueioNavegacao(estaBloqueada: () => boolean): () => void {
  bloqueioAtivo = estaBloqueada;
  return () => {
    if (bloqueioAtivo === estaBloqueada) {
      bloqueioAtivo = null;
    }
  };
}

export function navegacaoBloqueada(): boolean {
  return bloqueioAtivo?.() ?? false;
}
