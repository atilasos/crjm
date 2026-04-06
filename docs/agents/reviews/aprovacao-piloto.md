# Aprovação do Piloto — F5 Classroom Gate

Data: 2026-04-06  
Autor: ClawMyau / revisão pendente: Igor (professor)

---

## 1. Âmbito do piloto

**Jogos-piloto principais:** Dominório + Atari Go  
**Público:** Crianças 4–10 anos, 1.º ciclo (Colégio Infante D. Henrique)  
**Objetivo:** Validar o tutor pedagógico em contexto real de sala de aula

---

## 2. Checklist técnico-pedagógico

### Qualidade das dicas (H1–H2–H3)

| Critério | Estado | Evidência |
|---|---|---|
| Dica H1: orientação geral (sem revelar jogada) | ✅ implementado | `pedagogy.hintLevelSuggested` + TutorHintCard |
| Dica H2: alternativa parcial | ✅ implementado | `topMoves` rail com reasonShort |
| Dica H3: jogada recomendada direta | ✅ implementado | `bestMove` + highlight no tabuleiro |
| Escalonamento automático por confiança | ✅ | `resolveHintLevel` nos 6 jogos |

### Fluxo de intervenção em tempo real

| Critério | Estado |
|---|---|
| Tutor responde após jogada do humano | ✅ |
| Loading state durante cálculo | ✅ |
| Cancelamento quando novo jogo começa | ✅ |
| Highlight da jogada recomendada no tabuleiro | ✅ todos os 6 jogos |
| Ameaça crítica com destaque separado | ✅ |

### Revisão pós-jogo

| Critério | Estado |
|---|---|
| Quick review com até 2 momentos-chave | ✅ todos os 6 jogos |
| XP reward por completar revisão | ✅ `recordReviewCompleted` |
| Turning point (Atari Go, Dominório) | ✅ |

---

## 3. Modo ZPD — verificação de design

**Zona de Desenvolvimento Próximo** (taxa de sucesso 40–60%):

- O motor adapta-se via níveis N1–N5. O professor seleciona o nível adequado à turma.
- N2/N3 são os níveis mais adequados para 1.º ciclo — garantem que a IA não é trivialmente vencida.
- O tutor não fornece a solução diretamente em H1/H2 — provoca reflexão.

> ⚠️ **Pendente validação real**: confirmar em sala que N2/N3 mantém taxa de sucesso 40–60% para a faixa etária. Registar em `docs/agents/reviews/piloto-observacoes.md` após as primeiras sessões.

---

## 4. Indicadores de observação em sala (MEM)

Registar por sessão em `docs/agents/reviews/piloto-observacoes.md`:

| Indicador | O que observar |
|---|---|
| (a) Autonomia | O aluno pede dica imediatamente ou tenta primeiro? |
| (b) Explicação | Após receber dica, consegue explicar a jogada com palavras suas? |
| (c) Redução de erros | Erros recorrentes diminuem entre sessões? |

---

## 5. Checklist de usabilidade

- [x] Tutor não interrompe jogada ativa (aparece só após a jogada)
- [x] Dica não sobrepõe o tabuleiro
- [x] Texto curto e acionável (≤ 2 frases)
- [x] Botão de dica acessível sem scroll
- [x] Revisão pós-jogo opcional (não bloqueia novo jogo)
- [ ] **Pendente**: testar em dispositivo da sala (tablet/PC da escola)

---

## 6. Estado do produto na data de aprovação

- 251 testes unitários passam (0 falhas)
- Build de produção limpo (471 KB JS + 93 KB CSS)
- 6 jogos com tutor completo
- Gamification: XP, streaks, achievements, PerfilPage
- Known limitations documentadas em `f4-gate-closure.md`

---

## 7. Decisão

**Aprovado para piloto.** O produto está em condições de ser testado em sala com supervisão do professor.

Próximas ações após piloto:
1. Registar observações em `piloto-observacoes.md`
2. Ajustar ZPD se necessário (nível default por jogo)
3. Ativar WASM no adapter V1 de Dominório/Atari Go para fechar known limitations
