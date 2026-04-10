import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, Clock, AlertTriangle } from 'lucide-react';
import { getStatusDisplayName, getStatusColor, getRoleDisplayName } from '@/data/mockData';
import type { Database } from '@/integrations/supabase/types';

type AppRole = string;

export default function PendingActions() {
  const navigate = useNavigate();
  const { mrbRecords, isLoading } = useMRBDatabase();
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter MRBs with no action for 7+ days (#28)
  const pendingRecords = useMemo(() => {
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return (mrbRecords || [])
      .filter(mrb => {
        // Only include non-final statuses
        if (['approved', 'rejected', 'closed'].includes(mrb.status)) return false;
        
        // Check if pending for 7+ days
        const updatedAt = new Date(mrb.updated_at);
        return (now.getTime() - updatedAt.getTime()) >= sevenDaysMs;
      })
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
  }, [mrbRecords]);

  const filteredRecords = pendingRecords.filter(mrb =>
    !searchTerm ||
    mrb.mrb_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mrb.material_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mrb.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDaysPending = (updatedAt: string) => {
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleView = (mrb: any) => {
    if (mrb.source === 'quality_inspection') {
      navigate(`/inward/mrb/${mrb.id}`);
    } else if (mrb.source === 'shop_floor') {
      navigate(`/shop-floor/mrb/${mrb.id}`);
    } else {
      navigate(`/mrb/${mrb.id}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 overflow-auto h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-destructive" /> Pending Actions (7+ Days)
          </h1>
          <p className="text-muted-foreground mt-1">MRBs with no action taken for 7 or more days</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search MRBs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{pendingRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">
                  {pendingRecords.filter(m => getDaysPending(m.updated_at) >= 14).length}
                </p>
                <p className="text-sm text-muted-foreground">14+ Days Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">
                  {pendingRecords.filter(m => getDaysPending(m.updated_at) >= 30).length}
                </p>
                <p className="text-sm text-muted-foreground">30+ Days Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delayed MRBs</CardTitle>
          <CardDescription>{filteredRecords.length} records with delayed actions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">Loading...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No delayed MRBs found. All actions are within 7 days.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MRB Number</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Plant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pending With</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map(mrb => {
                    const days = getDaysPending(mrb.updated_at);
                    return (
                      <TableRow key={mrb.id}>
                        <TableCell className="font-mono font-medium">{mrb.mrb_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{mrb.material_number}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{mrb.material_description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{mrb.vendor_name || '-'}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{mrb.plant}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getStatusDisplayName(mrb.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mrb.pending_with ? (
                            <Badge variant="secondary" className="text-xs">
                              {getRoleDisplayName(mrb.pending_with as any)}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={days >= 30 ? 'destructive' : days >= 14 ? 'default' : 'secondary'}>
                            {days} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(mrb.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleView(mrb)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
