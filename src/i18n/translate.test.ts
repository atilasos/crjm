import { getStrategyChallenge } from '../server/learner-core/strategy-challenges';
import { describe, expect, test } from 'bun:test';
import { messages, formatMessage, translate } from './translate';
import { SUPPORTED_LOCALES, localeOrDefault } from './locale';
import { PUZZLES } from '../ai-core/puzzles';
import { TRAINING_PATHS } from '../ai-core/training-paths';
import { PATTERN_CARDS, STARTER_ACHIEVEMENTS, STARTER_MISSIONS } from '../ai-core/gamification';

import { catalogs } from './catalogs';
import { validateCatalogs } from './validate';

const displayFields = new Set(['title', 'label', 'description', 'prompt', 'hint', 'explanation', 'caption', 'focusNow', 'commonMistake', 'desafio', 'targetLabel', 'checkpoints']);
function checkContent(value: unknown, field = ''): void {
  if (typeof value === 'string' && displayFields.has(field)) {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.hasOwn(catalogs[locale], value.replace(/\s+/g, ' ').trim()), `Missing ${locale} for ${value}`).toBe(true);
    }
  } else if (Array.isArray(value)) {
    value.forEach(item => checkContent(item, field));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => checkContent(item, key));
  }
}

describe('Presentation in every supported language', () => {
  test('defaults to Portugal Portuguese without browser-language detection', () => {
    for (const value of [undefined, null, '', 'en-US', 'pt-BR', 'fr']) expect(localeOrDefault(value)).toBe('pt-PT');
    for (const locale of SUPPORTED_LOCALES) expect(localeOrDefault(locale)).toBe(locale);
  });
  test('preserves meaningful whitespace and leaves unknown/user text untouched', () => {
    expect(translate('  Regras de \n', 'pt-PT')).toBe('  Regras de \n');
    expect(translate('Match inválido.', 'pt-PT')).toBe('Confronto inválido.');
    expect(translate('Rules already in English', 'en')).toBe('Rules already in English');
    expect(translate('O teu adversário João da Silva voltou! O jogo vai continuar.', 'en')).toBe('Your opponent João da Silva is back! The game will continue.');
    expect(translate('Sessão de Mestre', 'en')).toBe('Session for Mestre');
    expect(translate('Sessão de Ana  Maria', 'en')).toBe('Session for Ana  Maria');
    expect(translate('constructor', 'en')).toBe('constructor');
  });
  test('updates complete hints and preserves whitespace around inline elements', () => {
    expect(translate(' Regras de ', 'en')).toBe(' Rules for ');
    expect(translate('ATENÇÃO: Este jogo é MISÈRE - perde quem fizer a última jogada!', 'en')).toContain('last move loses');
    expect(translate('Sem jogadas válidas: nesta posição ganhas, porque o adversário foi o último a jogar.', 'en')).toContain('you win');
    expect(translate('N2+: 1/2 vitórias', 'en')).toBe('L2+: 1/2 wins');
    expect(translate('Jogo 1 começou! Tu começas!', 'en')).toBe('Game 1 has started! You go first!');
    expect(formatMessage('{0} — peças por colocar: {1}', 'ne', ['कालो', 2])).toBe('कालो — राख्ने गोटी: 2');
    expect(translate('Coloca a primeira peça (qualquer cor)', 'en')).toBe('Place the first piece (any colour)');
  });
  test('every puzzle, path, achievement and mission has content in all languages', () => {
    checkContent([PUZZLES, TRAINING_PATHS, PATTERN_CARDS, STARTER_ACHIEVEMENTS, STARTER_MISSIONS]);
  });
  test('Faísca choices, predictions and feedback are translated for every situation', () => {
    for (let variant = 0; variant < 24; variant++) {
      const { challenge, hint, explanation } = getStrategyChallenge('faisca', variant);
      const copy = [challenge.skill, challenge.prompt, ...challenge.facts, challenge.question, challenge.prediction,
        ...challenge.options.map(option => option.label), ...challenge.predictions.map(option => option.label),
        challenge.diagram!.caption, hint, explanation];
      for (const value of copy) for (const locale of ['en', 'ne'] as const) {
        expect(translate(value, locale), `Missing ${locale}: ${value}`).not.toBe(value);
        expect(translate(value, locale)).not.toMatch(/\{\d+\}/);
      }
    }
  });
  test('all languages have exactly the same keys and interpolation slots', () => {
    expect(validateCatalogs()).toEqual([]);
  });
  test('the catalogue contract rejects missing locales, messages and incorrect slots', () => {
    expect(validateCatalogs({ 'pt-PT': { 'Olá {0}': 'Olá {0}' } }, ['pt-PT', 'ne'])).toContain('Missing catalogue: ne');
    const errors = validateCatalogs({ 'pt-PT': { 'Olá {0}': 'Olá {0}' }, ne: { 'Olá {0}': 'नमस्ते', extra: 'अर्को' } }, ['pt-PT', 'ne']);
    expect(errors).toContain('ne: interpolation mismatch: Olá {0}');
    expect(errors).toContain('ne: unknown message: extra');
  });
  test('whole messages support different word order without changing pupil names', () => {
    expect(formatMessage('Sessão de {0}', 'ne', ['Mestre'])).toBe('सत्र: Mestre');
    expect(formatMessage('{0} ganhou!', 'ne', ['Ana  Maria'])).toBe('Ana  Maria ले जित्यो!');
    expect(() => formatMessage('Sessão de {0}', 'ne')).toThrow('Missing value');
    expect(translate('Jogo 1 começou! Tu começas!', 'ne')).toBe('खेल 1 सुरु भयो! तिमी पहिले खेल!');
    expect(translate('constructor', 'ne')).toBe('constructor');
  });
});
