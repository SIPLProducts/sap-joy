import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Settings2, Play, Trash2, FileText, Link2, Server } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SAPApiEditForm } from '@/components/sapApi/SAPApiEditForm';
import { SAPConnectivityGuide } from '@/components/sapApi/SAPConnectivityGuide';
import { SAPApiFieldsDialog } from '@/components/sapApi/SAPApiFieldsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { invokeSapSync } from '@/lib/sapSyncClient';

interface SAPConfig {
  id: string;
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
  last_sync_at: string | null;
  sync_frequency: string | null;
  created_at: string;
}

export default function SAPApiSettings() {
  const [configs, setConfigs] = useState<SAPConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<SAPConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [fieldsConfig, setFieldsConfig] = useState<SAPConfig | null>(null);
  const [activeTab, setActiveTab] = useState('configurations');
  const [selfHostedUrl, setSelfHostedUrlState] = useState(getSelfHostedUrl() || '');
  const { userRole } = useAuth();

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sap_api_config')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: 'Failed to load configurations', variant: 'destructive' });
    } else {
      setConfigs((data as unknown as SAPConfig[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    const { error } = await supabase.from('sap_api_config').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Configuration removed' });
      fetchConfigs();
    }
  };

  const handleTest = async (config: SAPConfig) => {
    toast({ title: 'Testing...', description: `Testing connection to ${config.config_name}` });
    try {
      const { data, error } = await invokeSapSync({ action: 'test', config_id: config.id });
      if (error) {
        toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: 'Success', description: data.message || `Connection to ${config.config_name} successful` });
      } else {
        toast({ title: 'Test Failed', description: data?.error || data?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Connection Failed', description: err.message || 'Network error', variant: 'destructive' });
    }
  };

  const handleSaveSelfHostedUrl = () => {
    const trimmed = selfHostedUrl.trim();
    setSelfHostedUrl(trimmed || null);
    toast({
      title: trimmed ? 'Self-Hosted URL Saved' : 'Self-Hosted URL Cleared',
      description: trimmed
        ? `SAP calls will route to: ${trimmed}`
        : 'SAP calls will use Lovable Cloud edge functions',
    });
  };

  const handleSave = async (data: Partial<SAPConfig>) => {
    // Build api_endpoint from base_url + endpoint_path for backward compatibility
    const apiEndpoint = `${data.base_url || ''}${data.endpoint_path || ''}`;
    const saveData = { ...data, api_endpoint: apiEndpoint };

    if (editingConfig) {
      const { error } = await supabase
        .from('sap_api_config')
        .update(saveData as any)
        .eq('id', editingConfig.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return false;
      }
      toast({ title: 'Updated', description: 'Configuration saved successfully' });
    } else {
      const { error } = await supabase
        .from('sap_api_config')
        .insert(saveData as any);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return false;
      }
      toast({ title: 'Created', description: 'New API configuration added' });
    }
    setEditingConfig(null);
    setIsCreating(false);
    fetchConfigs();
    return true;
  };

  const getMethodBadge = (method: string | null) => {
    const m = (method || 'GET').toUpperCase();
    const colors: Record<string, string> = {
      GET: 'bg-green-100 text-green-700 border-green-300',
      POST: 'bg-purple-100 text-purple-700 border-purple-300',
      PUT: 'bg-amber-100 text-amber-700 border-amber-300',
      DELETE: 'bg-red-100 text-red-700 border-red-300',
    };
    return <Badge variant="outline" className={colors[m] || ''}>{m}</Badge>;
  };

  const getConnectionBadge = (mode: string | null) => {
    const labels: Record<string, { label: string; color: string }> = {
      direct: { label: 'Direct', color: 'bg-blue-100 text-blue-700' },
      vpn_tunnel: { label: 'VPN Tunnel', color: 'bg-orange-100 text-orange-700' },
      proxy: { label: 'Proxy', color: 'bg-cyan-100 text-cyan-700' },
      sap_cloud_vpn: { label: 'SAP Cloud VPN', color: 'bg-indigo-100 text-indigo-700' },
    };
    const info = labels[mode || 'direct'] || labels.direct;
    return <Badge variant="outline" className={info.color}>{info.label}</Badge>;
  };

  // If editing or creating, show the form
  if (editingConfig || isCreating) {
    return (
      <div className="space-y-6">
        <SAPApiEditForm
          config={editingConfig}
          onSave={handleSave}
          onCancel={() => { setEditingConfig(null); setIsCreating(false); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SAP API Settings</h1>
          <p className="text-muted-foreground">Configure SAP API connections with dynamic field mappings</p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 px-3 py-1">
              System Admin
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="configurations" className="gap-2">
              <FileText className="h-4 w-4" /> API Configurations
            </TabsTrigger>
            <TabsTrigger value="connectivity" className="gap-2">
              <Link2 className="h-4 w-4" /> SAP Connectivity Guide
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" className="gap-2" onClick={() => {
            toast({ title: 'PDF Export', description: 'Generating configuration PDF...' });
          }}>
            <FileText className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        <TabsContent value="configurations" className="space-y-4">
          {/* How SAP Routing Works */}
          <Card className="border-dashed border-blue-300 bg-blue-50/50">
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold">How SAP Connection Works</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-2 ml-7">
                <p>Your app calls → <strong>Edge Function</strong> (backend) → reads <strong>"Node.js Middleware URL"</strong> from each API config below → forwards request to your Node.js middleware → middleware calls SAP.</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-white rounded-md border p-3">
                    <p className="font-semibold text-purple-700 mb-1">☁️ Using from Lovable Cloud</p>
                    <p>Edge functions run on Lovable's servers.</p>
                    <p className="mt-1">→ Set <strong>"Node.js Middleware URL"</strong> in each config to your <strong>ngrok URL</strong></p>
                    <p className="text-[10px] mt-1 opacity-70">e.g. https://abc123.ngrok-free.app</p>
                  </div>
                  <div className="bg-white rounded-md border p-3">
                    <p className="font-semibold text-green-700 mb-1">🖥️ Using from Client Server</p>
                    <p>Edge functions run in Docker on your server.</p>
                    <p className="mt-1">→ Set <strong>"Node.js Middleware URL"</strong> in each config to <strong>http://host.docker.internal:3002</strong></p>
                    <p className="text-[10px] mt-1 opacity-70">or http://10.10.4.178:3002</p>
                  </div>
                </div>
                <p className="text-[11px] mt-2 font-medium">💡 Since Lovable and Client Server use <strong>separate databases</strong>, each can have different middleware URLs in their configs.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setIsCreating(true)} className="gap-2 bg-primary">
              <Plus className="h-4 w-4" /> Add API Configuration
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> API Configurations
              </CardTitle>
              <CardDescription>Manage your SAP API endpoints and their configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading configurations...</div>
              ) : configs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No API configurations yet. Click "Add API Configuration" to create one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NAME</TableHead>
                      <TableHead>ENDPOINT</TableHead>
                      <TableHead>METHOD</TableHead>
                      <TableHead>AUTH</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead className="text-right">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div className="font-medium">{config.config_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {getConnectionBadge(config.connection_mode)}
                            {config.description && (
                              <span className="text-xs text-muted-foreground">{config.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {config.endpoint_path || config.api_endpoint}
                          </code>
                        </TableCell>
                        <TableCell>{getMethodBadge(config.http_method)}</TableCell>
                        <TableCell className="capitalize">{config.auth_type || 'Basic'}</TableCell>
                        <TableCell>
                          <Badge className={config.is_active !== false
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'
                          }>
                            {config.is_active !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="gap-1 text-xs"
                              onClick={() => setEditingConfig(config)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs"
                              onClick={() => setFieldsConfig(config)}>
                              <Settings2 className="h-3.5 w-3.5" /> Fields
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs"
                              onClick={() => handleTest(config)}>
                              <Play className="h-3.5 w-3.5" /> Test
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(config.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectivity">
          <SAPConnectivityGuide />
        </TabsContent>
      </Tabs>

      {fieldsConfig && (
        <SAPApiFieldsDialog
          config={fieldsConfig}
          isOpen={!!fieldsConfig}
          onClose={() => setFieldsConfig(null)}
        />
      )}
    </div>
  );
}
