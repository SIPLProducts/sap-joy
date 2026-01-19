import { Link } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function EmailLog() {
  const { emailLogs } = useMRB();

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return null;
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
    };
    return labels[template] || template;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Email Notification Log</h1>
          <p className="text-muted-foreground">View all workflow email notifications</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>MRB</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{getStatusIcon(log.status)}</TableCell>
                  <TableCell>
                    <Link to={`/mrb/${log.mrb_id}`} className="text-primary hover:underline font-medium">
                      {log.mrb_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTemplateLabel(log.template)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.recipients.join(', ')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.sent_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
