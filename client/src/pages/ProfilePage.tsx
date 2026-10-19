import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Baby, CreditCard, Pencil, Plus, ShieldCheck, Trash2, UtensilsCrossed } from 'lucide-react';
import type { Child, ParentInput } from '../../../shared/schemas';
import { ApiRequestError, api } from '../api/client';
import { ChildForm } from '../components/ChildForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { DelayedShareNote, PrivacyBadge } from '../components/PrivacyBadge';
import { Avatar, EmptyState, Field, Input, Skeleton, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { invalidate, useQuery } from '../hooks/useQuery';

const EMPTY: ParentInput = { firstName: '', lastName: '', email: '', phone: '', address: '', emergencyContactName: '', emergencyContactPhone: '' };

/** Parent profile: edit own details (private) and manage children (partly shared on booking). */
export function ProfilePage() {
  const toast = useToast();
  const { data: profile, loading, error, reload } = useQuery('profile', api.getProfile);
  const [form, setForm] = useState<ParentInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | 'new' | null>(null);
  const [deletingChild, setDeletingChild] = useState<Child | null>(null);

  useEffect(() => {
    if (!profile) return;
    const { firstName, lastName, email, phone, address, emergencyContactName, emergencyContactPhone } = profile;
    setForm({ firstName, lastName, email, phone, address, emergencyContactName, emergencyContactPhone });
  }, [profile]);

  const dirty = profile && (Object.keys(EMPTY) as Array<keyof ParentInput>).some((k) => form[k] !== profile[k]);
  const set = (k: keyof ParentInput, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile(form);
      toast('Profile saved');
      invalidate('profile');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        toast(err.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteChild = async () => {
    if (!deletingChild) return;
    try {
      await api.deleteChild(deletingChild.id);
      toast(`${deletingChild.firstName} was removed`);
      void reload();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : 'Could not remove child', 'error');
    }
  };

  if (error) return <div className="page narrow"><div className="alert alert-error">{error.message}</div></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Your profile</h1>
          <p className="muted">Keep your family's details up to date. You're always in control of what's shared.</p>
        </div>
      </header>

      <div className="profile-layout">
        <form className="card" onSubmit={save} noValidate>
          <div className="card-head">
            <h2>About you</h2>
            <PrivacyBadge shared={false} />
          </div>
          {loading && !profile ? <Skeleton height={44} count={5} /> : (
            <div className="form-grid">
              <Field label="First name" error={errors.firstName}><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" /></Field>
              <Field label="Last name" error={errors.lastName}><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" /></Field>
              <Field label="Email" error={errors.email} className="span-2"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></Field>
              <Field label="Phone" error={errors.phone}><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" /></Field>
              <Field label="Address" error={errors.address}><Input value={form.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" /></Field>
              <div className="span-2 subhead">Emergency contact</div>
              <Field label="Name" error={errors.emergencyContactName}><Input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></Field>
              <Field label="Phone" error={errors.emergencyContactPhone}><Input type="tel" value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></Field>
            </div>
          )}
          <div className="card-foot">
            <span className="muted small">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
            <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>{saving && <Spinner />} Save profile</button>
          </div>
        </form>

        <div className="profile-side">
          <section className="card">
            <div className="card-head">
              <h2>Children</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingChild('new')}><Plus size={15} /> Add child</button>
            </div>
            {loading && !profile ? <Skeleton height={76} count={2} /> : profile?.children.length === 0 ? (
              <EmptyState icon={<Baby size={24} />} title="No children yet" action={<button className="btn btn-primary" onClick={() => setEditingChild('new')}>Add your first child</button>}>
                Add a child to start booking sessions.
              </EmptyState>
            ) : (
              <ul className="child-list">
                {profile?.children.map((c) => (
                  <li key={c.id} className="child-item">
                    <Avatar name={`${c.firstName} ${c.lastName}`} tone="peach" size={44} />
                    <div className="child-item-main">
                      <strong>{c.firstName} {c.lastName}</strong>
                      <span className="muted small">Age {c.age}</span>
                      <div className="tag-row">
                        {c.dietaryRestrictions.length
                          ? c.dietaryRestrictions.map((d) => <span key={d} className="tag tag-sm"><UtensilsCrossed size={10} /> {d}</span>)
                          : <span className="muted tiny">No dietary restrictions</span>}
                      </div>
                    </div>
                    <div className="child-item-actions">
                      <button className="icon-btn" onClick={() => setEditingChild(c)} aria-label={`Edit ${c.firstName}`}><Pencil size={16} /></button>
                      <button className="icon-btn danger-text" onClick={() => setDeletingChild(c)} aria-label={`Remove ${c.firstName}`}><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card payment-card">
            <div className="card-head">
              <h2><CreditCard size={18} /> Payment plan</h2>
              <span className="pill pill-low">Coming soon</span>
            </div>
            <p className="small">Soon you'll be able to add a payment method and spread session costs into a payment plan, right from your profile.</p>
            <p className="muted tiny">Nothing to set up yet. Session prices shown today are for reference, and you won't be charged when you book.</p>
          </section>

          <section className="card privacy-card">
            <div className="card-head"><h2><ShieldCheck size={18} /> How your data is shared</h2></div>
            <p className="small">Staff see different things at different times:</p>
            <ul className="privacy-list">
              <li><PrivacyBadge shared /> Child's name, age, and dietary restrictions, as soon as you book</li>
              <li><PrivacyBadge shared={false} /> Your name, email, phone, and address</li>
              <li><PrivacyBadge shared={false} /> Emergency contact and medical notes</li>
            </ul>
            <p className="muted tiny">You'll see exactly what's shared and confirm it every time you book.</p>
          </section>
        </div>
      </div>

      <DelayedShareNote className="page-end" />

      <Modal open={editingChild !== null} onClose={() => setEditingChild(null)} title={editingChild === 'new' ? 'Add a child' : 'Edit child'}>
        {editingChild !== null && (
          <ChildForm
            child={editingChild === 'new' ? undefined : editingChild}
            defaultLastName={profile?.lastName}
            onCancel={() => setEditingChild(null)}
            onSaved={(c) => {
              toast(editingChild === 'new' ? `${c.firstName} was added` : `${c.firstName}'s details were updated`);
              setEditingChild(null);
              invalidate('profile');
            }}
          />
        )}
      </Modal>

      <ConfirmDialog open={!!deletingChild} onClose={() => setDeletingChild(null)} onConfirm={deleteChild} title={`Remove ${deletingChild?.firstName ?? 'child'}?`} confirmLabel="Remove">
        <p>This permanently deletes {deletingChild?.firstName}'s details and booking history.</p>
      </ConfirmDialog>
    </div>
  );
}
