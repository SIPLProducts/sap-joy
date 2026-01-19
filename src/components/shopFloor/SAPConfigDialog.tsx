import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info, Eye, EyeOff } from 'lucide-react';

interface SAPConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: {
    config_name: string;
    api_endpoint: string;
    auth_type: string;
    username?: string;
    encrypted_password?: string;
    api_key?: string;
    sync_frequency: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function SAPConfigDialog({ isOpen, onClose, onSave }: SAPConfigDialogProps) {
  const [configName, setConfigName] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [authType, setAuthType] = useState<'basic' | 'oauth' | 'api_key'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [syncFrequency, setSyncFrequency] = useState('manual');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    
    // Validation
    if (!configName.trim()) {
      setError('Configuration name is required');
      return;
    }
    if (!apiEndpoint.trim()) {
      setError('API endpoint is required');
      return;
    }
    if (authType === 'basic' && (!username.trim() || !password.trim())) {
      setError('Username and password are required for basic auth');
      return;
    }
    if (authType === 'api_key' && !apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setIsSaving(true);
    
    const result = await onSave({
      config_name: configName.trim(),
      api_endpoint: apiEndpoint.trim(),
      auth_type: authType,
      username: authType === 'basic' ? username.trim() : undefined,
      encrypted_password: authType === 'basic' ? password : undefined, // In production, encrypt this
      api_key: authType === 'api_key' ? apiKey : undefined,
      sync_frequency: syncFrequency,
    });

    setIsSaving(false);

    if (result.success) {
      handleClose();
    } else {
      setError(result.error || 'Failed to save configuration');
    }
  };

  const handleClose = () => {
    setConfigName('');
    setApiEndpoint('');
    setAuthType('basic');
    setUsername('');
    setPassword('');
    setApiKey('');
    setSyncFrequency('manual');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>SAP API Configuration</DialogTitle>
          <DialogDescription>
            Configure the SAP system connection for stock data synchronization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              SAP integration requires backend edge function setup. This configuration stores the connection details.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="config_name">Configuration Name *</Label>
            <Input
              id="config_name"
              placeholder="e.g., SAP Production System"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_endpoint">API Endpoint URL *</Label>
            <Input
              id="api_endpoint"
              placeholder="https://sap-server.company.com/sap/opu/odata/..."
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Authentication Type</Label>
            <Select value={authType} onValueChange={(v: 'basic' | 'oauth' | 'api_key') => setAuthType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic Authentication</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="oauth">OAuth 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authType === 'basic' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="SAP Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="SAP Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          {authType === 'api_key' && (
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Your SAP API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          {authType === 'oauth' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                OAuth configuration requires additional setup. Contact your administrator for client credentials.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Sync Frequency</Label>
            <Select value={syncFrequency} onValueChange={setSyncFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
