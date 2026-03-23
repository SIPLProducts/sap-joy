import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeSapSync } from '@/lib/sapSyncClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, Activity, Database, ArrowDownToLine, Loader2, Plug, Eye, BarChart3 } from 'lucide-react';

interface SAPConfig {
  id: string;
  config_name: string;
  description: string | null;
  api_endpoint: string;
  connection_mode: string | null;
  http_method: string | null;
  is_active: boolean | null;
  last_sync_at: string | null;
}

interface SyncRecord {
  id: string;
  config_id: string | null;
  sync_type: string | null;
  status: string | null;
  records_fetched: number | null;
  records_inserted: number | null;
  records_updated: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  synced_by: string | null;
}

interface DataPreview {
  table: string;
  count: number;
  recentRecords: any[];
}

export default function SAPSyncMonitor() {
  const [configs, setConfigs] = useState<SAPConfig[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('all');
  const [testing, setTesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataPreviews, setDataPreviews] = useState<DataPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchConfigs = useCallback(async () => {
    const { data } = await supabase.from('sap_api_config').select('id, config_name, description, api_endpoint, connection_mode, http_method, is_active, last_sync_at').order('created_at', { ascending: false });
    setConfigs((data as unknown as SAPConfig[]) || []);
  }, []);

  const fetchSyncHistory = useCallback(async () => {
    let query = supabase.from('sap_stock_sync_history').select('*').order('started_at', { ascending: false }).limit(50);
    if (selectedConfig !== 'all') {
      query = query.eq('config_id', selectedConfig);
    }
    const { data } = await query;
    setSyncHistory((data as unknown as SyncRecord[]) || []);
  }, [selectedConfig]);

  // Helper to fetch all rows from a table (handles >1000 row limit)
  const fetchAllRows = async (table: string): Promise<{ data: any[]; count: number }> => {
    const { count } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
    const totalCount = count || 0;
    const allRows: any[] = [];
    const batchSize = 1000;
    for (let offset = 0; offset < totalCount; offset += batchSize) {
      const { data } = await supabase.from(table as any).select('*').order('created_at', { ascending: false }).range(offset, offset + batchSize - 1);
      if (data) allRows.push(...data);
    }
    return { data: allRows, count: totalCount };
  };

  const fetchDataPreviews = useCallback(async () => {
    setPreviewLoading(true);
    const previews: DataPreview[] = [];

    const [sfResult, ilResult, matResult, venResult] = await Promise.all([
      fetchAllRows('shop_floor_stock'),
      fetchAllRows('inward_inspection_lots'),
      fetchAllRows('materials'),
      fetchAllRows('vendors'),
    ]);

    previews.push({ table: 'shop_floor_stock', count: sfResult.count, recentRecords: sfResult.data });
    previews.push({ table: 'inward_inspection_lots', count: ilResult.count, recentRecords: ilResult.data });
    previews.push({ table: 'materials', count: matResult.count, recentRecords: matResult.data });
    previews.push({ table: 'vendors', count: venResult.count, recentRecords: venResult.data });

    setDataPreviews(previews);
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchConfigs(), fetchSyncHistory(), fetchDataPreviews()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchConfigs, fetchSyncHistory, fetchDataPreviews]);

  useEffect(() => { fetchSyncHistory(); }, [selectedConfig, fetchSyncHistory]);

  const handleTestConnection = async (configId: string) => {
    setTesting(configId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' }); return; }

      const res = await invokeSapSync({ action: 'test', config_id: configId });
      const { data: resData, error: resError } = res;

      if (resError) {
        toast({ title: 'Test Failed', description: resError.message, variant: 'destructive' });
      } else if (resData?.success) {
        toast({ title: 'Connection Successful', description: resData.message });
      } else {
        toast({ title: 'Test Failed', description: resData?.message || resData?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleTriggerSync = async (configId: string) => {
    setSyncing(configId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' }); return; }

      const res = await supabase.functions.invoke('sap-sync', {
        body: { action: 'sync', config_id: configId },
      });

      if (res.error) {
        toast({ title: 'Sync Failed', description: res.error.message, variant: 'destructive' });
      } else if (res.data?.success) {
        toast({
          title: 'Sync Complete',
          description: `Fetched: ${res.data.records_fetched}, Inserted: ${res.data.records_inserted}, Updated: ${res.data.records_updated}`,
        });
        await Promise.all([fetchSyncHistory(), fetchDataPreviews(), fetchConfigs()]);
      } else {
        toast({ title: 'Sync Failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1"><Loader2 className="h-3 w-3 animate-spin" /> In Progress</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 gap-1"><Clock className="h-3 w-3" /> {status || 'Pending'}</Badge>;
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString() : '-';

  const totalSyncs = syncHistory.length;
  const successSyncs = syncHistory.filter(s => s.status === 'success').length;
  const failedSyncs = syncHistory.filter(s => s.status === 'failed').length;
  const totalRecordsSynced = syncHistory.reduce((sum, s) => sum + (s.records_inserted || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SAP Sync Monitor</h1>
          <p className="text-muted-foreground">Test connections, trigger syncs, and view synced data across all tables</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { fetchConfigs(); fetchSyncHistory(); fetchDataPreviews(); }}>
          <RefreshCw className="h-4 w-4" /> Refresh All
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Plug className="h-5 w-5 text-blue-700" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active APIs</p>
                <p className="text-2xl font-bold">{configs.filter(c => c.is_active !== false).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="h-5 w-5 text-green-700" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Successful Syncs</p>
                <p className="text-2xl font-bold">{successSyncs}/{totalSyncs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><XCircle className="h-5 w-5 text-red-700" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Failed Syncs</p>
                <p className="text-2xl font-bold">{failedSyncs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><ArrowDownToLine className="h-5 w-5 text-purple-700" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Records Synced</p>
                <p className="text-2xl font-bold">{totalRecordsSynced}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> API Connections</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><Clock className="h-4 w-4" /> Sync History</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><Database className="h-4 w-4" /> Data Preview</TabsTrigger>
        </TabsList>

        {/* API Connections Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> SAP API Connections</CardTitle>
              <CardDescription>Test and trigger sync for each configured SAP API</CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No API configurations found. Create one in SAP API Settings.</div>
              ) : (
                <div className="space-y-4">
                  {configs.map((config) => (
                    <Card key={config.id} className="border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{config.config_name}</h3>
                              <Badge className={config.is_active !== false ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                                {config.is_active !== false ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{config.connection_mode || 'direct'}</Badge>
                              <Badge variant="outline">{(config.http_method || 'GET').toUpperCase()}</Badge>
                            </div>
                            {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}
                            <code className="text-xs bg-muted px-2 py-1 rounded inline-block">{config.api_endpoint}</code>
                            {config.last_sync_at && (
                              <p className="text-xs text-muted-foreground">Last synced: {formatDate(config.last_sync_at)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={testing === config.id}
                              onClick={() => handleTestConnection(config.id)}
                            >
                              {testing === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                              Test Connection
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={syncing === config.id}
                              onClick={() => handleTriggerSync(config.id)}
                            >
                              {syncing === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                              Trigger Sync
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Sync History</CardTitle>
                  <CardDescription>View past sync operations and their results</CardDescription>
                </div>
                <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filter by API" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Configurations</SelectItem>
                    {configs.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sync history yet. Trigger a sync from the API Connections tab.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>STATUS</TableHead>
                      <TableHead>API CONFIG</TableHead>
                      <TableHead>TYPE</TableHead>
                      <TableHead>FETCHED</TableHead>
                      <TableHead>INSERTED</TableHead>
                      <TableHead>UPDATED</TableHead>
                      <TableHead>STARTED</TableHead>
                      <TableHead>DURATION</TableHead>
                      <TableHead>BY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.map((sync) => {
                      const configName = configs.find(c => c.id === sync.config_id)?.config_name || 'Unknown';
                      const duration = sync.completed_at && sync.started_at
                        ? `${Math.round((new Date(sync.completed_at).getTime() - new Date(sync.started_at).getTime()) / 1000)}s`
                        : '-';
                      return (
                        <TableRow key={sync.id}>
                          <TableCell>{getStatusBadge(sync.status)}</TableCell>
                          <TableCell className="font-medium">{configName}</TableCell>
                          <TableCell className="capitalize">{sync.sync_type || 'manual'}</TableCell>
                          <TableCell>{sync.records_fetched ?? '-'}</TableCell>
                          <TableCell>{sync.records_inserted ?? '-'}</TableCell>
                          <TableCell>{sync.records_updated ?? '-'}</TableCell>
                          <TableCell className="text-xs">{formatDate(sync.started_at)}</TableCell>
                          <TableCell>{duration}</TableCell>
                          <TableCell className="text-xs">{sync.synced_by || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {syncHistory.some(s => s.error_message) && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium text-sm text-destructive">Recent Errors</h4>
                  {syncHistory.filter(s => s.error_message).slice(0, 3).map(s => (
                    <div key={s.id} className="text-xs bg-destructive/10 p-3 rounded border border-destructive/20">
                      <span className="font-medium">{configs.find(c => c.id === s.config_id)?.config_name}:</span>{' '}
                      {s.error_message}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Preview Tab */}
        <TabsContent value="data" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Database Tables — All Synced Data</h3>
            <Button variant="outline" size="sm" className="gap-1" onClick={fetchDataPreviews} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
          </div>
          {dataPreviews.map((preview) => {
            const allColumns = preview.recentRecords.length > 0
              ? Object.keys(preview.recentRecords[0]).filter(k => !['id', 'created_at', 'updated_at', 'upload_batch_id', 'uploaded_by', 'sap_sync_id'].includes(k))
              : [];
            return (
              <Card key={preview.table}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="h-4 w-4" />
                      {preview.table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                    <Badge variant="outline">{preview.count} total records — Showing {preview.recentRecords.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {preview.recentRecords.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">No records in this table</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs whitespace-nowrap">#</TableHead>
                            {allColumns.map(key => (
                              <TableHead key={key} className="text-xs whitespace-nowrap">{key.replace(/_/g, ' ').toUpperCase()}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.recentRecords.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium">{i + 1}</TableCell>
                              {allColumns.map(k => (
                                <TableCell key={k} className="text-xs max-w-[200px] truncate">{String((row as any)[k] ?? '-')}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
