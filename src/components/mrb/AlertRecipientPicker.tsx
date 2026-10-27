import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, X } from 'lucide-react';
import { getHblContactsFor } from '@/lib/hblAlertContacts';

export interface AlertRecipient { user_id: string | null; email: string; }
export type AlertRecipientMap = Record<string, AlertRecipient[]>;

interface Props {
  departments: string[];
  plant: string;
  getLabel?: (roleKey: string) => string;
  value: AlertRecipientMap;
  onChange: (v: AlertRecipientMap) => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Optional per-department email recipient selection. Empty = default (whole role). */
export function AlertRecipientPicker({ departments, getLabel, value, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (departments.length === 0) return null;

  const has = (role: string, email: string) =>
    !!value[role]?.some(x => x.email.toLowerCase() === email.toLowerCase());

  const setChecked = (role: string, email: string, checked: boolean) => {
    const cur = (value[role] || []).filter(x => x.email.toLowerCase() !== email.toLowerCase());
    onChange({ ...value, [role]: checked ? [...cur, { user_id: null, email }] : cur });
  };

  const addManual = (role: string) => {
    const email = (drafts[role] || '').trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) { setErrors({ ...errors, [role]: 'Please enter a valid email.' }); return; }
    if (has(role, email)) { setErrors({ ...errors, [role]: 'This email is already added.' }); return; }
    setChecked(role, email, true);
    setDrafts({ ...drafts, [role]: '' });
    setErrors({ ...errors, [role]: '' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Email Alert Recipients</CardTitle>
        <CardDescription>Optional. Tick or add emails for each department. If none are picked, everyone in that department is notified.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {departments.map(role => {
          const label = getLabel?.(role) || role;
          const list = getHblContactsFor(role, label);
          const manual = (value[role] || []).filter(x => !list.includes(x.email.toLowerCase()));
          return (
            <div key={role} className="border rounded-md p-3 space-y-2">
              <div className="font-medium text-sm">{label}</div>
              {list.length === 0 && <p className="text-xs text-muted-foreground">No listed emails for this department.</p>}
              {list.map(email => (
                <label key={email} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={has(role, email)} onCheckedChange={c => setChecked(role, email, !!c)} />
                  <span className="truncate">{email}</span>
                </label>
              ))}
              {manual.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {manual.map(m => (
                    <span key={m.email} className="inline-flex items-center gap-1 rounded bg-secondary text-secondary-foreground px-2 py-0.5 text-xs">
                      {m.email}
                      <button type="button" onClick={() => setChecked(role, m.email, false)} aria-label={`Remove ${m.email}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Input
                  type="email"
                  placeholder="Add other email"
                  className="h-8 text-sm"
                  value={drafts[role] || ''}
                  onChange={e => { setDrafts({ ...drafts, [role]: e.target.value }); setErrors({ ...errors, [role]: '' }); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual(role); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addManual(role)}>Add</Button>
              </div>
              {errors[role] && <p className="text-xs text-destructive">{errors[role]}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
