import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Child, ChildInput } from '../../../shared/schemas';
import { ApiRequestError, api } from '../api/client';
import { ageOn } from '../lib/format';
import { PrivacyBadge } from './PrivacyBadge';
import { TagInput } from './TagInput';
import { Field, Input, Spinner, Textarea } from './ui';

interface Props {
  child?: Child;
  defaultLastName?: string;
  onSaved: (child: Child) => void;
  onCancel: () => void;
}

/** Add / edit a child. Each field is labelled with whether staff will see it. */
export function ChildForm({ child, defaultLastName = '', onSaved, onCancel }: Props) {
  const [form, setForm] = useState<ChildInput>({
    firstName: child?.firstName ?? '',
    lastName: child?.lastName ?? defaultLastName,
    dateOfBirth: child?.dateOfBirth ?? '',
    dietaryRestrictions: child?.dietaryRestrictions ?? [],
    medicalNotes: child?.medicalNotes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ChildInput>(k: K, v: ChildInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      onSaved(child ? await api.updateChild(child.id, form) : await api.addChild(form));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else setFormError('Could not save — please try again');
    } finally {
      setSaving(false);
    }
  };

  const age = form.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) ? ageOn(form.dateOfBirth) : null;

  return (
    <form onSubmit={submit} noValidate>
      <div className="modal-body form-grid">
        <Field label="First name" error={errors.firstName} hint={<PrivacyBadge shared />}>
          <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
        </Field>
        <Field label="Last name" error={errors.lastName} hint={<PrivacyBadge shared />}>
          <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth} className="span-2"
          hint={<>{age !== null && age >= 0 && <span className="muted">Age {age} · </span>}<span className="muted">Only the age is shared</span> <PrivacyBadge shared /></>}>
          <Input type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
        <Field label="Dietary restrictions & allergies" error={errors.dietaryRestrictions} className="span-2" hint={<PrivacyBadge shared />}>
          <TagInput value={form.dietaryRestrictions} onChange={(v) => set('dietaryRestrictions', v)} />
        </Field>
        <Field label="Medical notes" error={errors.medicalNotes} className="span-2" hint={<><span className="muted">Staff see this 24 hours after you book</span> <PrivacyBadge shared={false} /></>}>
          <Textarea value={form.medicalNotes} onChange={(e) => set('medicalNotes', e.target.value)} placeholder="Medications, conditions, anything you want to keep handy" maxLength={500} />
        </Field>
        {formError && <div className="alert alert-error span-2">{formError}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {child ? 'Save changes' : 'Add child'}</button>
      </div>
    </form>
  );
}
