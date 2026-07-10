import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import {
  addStudents,
  ClassAdminApiError,
  createClass,
  deleteClass,
  fetchClasses,
  removeStudent,
} from './class-admin-api';

const globalComFetch = globalThis as { fetch: typeof fetch };
const fetchOriginal = globalComFetch.fetch;

interface ChamadaRegistada {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

function instalarFetchFalso(responder: (chamada: ChamadaRegistada) => Response): ChamadaRegistada[] {
  const chamadas: ChamadaRegistada[] = [];
  globalComFetch.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const chamada: ChamadaRegistada = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body: init?.body != null ? String(init.body) : null,
    };
    chamadas.push(chamada);
    return responder(chamada);
  }) as typeof fetch;
  return chamadas;
}

function respostaJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const turmaExemplo = {
  id: 'turma-5a',
  name: '5.º A',
  createdAt: '2026-07-10T09:00:00.000Z',
  students: [
    { id: 'aluno-1', name: 'Maria', code: 'ABC234' },
    { id: 'aluno-2', name: 'Rui', code: 'XYZ789' },
  ],
};

afterEach(() => {
  globalComFetch.fetch = fetchOriginal;
});

afterAll(() => {
  globalComFetch.fetch = fetchOriginal;
});

describe('fetchClasses', () => {
  test('em sucesso converte o endereço ws→http, envia a chave e devolve as turmas', async () => {
    const chamadas = instalarFetchFalso(() => respostaJson({ classes: [turmaExemplo] }));

    const turmas = await fetchClasses('wss://torneios.exemplo.pt/', 'chave-secreta');

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.url).toBe('https://torneios.exemplo.pt/api/classes');
    expect(chamadas[0]!.method).toBe('GET');
    expect(chamadas[0]!.headers.Authorization).toBe('Bearer chave-secreta');
    expect(turmas).toEqual([turmaExemplo]);
  });

  test('com 401 lança erro de chave errada', async () => {
    instalarFetchFalso(() => respostaJson({ error: 'unauthorized' }, 401));

    const promessa = fetchClasses('https://torneios.exemplo.pt', 'chave-errada');
    await expect(promessa).rejects.toThrow(/Chave de administração errada/);
    await promessa.catch((erro) => {
      expect(erro).toBeInstanceOf(ClassAdminApiError);
      expect((erro as ClassAdminApiError).kind).toBe('auth');
    });
  });

  test('com rede indisponível lança erro de servidor inacessível', async () => {
    globalComFetch.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    const promessa = fetchClasses('https://torneios.exemplo.pt', 'chave');
    await expect(promessa).rejects.toThrow(/Não foi possível contactar o servidor/);
    await promessa.catch((erro) => {
      expect((erro as ClassAdminApiError).kind).toBe('network');
    });
  });

  test('com erro 500 lança erro inesperado do servidor', async () => {
    instalarFetchFalso(() => respostaJson({ error: 'boom' }, 500));

    await expect(fetchClasses('https://torneios.exemplo.pt', 'chave')).rejects.toThrow(
      /erro inesperado \(500\)/,
    );
  });

  test('com payload sem lista de turmas lança erro de resposta inválida', async () => {
    instalarFetchFalso(() => respostaJson({ ok: true }));

    const promessa = fetchClasses('https://torneios.exemplo.pt', 'chave');
    await expect(promessa).rejects.toThrow(/não foi possível interpretar/);
    await promessa.catch((erro) => {
      expect((erro as ClassAdminApiError).kind).toBe('invalid-response');
    });
  });

  test('ignora entradas malformadas na lista de turmas', async () => {
    instalarFetchFalso(() => respostaJson({ classes: [turmaExemplo, { foo: 'bar' }, null] }));

    const turmas = await fetchClasses('https://torneios.exemplo.pt', 'chave');
    expect(turmas).toEqual([turmaExemplo]);
  });
});

describe('createClass', () => {
  test('em sucesso envia POST com nome e alunos e devolve a turma criada', async () => {
    const chamadas = instalarFetchFalso(() => respostaJson({ class: turmaExemplo }, 201));

    const turma = await createClass('ws://192.168.1.10:4000', 'chave', '5.º A', ['Maria', 'Rui']);

    expect(chamadas[0]!.url).toBe('http://192.168.1.10:4000/api/classes');
    expect(chamadas[0]!.method).toBe('POST');
    expect(chamadas[0]!.headers.Authorization).toBe('Bearer chave');
    expect(chamadas[0]!.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(chamadas[0]!.body!)).toEqual({ name: '5.º A', students: ['Maria', 'Rui'] });
    expect(turma).toEqual(turmaExemplo);
  });

  test('com 401 lança erro de chave errada', async () => {
    instalarFetchFalso(() => respostaJson({ error: 'unauthorized' }, 401));

    await expect(createClass('https://torneios.exemplo.pt', 'chave', '5.º A', [])).rejects.toThrow(
      /Chave de administração errada/,
    );
  });

  test('com resposta sem turma lança erro de resposta inválida', async () => {
    instalarFetchFalso(() => respostaJson({ ok: true }, 201));

    await expect(createClass('https://torneios.exemplo.pt', 'chave', '5.º A', [])).rejects.toThrow(
      /não foi possível interpretar/,
    );
  });
});

describe('deleteClass', () => {
  test('envia DELETE para o caminho da turma com o id codificado', async () => {
    const chamadas = instalarFetchFalso(() => respostaJson({ ok: true }));

    await deleteClass('https://torneios.exemplo.pt', 'chave', 'turma/estranha');

    expect(chamadas[0]!.url).toBe('https://torneios.exemplo.pt/api/classes/turma%2Festranha');
    expect(chamadas[0]!.method).toBe('DELETE');
  });

  test('com rede indisponível lança erro de servidor inacessível', async () => {
    globalComFetch.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    await expect(deleteClass('https://torneios.exemplo.pt', 'chave', 'turma-5a')).rejects.toThrow(
      /Não foi possível contactar o servidor/,
    );
  });
});

describe('addStudents', () => {
  test('em sucesso envia POST com os nomes e devolve os alunos criados', async () => {
    const novos = [{ id: 'aluno-3', name: 'Ana', code: 'QWE456' }];
    const chamadas = instalarFetchFalso(() => respostaJson({ students: novos }));

    const alunos = await addStudents('https://torneios.exemplo.pt', 'chave', 'turma-5a', ['Ana']);

    expect(chamadas[0]!.url).toBe('https://torneios.exemplo.pt/api/classes/turma-5a/students');
    expect(chamadas[0]!.method).toBe('POST');
    expect(JSON.parse(chamadas[0]!.body!)).toEqual({ names: ['Ana'] });
    expect(alunos).toEqual(novos);
  });

  test('com resposta sem alunos lança erro de resposta inválida', async () => {
    instalarFetchFalso(() => respostaJson({ ok: true }));

    await expect(addStudents('https://torneios.exemplo.pt', 'chave', 'turma-5a', ['Ana'])).rejects.toThrow(
      /não foi possível interpretar/,
    );
  });
});

describe('removeStudent', () => {
  test('envia DELETE para o caminho do aluno', async () => {
    const chamadas = instalarFetchFalso(() => respostaJson({ ok: true }));

    await removeStudent('https://torneios.exemplo.pt', 'chave', 'turma-5a', 'aluno-1');

    expect(chamadas[0]!.url).toBe('https://torneios.exemplo.pt/api/classes/turma-5a/students/aluno-1');
    expect(chamadas[0]!.method).toBe('DELETE');
  });

  test('com 401 lança erro de chave errada', async () => {
    instalarFetchFalso(() => respostaJson({ error: 'unauthorized' }, 401));

    await expect(removeStudent('https://torneios.exemplo.pt', 'chave', 'turma-5a', 'aluno-1')).rejects.toThrow(
      /Chave de administração errada/,
    );
  });
});
