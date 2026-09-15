# Publicação de 15 de setembro de 2026

## Versão disponível

- Aplicação: [crjmai.infantinho.xyz](https://crjmai.infantinho.xyz).
- Torneios: [crjmai-torneio.infantinho.xyz](https://crjmai-torneio.infantinho.xyz/health).
- Integração de `learning/strategy-first` em `main`: `464c060`.
- Quelhas: avaliação misère corrigida, contagens mínimas/máximas de turnos e resolução de finais. O worker publicado usa a revisão `tempo-20260915`.
- Seis jogos: pistas graduais e verificação de escolha/previsão no Laboratório, com progresso persistente e retenção noutro dia.
- Interface em português, inglês e nepalês.

## Verificação em produção

Os dois serviços responderam por HTTPS. Os 16 ficheiros JavaScript/WASM da
IA, usando o URL com revisão efetivamente pedido pelo cliente Quelhas,
corresponderam aos ficheiros locais por SHA-256.

No browser real, o Quelhas N5 executou Rust/WASM, com workers separados
para adversário e tutor. H0/H1/H2 ocultaram a solução; H3 apresentou as
contagens após pedido explícito. O Laboratório carregou a situação do
servidor e exigiu escolha e previsão antes de permitir a resposta. Não
houve erros JavaScript nem transbordo horizontal a 390 px.

Evidência: [serviços e ficheiros](../../artifacts/deployment/2026-09-15/public-verification.json),
[browser](../../artifacts/deployment/2026-09-15/public-browser.json),
[Quelhas móvel](../../artifacts/deployment/2026-09-15/quelhas-mobile.png) e
[Laboratório móvel](../../artifacts/deployment/2026-09-15/lab-mobile.png).

A suite completa passou com 525 testes, incluindo na integração contínua.
As verificações locais anteriores incluíram três testes Rust, os cinco
motores WASM, learner-core e2e e 21 combinações de jogo/ecrã. A mudança do
URL do worker voltou a passar os testes do cliente e o browser de produção.

## Ajustes encontrados durante a publicação

1. A cache pública ainda devolvia um worker Quelhas anterior. O URL com
   revisão permite carregar a correção sem depender da purga da cache.
2. O primeiro build do GitHub Pages instalou `wasm-bindgen-cli` 0.2.128,
   incompatível com 0.2.126 nos cinco `Cargo.lock`. O workflow passou a
   escolher a versão dos lockfiles e a verificar os cinco módulos WASM
   antes de publicar. Um build com fallback apenas em TypeScript deixa
   assim de ser aceite para publicação no Pages.

## Dados e recuperação

Foi criada uma cópia consistente da base SQLite antes da migração,
incluindo outra cópia imediatamente antes do reinício. A migração 005 foi
ensaiada numa cópia dos dados reais e aplicada em produção. A integridade
da base, a presença dos registos anteriores e o ficheiro de turmas foram
verificados. Não havia torneios em memória quando o serviço foi reiniciado.

Os backups privados, o build anterior e os registos locais estão em
`/home/proteu/.local/state/crjm/releases/20260915T113837Z/`. Não fazem parte
do Git. O estado anterior do código está no commit `65b4949` e no arquivo
`main-before.tar` desse diretório.

Para recuperar a versão anterior, preparar e compilar esse commit numa
cópia separada, repor os serviços com esse código/build e verificar os dois
endereços HTTPS. A migração é aditiva: manter os dados atuais durante uma
reversão do código; restaurar uma base antiga perderia atividade posterior
ao backup. Os comandos normais de atualização estão no
[guia do servidor](servidor-casa-crjmai.md).
