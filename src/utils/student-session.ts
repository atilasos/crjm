import { toTournamentHttpBaseUrl } from '../tournament/server-config';

export interface StudentSession {
  studentId: string;
  name: string;
  classId: string;
  className: string;
  code: string;
  serverUrl: string;
  loggedInAt: string;
}

export const STUDENT_SESSION_STORAGE_KEY = 'crjm-student-session';
export const STUDENT_SESSION_CHANGED_EVENT = 'crjm-session-changed';

function obterStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // Alguns ambientes (ex.: testes) expõem localStorage sem window
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

function anunciarMudancaDeSessao(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STUDENT_SESSION_CHANGED_EVENT));
}

function eTextoNaoVazio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0;
}

export function loadStudentSession(): StudentSession | null {
  const storage = obterStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STUDENT_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const dados = JSON.parse(raw) as Partial<StudentSession> | null;
    if (!dados || typeof dados !== 'object') return null;
    if (!eTextoNaoVazio(dados.studentId) || !eTextoNaoVazio(dados.name)) return null;
    if (typeof dados.classId !== 'string' || typeof dados.className !== 'string') return null;

    return {
      studentId: dados.studentId,
      name: dados.name,
      classId: dados.classId,
      className: dados.className,
      code: typeof dados.code === 'string' ? dados.code : '',
      serverUrl: typeof dados.serverUrl === 'string' ? dados.serverUrl : '',
      loggedInAt: typeof dados.loggedInAt === 'string' ? dados.loggedInAt : '',
    };
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession): void {
  const storage = obterStorage();
  if (!storage) return;

  try {
    storage.setItem(STUDENT_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
  anunciarMudancaDeSessao();
}

export function clearStudentSession(): void {
  const storage = obterStorage();
  if (!storage) return;

  try {
    storage.removeItem(STUDENT_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
  anunciarMudancaDeSessao();
}

interface LoginResponsePayload {
  student?: { id?: unknown; name?: unknown };
  class?: { id?: unknown; name?: unknown };
}

export async function loginStudent(serverUrl: string, code: string): Promise<StudentSession> {
  const baseUrl = toTournamentHttpBaseUrl(serverUrl);
  const codigo = code.trim().toUpperCase();

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codigo }),
    });
  } catch {
    throw new Error('Não foi possível contactar o servidor. Confirma o endereço e tenta novamente.');
  }

  if (resposta.status === 404 || resposta.status === 400) {
    throw new Error('Código inválido. Confirma o código com o teu professor.');
  }

  if (!resposta.ok) {
    throw new Error(`O servidor respondeu com um erro inesperado (${resposta.status}). Tenta novamente.`);
  }

  let dados: LoginResponsePayload;
  try {
    dados = (await resposta.json()) as LoginResponsePayload;
  } catch {
    throw new Error('O servidor devolveu uma resposta que não foi possível interpretar.');
  }

  const studentId = dados?.student?.id;
  const studentName = dados?.student?.name;
  if (!eTextoNaoVazio(studentId) || !eTextoNaoVazio(studentName)) {
    throw new Error('O servidor devolveu uma resposta que não foi possível interpretar.');
  }

  const session: StudentSession = {
    studentId,
    name: studentName,
    classId: typeof dados.class?.id === 'string' ? dados.class.id : '',
    className: typeof dados.class?.name === 'string' ? dados.class.name : '',
    code: codigo,
    serverUrl,
    loggedInAt: new Date().toISOString(),
  };

  saveStudentSession(session);
  return session;
}
