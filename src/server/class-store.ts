/**
 * Persistência de turmas e códigos de login de alunos.
 *
 * Cada aluno é identificado apenas pela alcunha/nome próprio (sem passwords,
 * sem emails) e recebe um código curto gerado pelo servidor para "login".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface StudentAccount {
  id: string;
  name: string;
  code: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  createdAt: string;
  students: StudentAccount[];
}

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

interface ClassStoreFile {
  classes: SchoolClass[];
}

export class ClassStore {
  private readonly filePath: string;
  private classes: SchoolClass[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) {
        this.classes = [];
        return;
      }

      const raw = readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw) as ClassStoreFile;
      this.classes = Array.isArray(data.classes) ? data.classes : [];
    } catch {
      // Ficheiro ausente ou JSON inválido: começa vazio.
      this.classes = [];
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    const data: ClassStoreFile = { classes: this.classes };
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  listClasses(): SchoolClass[] {
    return this.classes;
  }

  private allCodes(): Set<string> {
    return new Set(
      this.classes.flatMap((schoolClass) => schoolClass.students.map((student) => student.code.toUpperCase()))
    );
  }

  private generateUniqueCode(usedCodes: Set<string>): string {
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    } while (usedCodes.has(code));

    usedCodes.add(code);
    return code;
  }

  private buildStudents(studentNames: string[], usedCodes: Set<string>): StudentAccount[] {
    return studentNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => ({
        id: crypto.randomUUID(),
        name,
        code: this.generateUniqueCode(usedCodes),
      }));
  }

  createClass(name: string, studentNames: string[]): SchoolClass {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Nome da turma não pode ser vazio');
    }

    const schoolClass: SchoolClass = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      students: this.buildStudents(studentNames, this.allCodes()),
    };

    this.classes.push(schoolClass);
    this.save();
    return schoolClass;
  }

  deleteClass(id: string): boolean {
    const initialLength = this.classes.length;
    this.classes = this.classes.filter((schoolClass) => schoolClass.id !== id);

    const removed = this.classes.length !== initialLength;
    if (removed) this.save();
    return removed;
  }

  addStudents(classId: string, names: string[]): StudentAccount[] | null {
    const schoolClass = this.classes.find((candidate) => candidate.id === classId);
    if (!schoolClass) return null;

    const newStudents = this.buildStudents(names, this.allCodes());
    schoolClass.students.push(...newStudents);
    this.save();
    return newStudents;
  }

  removeStudent(classId: string, studentId: string): boolean {
    const schoolClass = this.classes.find((candidate) => candidate.id === classId);
    if (!schoolClass) return false;

    const initialLength = schoolClass.students.length;
    schoolClass.students = schoolClass.students.filter((student) => student.id !== studentId);

    const removed = schoolClass.students.length !== initialLength;
    if (removed) this.save();
    return removed;
  }

  findByCode(code: string): { student: StudentAccount; schoolClass: SchoolClass } | null {
    const normalized = code.trim().replace(/[\s-]/g, '').toUpperCase();
    if (!normalized) return null;

    for (const schoolClass of this.classes) {
      for (const student of schoolClass.students) {
        if (student.code.toUpperCase() === normalized) {
          return { student, schoolClass };
        }
      }
    }

    return null;
  }
}
