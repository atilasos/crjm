import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  clearStudentSession,
  loadStudentSession,
  loginStudent,
  saveStudentSession,
  STUDENT_SESSION_STORAGE_KEY,
  type StudentSession,
} from './student-session';

class FakeStorage implements Storage {
  private dados = new Map<string, string>();

  get length(): number {
    return this.dados.size;
  }

  clear(): void {
    this.dados.clear();
  }

  getItem(key: string): string | null {
    return this.dados.has(key) ? this.dados.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.dados.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.dados.delete(key);
  }

  setItem(key: string, value: string): void {
    this.dados.set(key, value);
  }
}

const globalComStorage = globalThis as { localStorage?: Storage; fetch: typeof fetch };
const localStorageOriginal = globalComStorage.localStorage;
const fetchOriginal = globalComStorage.fetch;

const sessaoExemplo: StudentSession = {
  studentId: 'aluno-1',
  name: 'Maria',
  classId: 'turma-5a',
  className: '5.º A',
  code: 'ABC123',
  serverUrl: 'wss://torneios.exemplo.pt',
  loggedInAt: '2026-07-10T10:00:00.000Z',
};

beforeEach(() => {
  globalComStorage.localStorage = new FakeStorage();
});

afterEach(() => {
  globalComStorage.fetch = fetchOriginal;
});

afterAll(() => {
  globalComStorage.localStorage = localStorageOriginal;
  globalComStorage.fetch = fetchOriginal;
});

describe('student-session storage', () => {
  test('loadStudentSession devolve null sem sessão guardada', () => {
    expect(loadStudentSession()).toBeNull();
  });

  test('saveStudentSession seguido de loadStudentSession devolve a sessão', () => {
    saveStudentSession(sessaoExemplo);
    expect(loadStudentSession()).toEqual(sessaoExemplo);
  });

  test('clearStudentSession remove a sessão guardada', () => {
    saveStudentSession(sessaoExemplo);
    clearStudentSession();
    expect(loadStudentSession()).toBeNull();
    expect(globalComStorage.localStorage!.getItem(STUDENT_SESSION_STORAGE_KEY)).toBeNull();
  });

  test('loadStudentSession tolera JSON inválido', () => {
    globalComStorage.localStorage!.setItem(STUDENT_SESSION_STORAGE_KEY, '{nada-de-json');
    expect(loadStudentSession()).toBeNull();
  });

  test('loadStudentSession rejeita conteúdo sem os campos obrigatórios', () => {
    globalComStorage.localStorage!.setItem(STUDENT_SESSION_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadStudentSession()).toBeNull();

    globalComStorage.localStorage!.setItem(STUDENT_SESSION_STORAGE_KEY, JSON.stringify('texto'));
    expect(loadStudentSession()).toBeNull();
  });
});

describe('loginStudent', () => {
  test('em sucesso constrói a sessão, guarda-a e envia o código normalizado', async () => {
    let urlChamado = '';
    let bodyEnviado = '';
    globalComStorage.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      urlChamado = String(input);
      bodyEnviado = String(init?.body);
      return new Response(
        JSON.stringify({ student: { id: 'aluno-1', name: 'Maria' }, class: { id: 'turma-5a', name: '5.º A' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const session = await loginStudent('wss://torneios.exemplo.pt/', ' abc123 ');

    expect(urlChamado).toBe('https://torneios.exemplo.pt/api/login');
    expect(JSON.parse(bodyEnviado)).toEqual({ code: 'ABC123' });
    expect(session.studentId).toBe('aluno-1');
    expect(session.name).toBe('Maria');
    expect(session.classId).toBe('turma-5a');
    expect(session.className).toBe('5.º A');
    expect(session.code).toBe('ABC123');
    expect(session.serverUrl).toBe('wss://torneios.exemplo.pt/');
    expect(Number.isNaN(Date.parse(session.loggedInAt))).toBe(false);
    expect(loadStudentSession()).toEqual(session);
  });

  test('com 404 lança mensagem de código inválido e não guarda sessão', async () => {
    globalComStorage.fetch = (async () =>
      new Response(JSON.stringify({ error: 'codigo_invalido' }), { status: 404 })) as typeof fetch;

    await expect(loginStudent('https://torneios.exemplo.pt', 'ZZZ999')).rejects.toThrow(/Código inválido/);
    expect(loadStudentSession()).toBeNull();
  });

  test('com 400 lança mensagem de código inválido', async () => {
    globalComStorage.fetch = (async () =>
      new Response(JSON.stringify({ error: 'codigo_invalido' }), { status: 400 })) as typeof fetch;

    await expect(loginStudent('https://torneios.exemplo.pt', 'ZZZ999')).rejects.toThrow(/Código inválido/);
  });

  test('com rede indisponível lança mensagem de servidor inacessível', async () => {
    globalComStorage.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    await expect(loginStudent('https://torneios.exemplo.pt', 'ABC123')).rejects.toThrow(
      /Não foi possível contactar o servidor/,
    );
    expect(loadStudentSession()).toBeNull();
  });

  test('com resposta sem estudante lança erro de resposta inesperada', async () => {
    globalComStorage.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

    await expect(loginStudent('https://torneios.exemplo.pt', 'ABC123')).rejects.toThrow(
      /não foi possível interpretar/,
    );
  });
});
