import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FieldRow {
  id?: string;
  field_name: string;
  field_type: string;
  sap_field_name: string;
  default_value?: string;
  is_required?: boolean;
  json_path?: string;
  map_to_column?: string;
  map_to_table?: string;
  description: string;
  sort_order: number;
  isNew?: boolean;
}

interface Props {
  config: { id: string; config_name: string };
  isOpen: boolean;
  onClose: () => void;
}

const fieldTypes = ['string', 'integer', 'number', 'boolean', 'date', 'datetime', 'array', 'object'];

/** Maps SAP field type to Postgres column type for add_dynamic_column RPC */
function mapFieldTypeToDbType(fieldType: string): string {
  const map: Record<string, string> = {
    string: 'text',
    integer: 'integer',
    number: 'numeric',
    boolean: 'boolean',
    date: 'date',
    datetime: 'timestamptz',
    array: 'jsonb',
    object: 'jsonb',
  };
  return map[fieldType] || 'text';
}

const sapTables = [
  { value: 'shop_floor_stock', label: 'Shop Floor Stock' },
  { value: 'inward_inspection_lots', label: 'Inward Inspection Lots' },
  { value: 'materials', label: 'Materials' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'mrb_records', label: 'MRB Records' },
];

export function SAPApiFieldsDialog({ config, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState('request');
  const [requestFields, setRequestFields] = useState<FieldRow[]>([]);
  const [responseFields, setResponseFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && config.id) loadFields();
  }, [isOpen, config.id]);

  const loadFields = async () => {
    setLoading(true);
    const [reqRes, respRes] = await Promise.all([
      supabase.from('sap_api_request_fields').select('*').eq('config_id', config.id).order('sort_order'),
      supabase.from('sap_api_response_fields').select('*').eq('config_id', config.id).order('sort_order'),
    ]);
    if (reqRes.data) setRequestFields(reqRes.data as unknown as FieldRow[]);
    if (respRes.data) setResponseFields(respRes.data as unknown as FieldRow[]);
    setLoading(false);
  };

  const addRequestField = () => {
    setRequestFields([...requestFields, {
      field_name: '', field_type: 'string', sap_field_name: '', default_value: '',
      is_required: false, description: '', sort_order: requestFields.length, isNew: true,
    }]);
  };

  const addResponseField = () => {
    setResponseFields([...responseFields, {
      field_name: '', field_type: 'string', sap_field_name: '', json_path: '',
      map_to_column: '', map_to_table: '', description: '', sort_order: responseFields.length, isNew: true,
    }]);
  };

  const updateReqField = (i: number, key: keyof FieldRow, val: any) => {
    const u = [...requestFields]; (u[i] as any)[key] = val; setRequestFields(u);
  };
  const updateRespField = (i: number, key: keyof FieldRow, val: any) => {
    const u = [...responseFields]; (u[i] as any)[key] = val; setResponseFields(u);
  };

  const removeReqField = async (i: number) => {
    const f = requestFields[i];
    if (f.id) await supabase.from('sap_api_request_fields').delete().eq('id', f.id);
    setRequestFields(requestFields.filter((_, idx) => idx !== i));
  };
  const removeRespField = async (i: number) => {
    const f = responseFields[i];
    if (f.id) await supabase.from('sap_api_response_fields').delete().eq('id', f.id);
    setResponseFields(responseFields.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const f of requestFields) {
        const data = {
          config_id: config.id, field_name: f.field_name, field_type: f.field_type,
          sap_field_name: f.sap_field_name, default_value: f.default_value || null,
          is_required: f.is_required || false, description: f.description || null, sort_order: f.sort_order,
        };
        if (f.id && !f.isNew) {
          await supabase.from('sap_api_request_fields').update(data as any).eq('id', f.id);
        } else if (f.field_name.trim()) {
          await supabase.from('sap_api_request_fields').insert(data as any);
        }
      }
      for (const f of responseFields) {
        const data = {
          config_id: config.id, field_name: f.field_name, field_type: f.field_type,
          sap_field_name: f.sap_field_name, json_path: f.json_path || null,
          map_to_column: f.map_to_column || null, map_to_table: f.map_to_table || null,
          description: f.description || null, sort_order: f.sort_order,
        };
        if (f.id && !f.isNew) {
          await supabase.from('sap_api_response_fields').update(data as any).eq('id', f.id);
        } else if (f.field_name.trim()) {
          await supabase.from('sap_api_response_fields').insert(data as any);
        }

        // Auto-create column in the target table if map_to_table and map_to_column are set
        if (f.map_to_table && f.map_to_column && f.map_to_column.trim()) {
          const colType = mapFieldTypeToDbType(f.field_type);
          try {
            await supabase.rpc('add_dynamic_column', {
              _table_name: f.map_to_table,
              _column_name: f.map_to_column.trim().toLowerCase(),
              _column_type: colType,
            });
          } catch (colErr: any) {
            // Column may already exist — that's fine
            console.log(`Column ${f.map_to_column} on ${f.map_to_table}: ${colErr.message || 'already exists'}`);
          }
        }
      }
      toast({ title: 'Saved', description: 'Field mappings updated and target columns ensured' });
      await loadFields();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Field Mappings — {config.config_name}</DialogTitle>
          <DialogDescription>Configure request and response field mappings for SAP integration</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="request">
              Request Fields <Badge variant="secondary" className="ml-1.5 text-xs">{requestFields.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="response">
              Response Fields <Badge variant="secondary" className="ml-1.5 text-xs">{responseFields.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={addRequestField} className="gap-1"><Plus className="h-4 w-4" /> Add Field</Button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground py-4">Loading...</p> : requestFields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No request fields. Click "Add Field" to start mapping.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>SAP Field</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Req</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestFields.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={f.field_name} onChange={e => updateReqField(i, 'field_name', e.target.value)} className="h-8 text-sm" placeholder="BUKRS" /></TableCell>
                      <TableCell><Input value={f.sap_field_name} onChange={e => updateReqField(i, 'sap_field_name', e.target.value)} className="h-8 text-sm" placeholder="CompanyCode" /></TableCell>
                      <TableCell>
                        <Select value={f.field_type} onValueChange={v => updateReqField(i, 'field_type', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{fieldTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={f.default_value || ''} onChange={e => updateReqField(i, 'default_value', e.target.value)} className="h-8 text-sm" /></TableCell>
                      <TableCell><Checkbox checked={f.is_required || false} onCheckedChange={v => updateReqField(i, 'is_required', v)} /></TableCell>
                      <TableCell><Input value={f.description} onChange={e => updateReqField(i, 'description', e.target.value)} className="h-8 text-sm" /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => removeReqField(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="response" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={addResponseField} className="gap-1"><Plus className="h-4 w-4" /> Add Field</Button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground py-4">Loading...</p> : responseFields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No response fields. Click "Add Field" to start mapping.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>SAP Field</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>JSON Path</TableHead>
                    <TableHead>Map To Table</TableHead>
                    <TableHead>Map To Column</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responseFields.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={f.field_name} onChange={e => updateRespField(i, 'field_name', e.target.value)} className="h-8 text-sm" placeholder="MATNR" /></TableCell>
                      <TableCell><Input value={f.sap_field_name} onChange={e => updateRespField(i, 'sap_field_name', e.target.value)} className="h-8 text-sm" placeholder="MaterialNumber" /></TableCell>
                      <TableCell>
                        <Select value={f.field_type} onValueChange={v => updateRespField(i, 'field_type', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{fieldTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={f.json_path || ''} onChange={e => updateRespField(i, 'json_path', e.target.value)} className="h-8 text-sm" placeholder="$.d.results[*]" /></TableCell>
                      <TableCell>
                        <Select value={f.map_to_table || ''} onValueChange={v => updateRespField(i, 'map_to_table', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{sapTables.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={f.map_to_column || ''} onChange={e => updateRespField(i, 'map_to_column', e.target.value)} className="h-8 text-sm" placeholder="material_code" /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => removeRespField(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Field Mappings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
