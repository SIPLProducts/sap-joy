import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleMatrix } from '@/hooks/useRoleMatrix';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Mail, Server, Info, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface SmtpConfig {
  id: string;
  plant: string | null;
  sender_email: string;
  sender_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  use_tls: boolean;
  is_active: boolean;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  subject_template: string;
  body_template: string;
  plant: string | null;
  is_active: boolean;
  to_emails: string[];
  cc_emails: string[];
  to_roles: string[];
}

const EVENT_TYPES = [
  { value: 'mrb_created', label: 'MRB Created' },
  { value: 'mrb_forwarded', label: 'MRB Forwarded' },
  { value: 'mrb_approved', label: 'MRB Approved' },
  { value: 'mrb_rejected', label: 'MRB Rejected' },
  { value: 'sla_warning', label: 'SLA Warning' },
];

const MRB_VARIABLES = [
  { key: 'mrb_number', label: 'MRB Number' },
  { key: 'material_number', label: 'Material Code' },
  { key: 'material_description', label: 'Material Description' },
  { key: 'plant', label: 'Plant' },
  { key: 'vendor_code', label: 'Vendor Code' },
  { key: 'vendor_name', label: 'Vendor Name' },
  { key: 'grn_number', label: 'GRN Number' },
  { key: 'po_number', label: 'PO Number' },
  { key: 'inspection_lot', label: 'Inspection Lot' },
  { key: 'total_quantity', label: 'Total Quantity' },
  { key: 'blocked_quantity', label: 'Blocked Quantity' },
  { key: 'rejected_quantity', label: 'Rejected Quantity' },
  { key: 'uom', label: 'UOM' },
  { key: 'quality_decision', label: 'Quality Decision' },
  { key: 'defect_category', label: 'Defect Category' },
  { key: 'defect_description', label: 'Defect Description' },
  { key: 'pending_with', label: 'Pending With' },
  { key: 'final_decision', label: 'Final Decision' },
  { key: 'pending_days', label: 'Pending Days' },
  { key: 'status', label: 'Status' },
  { key: 'batch', label: 'Batch' },
  { key: 'storage_location', label: 'Storage Location' },
];

const INSPECTION_VARIABLES = [
  { key: 'posting_date', label: 'Posting Date' },
  { key: 'inspection_date', label: 'Inspection Date' },
  { key: 'block_reason', label: 'Block Reason' },
  { key: 'transaction_quantity', label: 'Transaction Quantity' },
  { key: 'po_item_number', label: 'PO Item Number' },
];

const SAMPLE_BODY = `Dear Material Review Board,

A quality discrepancy has been identified in a recent shipment of {{material_description}} from {{vendor_name}}. To maintain our production schedule and quality standards, we require your collective review and approval on the proposed disposition.

1. Defect Overview
   Total Quantity: {{total_quantity}} {{uom}}
   Blocked Quantity: {{blocked_quantity}} {{uom}}
   Primary Issue: {{defect_description}}
   Quality Decision: {{quality_decision}}
   Defect Category: {{defect_category}}

2. Material & Vendor Details
   Material Code: {{material_number}}
   Plant: {{plant}}
   Vendor Code: {{vendor_code}}
   GRN Number: {{grn_number}}
   PO Number: {{po_number}}
   PO Item: {{po_item_number}}
   Inspection Lot: {{inspection_lot}}

3. Proposed Disposition
   Recommended Action: {{quality_decision}}
   Routed To: {{pending_with}}

4. Required Action
   Please review the Non-Conformance Report (NCR) and provide your decision at the earliest.

Best regards,
Quality Department`;

export default function EmailConfiguration() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const { hasAccess, loading: permLoading } = useRoleMatrix();
  const isAdmin = userRole === 'admin' || hasAccess('email_config');

  const [plants, setPlants] = useState<{ code: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ role_key: string; name: string }[]>([]);

  // SMTP state
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<SmtpConfig | null>(null);
  const [smtpDeleteTarget, setSmtpDeleteTarget] = useState<SmtpConfig | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    plant: '' as string,
    sender_email: '',
    sender_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    use_tls: true,
    is_active: true,
  });

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    template_key: '',
    subject_template: '',
    body_template: '',
    plant: '' as string,
    is_active: true,
    to_emails: '',
    cc_emails: '',
    to_roles: [] as string[],
  });

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Test SMTP state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testSmtpId, setTestSmtpId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    fetchPlants();
    fetchDepartments();
    fetchSmtpConfigs();
    fetchTemplates();
  }, []);

  const fetchPlants = async () => {
    const { data } = await supabase.from('plants').select('code, name').order('code');
    if (data) setPlants(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('role_key, name').eq('is_active', true).order('name');
    if (data) setDepartments(data.filter(d => d.role_key));
  };

  const fetchSmtpConfigs = async () => {
    const { data } = await supabase.from('smtp_config').select('*').order('plant');
    if (data) setSmtpConfigs(data as SmtpConfig[]);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from('email_templates').select('*').order('plant');
    if (data) setTemplates(data.map(t => ({
      ...t,
      to_emails: (t as any).to_emails || [],
      cc_emails: (t as any).cc_emails || [],
      to_roles: (t as any).to_roles || [],
    })));
  };

  // SMTP CRUD
  const openSmtpDialog = (smtp?: SmtpConfig) => {
    if (smtp) {
      setEditingSmtp(smtp);
      setSmtpForm({
        plant: smtp.plant || '',
        sender_email: smtp.sender_email,
        sender_name: smtp.sender_name,
        smtp_host: smtp.smtp_host,
        smtp_port: smtp.smtp_port,
        smtp_username: smtp.smtp_username,
        smtp_password: smtp.smtp_password,
        use_tls: smtp.use_tls,
        is_active: smtp.is_active,
      });
    } else {
      setEditingSmtp(null);
      setSmtpForm({
        plant: '',
        sender_email: '',
        sender_name: '',
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        use_tls: true,
        is_active: true,
      });
    }
    setSmtpDialogOpen(true);
  };

  const saveSmtp = async () => {
    const payload = {
      ...smtpForm,
      plant: smtpForm.plant || null,
    };

    if (editingSmtp) {
      const { error } = await supabase.from('smtp_config').update(payload).eq('id', editingSmtp.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('smtp_config').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: 'Success', description: 'SMTP configuration saved' });
    setSmtpDialogOpen(false);
    fetchSmtpConfigs();
  };

  const deleteSmtp = async (target: SmtpConfig) => {
    const { error } = await supabase.from('smtp_config').delete().eq('id', target.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Deleted successfully',
      description: `SMTP configuration for ${target.sender_email} (${target.plant ? `Plant ${target.plant}` : 'All Plants'}) removed.`,
    });
    setSmtpDeleteTarget(null);
    fetchSmtpConfigs();
  };

  // Template CRUD
  const openTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        template_key: template.template_key,
        subject_template: template.subject_template,
        body_template: template.body_template,
        plant: template.plant || '',
        is_active: template.is_active,
        to_emails: (template.to_emails || []).join(', '),
        cc_emails: (template.cc_emails || []).join(', '),
        to_roles: template.to_roles || [],
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        template_key: '',
        subject_template: '',
        body_template: SAMPLE_BODY,
        plant: '',
        is_active: true,
        to_emails: '',
        cc_emails: '',
        to_roles: [],
      });
    }
    setTemplateDialogOpen(true);
  };

  const saveTemplate = async () => {
    const payload = {
      template_key: templateForm.template_key,
      subject_template: templateForm.subject_template,
      body_template: templateForm.body_template,
      plant: templateForm.plant || null,
      is_active: templateForm.is_active,
      to_emails: templateForm.to_emails ? templateForm.to_emails.split(',').map(e => e.trim()).filter(Boolean) : [],
      cc_emails: templateForm.cc_emails ? templateForm.cc_emails.split(',').map(e => e.trim()).filter(Boolean) : [],
      to_roles: templateForm.to_roles,
      cc_roles: [],
    };

    if (editingTemplate) {
      const { error } = await supabase.from('email_templates').update(payload as any).eq('id', editingTemplate.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('email_templates').insert(payload as any);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: 'Success', description: 'Email template saved' });
    setTemplateDialogOpen(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Deleted', description: 'Email template removed' });
    fetchTemplates();
  };

  const insertVariable = (varKey: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.body_template;
    const varText = `{{${varKey}}}`;
    const newText = text.substring(0, start) + varText + text.substring(end);
    setTemplateForm(prev => ({ ...prev, body_template: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varText.length, start + varText.length);
    }, 0);
  };

  const toggleRole = (list: string[], role: string, field: 'to_roles' | 'cc_roles') => {
    const updated = list.includes(role) ? list.filter(r => r !== role) : [...list, role];
    setTemplateForm(prev => ({ ...prev, [field]: updated }));
  };

  const getPlantName = (code: string | null) => {
    if (!code) return 'Global (All Plants)';
    const p = plants.find(p => p.code === code);
    return p ? `${p.code} - ${p.name}` : code;
  };

  if (permLoading) {
    return (
      <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-center">You do not have permission to manage email configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-foreground">Email Configuration</h1>
        <p className="text-muted-foreground">Configure SMTP settings and email templates per plant</p>
      </div>

      <Tabs defaultValue="smtp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="smtp" className="gap-2"><Server className="h-4 w-4" /> SMTP Settings</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><Mail className="h-4 w-4" /> Email Templates</TabsTrigger>
        </TabsList>

        {/* SMTP Tab */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>SMTP Configuration</CardTitle>
                <CardDescription>Configure sender email credentials per plant. Emails will be sent from the respective plant's configured mail ID.</CardDescription>
              </div>
              <Button onClick={() => openSmtpDialog()} className="gap-2"><Plus className="h-4 w-4" /> Add SMTP</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plant</TableHead>
                    <TableHead>Sender Email</TableHead>
                    <TableHead>Sender Name</TableHead>
                    <TableHead>SMTP Host</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>TLS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smtpConfigs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No SMTP configurations. Add one to enable email sending.</TableCell></TableRow>
                  )}
                  {smtpConfigs.map(smtp => (
                    <TableRow key={smtp.id}>
                      <TableCell className="font-medium">{getPlantName(smtp.plant)}</TableCell>
                      <TableCell>{smtp.sender_email}</TableCell>
                      <TableCell>{smtp.sender_name}</TableCell>
                      <TableCell>{smtp.smtp_host}</TableCell>
                      <TableCell>{smtp.smtp_port}</TableCell>
                      <TableCell>{smtp.use_tls ? 'Yes' : 'No'}</TableCell>
                      <TableCell><Badge variant={smtp.is_active ? 'default' : 'secondary'}>{smtp.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => { setTestSmtpId(smtp.id); setTestEmail(''); setTestDialogOpen(true); }}><Mail className="h-4 w-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Test Email</TooltipContent>
                        </Tooltip>
                        <Button size="icon" variant="ghost" onClick={() => openSmtpDialog(smtp)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteSmtp(smtp.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>Configure email body with dynamic variables. Use the variable guide to insert placeholders that get replaced with actual MRB data.</CardDescription>
              </div>
              <Button onClick={() => openTemplateDialog()} className="gap-2"><Plus className="h-4 w-4" /> Add Template</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plant</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No templates configured. Add one to get started.</TableCell></TableRow>
                  )}
                  {templates.map(tpl => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{getPlantName(tpl.plant)}</TableCell>
                      <TableCell>{EVENT_TYPES.find(e => e.value === tpl.template_key)?.label || tpl.template_key}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tpl.subject_template}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(tpl.to_roles || []).map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}
                          {(!tpl.to_roles || tpl.to_roles.length === 0) && <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={tpl.is_active ? 'default' : 'secondary'}>{tpl.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openTemplateDialog(tpl)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SMTP Dialog */}
      <Dialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSmtp ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Plant</Label>
              <Select value={smtpForm.plant} onValueChange={v => setSmtpForm(p => ({ ...p, plant: v }))}>
                <SelectTrigger><SelectValue placeholder="Global (All Plants)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Global (All Plants)</SelectItem>
                  {plants.map(p => <SelectItem key={p.code} value={p.code}>{p.code} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Sender Email</Label><Input value={smtpForm.sender_email} onChange={e => setSmtpForm(p => ({ ...p, sender_email: e.target.value }))} placeholder="noreply@company.com" /></div>
              <div><Label>Sender Name</Label><Input value={smtpForm.sender_name} onChange={e => setSmtpForm(p => ({ ...p, sender_name: e.target.value }))} placeholder="MRB System" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>SMTP Host</Label><Input value={smtpForm.smtp_host} onChange={e => setSmtpForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
              <div><Label>SMTP Port</Label><Input type="number" value={smtpForm.smtp_port} onChange={e => setSmtpForm(p => ({ ...p, smtp_port: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>SMTP Username</Label><Input value={smtpForm.smtp_username} onChange={e => setSmtpForm(p => ({ ...p, smtp_username: e.target.value }))} /></div>
              <div><Label>SMTP Password</Label><Input type="password" value={smtpForm.smtp_password} onChange={e => setSmtpForm(p => ({ ...p, smtp_password: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={smtpForm.use_tls} onCheckedChange={v => setSmtpForm(p => ({ ...p, use_tls: v }))} /><Label>Use TLS</Label></div>
              <div className="flex items-center gap-2"><Switch checked={smtpForm.is_active} onCheckedChange={v => setSmtpForm(p => ({ ...p, is_active: v }))} /><Label>Active</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmtpDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSmtp}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test SMTP Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Recipient Email Address</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!testEmail || testSending}
              onClick={async () => {
                setTestSending(true);
                try {
                  const { data, error } = await supabase.functions.invoke('test-smtp', {
                    body: { smtp_config_id: testSmtpId, to_email: testEmail },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast({ title: 'Success', description: 'Test email sent successfully!' });
                  setTestDialogOpen(false);
                } catch (err: any) {
                  toast({ title: 'Failed', description: err.message || 'Could not send test email', variant: 'destructive' });
                } finally {
                  setTestSending(false);
                }
              }}
            >
              {testSending ? 'Sending...' : 'Send Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Email Template' : 'Add Email Template'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plant</Label>
                  <Select value={templateForm.plant} onValueChange={v => setTemplateForm(p => ({ ...p, plant: v }))}>
                    <SelectTrigger><SelectValue placeholder="Global (All Plants)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">Global (All Plants)</SelectItem>
                      {plants.map(p => <SelectItem key={p.code} value={p.code}>{p.code} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select value={templateForm.template_key} onValueChange={v => setTemplateForm(p => ({ ...p, template_key: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Subject</Label>
                <Input value={templateForm.subject_template} onChange={e => setTemplateForm(p => ({ ...p, subject_template: e.target.value }))} placeholder="Quality Non-Conformance: {{mrb_number}} - {{material_description}}" />
              </div>

              <div>
                <Label>Body</Label>
                <Textarea
                  ref={bodyTextareaRef}
                  value={templateForm.body_template}
                  onChange={e => setTemplateForm(p => ({ ...p, body_template: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Use the variable guide to insert dynamic placeholders..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>To Emails (comma separated)</Label>
                  <Input value={templateForm.to_emails} onChange={e => setTemplateForm(p => ({ ...p, to_emails: e.target.value }))} placeholder="user1@company.com, user2@company.com" />
                </div>
                <div>
                  <Label>CC Emails (comma separated)</Label>
                  <Input value={templateForm.cc_emails} onChange={e => setTemplateForm(p => ({ ...p, cc_emails: e.target.value }))} placeholder="manager@company.com" />
                </div>
              </div>

              <div>
                <Label>Role (email sent only when this role is in MRB workflow routing)</Label>
                <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md min-h-[40px]">
                  {departments.map(d => (
                    <Badge
                      key={d.role_key}
                      variant={templateForm.to_roles.includes(d.role_key!) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleRole(templateForm.to_roles, d.role_key!, 'to_roles')}
                    >
                      {d.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={templateForm.is_active} onCheckedChange={v => setTemplateForm(p => ({ ...p, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>

            {/* Right: Variable Guide */}
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Variable Guide</CardTitle>
                  <CardDescription className="text-xs">Click a variable to insert it at cursor position in the body.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">MRB Record Fields</p>
                    <div className="flex flex-wrap gap-1">
                      {MRB_VARIABLES.map(v => (
                        <Tooltip key={v.key}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                              onClick={() => insertVariable(v.key)}
                            >
                              {`{{${v.key}}}`}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{v.label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Inspection Lot Fields</p>
                    <div className="flex flex-wrap gap-1">
                      {INSPECTION_VARIABLES.map(v => (
                        <Tooltip key={v.key}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                              onClick={() => insertVariable(v.key)}
                            >
                              {`{{${v.key}}}`}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{v.label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Copy className="h-4 w-4" /> Sample Body</CardTitle>
                  <CardDescription className="text-xs">Reference template showing how to use variables in the email body.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full mb-2" onClick={() => setTemplateForm(p => ({ ...p, body_template: SAMPLE_BODY }))}>
                    Use Sample Body
                  </Button>
                  <pre className="text-[10px] leading-tight whitespace-pre-wrap text-muted-foreground max-h-[300px] overflow-y-auto">
                    {SAMPLE_BODY}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
