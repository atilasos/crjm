/**
 * Cliente da API de gestão de turmas e códigos de alunos do servidor de torneios.
 *
 * Funções puras: recebem sempre `serverUrl` e `adminKey`, convertem o endereço
 * com `toTournamentHttpBaseUrl` e lançam `ClassAdminApiError` com mensagens em
 * português europeu prontas a mostrar ao professor.
 */

import { toTournamentHttpBaseUrl } from '../tournament/server-config';

export interface ClassStudent {
  id: string;
  name: string;
  code: string;
}

export interface SchoolClassSummary {
  id: string;
  name: string;
  createdAt: string;
  students: ClassStudent[];
}

export type ClassAdminErrorKind = 'auth' | 'network' | 'server' | 'invalid-response';

export class ClassAdminApiError extends Error {
  readonly kind: ClassAdminErrorKind;

  constructor(kind: ClassAdminErrorKind, message: string) {
    super(message);
    this.name = 'ClassAdminApiError';
    this.kind = kind;
  }
}

function eTextoNaoVazio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0;
}

function normalizarAluno(valor: unknown): ClassStudent | null {
  if (!valor || typeof valor !== 'object') return null;
  const aluno = valor as Partial<ClassStudent>;
  if (!eTextoNaoVazio(aluno.id) || !eTextoNaoVazio(aluno.name) || !eTextoNaoVazio(aluno.code)) return null;
  return { id: aluno.id, name: aluno.name, code: aluno.code };
}

function normalizarTurma(valor: unknown): SchoolClassSummary | null {
  if (!valor || typeof valor !== 'object') return null;
  const turma = valor as Partial<SchoolClassSummary>;
  if (!eTextoNaoVazio(turma.id) || !eTextoNaoVazio(turma.name)) return null;

  const alunos = Array.isArray(turma.students)
    ? turma.students.map(normalizarAluno).filter((aluno): aluno is ClassStudent => aluno !== null)
    : [];

  return {
    id: turma.id,
    name: turma.name,
    createdAt: typeof turma.createdAt === 'string' ? turma.createdAt : '',
    students: alunos,
  };
}

const ERRO_RESPOSTA_INVALIDA = 'O servidor devolveu uma resposta que não foi possível interpretar.';

async function pedirAoServidor(
  serverUrl: string,
  adminKey: string,
  caminho: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const baseUrl = toTournamentHttpBaseUrl(serverUrl);

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl}${caminho}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${adminKey}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new ClassAdminApiError(
      'network',
      'Não foi possível contactar o servidor. Confirma o endereço e tenta novamente.',
    );
  }

  if (resposta.status === 401) {
    throw new ClassAdminApiError('auth', 'Chave de administração errada.');
  }

  if (!resposta.ok) {
    throw new ClassAdminApiError('server', `O servidor respondeu com um erro inesperado (${resposta.status}).`);
  }

  try {
    return await resposta.json();
  } catch {
    throw new ClassAdminApiError('invalid-response', ERRO_RESPOSTA_INVALIDA);
  }
}

export async function fetchClasses(serverUrl: string, adminKey: string): Promise<SchoolClassSummary[]> {
  const dados = (await pedirAoServidor(serverUrl, adminKey, '/api/classes')) as { classes?: unknown };
  if (!dados || !Array.isArray(dados.classes)) {
    throw new ClassAdminApiError('invalid-response', ERRO_RESPOSTA_INVALIDA);
  }

  return dados.classes
    .map(normalizarTurma)
    .filter((turma): turma is SchoolClassSummary => turma !== null);
}

export async function createClass(
  serverUrl: string,
  adminKey: string,
  name: string,
  studentNames: string[],
): Promise<SchoolClassSummary> {
  const dados = (await pedirAoServidor(serverUrl, adminKey, '/api/classes', {
    method: 'POST',
    body: { name, students: studentNames },
  })) as { class?: unknown };

  const turma = normalizarTurma(dados?.class);
  if (!turma) {
    throw new ClassAdminApiError('invalid-response', ERRO_RESPOSTA_INVALIDA);
  }
  return turma;
}

export async function deleteClass(serverUrl: string, adminKey: string, classId: string): Promise<void> {
  await pedirAoServidor(serverUrl, adminKey, `/api/classes/${encodeURIComponent(classId)}`, { method: 'DELETE' });
}

export async function addStudents(
  serverUrl: string,
  adminKey: string,
  classId: string,
  names: string[],
): Promise<ClassStudent[]> {
  const dados = (await pedirAoServidor(serverUrl, adminKey, `/api/classes/${encodeURIComponent(classId)}/students`, {
    method: 'POST',
    body: { names },
  })) as { students?: unknown };

  if (!dados || !Array.isArray(dados.students)) {
    throw new ClassAdminApiError('invalid-response', ERRO_RESPOSTA_INVALIDA);
  }

  return dados.students
    .map(normalizarAluno)
    .filter((aluno): aluno is ClassStudent => aluno !== null);
}

export async function removeStudent(
  serverUrl: string,
  adminKey: string,
  classId: string,
  studentId: string,
): Promise<void> {
  await pedirAoServidor(
    serverUrl,
    adminKey,
    `/api/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' },
  );
}
