import { ClipboardList, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getStatusDisplayName, getStatusColor, getSLAColor } from '@/data/mockData';

export default function Dashboard() {
  const { mrbRecords, isLoading } = useMRB();
  const { currentRole, roleDisplayName } = useRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pendingForMe = mrbRecords.filter(mrb => mrb.pending_with === currentRole && mrb.status !== 'closed');
  const slaBreaches = mrbRecords.filter(mrb => mrb.sla_status === 'red');
  const closedThisMonth = mrbRecords.filter(mrb => mrb.closure_status === 'closed');
  const totalOpen = mrbRecords.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');

  const stats = [
    { title: 'Total Open MRBs', value: totalOpen.length, icon: ClipboardList, color: 'text-primary' },
    { title: 'My Pending Actions', value: pendingForMe.length, icon: Clock, color: 'text-warning' },
    { title: 'SLA Breaches', value: slaBreaches.length, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Closed This Month', value: closedThisMonth.length, icon: CheckCircle, color: 'text-secondary' },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {roleDisplayName}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Pending Actions</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/worklist">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingForMe.length === 0 ? (
              <p className="text-muted-foreground">No pending actions</p>
            ) : (
              <div className="space-y-3">
                {pendingForMe.slice(0, 5).map((mrb) => (
                  <Link
                    key={mrb.id}
                    to={mrb.source === 'quality_inspection' ? `/inward/mrb/${mrb.id}` : `/mrb/${mrb.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{mrb.mrb_number}</p>
                      <p className="text-sm text-muted-foreground">{mrb.material_description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSLAColor(mrb.sla_status || 'green')}>{mrb.pending_days || 0}d</Badge>
                      <Badge className={getStatusColor(mrb.status)}>{getStatusDisplayName(mrb.status)}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mrbRecords.slice(0, 5).map((mrb) => (
                <Link
                  key={mrb.id}
                  to={mrb.source === 'quality_inspection' ? `/inward/mrb/${mrb.id}` : `/mrb/${mrb.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{mrb.mrb_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {mrb.source === 'shop_floor' ? 'Shop Floor' : 'Quality Inspection'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(mrb.status)}>{getStatusDisplayName(mrb.status)}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
