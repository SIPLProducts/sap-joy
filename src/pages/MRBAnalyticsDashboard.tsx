import { useMemo, useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Users,
  Timer,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { getStatusDisplayName, getStatusColor, getSLAColor } from '@/data/mockData';
import type { Database } from '@/integrations/supabase/types';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type SLAStatus = Database['public']['Enums']['sla_status'];

// Color palette for charts
const COLORS = {
  green: 'hsl(142, 71%, 45%)',
  yellow: 'hsl(48, 96%, 53%)',
  red: 'hsl(0, 84%, 60%)',
  primary: 'hsl(215, 75%, 50%)',
  secondary: 'hsl(210, 40%, 60%)',
  muted: 'hsl(215, 16%, 47%)',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(215, 16%, 47%)',
  quality_review: 'hsl(215, 75%, 50%)',
  purchase_review: 'hsl(280, 65%, 60%)',
  engineering_review: 'hsl(25, 95%, 53%)',
  final_approval: 'hsl(48, 96%, 53%)',
  approved: 'hsl(142, 71%, 45%)',
  rejected: 'hsl(0, 84%, 60%)',
  closed: 'hsl(215, 20%, 65%)',
};

export default function MRBAnalyticsDashboard() {
  const { mrbRecords, isLoading, refreshData } = useMRB();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await refreshData();
    setLastRefresh(new Date());
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!mrbRecords.length) return null;

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Total counts
    const totalOpen = mrbRecords.filter(mrb => 
      !['closed', 'approved', 'rejected'].includes(mrb.status)
    ).length;

    const totalClosed = mrbRecords.filter(mrb => 
      mrb.status === 'closed' || mrb.status === 'approved'
    ).length;

    // SLA metrics
    const slaGreen = mrbRecords.filter(mrb => mrb.sla_status === 'green').length;
    const slaYellow = mrbRecords.filter(mrb => mrb.sla_status === 'yellow').length;
    const slaRed = mrbRecords.filter(mrb => mrb.sla_status === 'red').length;
    const slaCompliance = mrbRecords.length > 0 
      ? ((slaGreen + slaYellow) / mrbRecords.length * 100).toFixed(1)
      : '0';

    // Aging metrics
    const openMRBs = mrbRecords.filter(mrb => !['closed', 'approved', 'rejected'].includes(mrb.status));
    const agingBuckets = {
      '0-3 days': openMRBs.filter(mrb => (mrb.pending_days || 0) <= 3).length,
      '4-7 days': openMRBs.filter(mrb => (mrb.pending_days || 0) > 3 && (mrb.pending_days || 0) <= 7).length,
      '8-14 days': openMRBs.filter(mrb => (mrb.pending_days || 0) > 7 && (mrb.pending_days || 0) <= 14).length,
      '15-30 days': openMRBs.filter(mrb => (mrb.pending_days || 0) > 14 && (mrb.pending_days || 0) <= 30).length,
      '30+ days': openMRBs.filter(mrb => (mrb.pending_days || 0) > 30).length,
    };

    // Average resolution time
    const closedWithDays = mrbRecords.filter(mrb => 
      (mrb.status === 'closed' || mrb.status === 'approved') && mrb.pending_days !== null
    );
    const avgResolutionTime = closedWithDays.length > 0
      ? (closedWithDays.reduce((sum, mrb) => sum + (mrb.pending_days || 0), 0) / closedWithDays.length).toFixed(1)
      : '0';

    // Status distribution
    const statusDistribution = mrbRecords.reduce((acc, mrb) => {
      acc[mrb.status] = (acc[mrb.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Department workload
    const departmentWorkload = openMRBs.reduce((acc, mrb) => {
      const dept = mrb.pending_with || 'unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // This month's metrics
    const thisMonthMRBs = mrbRecords.filter(mrb => {
      const createdDate = new Date(mrb.created_at);
      return createdDate.getMonth() === thisMonth && createdDate.getFullYear() === thisYear;
    });
    const createdThisMonth = thisMonthMRBs.length;
    const closedThisMonth = mrbRecords.filter(mrb => {
      if (!mrb.closed_at) return false;
      const closedDate = new Date(mrb.closed_at);
      return closedDate.getMonth() === thisMonth && closedDate.getFullYear() === thisYear;
    }).length;

    // Trend data (last 7 days)
    const trendData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      const created = mrbRecords.filter(mrb => 
        mrb.created_at.split('T')[0] === dateStr
      ).length;
      
      const closed = mrbRecords.filter(mrb => 
        mrb.closed_at && mrb.closed_at.split('T')[0] === dateStr
      ).length;

      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        created,
        closed,
      };
    });

    // Source distribution
    const sourceDistribution = {
      quality_inspection: mrbRecords.filter(mrb => mrb.source === 'quality_inspection').length,
      shop_floor: mrbRecords.filter(mrb => mrb.source === 'shop_floor').length,
    };

    // Critical MRBs (SLA Red)
    const criticalMRBs = mrbRecords
      .filter(mrb => mrb.sla_status === 'red' && !['closed', 'approved', 'rejected'].includes(mrb.status))
      .sort((a, b) => (b.pending_days || 0) - (a.pending_days || 0))
      .slice(0, 5);

    return {
      totalOpen,
      totalClosed,
      total: mrbRecords.length,
      slaGreen,
      slaYellow,
      slaRed,
      slaCompliance,
      agingBuckets,
      avgResolutionTime,
      statusDistribution,
      departmentWorkload,
      createdThisMonth,
      closedThisMonth,
      trendData,
      sourceDistribution,
      criticalMRBs,
    };
  }, [mrbRecords]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
          <p className="text-muted-foreground">Create some MRB records to see analytics.</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const agingChartData = Object.entries(metrics.agingBuckets).map(([range, count]) => ({
    range,
    count,
    fill: count > 0 && range.includes('30+') ? COLORS.red : 
          count > 0 && range.includes('15-30') ? COLORS.yellow : COLORS.green,
  }));

  const statusChartData = Object.entries(metrics.statusDistribution).map(([status, count]) => ({
    name: getStatusDisplayName(status as any),
    value: count,
    fill: STATUS_COLORS[status] || COLORS.muted,
  }));

  const slaChartData = [
    { name: 'On Track', value: metrics.slaGreen, fill: COLORS.green },
    { name: 'At Risk', value: metrics.slaYellow, fill: COLORS.yellow },
    { name: 'Breached', value: metrics.slaRed, fill: COLORS.red },
  ];

  const departmentChartData = Object.entries(metrics.departmentWorkload).map(([dept, count]) => ({
    department: dept.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count,
  }));

  const sourceChartData = [
    { name: 'Quality Inspection', value: metrics.sourceDistribution.quality_inspection, fill: COLORS.primary },
    { name: 'Shop Floor', value: metrics.sourceDistribution.shop_floor, fill: COLORS.secondary },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                MRB Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">Aging and SLA compliance metrics for management oversight</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm bg-green-500/10 border-green-500/30">
                <Activity className="h-3 w-3 mr-1 text-green-500" />
                Live Data
              </Badge>
              <Badge variant="outline" className="text-sm">
                <Clock className="h-3 w-3 mr-1" />
                {lastRefresh.toLocaleTimeString()}
              </Badge>
              <button onClick={handleRefresh} className="p-2 hover:bg-muted rounded-md transition-colors">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Open MRBs</CardTitle>
              <Clock className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.totalOpen}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.createdThisMonth} created this month
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Compliance</CardTitle>
              <Target className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.slaCompliance}%</p>
              <Progress value={parseFloat(metrics.slaCompliance)} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution Time</CardTitle>
              <Timer className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.avgResolutionTime}</p>
              <p className="text-xs text-muted-foreground mt-1">days average</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Breaches</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-500">{metrics.slaRed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="aging" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
            <TabsTrigger value="sla">SLA Status</TabsTrigger>
            <TabsTrigger value="trend">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="aging" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Aging Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    MRB Aging Distribution
                  </CardTitle>
                  <CardDescription>Open MRBs grouped by age</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agingChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="range" type="category" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {agingChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Department Workload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Pending by Department
                  </CardTitle>
                  <CardDescription>Current workload distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sla" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* SLA Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    SLA Status Overview
                  </CardTitle>
                  <CardDescription>Current SLA compliance breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={slaChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {slaChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Status Distribution
                  </CardTitle>
                  <CardDescription>MRBs by current status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trend" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Trend Line Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    7-Day Trend
                  </CardTitle>
                  <CardDescription>MRBs created vs closed over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics.trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="created" 
                          stroke={COLORS.primary} 
                          fill={COLORS.primary}
                          fillOpacity={0.3}
                          name="Created"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="closed" 
                          stroke={COLORS.green} 
                          fill={COLORS.green}
                          fillOpacity={0.3}
                          name="Closed"
                        />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom Section */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Source Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                    <span className="text-sm">Quality Inspection</span>
                  </div>
                  <span className="font-semibold">{metrics.sourceDistribution.quality_inspection}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.secondary }} />
                    <span className="text-sm">Shop Floor</span>
                  </div>
                  <span className="font-semibold">{metrics.sourceDistribution.shop_floor}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{metrics.createdThisMonth}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closed</span>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">{metrics.closedThisMonth}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Net Change</span>
                  <span className={`font-semibold ${metrics.createdThisMonth - metrics.closedThisMonth > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                    {metrics.createdThisMonth - metrics.closedThisMonth > 0 ? '+' : ''}
                    {metrics.createdThisMonth - metrics.closedThisMonth}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critical MRBs */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Critical MRBs (SLA Breached)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.criticalMRBs.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">No critical MRBs</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.criticalMRBs.map((mrb) => (
                    <Link
                      key={mrb.id}
                      to={mrb.source === 'quality_inspection' ? `/inward/mrb/${mrb.id}` : `/mrb/${mrb.id}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{mrb.mrb_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {mrb.material_description}
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {mrb.pending_days}d
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
