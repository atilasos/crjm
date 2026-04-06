# Plano F5 — Classroom-ready Gate (Piloto)

**Objetivo:** Transição do motor de IA para **Tutor Pedagógico** funcional, validado em sala de aula (crianças 4–10 anos).

---

## 1. Critérios de Passagem
- [ ] **Checklist técnico-pedagógico**: Validar a qualidade das dicas (hints H1–H3) e eficácia da revisão pós-jogo.
- [ ] **Fluxo do tutor**: Validar os 2 jogos-piloto (Dominório + Atari Go) com fluxo de intervenção IA em tempo real.
- [ ] **Modo ZPD**: Garantir que a taxa de sucesso se mantém entre 40–60% (zona de desafio).
- [ ] **Revisão Pedagógica**: O feedback da IA é "instrutivo" (provoca reflexão) e não "solucionador"?

## 2. Tarefas de Implementação

### T1 — Validação do Motor Tutor (Shadow Mode)
- Correr 5 partidas de teste por jogo com "Shadow Tutor" (IA analisa jogadas reais do Igor/professores).
- Identificar desvios entre comportamento da IA vs feedback esperado (pelo prof).
- Registar desvios em `docs/agents/reviews/`.

### T2 — Checklist de Observação em Sala (MEM)
- Definir 3 indicadores de sucesso para o aluno:
  - (a) autonomia na resolução (não pede dica imediata);
  - (b) capacidade de explicar a jogada após dica;
  - (c) redução de erros recorrentes.

### T3 — Documentação de Aprovação
- Criar `docs/agents/reviews/aprovacao-piloto.md` com evidência:
  - Logs das partidas teste.
  - Verificação de ZPD.
  - Checklist de usabilidade (IA não intrusiva).

---

## 3. Próximos Passos (Semana 1)
1. **Configurar modo "Tutor Interventivo"** nos motores estabilizados (F4).
2. **Executar Shadow Mode** para calibração final do feedback.
3. **Produzir ficheiro de aprovação** para o piloto.

---

## Regras de execução
1. **Foco total na pedagogia**: IA é meio, não fim.
2. **Observação ativa**: Priorizar feedback do professor sobre o feedback técnico puro.
3. **Simplicidade**: Se o tutor confunde a criança, desligar a funcionalidade específica e simplificar (corte na complexidade).
