import { ClipboardList, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getStatusDisplayName, getStatusColor, getSLAColor } from '@/data/mockData';

export default function Dashboard() {
  const { mrbRecords } = useMRB();
  const { currentRole, roleDisplayName } = useRole();

  const pendingForMe = mrbRecords.filter(mrb => mrb.pendingWith === currentRole && mrb.status !== 'closed');
  const slaBreaches = mrbRecords.filter(mrb => mrb.slaStatus === 'red');
  const closedThisMonth = mrbRecords.filter(mrb => mrb.closureStatus === 'closed');
  const totalOpen = mrbRecords.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');

  const stats = [
    { title: 'Total Open MRBs', value: totalOpen.length, icon: ClipboardList, color: 'text-primary' },
    { title: 'My Pending Actions', value: pendingForMe.length, icon: Clock, color: 'text-warning' },
    { title: 'SLA Breaches', value: slaBreaches.length, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Closed This Month', value: closedThisMonth.length, icon: CheckCircle, color: 'text-secondary' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {roleDisplayName}</p>
      </div>

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
                    to={`/mrb/${mrb.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{mrb.mrbNumber}</p>
                      <p className="text-sm text-muted-foreground">{mrb.materialDescription}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSLAColor(mrb.slaStatus)}>{mrb.pendingDays}d</Badge>
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
                  to={`/mrb/${mrb.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{mrb.mrbNumber}</p>
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
  );
}
