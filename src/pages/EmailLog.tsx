import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, CheckCircle, Clock, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EmailLog = Database['public']['Tables']['email_logs']['Row'];

export default function EmailLog() {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false });
    if (data) setEmailLogs(data);
    if (error) console.error('Error fetching email logs:', error);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      quality_to_engineering: 'Quality → Engineering',
      quality_to_purchase: 'Quality → Purchase',
      purchase_to_vendor: 'Purchase → Vendor',
      engineering_decision: 'Engineering Decision',
      final_approval: 'Final Approval',
      escalation_l1: 'Escalation L1',
      escalation_l2: 'Escalation L2',
      sla_warning: 'SLA Warning',
      mrb_closure: 'MRB Closure',
      workflow_forward: 'Workflow Forward',
      mrb_created: 'MRB Created',
    };
    return labels[template] || template;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Notification Log</h1>
            <p className="text-muted-foreground">View all workflow email notifications</p>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email History ({emailLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No email logs found. Emails are generated when MRB workflow transitions occur.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>MRB</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Body</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(log.status)}
                          <span className="text-xs capitalize">{log.status || 'pending'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/mrb/${log.mrb_id}`} className="text-primary hover:underline font-medium">
                          {log.mrb_number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTemplateLabel(log.template)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {log.recipients.join(', ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        {log.body ? (
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Body Preview Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details — {selectedLog?.mrb_number}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedLog.subject}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Template</p>
                  <Badge variant="outline">{getTemplateLabel(selectedLog.template)}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">To</p>
                  <p className="font-medium">{selectedLog.recipients.join(', ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CC</p>
                  <p className="font-medium">{selectedLog.cc?.join(', ') || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">Email Body</p>
                <div className="bg-muted/50 border rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {selectedLog.body || 'No body content available.'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
