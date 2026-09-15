import portuguese from './pt-PT.json';
import english from './en.json';
import nepali from './ne.json';
import type { Locale } from './locale';

export type MessageKey = keyof typeof portuguese;
export type MessageCatalog = Readonly<Record<MessageKey, string>>;
// The build also checks exact keys and interpolation slots in every catalogue.
export const catalogs = {
  'pt-PT': portuguese,
  en: english,
  ne: nepali,
} satisfies Record<Locale, MessageCatalog>;
