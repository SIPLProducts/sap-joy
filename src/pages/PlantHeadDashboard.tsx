import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isWithinInterval, differenceInDays } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICard } from '@/components/dashboard/KPICard';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import {
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle,
  Factory,
  Activity,
  RefreshCw,
  ExternalLink,
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
} from 'recharts';

const CHART_COLORS = ['hsl(210, 85%, 35%)', 'hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 55%)'];
const SLA_DAYS = 5;

export default function PlantHeadDashboard() {
  const { mrbRecords } = useMRB();
  const { inwardMRBRecords } = useInwardMRB();
  const [selectedPlant, setSelectedPlant] = useState('all');
  const { visiblePlants, plantScope } = useActivePlant();
  useEffect(() => {
    if (visiblePlants.length === 1) setSelectedPlant(visiblePlants[0]);
  }, [visiblePlants.join('|')]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const allMRBs = useMemo(() => [...mrbRecords, ...inwardMRBRecords], [mrbRecords, inwardMRBRecords]);

  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];
    filtered = filtered.filter(mrb => matchesPlantScope(mrb.plant, selectedPlant, plantScope));
    if (dateFrom && dateTo) {
      filtered = filtered.filter(mrb => {
        if (!mrb.created_at) return false;
        const createdDate = parseISO(mrb.created_at);
        return isWithinInterval(createdDate, { start: dateFrom, end: dateTo });
      });
    } else if (dateFrom) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) >= dateFrom);
    } else if (dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) <= dateTo);
    }
    return filtered;
  }, [allMRBs, selectedPlant, plantScope?.join('|'), dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const totalMRBs = filteredMRBs.length;
    const pendingProduction = filteredMRBs.filter(mrb => mrb.impact_on_production || mrb.immediate_block_required).length;
    
    const closedMRBs = filteredMRBs.filter(mrb => mrb.closure_status === 'closed' && mrb.closed_at);
    const avgClosureTime = closedMRBs.length > 0
      ? Math.round(closedMRBs.reduce((sum, mrb) => {
          const created = parseISO(mrb.created_at);
          const closed = parseISO(mrb.closed_at!);
          return sum + differenceInDays(closed, created);
        }, 0) / closedMRBs.length)
      : 0;

    const slaCompliant = closedMRBs.filter(mrb => {
      const created = parseISO(mrb.created_at);
      const closed = parseISO(mrb.closed_at!);
      return differenceInDays(closed, created) <= SLA_DAYS;
    }).length;
    const slaPercent = closedMRBs.length > 0 ? Math.round((slaCompliant / closedMRBs.length) * 100) : 0;

    const productionLoss = filteredMRBs.filter(mrb => mrb.impact_on_production).length * 8; // Estimated hours

    return { totalMRBs, pendingProduction, avgClosureTime, slaPercent, productionLoss };
  }, [filteredMRBs]);

  const statusDistribution = useMemo(() => {
    const pending = filteredMRBs.filter(mrb => !['closed', 'approved', 'rejected'].includes(mrb.status)).length;
    const approved = filteredMRBs.filter(mrb => mrb.final_decision === 'approved' || mrb.status === 'approved').length;
    const closed = filteredMRBs.filter(mrb => mrb.closure_status === 'closed').length;
    return [
      { name: 'Pending', value: pending },
      { name: 'Approved', value: approved },
      { name: 'Closed', value: closed },
    ];
  }, [filteredMRBs]);

  const decisionDistribution = useMemo(() => {
    const decisions: Record<string, number> = { 'Use As-Is': 0, 'Deviation': 0, 'Return': 0, 'Scrap': 0 };
    filteredMRBs.forEach(mrb => {
      if (mrb.engineering_decision === 'use_as_is') decisions['Use As-Is']++;
      else if (mrb.engineering_decision === 'use_with_deviation') decisions['Deviation']++;
      else if (mrb.quality_decision === 'reject' || mrb.final_decision === 'rejected') decisions['Return']++;
      else if (mrb.purchase_action?.toLowerCase().includes('scrap')) decisions['Scrap']++;
    });
    return Object.entries(decisions).map(([name, value]) => ({ name, value }));
  }, [filteredMRBs]);

  const productionImpactByPlant = useMemo(() => {
    const plantData: Record<string, number> = {};
    filteredMRBs.forEach(mrb => {
      if (mrb.impact_on_production || mrb.immediate_block_required) {
        plantData[mrb.plant] = (plantData[mrb.plant] || 0) + 1;
      }
    });
    return Object.entries(plantData).map(([plant, count]) => ({ plant, count }));
  }, [filteredMRBs]);

  const tableData = useMemo(() => {
    return filteredMRBs.slice(0, 20).map(mrb => ({
      id: mrb.id,
      mrbNumber: mrb.mrb_number,
      materialCode: mrb.material_number,
      blockedQuantity: mrb.blocked_quantity,
      status: mrb.status,
      pendingWith: mrb.pending_with,
      pendingDays: mrb.pending_days || 0,
      finalDecision: mrb.final_decision || mrb.engineering_decision || '-',
      isSLABreached: (mrb.pending_days || 0) > SLA_DAYS,
    }));
  }, [filteredMRBs]);

  const clearFilters = () => {
    setSelectedPlant('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      quality_review: { label: 'Quality Review', variant: 'default' },
      purchase_review: { label: 'Purchase Review', variant: 'secondary' },
      engineering_review: { label: 'Engineering Review', variant: 'outline' },
      final_approval: { label: 'Final Approval', variant: 'default' },
      closed: { label: 'Closed', variant: 'secondary' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-muted/30 overflow-auto h-full">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Plant Head – MRB Overview</h1>
              <p className="text-muted-foreground">Production impact & closure analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="w-3 h-3 mr-1" />
                {filteredMRBs.length} Records
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <RefreshCw className="w-3 h-3 mr-1" />
                {format(lastRefresh, 'HH:mm:ss')}
              </Badge>
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
          plants={visiblePlants}
          onClear={clearFilters}
        />
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Total MRBs"
            value={kpis.totalMRBs}
            icon={ClipboardList}
            variant="primary"
            drillDownUrl="/worklist"
          />
          <KPICard
            title="Pending (Production Impact)"
            value={kpis.pendingProduction}
            subtitle="Impacting production"
            icon={AlertTriangle}
            variant="destructive"
            drillDownUrl="/worklist?filter=production"
          />
          <KPICard
            title="Avg Closure Time"
            value={`${kpis.avgClosureTime} days`}
            icon={Clock}
            variant="info"
          />
          <KPICard
            title="SLA Compliance"
            value={`${kpis.slaPercent}%`}
            subtitle="Closed within SLA"
            icon={CheckCircle}
            variant={kpis.slaPercent >= 80 ? 'success' : 'warning'}
          />
          <KPICard
            title="Production Loss"
            value={`${kpis.productionLoss}h`}
            subtitle="Estimated hours"
            icon={Factory}
            variant="warning"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">MRB Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDistribution.map((_, index) => (
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
              <CardTitle className="text-base">MRBs by Final Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={decisionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {decisionDistribution.map((_, index) => (
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
              <CardTitle className="text-base">Production Impact by Plant</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productionImpactByPlant}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="plant" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>MRB Details</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/worklist">
                View All <ExternalLink className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <TableRow>
                    <TableHead>MRB Number</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead className="text-right">Blocked Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pending With</TableHead>
                    <TableHead className="text-right">Pending Days</TableHead>
                    <TableHead>Final Decision</TableHead>
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
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell className="text-right">{row.blockedQuantity}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="capitalize">{row.pendingWith?.replace('_', ' ')}</TableCell>
                      <TableCell className={`text-right ${row.isSLABreached ? 'text-destructive font-semibold' : ''}`}>
                        {row.pendingDays}
                        {row.isSLABreached && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                      </TableCell>
                      <TableCell className="capitalize">{row.finalDecision?.replace('_', ' ')}</TableCell>
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
