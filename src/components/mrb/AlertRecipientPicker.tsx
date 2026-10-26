import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail } from 'lucide-react';

export interface AlertRecipient { user_id: string; email: string; }
export type AlertRecipientMap = Record<string, AlertRecipient[]>;

interface Person { user_id: string; full_name: string; email: string; role: string; }

interface Props {
  departments: string[];
  plant: string;
  getLabel?: (roleKey: string) => string;
  value: AlertRecipientMap;
  onChange: (v: AlertRecipientMap) => void;
}

/** Optional per-department email recipient selection. Empty = default (whole role). */
export function AlertRecipientPicker({ departments, plant, getLabel, value, onChange }: Props) {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (departments.length === 0) { setPeople([]); return; }
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', departments);
      const ids = (roles || []).map(r => r.user_id);
      if (ids.length === 0) { setPeople([]); return; }
      const [{ data: profiles }, { data: up }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, plant').in('user_id', ids),
        supabase.from('user_plants').select('user_id, plant_code').in('user_id', ids),
      ]);
      const list: Person[] = [];
      (roles || []).forEach(r => {
        const p = profiles?.find(x => x.user_id === r.user_id);
        if (!p?.email) return;
        const plants = (up || []).filter(x => x.user_id === r.user_id).map(x => x.plant_code);
        const inPlant = !plant || !p.plant || p.plant === plant || plants.includes(plant);
        if (inPlant) list.push({ user_id: r.user_id, full_name: p.full_name, email: p.email, role: r.role });
      });
      setPeople(list);
    })();
  }, [departments.join('|'), plant]);

  if (departments.length === 0) return null;

  const toggle = (role: string, p: Person, checked: boolean) => {
    const cur = value[role] || [];
    const next = checked ? [...cur, { user_id: p.user_id, email: p.email }] : cur.filter(x => x.user_id !== p.user_id);
    onChange({ ...value, [role]: next });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Email Alert Recipients</CardTitle>
        <CardDescription>Optional. Pick who should get email alerts for each department. If none are picked, everyone in that department is notified.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {departments.map(role => {
          const list = people.filter(p => p.role === role);
          return (
            <div key={role} className="border rounded-md p-3 space-y-2">
              <div className="font-medium text-sm">{getLabel?.(role) || role}</div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">No users found for this department.</p>
              ) : list.map(p => (
                <label key={p.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!value[role]?.some(x => x.user_id === p.user_id)}
                    onCheckedChange={c => toggle(role, p, !!c)}
                  />
                  <span>{p.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate">{p.email}</span>
                </label>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
