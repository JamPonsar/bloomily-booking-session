import { useState } from 'react';
import type { FormEvent } from 'react';
import { SESSION_CATEGORIES } from '../../../shared/schemas';
import type { Session, SessionCategory } from '../../../shared/schemas';
import { ApiRequestError, api } from '../api/client';
import { CATEGORIES } from '../lib/categories';
import { Field, Input, Select, Spinner, Textarea } from './ui';

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Staff form to schedule a session (POST /api/sessions). */
export function SessionForm({ onSaved, onCancel }: { onSaved: (s: Session) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    title: '', description: '', instructorName: '', category: 'art' as SessionCategory, location: '',
    date: tomorrow(), start: '10:00', end: '11:30', capacity: '12', minAge: '5', maxAge: '10', price: '25',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const session = await api.createSession({
        title: f.title, description: f.description, instructorName: f.instructorName, category: f.category, location: f.location,
        startsAt: new Date(`${f.date}T${f.start}`).toISOString(),
        endsAt: new Date(`${f.date}T${f.end}`).toISOString(),
        capacity: Number(f.capacity), minAge: Number(f.minAge), maxAge: Number(f.maxAge),
        priceCents: Math.round(Number(f.price || 0) * 100),
      });
      onSaved(session);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const { startsAt, endsAt, ...rest } = err.fields;
        setErrors({ ...rest, end: endsAt ?? startsAt });
        if (!Object.keys(err.fields).length) setFormError(err.message);
      } else setFormError('Could not create session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="modal-body form-grid">
        <Field label="Title" error={errors.title} className="span-2"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Little Picassos: Watercolor" autoFocus /></Field>
        <Field label="Session lead" error={errors.instructorName}><Input value={f.instructorName} onChange={(e) => set('instructorName', e.target.value)} placeholder="Ms. Hannah Cole" /></Field>
        <Field label="Category" error={errors.category}>
          <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {SESSION_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
          </Select>
        </Field>
        <Field label="Location" error={errors.location} className="span-2"><Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Studio A" /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <div className="field-pair">
          <Field label="Starts"><Input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></Field>
          <Field label="Ends" error={errors.end}><Input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></Field>
        </div>
        <Field label="Capacity" error={errors.capacity}><Input type="number" min={1} max={100} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field>
        <Field label="Price (USD)" error={errors.priceCents}><Input type="number" min={0} step="0.5" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Min age" error={errors.minAge}><Input type="number" min={0} max={18} value={f.minAge} onChange={(e) => set('minAge', e.target.value)} /></Field>
        <Field label="Max age" error={errors.maxAge}><Input type="number" min={0} max={18} value={f.maxAge} onChange={(e) => set('maxAge', e.target.value)} /></Field>
        <Field label="Description" error={errors.description} className="span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What will kids do? What should they bring?" /></Field>
        {formError && <div className="alert alert-error span-2">{formError}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Create session</button>
      </div>
    </form>
  );
}
