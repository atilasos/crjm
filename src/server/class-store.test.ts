import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClassStore } from './class-store';

describe('ClassStore', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'crjm-class-store-'));
    filePath = path.join(dir, 'classes.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('começa vazio quando o ficheiro não existe', () => {
    const store = new ClassStore(filePath);
    expect(store.listClasses()).toEqual([]);
  });

  test('começa vazio quando o ficheiro tem JSON inválido', () => {
    writeFileSync(filePath, '{ isto não é json válido');

    const store = new ClassStore(filePath);
    expect(store.listClasses()).toEqual([]);
  });

  test('criar turma gera códigos únicos sem caracteres ambíguos', () => {
    const store = new ClassStore(filePath);
    const schoolClass = store.createClass('4.º A', ['Ana', 'Bruno', 'Carla', 'Diogo', 'Eva']);

    expect(schoolClass.students).toHaveLength(5);

    const codes = schoolClass.students.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);

    const ambiguous = /[0O1IL]/;
    for (const code of codes) {
      expect(code).toHaveLength(6);
      expect(ambiguous.test(code)).toBe(false);
    }
  });

  test('criar turma ignora nomes vazios e faz trim', () => {
    const store = new ClassStore(filePath);
    const schoolClass = store.createClass('  4.º B  ', ['  Ana  ', '', '   ', 'Bruno']);

    expect(schoolClass.name).toBe('4.º B');
    expect(schoolClass.students.map((s) => s.name)).toEqual(['Ana', 'Bruno']);
  });

  test('criar turma com nome vazio lança erro', () => {
    const store = new ClassStore(filePath);
    expect(() => store.createClass('   ', ['Ana'])).toThrow();
  });

  test('findByCode é case-insensitive e tolera espaços/hífens', () => {
    const store = new ClassStore(filePath);
    const schoolClass = store.createClass('4.º A', ['Ana']);
    const code = schoolClass.students[0].code;

    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`.toLowerCase();
    const hyphenated = `${code.slice(0, 3)}-${code.slice(3)}`;

    expect(store.findByCode(code.toLowerCase())?.student.name).toBe('Ana');
    expect(store.findByCode(spaced)?.student.name).toBe('Ana');
    expect(store.findByCode(hyphenated)?.student.name).toBe('Ana');
    expect(store.findByCode(`  ${code}  `)?.student.name).toBe('Ana');
  });

  test('findByCode devolve null para código inexistente', () => {
    const store = new ClassStore(filePath);
    store.createClass('4.º A', ['Ana']);
    expect(store.findByCode('ZZZZZZ')).toBeNull();
    expect(store.findByCode('')).toBeNull();
  });

  test('persiste dados entre instâncias do store', () => {
    const store = new ClassStore(filePath);
    const created = store.createClass('4.º A', ['Ana', 'Bruno']);

    const reloaded = new ClassStore(filePath);
    const classes = reloaded.listClasses();

    expect(classes).toHaveLength(1);
    expect(classes[0].id).toBe(created.id);
    expect(classes[0].students.map((s) => s.name)).toEqual(['Ana', 'Bruno']);
    expect(classes[0].students.map((s) => s.code)).toEqual(created.students.map((s) => s.code));
  });

  test('deleteClass remove turma existente e persiste', () => {
    const store = new ClassStore(filePath);
    const created = store.createClass('4.º A', ['Ana']);

    expect(store.deleteClass(created.id)).toBe(true);
    expect(store.listClasses()).toEqual([]);

    const reloaded = new ClassStore(filePath);
    expect(reloaded.listClasses()).toEqual([]);
  });

  test('deleteClass devolve false para turma inexistente', () => {
    const store = new ClassStore(filePath);
    expect(store.deleteClass('inexistente')).toBe(false);
  });

  test('addStudents adiciona alunos a turma existente com códigos únicos', () => {
    const store = new ClassStore(filePath);
    const created = store.createClass('4.º A', ['Ana']);

    const added = store.addStudents(created.id, ['Bruno', 'Carla']);
    expect(added).not.toBeNull();
    expect(added?.map((s) => s.name)).toEqual(['Bruno', 'Carla']);

    const classes = store.listClasses();
    expect(classes[0].students).toHaveLength(3);

    const allCodes = classes[0].students.map((s) => s.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  test('addStudents devolve null para turma inexistente', () => {
    const store = new ClassStore(filePath);
    expect(store.addStudents('inexistente', ['Ana'])).toBeNull();
  });

  test('removeStudent remove aluno existente e persiste', () => {
    const store = new ClassStore(filePath);
    const created = store.createClass('4.º A', ['Ana', 'Bruno']);
    const studentId = created.students[0].id;

    expect(store.removeStudent(created.id, studentId)).toBe(true);
    expect(store.listClasses()[0].students).toHaveLength(1);
    expect(store.listClasses()[0].students[0].name).toBe('Bruno');

    const reloaded = new ClassStore(filePath);
    expect(reloaded.listClasses()[0].students).toHaveLength(1);
  });

  test('removeStudent devolve false para turma ou aluno inexistente', () => {
    const store = new ClassStore(filePath);
    const created = store.createClass('4.º A', ['Ana']);

    expect(store.removeStudent('inexistente', created.students[0].id)).toBe(false);
    expect(store.removeStudent(created.id, 'inexistente')).toBe(false);
  });
});
