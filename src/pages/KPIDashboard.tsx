import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Users,
  Building2,
  Wrench,
  ShieldCheck,
  Package,
  FileText,
  ArrowRight,
  Activity
} from 'lucide-react';
import { getStatusDisplayName, getStatusColor, getSLAColor } from '@/data/mockData';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from 'recharts';

export default function KPIDashboard() {
  const { mrbRecords, emailLogs } = useMRB();
  const { inwardMRBRecords, inspectionLotRecords } = useInwardMRB();
  const { currentRole, roleDisplayName } = useRole();

  // Calculate comprehensive KPIs
  const kpis = useMemo(() => {
    const allMRBs = [...mrbRecords, ...inwardMRBRecords];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    // Basic Counts
    const totalMRBs = allMRBs.length;
    const openMRBs = allMRBs.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');
    const closedMRBs = allMRBs.filter(mrb => mrb.closureStatus === 'closed');
    const closedThisMonth = closedMRBs.filter(mrb => {
      const closedDate = mrb.closedAt ? new Date(mrb.closedAt) : null;
      return closedDate && closedDate.getMonth() === thisMonth && closedDate.getFullYear() === thisYear;
    });

    // SLA Status
    const slaGreen = allMRBs.filter(mrb => mrb.slaStatus === 'green').length;
    const slaYellow = allMRBs.filter(mrb => mrb.slaStatus === 'yellow').length;
    const slaRed = allMRBs.filter(mrb => mrb.slaStatus === 'red').length;
    const slaBreaches = slaRed;

    // Pending by Role
    const pendingByRole = {
      quality: allMRBs.filter(mrb => mrb.pendingWith === 'quality' && mrb.status !== 'closed').length,
      purchase: allMRBs.filter(mrb => mrb.pendingWith === 'purchase' && mrb.status !== 'closed').length,
      engineering: allMRBs.filter(mrb => mrb.pendingWith === 'engineering' && mrb.status !== 'closed').length,
      plant_head: allMRBs.filter(mrb => mrb.pendingWith === 'plant_head' && mrb.status !== 'closed').length,
      shop_floor: allMRBs.filter(mrb => mrb.pendingWith === 'shop_floor' && mrb.status !== 'closed').length,
    };

    // My Pending
    const myPending = allMRBs.filter(mrb => mrb.pendingWith === currentRole && mrb.status !== 'closed').length;

    // Status Distribution
    const statusDistribution = {
      draft: allMRBs.filter(mrb => mrb.status === 'draft').length,
      quality_review: allMRBs.filter(mrb => mrb.status === 'quality_review').length,
      purchase_review: allMRBs.filter(mrb => mrb.status === 'purchase_review').length,
      engineering_review: allMRBs.filter(mrb => mrb.status === 'engineering_review').length,
      final_approval: allMRBs.filter(mrb => mrb.status === 'final_approval').length,
      approved: allMRBs.filter(mrb => mrb.status === 'approved').length,
      rejected: allMRBs.filter(mrb => mrb.status === 'rejected').length,
      closed: allMRBs.filter(mrb => mrb.status === 'closed').length,
    };

    // Source Distribution
    const byQualityInspection = mrbRecords.filter(mrb => mrb.source === 'quality_inspection').length;
    const byShopFloor = mrbRecords.filter(mrb => mrb.source === 'shop_floor').length;
    const byInward = inwardMRBRecords.length;

    // Defect Categories
    const defectCategories = {
      dimensional: allMRBs.filter(mrb => mrb.defectCategory === 'dimensional').length,
      surface: allMRBs.filter(mrb => mrb.defectCategory === 'surface').length,
      material: allMRBs.filter(mrb => mrb.defectCategory === 'material').length,
      functional: allMRBs.filter(mrb => mrb.defectCategory === 'functional').length,
      documentation: allMRBs.filter(mrb => mrb.defectCategory === 'documentation').length,
      packaging: allMRBs.filter(mrb => mrb.defectCategory === 'packaging').length,
    };

    // Escalation Levels
    const escalationNone = allMRBs.filter(mrb => mrb.escalationLevel === 'none').length;
    const escalationL1 = allMRBs.filter(mrb => mrb.escalationLevel === 'L1').length;
    const escalationL2 = allMRBs.filter(mrb => mrb.escalationLevel === 'L2').length;
    const escalationL3 = allMRBs.filter(mrb => mrb.escalationLevel === 'L3').length;

    // Plants Distribution
    const plantCounts: Record<string, number> = {};
    allMRBs.forEach(mrb => {
      plantCounts[mrb.plant] = (plantCounts[mrb.plant] || 0) + 1;
    });

    // Average Pending Days
    const avgPendingDays = openMRBs.length > 0 
      ? Math.round(openMRBs.reduce((sum, mrb) => sum + mrb.pendingDays, 0) / openMRBs.length)
      : 0;

    // Inspection Lots Available
    const inspectionLotsCount = inspectionLotRecords.length;

    // Email Activity
    const emailsSent = emailLogs.filter(e => e.status === 'sent').length;

    return {
      totalMRBs,
      openMRBs: openMRBs.length,
      closedMRBs: closedMRBs.length,
      closedThisMonth: closedThisMonth.length,
      slaGreen,
      slaYellow,
      slaRed,
      slaBreaches,
      pendingByRole,
      myPending,
      statusDistribution,
      byQualityInspection,
      byShopFloor,
      byInward,
      defectCategories,
      escalationNone,
      escalationL1,
      escalationL2,
      escalationL3,
      plantCounts,
      avgPendingDays,
      inspectionLotsCount,
      emailsSent,
    };
  }, [mrbRecords, inwardMRBRecords, inspectionLotRecords, emailLogs, currentRole]);

  // Chart Data
  const slaChartData = [
    { name: 'On Track', value: kpis.slaGreen, color: 'hsl(142, 70%, 45%)' },
    { name: 'At Risk', value: kpis.slaYellow, color: 'hsl(45, 93%, 47%)' },
    { name: 'Breached', value: kpis.slaRed, color: 'hsl(0, 72%, 51%)' },
  ];

  const sourceChartData = [
    { name: 'Quality Inspection', value: kpis.byQualityInspection, color: 'hsl(210, 85%, 35%)' },
    { name: 'Shop Floor', value: kpis.byShopFloor, color: 'hsl(160, 60%, 40%)' },
    { name: 'Inward', value: kpis.byInward, color: 'hsl(38, 92%, 50%)' },
  ];

  const pendingByRoleData = [
    { name: 'Quality', count: kpis.pendingByRole.quality, icon: ShieldCheck },
    { name: 'Purchase', count: kpis.pendingByRole.purchase, icon: Building2 },
    { name: 'Engineering', count: kpis.pendingByRole.engineering, icon: Wrench },
    { name: 'Plant Head', count: kpis.pendingByRole.plant_head, icon: Users },
  ];

  const statusChartData = Object.entries(kpis.statusDistribution)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: getStatusDisplayName(status as any),
      value: count,
    }));

  const defectChartData = Object.entries(kpis.defectCategories)
    .filter(([_, count]) => count > 0)
    .map(([category, count]) => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      count,
    }));

  const CHART_COLORS = [
    'hsl(210, 85%, 35%)',
    'hsl(160, 60%, 40%)',
    'hsl(38, 92%, 50%)',
    'hsl(0, 72%, 51%)',
    'hsl(270, 60%, 55%)',
    'hsl(199, 89%, 48%)',
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Page Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">KPI Dashboard</h1>
              <p className="text-muted-foreground">Real-time MRB performance metrics and analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="w-3 h-3 mr-1" />
                Live
              </Badge>
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Go to Worklist
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Top KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total MRBs</CardTitle>
              <ClipboardList className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.totalMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.openMRBs} open • {kpis.closedMRBs} closed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Pending Actions</CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.myPending}</p>
              <p className="text-xs text-muted-foreground mt-1">
                As {roleDisplayName}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Breaches</CardTitle>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.slaBreaches}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.slaYellow} at risk
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closed This Month</CardTitle>
              <CheckCircle className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.closedThisMonth}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg. {kpis.avgPendingDays} days pending
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Second Row - Detailed Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inspection Lots</CardTitle>
              <Package className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{kpis.inspectionLotsCount}</p>
              <p className="text-xs text-muted-foreground">Available for MRB creation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Emails Sent</CardTitle>
              <FileText className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{kpis.emailsSent}</p>
              <p className="text-xs text-muted-foreground">Workflow notifications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Escalations</CardTitle>
              <TrendingUp className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{kpis.escalationL1 + kpis.escalationL2 + kpis.escalationL3}</p>
              <p className="text-xs text-muted-foreground">
                L1: {kpis.escalationL1} • L2: {kpis.escalationL2} • L3: {kpis.escalationL3}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Resolution</CardTitle>
              <TrendingDown className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{kpis.avgPendingDays} days</p>
              <p className="text-xs text-muted-foreground">Current pending average</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* SLA Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                SLA Status Distribution
              </CardTitle>
              <CardDescription>Current SLA compliance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={slaChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {slaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* MRB Source Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                MRB Source Distribution
              </CardTitle>
              <CardDescription>MRBs by creation source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {sourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending by Department & Defect Categories */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending by Department */}
          <Card>
            <CardHeader>
              <CardTitle>Pending by Department</CardTitle>
              <CardDescription>MRBs awaiting action per department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingByRoleData.map((dept) => (
                  <div key={dept.name} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <dept.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{dept.name}</span>
                        <span className="text-sm font-bold text-foreground">{dept.count}</span>
                      </div>
                      <Progress 
                        value={kpis.openMRBs > 0 ? (dept.count / kpis.openMRBs) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Defect Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Defect Categories</CardTitle>
              <CardDescription>Distribution of defect types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={defectChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(210, 85%, 35%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview & Plant Distribution */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Status Overview</CardTitle>
              <CardDescription>MRBs by current workflow status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Plant Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Plant Distribution</CardTitle>
              <CardDescription>MRBs by plant location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(kpis.plantCounts).map(([plant, count], index) => (
                  <div key={plant} className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    >
                      {plant.split('-')[1] || 'P'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{plant}</span>
                        <span className="text-sm font-bold text-foreground">{count} MRBs</span>
                      </div>
                      <Progress 
                        value={kpis.totalMRBs > 0 ? (count / kpis.totalMRBs) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigate to key areas of the MRB system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/worklist">
                  <ClipboardList className="w-6 h-6 text-primary" />
                  <span>View Worklist</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/inward/report">
                  <Package className="w-6 h-6 text-secondary" />
                  <span>Inward Report</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/inward/worklist">
                  <FileText className="w-6 h-6 text-warning" />
                  <span>Inward Worklist</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/emails">
                  <Activity className="w-6 h-6 text-info" />
                  <span>Email Log</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
