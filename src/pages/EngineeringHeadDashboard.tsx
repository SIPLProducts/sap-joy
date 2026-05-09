import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isWithinInterval, differenceInDays } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICard } from '@/components/dashboard/KPICard';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  GitBranch,
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
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = ['hsl(210, 85%, 35%)', 'hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 55%)'];
const SLA_DAYS = 3;

export default function EngineeringHeadDashboard() {
  const { mrbRecords, isLoading, refreshData } = useMRB();
  const { visiblePlants } = useVisiblePlants();
  const [selectedPlant, setSelectedPlant] = useState('all');
  useEffect(() => {
    if (visiblePlants.length === 1) setSelectedPlant(visiblePlants[0]);
  }, [visiblePlants.join('|')]);
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await refreshData();
    setLastRefresh(new Date());
  };

  const allMRBs = mrbRecords;

  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];
    if (selectedPlant !== 'all') filtered = filtered.filter(mrb => mrb.plant === selectedPlant);
    if (selectedMaterial !== 'all') filtered = filtered.filter(mrb => mrb.material_number === selectedMaterial);
    if (dateFrom && dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at && isWithinInterval(parseISO(mrb.created_at), { start: dateFrom, end: dateTo }));
    } else if (dateFrom) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) >= dateFrom);
    } else if (dateTo) {
      filtered = filtered.filter(mrb => mrb.created_at && parseISO(mrb.created_at) <= dateTo);
    }
    return filtered;
  }, [allMRBs, selectedPlant, selectedMaterial, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const pendingEngineering = filteredMRBs.filter(mrb => mrb.pending_with === 'engineering').length;
    
    const reviewedMRBs = filteredMRBs.filter(mrb => mrb.engineering_approved_at);
    const avgReviewTime = reviewedMRBs.length > 0
      ? Math.round(reviewedMRBs.reduce((sum, mrb) => {
          const purchaseDate = parseISO(mrb.created_at);
          const engDate = parseISO(mrb.engineering_approved_at!);
          return sum + differenceInDays(engDate, purchaseDate);
        }, 0) / reviewedMRBs.length)
      : 0;

    const slaCompliant = reviewedMRBs.filter(mrb => {
      const purchaseDate = parseISO(mrb.created_at);
      const engDate = parseISO(mrb.engineering_approved_at!);
      return differenceInDays(engDate, purchaseDate) <= SLA_DAYS;
    }).length;
    const slaPercent = reviewedMRBs.length > 0 ? Math.round((slaCompliant / reviewedMRBs.length) * 100) : 0;

    const escalated = filteredMRBs.filter(mrb => mrb.escalation_level && mrb.escalation_level !== 'none').length;
    const deviations = filteredMRBs.filter(mrb => mrb.engineering_decision === 'use_with_deviation').length;
    const deviationPercent = filteredMRBs.length > 0 ? Math.round((deviations / filteredMRBs.length) * 100) : 0;

    return { pendingEngineering, avgReviewTime, slaPercent, escalated, deviationPercent };
  }, [filteredMRBs]);

  const decisionSplit = useMemo(() => {
    const decisions: Record<string, number> = {
      'Use As-Is': 0,
      'Deviation': 0,
      'Rework': 0,
      'Return': 0,
    };
    filteredMRBs.forEach(mrb => {
      if (mrb.engineering_decision === 'use_as_is') decisions['Use As-Is']++;
      else if (mrb.engineering_decision === 'use_with_deviation') decisions['Deviation']++;
      else if (mrb.engineering_decision === 'rework_required') decisions['Rework']++;
      else if (mrb.engineering_decision === 'return_to_vendor' || mrb.quality_decision === 'reject') decisions['Return']++;
    });
    return Object.entries(decisions).map(([name, value]) => ({ name, value }));
  }, [filteredMRBs]);

  const pendingAgeing = useMemo(() => {
    const pending = filteredMRBs.filter(mrb => mrb.pending_with === 'engineering');
    return [
      { range: '0-2 Days', count: pending.filter(mrb => (mrb.pending_days || 0) <= 2).length },
      { range: '3-5 Days', count: pending.filter(mrb => (mrb.pending_days || 0) > 2 && (mrb.pending_days || 0) <= 5).length },
      { range: '>5 Days', count: pending.filter(mrb => (mrb.pending_days || 0) > 5).length },
    ];
  }, [filteredMRBs]);

  const repeatMaterials = useMemo(() => {
    const materialCounts: Record<string, { material: string; count: number }> = {};
    filteredMRBs.forEach(mrb => {
      if (!materialCounts[mrb.material_number]) {
        materialCounts[mrb.material_number] = { material: mrb.material_number, count: 0 };
      }
      materialCounts[mrb.material_number].count++;
    });
    return Object.values(materialCounts)
      .filter(m => m.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredMRBs]);

  const tableData = useMemo(() => {
    return filteredMRBs
      .filter(mrb => mrb.pending_with === 'engineering' || mrb.engineering_decision)
      .slice(0, 20)
      .map(mrb => ({
        id: mrb.id,
        mrbNumber: mrb.mrb_number,
        materialCode: mrb.material_number,
        defectDescription: mrb.defect_description || '-',
        engineeringDecision: mrb.engineering_decision || 'Pending',
        pendingDays: mrb.pending_days || 0,
        escalated: mrb.escalation_level && mrb.escalation_level !== 'none',
        isSLABreached: (mrb.pending_days || 0) > SLA_DAYS && mrb.pending_with === 'engineering',
      }));
  }, [filteredMRBs]);

  const clearFilters = () => {
    setSelectedPlant('all');
    setSelectedMaterial('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

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
    <div className="min-h-screen bg-muted/30 overflow-auto h-full">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Engineering Head – MRB Review Effectiveness</h1>
              <p className="text-muted-foreground">Technical review & deviation analytics</p>
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
          selectedMaterial={selectedMaterial}
          setSelectedMaterial={setSelectedMaterial}
          showMaterial
          plants={visiblePlants}
          onClear={clearFilters}
        />
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Pending with Engg"
            value={kpis.pendingEngineering}
            icon={Wrench}
            variant="primary"
            drillDownUrl="/worklist?pending=engineering"
          />
          <KPICard
            title="Avg Review Time"
            value={`${kpis.avgReviewTime} days`}
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
            title="Escalated MRBs"
            value={kpis.escalated}
            icon={AlertTriangle}
            variant="destructive"
          />
          <KPICard
            title="Deviation Approvals"
            value={`${kpis.deviationPercent}%`}
            icon={GitBranch}
            variant="warning"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engineering Decisions Split</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={decisionSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {decisionSplit.map((_, index) => (
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
              <CardTitle className="text-base">Pending Ageing</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pendingAgeing}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repeat MRBs by Material</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={repeatMaterials} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="material" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Engineering Review Details</CardTitle>
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
                    <TableHead>Material Code</TableHead>
                    <TableHead className="max-w-[200px]">Defect Description</TableHead>
                    <TableHead>Engg Decision</TableHead>
                    <TableHead className="text-right">Pending Days</TableHead>
                    <TableHead>Escalation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow
                      key={row.id}
                      className={row.escalated ? 'bg-destructive/10 hover:bg-destructive/15' : row.isSLABreached ? 'bg-yellow-500/10' : ''}
                    >
                      <TableCell>
                        <Link to={`/mrb/${row.id}`} className="text-primary hover:underline font-medium">
                          {row.mrbNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.defectDescription}>
                        {row.defectDescription}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.engineeringDecision === 'Pending' ? 'outline' : 'secondary'} className="capitalize">
                          {row.engineeringDecision.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right ${row.isSLABreached ? 'text-destructive font-semibold' : ''}`}>
                        {row.pendingDays}
                      </TableCell>
                      <TableCell>
                        {row.escalated ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Escalated
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
