import { describe, expect, it } from 'bun:test';
import { navegacaoBloqueada, registarBloqueioNavegacao } from './navigation-guard';

describe('navigation-guard', () => {
  it('sem bloqueio registado, a navegação está livre', () => {
    expect(navegacaoBloqueada()).toBe(false);
  });

  it('com bloqueio ativo, a navegação fica bloqueada', () => {
    const remover = registarBloqueioNavegacao(() => true);
    expect(navegacaoBloqueada()).toBe(true);
    remover();
    expect(navegacaoBloqueada()).toBe(false);
  });

  it('o bloqueio consulta a condição em cada verificação', () => {
    let ativo = true;
    const remover = registarBloqueioNavegacao(() => ativo);
    expect(navegacaoBloqueada()).toBe(true);
    ativo = false;
    expect(navegacaoBloqueada()).toBe(false);
    remover();
  });

  it('remover um bloqueio antigo não apaga um bloqueio mais recente', () => {
    const removerPrimeiro = registarBloqueioNavegacao(() => true);
    const removerSegundo = registarBloqueioNavegacao(() => true);
    removerPrimeiro();
    expect(navegacaoBloqueada()).toBe(true);
    removerSegundo();
    expect(navegacaoBloqueada()).toBe(false);
  });
});
