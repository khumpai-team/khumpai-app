/**
 * Quick suggestion chips shown above the input so the user can see what kinds
 * of things they can tell Khumpi. Tapping one sends it.
 */

import { es } from '@/data/i18n/es';

export function SuggestionChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="ml-[46px]">
      <p className="eyebrow mb-2 px-1">{es.chat.suggestionsTitle}</p>
      <div className="flex flex-col items-start gap-2">
        {es.chat.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="press rounded-[16px] rounded-bl-[7px] border border-border bg-bg-surface px-4 py-2.5 text-left text-[14px] font-semibold text-text-primary shadow-soft transition-colors hover:border-border-strong"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
