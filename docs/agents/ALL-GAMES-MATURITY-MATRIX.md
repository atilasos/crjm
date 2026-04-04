# All-Games Maturity Matrix — CRJM

Data: 2026-04-04

## Objetivo
Dar visibilidade rápida ao estado técnico e pedagógico de cada jogo relativamente ao objetivo de treino de campeonato.

| Jogo | Engine principal | Fallback | Adapter V1 | Tutor UI | Revisão pós-jogo | Estado resumido |
|---|---|---|---|---|---|---|
| Dominório | TS + opening book (WASM não ativo no adapter atual) | TS inline | Sim | Sim | Sim | jogo-piloto maduro; falta continuar calibração/confiança |
| Atari Go | WASM/worker | TS local (`jogadaComputador`) | Sim | Sim | Parcial | bom segundo piloto; ainda sensível a calibração F4 |
| Quelhas | worker/TS com sinais de runtime | TS inline | Sim (novo) | Sim (novo) | Sim (novo) | em consolidação; precisa hardening e build verde no fluxo completo |
| Gatos & Cães | TS forte inline | n/a (mesma engine) | Sim (novo) | Sim (novo) | Sim (novo) | base algorítmica ligada ao tutor; precisa validação prática e calibração |
| Produto | WASM-first | `null` / fallback fraco | Não (alvo F6) | Não (alvo F6) | Não | precisa bridge pedagógica + confiança mínima |
| Nex | WASM-first | `null` | Não (alvo F6) | Não (alvo F6) | Não | precisa bridge pedagógica + fallback/trust surface |

## Leitura rápida
### Mais avançados
- **Dominório** e **Atari Go** já mostram o padrão de tutor jogável.
- **Quelhas** está a aproximar-se desse patamar no worktree atual.

### Melhor próximo investimento
- **Gatos & Cães** oferece o melhor rácio esforço/ganho porque já tem motor TS forte e não depende de bridge WASM complexa.

### Maiores riscos
- **Produto** e **Nex** não podem receber copy pedagógica “confiante” sem first-pass de confiança/fallback.

## Regra operacional
Antes de declarar um jogo “pronto para treino”, garantir:
1. caminho de decisão observável (`stats` + engine/fallback);
2. explicação curta e acionável;
3. top moves / alternativa;
4. revisão pós-jogo ou turning point;
5. progressão de dificuldade minimamente consistente.
