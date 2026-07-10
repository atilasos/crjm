# Checklist de sala de aula — CRJM

Usa esta lista no computador que vai servir a aplicação, antes de os alunos chegarem.

## Pré-aula (10 minutos)

- [ ] `bun install` terminou sem erro.
- [ ] `bun run classroom:smoke` passou: health, sessão anónima, seis workers e 21 percursos UI (seis jogos + laboratório × três viewports).
- [ ] `bun test src/games/*/logic.test.ts` passou.
- [ ] O computador está ligado à corrente e não vai suspender durante a sessão.
- [ ] A rede usada pelos tablets/computadores consegue abrir o endereço local escolhido.
- [ ] Foi aberta uma partida rápida em cada jogo que será usado na aula.
- [ ] N1–N5 aparecem e a selecção está bloqueada enquanto a IA pensa.
- [ ] O Perfil abre e mostra XP, 8 missões, 29 conquistas e 23 cartões sem pedir nome real.
- [ ] O Laboratório abre, permite resolver um dos 18 puzzles e conserva a conclusão após recarregar.

O benchmark `bun run ai:ladder` é prolongado e serve para calibração/CI; não faz parte da preparação de 10 minutos antes da aula.

## Privacidade e contas

- [ ] Não recolher nomes completos, email, idade exacta ou outros dados pessoais no perfil anónimo.
- [ ] Cada browser/dispositivo mantém a associação por cookie; limpar cookies cria outro perfil anónimo.
- [ ] Se vários alunos partilham o mesmo perfil do browser, explicar que o progresso também fica partilhado.
- [ ] Não projectar o painel de administração com a palavra-passe visível.
- [ ] Não activar leaderboard global; comparar o aluno apenas com o próprio progresso.

## Durante a sessão

- [ ] Sessões curtas de 15–25 minutos: aquecimento, partida, revisão e um padrão para repetir.
- [ ] Se uma IA demorar, aguardar o indicador “A pensar…”; nunca recarregar repetidamente o mesmo jogo.
- [ ] Usar N1/N2 para descoberta, N3 para desafio e N4/N5 para preparação competitiva.
- [ ] Aceitar a recomendação adaptativa apenas no fim da partida.
- [ ] Completar a revisão pós-jogo; vale mais XP do que a vitória.

## Fim da aula

- [ ] Confirmar `/api/health` e abrir um Perfil para verificar persistência.
- [ ] Em VPS, executar/verificar o backup SQLite diário.
- [ ] Registar problemas sem dados pessoais: jogo, nível, lance aproximado e mensagem visível.
- [ ] Fechar o painel do professor e não deixar a sessão administrativa aberta.

## Plano de contingência

1. Se o servidor local parar, voltar a iniciar com `bun run start`.
2. Se a rede falhar, usar o mesmo computador em `http://127.0.0.1:3000` ou a versão estática; o progresso fica local nesse browser.
3. Se um worker falhar, a aplicação usa o fallback TypeScript. Confirmar que a jogada termina; anotar o jogo/nível.
4. Não apagar nem substituir a SQLite durante a aula. Restaurar backup apenas com a app parada e depois de preservar uma cópia do ficheiro actual.
