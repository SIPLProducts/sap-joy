import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, isWithinInterval, differenceInDays, subMonths, getYear } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  BarChart3,
  Clock,
  CheckCircle,
  GitBranch,
  Factory,
  Activity,
  RefreshCw,
  ExternalLink,
  Building2,
  Users,
  Wrench,
  Shield,
} from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

const CHART_COLORS = ['hsl(210, 85%, 35%)', 'hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 55%)'];

export default function ExecutiveSummaryDashboard() {
  const { mrbRecords, isLoading, refreshData: refreshMRB } = useMRB();
  const navigate = useNavigate();
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await refreshMRB();
    setLastRefresh(new Date());
  };

  const allMRBs = useMemo(() => mrbRecords, [mrbRecords]);

  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];
    if (selectedPlant !== 'all') filtered = filtered.filter(mrb => mrb.plant === selectedPlant);
    if (selectedVendor !== 'all') filtered = filtered.filter(mrb => mrb.vendor_code === selectedVendor);
    if (selectedMaterial !== 'all') filtered = filtered.filter(mrb => mrb.material_number === selectedMaterial);
    if (dateFrom && dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at && isWithinInterval(parseISO(mrb.created_at), { start: dateFrom, end: dateTo }));
    } else if (dateFrom) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) >= dateFrom);
    } else if (dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) <= dateTo);
    }
    return filtered;
  }, [allMRBs, selectedPlant, selectedVendor, selectedMaterial, dateFrom, dateTo]);

  // YTD MRBs
  const ytdMRBs = useMemo(() => {
    const currentYear = getYear(new Date());
    return allMRBs.filter(mrb => mrb.created_at && getYear(parseISO(mrb.created_at)) === currentYear);
  }, [allMRBs]);

  const kpis = useMemo(() => {
    const totalYTD = ytdMRBs.length;

    const closedMRBs = filteredMRBs.filter(mrb => mrb.closure_status === 'closed' && mrb.closed_at);
    const avgLifecycle = closedMRBs.length > 0
      ? Math.round(closedMRBs.reduce((sum, mrb) => {
          const created = parseISO(mrb.created_at);
          const closed = parseISO(mrb.closed_at!);
          return sum + differenceInDays(closed, created);
        }, 0) / closedMRBs.length)
      : 0;

    const slaCompliant = closedMRBs.filter(mrb => differenceInDays(parseISO(mrb.closed_at!), parseISO(mrb.created_at)) <= 5).length;
    const slaPercent = closedMRBs.length > 0 ? Math.round((slaCompliant / closedMRBs.length) * 100) : 0;

    const deviations = filteredMRBs.filter(mrb => mrb.engineering_decision === 'use_with_deviation').length;
    const rejections = filteredMRBs.filter(mrb => mrb.quality_decision === 'reject' || mrb.final_decision === 'rejected').length;
    const deviationRatio = rejections > 0 ? `${deviations}:${rejections}` : `${deviations}:0`;

    const productionImpact = filteredMRBs.filter(mrb => mrb.impact_on_production || mrb.immediate_block_required).length;

    return { totalYTD, avgLifecycle, slaPercent, deviationRatio, productionImpact };
  }, [filteredMRBs, ytdMRBs]);

  const trendByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months[format(date, 'MMM')] = 0;
    }
    filteredMRBs.forEach(mrb => {
      if (!mrb.created_at) return;
      const month = format(parseISO(mrb.created_at), 'MMM');
      if (months[month] !== undefined) months[month]++;
    });
    return Object.entries(months).map(([month, count]) => ({ month, count }));
  }, [filteredMRBs]);

  const mrbsByPlant = useMemo(() => {
    const plantData: Record<string, number> = {};
    filteredMRBs.forEach(mrb => {
      plantData[mrb.plant] = (plantData[mrb.plant] || 0) + 1;
    });
    return Object.entries(plantData).map(([plant, count]) => ({ plant, count }));
  }, [filteredMRBs]);

  const mrbsByDecision = useMemo(() => {
    const decisions: Record<string, number> = {
      'Approved': 0,
      'Deviation': 0,
      'Rejected': 0,
      'Pending': 0,
    };
    filteredMRBs.forEach(mrb => {
      if (mrb.final_decision === 'approved' || mrb.status === 'closed') decisions['Approved']++;
      else if (mrb.engineering_decision === 'use_with_deviation') decisions['Deviation']++;
      else if (mrb.final_decision === 'rejected' || mrb.quality_decision === 'reject') decisions['Rejected']++;
      else decisions['Pending']++;
    });
    return Object.entries(decisions).map(([name, value]) => ({ name, value }));
  }, [filteredMRBs]);

  const top10Materials = useMemo(() => {
    const materialCounts: Record<string, { material: string; description: string; count: number }> = {};
    filteredMRBs.forEach(mrb => {
      if (!materialCounts[mrb.material_number]) {
        materialCounts[mrb.material_number] = {
          material: mrb.material_number,
          description: mrb.material_description || '',
          count: 0,
        };
      }
      materialCounts[mrb.material_number].count++;
    });
    return Object.values(materialCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredMRBs]);

  const tableData = useMemo(() => {
    return filteredMRBs.slice(0, 25).map(mrb => {
      const closureTime = mrb.closed_at
        ? differenceInDays(parseISO(mrb.closed_at), parseISO(mrb.created_at))
        : mrb.pending_days || 0;
      return {
        id: mrb.id,
        mrbNumber: mrb.mrb_number,
        plant: mrb.plant,
        materialCode: mrb.material_number,
        vendorName: mrb.vendor_name,
        finalDecision: mrb.final_decision || mrb.engineering_decision || 'Pending',
        closureTime,
        isSLABreached: closureTime > 5,
      };
    });
  }, [filteredMRBs]);

  const clearFilters = () => {
    setSelectedPlant('all');
    setSelectedVendor('all');
    setSelectedMaterial('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Role-specific dashboard links
  const roleDashboards = [
    { title: 'Plant Head', url: '/dashboard/plant-head', icon: Factory },
    { title: 'Quality Head', url: '/dashboard/quality-head', icon: Shield },
    { title: 'Purchase Head', url: '/dashboard/purchase-head', icon: Users },
    { title: 'Engineering Head', url: '/dashboard/engineering-head', icon: Wrench },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">MRB Executive Summary</h1>
              <p className="text-muted-foreground">Consolidated overview & drill-down analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1 bg-green-500/10 border-green-500/30">
                <Activity className="w-3 h-3 mr-1 text-green-500" />
                Live Data
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <RefreshCw className="w-3 h-3 mr-1" />
                {format(lastRefresh, 'HH:mm:ss')}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                {filteredMRBs.length} Records
              </Badge>
              <button onClick={handleRefresh} className="p-2 hover:bg-muted rounded-md transition-colors">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
        <DashboardFilters
          selectedPlant={selectedPlant}
          setSelectedPlant={setSelectedPlant}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          selectedVendor={selectedVendor}
          setSelectedVendor={setSelectedVendor}
          selectedMaterial={selectedMaterial}
          setSelectedMaterial={setSelectedMaterial}
          showVendor
          showMaterial
          onClear={clearFilters}
        />
      </div>

      <div className="p-6 space-y-6">
        {/* Role Dashboard Links */}
        <div className="grid gap-4 md:grid-cols-4">
          {roleDashboards.map(dash => (
            <Card
              key={dash.url}
              className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/40"
              onClick={() => navigate(dash.url)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <dash.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{dash.title}</p>
                  <p className="text-xs text-muted-foreground">View Dashboard</p>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Total MRBs (YTD)"
            value={kpis.totalYTD}
            icon={BarChart3}
            variant="primary"
            drillDownUrl="/worklist"
          />
          <KPICard
            title="Avg Lifecycle Time"
            value={`${kpis.avgLifecycle} days`}
            icon={Clock}
            variant="info"
          />
          <KPICard
            title="SLA Compliance"
            value={`${kpis.slaPercent}%`}
            icon={CheckCircle}
            variant={kpis.slaPercent >= 80 ? 'success' : 'warning'}
          />
          <KPICard
            title="Deviation:Rejection"
            value={kpis.deviationRatio}
            icon={GitBranch}
            variant="default"
          />
          <KPICard
            title="Production Impacted"
            value={kpis.productionImpact}
            icon={Factory}
            variant="destructive"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">MRB Trend by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(210, 85%, 35%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">MRBs by Plant</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mrbsByPlant}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="plant" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">MRBs by Final Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={mrbsByDecision}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {mrbsByDecision.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Materials with MRBs</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top10Materials} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="material" tick={{ fontSize: 8 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Consolidated MRB View</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/worklist">View All <ExternalLink className="w-4 h-4 ml-2" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <TableRow>
                    <TableHead>MRB Number</TableHead>
                    <TableHead>Plant</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Final Decision</TableHead>
                    <TableHead className="text-right">Closure Time (Days)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow
                      key={row.id}
                      className={row.isSLABreached ? 'bg-destructive/10 hover:bg-destructive/15' : ''}
                    >
                      <TableCell>
                        <Link to={`/mrb/${row.id}`} className="text-primary hover:underline font-medium">
                          {row.mrbNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{row.plant}</TableCell>
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell>{row.vendorName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {row.finalDecision.toString().replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right ${row.isSLABreached ? 'text-destructive font-semibold' : ''}`}>
                        {row.closureTime}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
