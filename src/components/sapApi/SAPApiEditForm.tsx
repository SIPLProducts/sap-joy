import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Save, Loader2, Eye, EyeOff, Link2, ChevronDown } from 'lucide-react';

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
}

interface Props {
  config: SAPConfig | null;
  onSave: (data: Partial<SAPConfig>) => Promise<boolean>;
  onCancel: () => void;
}

export function SAPApiEditForm({ config, onSave, onCancel }: Props) {
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
  const [username, setUsername] = useState(config?.username || '');
  const [password, setPassword] = useState(config?.encrypted_password || '');
  const [apiKey, setApiKey] = useState(config?.api_key || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showProxySecret, setShowProxySecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

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
      sap_client: sapClient || null,
      timeout_ms: parseInt(timeoutMs) || 30000,
      connection_mode: connectionMode,
      proxy_tunnel_url: proxyUrl || null,
      proxy_secret: proxySecret || null,
      username: authType === 'basic' ? username || null : null,
      encrypted_password: authType === 'basic' ? password || null : null,
      api_key: authType === 'api_key' ? apiKey || null : null,
      is_active: true,
    });
    setSaving(false);
  };

  const connectionModeHelp: Record<string, string> = {
    direct: 'Direct connection to cloud-hosted SAP system.',
    sap_cloud_vpn: 'SAP Cloud system accessed via VPN connection.',
    proxy: 'Route through a proxy server for on-premise SAP.',
    vpn_tunnel: 'On-premise SAP via VPN. BA runs local proxy + tunnel.',
  };

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

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">⚙️</span> API Configuration
              </CardTitle>
              <CardDescription>Edit the API endpoint details, HTTP method, and authentication type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Row 1: Name + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., RESL" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., BP" />
                </div>
              </div>

              {/* Row 2: Base URL + Endpoint Path */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://10.150.150.154:8103" />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint Path</Label>
                  <Input value={endpointPath} onChange={(e) => setEndpointPath(e.target.value)} placeholder="/gate_entry/login/login?sap-client=300" />
                </div>
              </div>

              {/* Row 3: Method + Auth + SAP Client */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>HTTP Method</Label>
                  <Select value={httpMethod} onValueChange={setHttpMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
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

              {/* Row 4: Timeout */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="30000" />
                </div>
              </div>

              {/* Connection Mode */}
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
                    <Label>Proxy / Tunnel URL</Label>
                    <Input value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)}
                      placeholder="https://your-tunnel.ngrok-free.dev/" />
                    <p className="text-xs text-muted-foreground">URL of the proxy server or ngrok/Cloudflare tunnel.</p>
                  </div>
                )}
              </div>

              {/* Proxy Secret */}
              {(connectionMode === 'proxy' || connectionMode === 'vpn_tunnel') && (
                <div className="space-y-2">
                  <Label>Proxy Secret / Password</Label>
                  <div className="relative">
                    <Input
                      type={showProxySecret ? 'text' : 'password'}
                      value={proxySecret}
                      onChange={(e) => setProxySecret(e.target.value)}
                      placeholder="Shared secret for proxy authentication"
                    />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowProxySecret(!showProxySecret)}>
                      {showProxySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Shared secret used to authenticate with the proxy server (sent as x-proxy-secret header).</p>
                </div>
              )}

              {/* VPN Proxy Setup Guide */}
              {connectionMode === 'vpn_tunnel' && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" /> VPN Proxy Setup Guide (for BA)
                      </span>
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
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                              {item.step}
                            </div>
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

        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle>Credentials</CardTitle>
              <CardDescription>Authentication credentials for the SAP API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {authType === 'basic' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="SAP Username" />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="SAP Password" />
                        <Button type="button" variant="ghost" size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {authType === 'api_key' && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your SAP API Key" />
                </div>
              )}
              {authType === 'none' && (
                <p className="text-muted-foreground">No credentials required for this configuration.</p>
              )}
              {authType === 'oauth' && (
                <p className="text-muted-foreground">OAuth configuration requires additional setup. Contact your administrator for client credentials.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="request"><Card><CardContent className="py-8 text-center text-muted-foreground">Request field mapping configuration — coming soon</CardContent></Card></TabsContent>
        <TabsContent value="response"><Card><CardContent className="py-8 text-center text-muted-foreground">Response field mapping configuration — coming soon</CardContent></Card></TabsContent>
        <TabsContent value="scheduler"><Card><CardContent className="py-8 text-center text-muted-foreground">Scheduled sync configuration — coming soon</CardContent></Card></TabsContent>
        <TabsContent value="settings"><Card><CardContent className="py-8 text-center text-muted-foreground">Advanced settings — coming soon</CardContent></Card></TabsContent>
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
