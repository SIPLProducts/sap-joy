import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, Eye, EyeOff, Link2, ChevronDown, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SAPConfig {
  id?: string;
  config_name: string;
  description: string | null;
  base_url: string | null;
  endpoint_path: string | null;
  api_endpoint: string;
  http_method: string | null;
  auth_type: string | null;
  sap_client: string | null;
  timeout_ms: number | null;
  connection_mode: string | null;
  proxy_tunnel_url: string | null;
  proxy_secret: string | null;
  username: string | null;
  encrypted_password: string | null;
  api_key: string | null;
  is_active: boolean | null;
  sync_frequency: string | null;
  cron_expression?: string | null;
  scheduler_enabled?: boolean | null;
  retry_count?: number | null;
  retry_delay_ms?: number | null;
  max_records?: number | null;
  enable_logging?: boolean | null;
  custom_headers?: Record<string, string> | null;
  client_id?: string | null;
  client_secret?: string | null;
  token_url?: string | null;
}

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
  config: SAPConfig | null;
  onSave: (data: Partial<SAPConfig>) => Promise<boolean>;
  onCancel: () => void;
}

export function SAPApiEditForm({ config, onSave, onCancel }: Props) {
  // API Details state
  const [name, setName] = useState(config?.config_name || '');
  const [description, setDescription] = useState(config?.description || '');
  const [baseUrl, setBaseUrl] = useState(config?.base_url || '');
  const [endpointPath, setEndpointPath] = useState(config?.endpoint_path || '');
  const [httpMethod, setHttpMethod] = useState(config?.http_method || 'GET');
  const [authType, setAuthType] = useState(config?.auth_type || 'basic');
  const [sapClient, setSapClient] = useState(config?.sap_client || '');
  const [timeoutMs, setTimeoutMs] = useState(String(config?.timeout_ms || 30000));
  const [connectionMode, setConnectionMode] = useState(config?.connection_mode || 'direct');
  const [proxyUrl, setProxyUrl] = useState(config?.proxy_tunnel_url || '');
  const [proxySecret, setProxySecret] = useState(config?.proxy_secret || '');

  // Credentials state
  const [username, setUsername] = useState(config?.username || '');
  const [password, setPassword] = useState(config?.encrypted_password || '');
  const [apiKey, setApiKey] = useState(config?.api_key || '');
  const [clientId, setClientId] = useState(config?.client_id || '');
  const [clientSecret, setClientSecret] = useState(config?.client_secret || '');
  const [tokenUrl, setTokenUrl] = useState(config?.token_url || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showProxySecret, setShowProxySecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Scheduler state
  const [syncFrequency, setSyncFrequency] = useState(config?.sync_frequency || 'manual');
  const [cronExpression, setCronExpression] = useState(config?.cron_expression || '');
  const [schedulerEnabled, setSchedulerEnabled] = useState(config?.scheduler_enabled || false);
  const [retryCount, setRetryCount] = useState(String(config?.retry_count || 3));
  const [retryDelayMs, setRetryDelayMs] = useState(String(config?.retry_delay_ms || 5000));

  // Settings state
  const [maxRecords, setMaxRecords] = useState(String(config?.max_records || 1000));
  const [enableLogging, setEnableLogging] = useState(config?.enable_logging !== false);
  const [isActive, setIsActive] = useState(config?.is_active !== false);
  const [customHeadersText, setCustomHeadersText] = useState(
    config?.custom_headers ? JSON.stringify(config.custom_headers, null, 2) : '{}'
  );

  // Field mapping state
  const [requestFields, setRequestFields] = useState<FieldRow[]>([]);
  const [responseFields, setResponseFields] = useState<FieldRow[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Load existing fields when editing
  useEffect(() => {
    if (config?.id) {
      loadFields();
    }
  }, [config?.id]);

  const loadFields = async () => {
    if (!config?.id) return;
    setLoadingFields(true);
    const [reqRes, respRes] = await Promise.all([
      supabase.from('sap_api_request_fields').select('*').eq('config_id', config.id).order('sort_order'),
      supabase.from('sap_api_response_fields').select('*').eq('config_id', config.id).order('sort_order'),
    ]);
    if (reqRes.data) setRequestFields(reqRes.data as unknown as FieldRow[]);
    if (respRes.data) setResponseFields(respRes.data as unknown as FieldRow[]);
    setLoadingFields(false);
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

  const updateRequestField = (index: number, key: keyof FieldRow, value: any) => {
    const updated = [...requestFields];
    (updated[index] as any)[key] = value;
    setRequestFields(updated);
  };

  const updateResponseField = (index: number, key: keyof FieldRow, value: any) => {
    const updated = [...responseFields];
    (updated[index] as any)[key] = value;
    setResponseFields(updated);
  };

  const removeRequestField = async (index: number) => {
    const field = requestFields[index];
    if (field.id) {
      await supabase.from('sap_api_request_fields').delete().eq('id', field.id);
    }
    setRequestFields(requestFields.filter((_, i) => i !== index));
  };

  const removeResponseField = async (index: number) => {
    const field = responseFields[index];
    if (field.id) {
      await supabase.from('sap_api_response_fields').delete().eq('id', field.id);
    }
    setResponseFields(responseFields.filter((_, i) => i !== index));
  };

  const saveFields = async (configId: string) => {
    // Save request fields
    for (const field of requestFields) {
      const data = {
        config_id: configId,
        field_name: field.field_name,
        field_type: field.field_type,
        sap_field_name: field.sap_field_name,
        default_value: field.default_value || null,
        is_required: field.is_required || false,
        description: field.description || null,
        sort_order: field.sort_order,
      };
      if (field.id && !field.isNew) {
        await supabase.from('sap_api_request_fields').update(data as any).eq('id', field.id);
      } else if (field.field_name.trim()) {
        await supabase.from('sap_api_request_fields').insert(data as any);
      }
    }
    // Save response fields
    for (const field of responseFields) {
      const data = {
        config_id: configId,
        field_name: field.field_name,
        field_type: field.field_type,
        sap_field_name: field.sap_field_name,
        json_path: field.json_path || null,
        map_to_column: field.map_to_column || null,
        map_to_table: field.map_to_table || null,
        description: field.description || null,
        sort_order: field.sort_order,
      };
      if (field.id && !field.isNew) {
        await supabase.from('sap_api_response_fields').update(data as any).eq('id', field.id);
      } else if (field.field_name.trim()) {
        await supabase.from('sap_api_response_fields').insert(data as any);
      }
    }
  };

  let parsedHeaders: Record<string, string> = {};
  try { parsedHeaders = JSON.parse(customHeadersText); } catch {}

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const success = await onSave({
      config_name: name.trim(),
      description: description || null,
      base_url: baseUrl || null,
      endpoint_path: endpointPath || null,
      http_method: httpMethod,
      auth_type: authType,
      sap_client: sapClient?.trim() || null,
      timeout_ms: parseInt(timeoutMs) || 30000,
      connection_mode: connectionMode,
      proxy_tunnel_url: proxyUrl?.trim() || null,
      proxy_secret: proxySecret?.trim() || null,
      username: authType === 'basic' ? username.trim() || null : null,
      encrypted_password: authType === 'basic' ? password.replace(/\r?\n/g, '') || null : null,
      api_key: authType === 'api_key' ? apiKey || null : null,
      client_id: authType === 'oauth' ? clientId || null : null,
      client_secret: authType === 'oauth' ? clientSecret || null : null,
      token_url: authType === 'oauth' ? tokenUrl || null : null,
      is_active: isActive,
      sync_frequency: syncFrequency,
      cron_expression: cronExpression || null,
      scheduler_enabled: schedulerEnabled,
      retry_count: parseInt(retryCount) || 3,
      retry_delay_ms: parseInt(retryDelayMs) || 5000,
      max_records: parseInt(maxRecords) || 1000,
      enable_logging: enableLogging,
      custom_headers: parsedHeaders,
    } as any);

    // If we have a config ID, save fields too
    if (success && config?.id) {
      await saveFields(config.id);
    }
    setSaving(false);
  };

  const connectionModeHelp: Record<string, string> = {
    direct: 'Direct connection to cloud-hosted SAP system.',
    sap_cloud_vpn: 'SAP Cloud system accessed via VPN connection.',
    proxy: 'Route through a proxy server for on-premise SAP.',
    vpn_tunnel: 'On-premise SAP via VPN. BA runs local proxy + tunnel.',
  };

  const fieldTypes = ['string', 'integer', 'number', 'boolean', 'date', 'datetime', 'array', 'object'];

  const sapTables = [
    { value: 'shop_floor_stock', label: 'Shop Floor Stock' },
    { value: 'inward_inspection_lots', label: 'Inward Inspection Lots' },
    { value: 'materials', label: 'Materials' },
    { value: 'vendors', label: 'Vendors' },
    { value: 'mrb_records', label: 'MRB Records' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold">{config ? 'Edit' : 'New'} API Configuration</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">API Details</TabsTrigger>
          <TabsTrigger value="request">Request Fields</TabsTrigger>
          <TabsTrigger value="response">Response Fields</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ==================== API DETAILS ==================== */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">⚙️</span> API Configuration
              </CardTitle>
              <CardDescription>Edit the API endpoint details, HTTP method, and authentication type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., RESL" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Business Partner API" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base URL *</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://10.150.150.154:8103" />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint Path</Label>
                  <Input value={endpointPath} onChange={(e) => setEndpointPath(e.target.value)} placeholder="/gate_entry/login/login?sap-client=300" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>HTTP Method</Label>
                  <Select value={httpMethod} onValueChange={setHttpMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Auth Type</Label>
                  <Select value={authType} onValueChange={setAuthType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="oauth">OAuth 2.0</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SAP Client</Label>
                  <Input value={sapClient} onChange={(e) => setSapClient(e.target.value)} placeholder="300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="30000" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Connection Mode</Label>
                  <Select value={connectionMode} onValueChange={setConnectionMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct (Cloud SAP)</SelectItem>
                      <SelectItem value="sap_cloud_vpn">SAP Cloud with VPN</SelectItem>
                      <SelectItem value="proxy">Via Proxy Server</SelectItem>
                      <SelectItem value="vpn_tunnel">Via VPN Tunnel</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{connectionModeHelp[connectionMode]}</p>
                </div>
                {(connectionMode === 'proxy' || connectionMode === 'vpn_tunnel') && (
                  <div className="space-y-2">
                    <Label>Node.js Middleware URL</Label>
                    <Input value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)}
                      placeholder="e.g. https://abc.ngrok-free.app or http://host.docker.internal:3002" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>This is the URL of your Node.js middleware</strong> that connects to SAP.</p>
                      <p>• <strong>UICloud DB:</strong> Use ngrok URL (e.g. <code>https://abc.ngrok-free.app</code>)</p>
                      <p>• <strong>Client Server DB:</strong> Use <code>http://host.docker.internal:3002</code> or <code>http://10.10.4.178:3002</code></p>
                    </div>
                  </div>
                )}
              </div>

              {(connectionMode === 'proxy' || connectionMode === 'vpn_tunnel') && (
                <div className="space-y-2">
                  <Label>Proxy Secret / Password</Label>
                  <div className="relative">
                    <Input type={showProxySecret ? 'text' : 'password'} value={proxySecret}
                      onChange={(e) => setProxySecret(e.target.value)} placeholder="Shared secret for proxy authentication" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowProxySecret(!showProxySecret)}>
                      {showProxySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Shared secret sent as x-proxy-secret header.</p>
                </div>
              )}

              {connectionMode === 'vpn_tunnel' && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between gap-2">
                      <span className="flex items-center gap-2"><Link2 className="h-4 w-4" /> VPN Proxy Setup Guide (for BA)</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4 space-y-4">
                        {[
                          { step: 1, title: 'Connect to Customer VPN', desc: 'Use the VPN client provided by Customer IT to connect to their network.' },
                          { step: 2, title: 'Start Node.js Proxy Server', desc: 'Run the proxy on your machine: node index.js (port 3001)' },
                          { step: 3, title: 'Create Tunnel', desc: 'Run: ngrok http 3001 or use Cloudflare Tunnel. Copy the generated URL (e.g., https://abc123.ngrok-free.app)' },
                          { step: 4, title: 'Paste Tunnel URL Above', desc: 'Paste the tunnel URL in the "Proxy / Tunnel URL" field above and click Save. Note: Free ngrok URLs rotate on restart.' },
                        ].map((item) => (
                          <div key={item.step} className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">{item.step}</div>
                            <div>
                              <div className="font-medium">{item.title}</div>
                              <div className="text-sm text-muted-foreground">{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== REQUEST FIELDS ==================== */}
        <TabsContent value="request">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Request Fields</CardTitle>
                  <CardDescription>Define the fields sent to the SAP API in the request body/query parameters</CardDescription>
                </div>
                <Button size="sm" onClick={addRequestField} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!config?.id && (
                <p className="text-sm text-muted-foreground py-4">Save the API configuration first to manage request fields.</p>
              )}
              {config?.id && loadingFields && <p className="text-sm text-muted-foreground py-4">Loading fields...</p>}
              {config?.id && !loadingFields && requestFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No request fields defined. Click "Add Field" to create one.</p>
              )}
              {requestFields.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Field Name</TableHead>
                      <TableHead>SAP Field</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Default Value</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestFields.map((field, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                          <Input value={field.field_name} onChange={(e) => updateRequestField(idx, 'field_name', e.target.value)}
                            placeholder="e.g., BUKRS" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input value={field.sap_field_name} onChange={(e) => updateRequestField(idx, 'sap_field_name', e.target.value)}
                            placeholder="e.g., CompanyCode" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Select value={field.field_type} onValueChange={(v) => updateRequestField(idx, 'field_type', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {fieldTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={field.default_value || ''} onChange={(e) => updateRequestField(idx, 'default_value', e.target.value)}
                            placeholder="Default" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Checkbox checked={field.is_required || false}
                            onCheckedChange={(v) => updateRequestField(idx, 'is_required', v)} />
                        </TableCell>
                        <TableCell>
                          <Input value={field.description} onChange={(e) => updateRequestField(idx, 'description', e.target.value)}
                            placeholder="Description" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0"
                            onClick={() => removeRequestField(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== RESPONSE FIELDS ==================== */}
        <TabsContent value="response">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Response Fields</CardTitle>
                  <CardDescription>Map SAP API response fields to your database columns</CardDescription>
                </div>
                <Button size="sm" onClick={addResponseField} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!config?.id && (
                <p className="text-sm text-muted-foreground py-4">Save the API configuration first to manage response fields.</p>
              )}
              {config?.id && loadingFields && <p className="text-sm text-muted-foreground py-4">Loading fields...</p>}
              {config?.id && !loadingFields && responseFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No response fields defined. Click "Add Field" to create one.</p>
              )}
              {responseFields.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
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
                    {responseFields.map((field, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                          <Input value={field.field_name} onChange={(e) => updateResponseField(idx, 'field_name', e.target.value)}
                            placeholder="e.g., MATNR" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input value={field.sap_field_name} onChange={(e) => updateResponseField(idx, 'sap_field_name', e.target.value)}
                            placeholder="e.g., MaterialNumber" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Select value={field.field_type} onValueChange={(v) => updateResponseField(idx, 'field_type', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {fieldTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={field.json_path || ''} onChange={(e) => updateResponseField(idx, 'json_path', e.target.value)}
                            placeholder="$.d.results[*].Matnr" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Select value={field.map_to_table || ''} onValueChange={(v) => updateResponseField(idx, 'map_to_table', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {sapTables.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={field.map_to_column || ''} onChange={(e) => updateResponseField(idx, 'map_to_column', e.target.value)}
                            placeholder="material_code" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0"
                            onClick={() => removeResponseField(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SCHEDULER ==================== */}
        <TabsContent value="scheduler">
          <Card>
            <CardHeader>
              <CardTitle>⏱️ Scheduler Configuration</CardTitle>
              <CardDescription>Set up automatic data synchronization with SAP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Scheduler</Label>
                  <p className="text-sm text-muted-foreground">Automatically sync data from SAP at scheduled intervals</p>
                </div>
                <Switch checked={schedulerEnabled} onCheckedChange={setSchedulerEnabled} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Only</SelectItem>
                      <SelectItem value="every_5_min">Every 5 Minutes</SelectItem>
                      <SelectItem value="every_15_min">Every 15 Minutes</SelectItem>
                      <SelectItem value="every_30_min">Every 30 Minutes</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="every_6_hours">Every 6 Hours</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom (Cron)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {syncFrequency === 'custom' && (
                  <div className="space-y-2">
                    <Label>Cron Expression</Label>
                    <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
                      placeholder="*/30 * * * *" />
                    <p className="text-xs text-muted-foreground">Standard cron syntax: min hour day month weekday</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Retry Count</Label>
                  <Input type="number" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} placeholder="3" />
                  <p className="text-xs text-muted-foreground">Number of retry attempts on failure</p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (ms)</Label>
                  <Input type="number" value={retryDelayMs} onChange={(e) => setRetryDelayMs(e.target.value)} placeholder="5000" />
                  <p className="text-xs text-muted-foreground">Delay between retry attempts in milliseconds</p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Sync Schedule Preview</h4>
                <p className="text-sm text-muted-foreground">
                  {!schedulerEnabled
                    ? 'Scheduler is disabled. Enable it to set up automatic syncing.'
                    : syncFrequency === 'manual'
                    ? 'Manual mode — data will only sync when triggered manually.'
                    : syncFrequency === 'custom'
                    ? `Custom cron: ${cronExpression || '(not set)'}`
                    : `Data will sync ${syncFrequency.replace('_', ' ')} automatically.`}
                </p>
                {schedulerEnabled && syncFrequency !== 'manual' && (
                  <p className="text-xs text-muted-foreground">
                    Retries: {retryCount} attempts with {retryDelayMs}ms delay between each
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== CREDENTIALS ==================== */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle>🔐 Credentials</CardTitle>
              <CardDescription>Authentication credentials for the SAP API ({authType === 'basic' ? 'Basic Auth' : authType === 'api_key' ? 'API Key' : authType === 'oauth' ? 'OAuth 2.0' : 'None'})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {authType === 'basic' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SAP Username *</Label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="SAP_RFC_USER" />
                    </div>
                    <div className="space-y-2">
                      <Label>SAP Password *</Label>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        <Button type="button" variant="ghost" size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>SAP Client (for auth header)</Label>
                    <Input value={sapClient} onChange={(e) => setSapClient(e.target.value)} placeholder="300" />
                    <p className="text-xs text-muted-foreground">Sent as sap-client header in Basic Auth requests</p>
                  </div>
                </>
              )}

              {authType === 'api_key' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key *</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)} placeholder="Your SAP API Key" />
                      <Button type="button" variant="ghost" size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Sent as X-API-Key header in requests</p>
                  </div>
                </div>
              )}

              {authType === 'oauth' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client ID *</Label>
                      <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="OAuth Client ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret *</Label>
                      <div className="relative">
                        <Input type={showClientSecret ? 'text' : 'password'} value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)} placeholder="OAuth Client Secret" />
                        <Button type="button" variant="ghost" size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowClientSecret(!showClientSecret)}>
                          {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Token URL *</Label>
                    <Input value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)}
                      placeholder="https://sap-server.com/oauth/token" />
                    <p className="text-xs text-muted-foreground">OAuth 2.0 token endpoint for client_credentials grant</p>
                  </div>
                </div>
              )}

              {authType === 'none' && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">No authentication credentials required for this API configuration. Requests will be sent without an Authorization header.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SETTINGS ==================== */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>🛠️ Advanced Settings</CardTitle>
              <CardDescription>Configure advanced API behavior, logging, and data limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Active</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable this API configuration</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Logging</Label>
                  <p className="text-sm text-muted-foreground">Log all API requests and responses for debugging</p>
                </div>
                <Switch checked={enableLogging} onCheckedChange={setEnableLogging} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Records per Sync</Label>
                  <Input type="number" value={maxRecords} onChange={(e) => setMaxRecords(e.target.value)} placeholder="1000" />
                  <p className="text-xs text-muted-foreground">Maximum number of records to fetch per API call</p>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="30000" />
                  <p className="text-xs text-muted-foreground">Request timeout in milliseconds</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom Headers (JSON)</Label>
                <Textarea
                  value={customHeadersText}
                  onChange={(e) => setCustomHeadersText(e.target.value)}
                  placeholder='{"X-Custom-Header": "value"}'
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Additional HTTP headers sent with every request (JSON format)</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Configuration Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{isActive ? '✅ Active' : '❌ Inactive'}</span>
                  <span className="text-muted-foreground">Logging:</span>
                  <span>{enableLogging ? '✅ Enabled' : '❌ Disabled'}</span>
                  <span className="text-muted-foreground">Max Records:</span>
                  <span>{maxRecords}</span>
                  <span className="text-muted-foreground">Timeout:</span>
                  <span>{timeoutMs}ms</span>
                  <span className="text-muted-foreground">Connection:</span>
                  <span className="capitalize">{connectionMode?.replace('_', ' ')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save API Details
        </Button>
      </div>
    </div>
  );
}
