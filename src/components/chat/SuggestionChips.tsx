/**
 * Quick suggestion chips shown above the input so the user can see what kinds
 * of things they can tell Khumpi. Tapping one sends it.
 */

import { es } from '@/data/i18n/es';

export function SuggestionChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div>
      <p className="mb-2 px-1 text-xs font-semibold text-text-tertiary">{es.chat.suggestionsTitle}</p>
      <div className="flex flex-wrap gap-2">
        {es.chat.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-bg-surface px-3.5 py-2 text-left text-sm font-semibold text-deep-blue shadow-soft transition-transform active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
