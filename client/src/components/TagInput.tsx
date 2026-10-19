import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';

const SUGGESTIONS = ['Vegetarian', 'Vegan', 'Nut allergy', 'Dairy-free', 'Gluten-free', 'Egg allergy', 'Shellfish allergy', 'Halal', 'Kosher'];

/** Chip input for dietary restrictions with one-tap common suggestions. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = (tag: string) => {
    const t = tag.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase()) && value.length < 12) onChange([...value, t]);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const remaining = SUGGESTIONS.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="tag-input">
      <div className="tag-box input">
        {value.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)}
          placeholder={value.length ? 'Add another…' : 'Type and press Enter'} maxLength={40} />
      </div>
      {remaining.length > 0 && (
        <div className="tag-suggestions">
          {remaining.slice(0, 6).map((s) => (
            <button type="button" key={s} className="chip chip-sm" onClick={() => add(s)}><Plus size={12} /> {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
