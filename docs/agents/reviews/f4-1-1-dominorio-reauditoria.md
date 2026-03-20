# F4.1.1 — Dominório reauditoria de baseline atual

Data: 2026-03-20
Fase: F4.1 (ativo)

## T1 — pares em FAIL e delta para meta (>=60%)

Fonte: `artifacts/dominorio-baseline/latest/baseline.md` (`generatedAt: 2026-03-20T01:15:53.748Z`)

- `N2 > N1`: atual `50.0%` (FAIL) | delta para `60.0%`: `+10.0 pp`
- `N4 > N3`: atual `50.0%` (FAIL) | delta para `60.0%`: `+10.0 pp`
- `N5 > N4`: atual `50.0%` (FAIL) | delta para `60.0%`: `+10.0 pp`

Resumo T1: 3/4 pares em FAIL; falta ganho mínimo de 10 pp em cada par acima.

## T4 — valor atual e gap para meta (<=15%)

- Atual: `45.83%` de divergência (FAIL)
- Meta F4: `<=15.00%`
- Gap: `30.83 pp` acima do limite

## Hipótese única priorizada (sem refactor)

Hipótese: a combinação de pouca separação efetiva entre níveis altos (principalmente `N4`/`N5`) e variância excessiva na seleção de topo está achatando a ladder e inflando a divergência; um ajuste mínimo de parâmetros no runtime (separar preset efetivo de `N5` vs `N4` + reduzir aleatoriedade de abertura/desempate em `N4`/`N5`) deve elevar `N5>N4`/`N4>N3` e reduzir T4 sem mudar arquitetura.

## Critério de aceitação mensurável

Após aplicar apenas esse ajuste mínimo e regenerar baseline Dominório:

- `N4 > N3 >= 60.0%`
- `N5 > N4 >= 60.0%`
- `N2 > N1 >= 60.0%`
- `T4 <= 15.0%` de divergência

Se qualquer condição falhar, F4.1 permanece em FAIL e exige nova iteração parametrizada.
