import { catalogs, type MessageKey } from './catalogs';
import type { Locale } from './locale';

export const messages: Readonly<Record<string, string>> = catalogs['pt-PT'];
export function normalizeMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(messages)
  .filter(([source]) => /\{\d+\}/.test(source))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([source]) => ({
    source,
    expression: new RegExp(`^${source.split(/\{\d+\}/).map(escapeRegex).join('(.*?)')}$`),
    slots: [...source.matchAll(/\{(\d+)\}/g)].map(match => match[1]!),
  }));

// Only these slots contain application messages or game roles. Names and codes
// in all other slots are copied verbatim, even when they equal a catalogue key.
const translatedSlots: Readonly<Record<string, readonly string[]>> = {
  '🎮 Jogo {0}/3 começou! {1}': ['1'],
  'Prepara-te para o jogo {0}! {1}': ['1'],
  'Jogo {0} começou! {1}': ['1'],
  '{0} o jogo {1}! Resultado: {2}-{3}': ['0'],
  'Coloca a primeira peça ({0})': ['0'],
  'Clica na casa inicial para o teu segmento {0}': ['0'],
  'L{0} C{1}, {2}, {3} casas': ['2'],
  'L{0} C{1} • {2} • {3}': ['2'],
  'Missão {0}': ['0'],
  'Erro: {0}': ['0'],
  'Erro de ligação: {0}': ['0'],
};

/** Translate only at the presentation boundary. Stored game evidence stays canonical. */
export function translate(text: string, locale: Locale): string {
  if (!text) return text;
  const catalog: Readonly<Record<string, string>> = catalogs[locale];
  const normalized = normalizeMessage(text);
  let result = Object.hasOwn(catalog, normalized) ? catalog[normalized] : undefined;
  if (result === undefined) {
    for (const template of templates) {
      const match = template.expression.exec(text.trim()) ?? template.expression.exec(normalized);
      if (!match) continue;
      const values = new Map(template.slots.map((slot, index) => [slot, match[index + 1]!]));
      result = catalog[template.source]!.replace(/\{(\d+)\}/g, (placeholder, slot: string) => {
        const value = values.get(slot);
        if (value === undefined) return placeholder;
        return translatedSlots[template.source]?.includes(slot) ? translate(value, locale) : value;
      });
      break;
    }
  }
  if (result === undefined) return text;
  // JSX spaces around inline elements are meaningful.
  return `${text.match(/^\s*/)?.[0] ?? ''}${result}${text.match(/\s*$/)?.[0] ?? ''}`;
}

/** Preferred for new variable messages: interpolate the whole sentence, never fragments.
 * Values remain verbatim; translate application labels explicitly before passing them. */
export function formatMessage(key: MessageKey, locale: Locale, values: readonly (string | number)[] = []): string {
  return catalogs[locale][key].replace(/\{(\d+)\}/g, (slot, index: string) => {
    const value = values[Number(index)];
    if (value === undefined) throw new Error(`Missing value ${slot} for message: ${key}`);
    return String(value);
  });
}
