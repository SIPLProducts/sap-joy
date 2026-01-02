import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isWithinInterval, differenceInDays, subMonths } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  Users,
  RefreshCcw,
  Clock,
  AlertCircle,
  DollarSign,
  Activity,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
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

export default function PurchaseHeadDashboard() {
  const { mrbRecords } = useMRB();
  const { inwardMRBRecords } = useInwardMRB();
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

  const allMRBs = useMemo(() => [...mrbRecords, ...inwardMRBRecords], [mrbRecords, inwardMRBRecords]);

  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];
    if (selectedPlant !== 'all') filtered = filtered.filter(mrb => mrb.plant === selectedPlant);
    if (selectedVendor !== 'all') filtered = filtered.filter(mrb => mrb.vendor === selectedVendor);
    if (selectedMaterial !== 'all') filtered = filtered.filter(mrb => mrb.materialNumber === selectedMaterial);
    if (dateFrom && dateTo) {
      filtered = filtered.filter(mrb => isWithinInterval(parseISO(mrb.createdAt), { start: dateFrom, end: dateTo }));
    } else if (dateFrom) {
      filtered = filtered.filter(mrb => parseISO(mrb.createdAt) >= dateFrom);
    } else if (dateTo) {
      filtered = filtered.filter(mrb => parseISO(mrb.createdAt) <= dateTo);
    }
    return filtered;
  }, [allMRBs, selectedPlant, selectedVendor, selectedMaterial, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const vendorMRBs = filteredMRBs.filter(mrb => mrb.vendorResponsibility);
    const vendorReplaceRequired = filteredMRBs.filter(mrb => mrb.vendorReplacementRequired).length;
    const replacePercent = filteredMRBs.length > 0 ? Math.round((vendorReplaceRequired / filteredMRBs.length) * 100) : 0;
    
    const replacementLeadTimes = filteredMRBs
      .filter(mrb => mrb.vendorReplacementRequired && mrb.expectedReplacementDate)
      .map(mrb => {
        const created = parseISO(mrb.createdAt);
        const expected = parseISO(mrb.expectedReplacementDate!);
        return differenceInDays(expected, created);
      });
    const avgLeadTime = replacementLeadTimes.length > 0
      ? Math.round(replacementLeadTimes.reduce((a, b) => a + b, 0) / replacementLeadTimes.length)
      : 0;

    const pendingPurchase = filteredMRBs.filter(mrb => mrb.pendingWith === 'purchase').length;
    const scrapCost = filteredMRBs
      .filter(mrb => mrb.purchaseAction?.toLowerCase().includes('scrap'))
      .reduce((sum, mrb) => sum + (mrb.blockedQuantity || 0) * 100, 0); // Estimated cost per unit

    return { vendorMRBs: vendorMRBs.length, replacePercent, avgLeadTime, pendingPurchase, scrapCost };
  }, [filteredMRBs]);

  const top10Vendors = useMemo(() => {
    const vendorCounts: Record<string, { name: string; count: number }> = {};
    filteredMRBs.forEach(mrb => {
      if (!vendorCounts[mrb.vendor]) {
        vendorCounts[mrb.vendor] = { name: mrb.vendorName || mrb.vendor, count: 0 };
      }
      vendorCounts[mrb.vendor].count++;
    });
    return Object.entries(vendorCounts)
      .map(([_, data]) => ({ vendor: data.name.split(' ')[0], count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredMRBs]);

  const leadTimeTrend = useMemo(() => {
    const monthData: Record<string, { total: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const month = format(subMonths(new Date(), i), 'MMM');
      monthData[month] = { total: 0, count: 0 };
    }
    filteredMRBs.forEach(mrb => {
      if (mrb.vendorReplacementRequired && mrb.expectedReplacementDate) {
        const month = format(parseISO(mrb.createdAt), 'MMM');
        if (monthData[month]) {
          const days = differenceInDays(parseISO(mrb.expectedReplacementDate), parseISO(mrb.createdAt));
          monthData[month].total += days;
          monthData[month].count++;
        }
      }
    });
    return Object.entries(monthData).map(([month, data]) => ({
      month,
      avgDays: data.count > 0 ? Math.round(data.total / data.count) : 0,
    }));
  }, [filteredMRBs]);

  const purchaseActionSplit = useMemo(() => {
    const actions: Record<string, number> = { Replace: 0, Return: 0, Accept: 0 };
    filteredMRBs.forEach(mrb => {
      if (mrb.vendorReplacementRequired) actions['Replace']++;
      else if (mrb.qualityDecision === 'reject') actions['Return']++;
      else if (mrb.qualityDecision === 'accept' || mrb.qualityDecision === 'partial_accept') actions['Accept']++;
    });
    return Object.entries(actions).map(([name, value]) => ({ name, value }));
  }, [filteredMRBs]);

  // Identify vendors with repeat MRBs
  const repeatVendors = useMemo(() => {
    const vendorCounts: Record<string, number> = {};
    filteredMRBs.forEach(mrb => {
      vendorCounts[mrb.vendor] = (vendorCounts[mrb.vendor] || 0) + 1;
    });
    return new Set(Object.entries(vendorCounts).filter(([_, count]) => count > 1).map(([vendor]) => vendor));
  }, [filteredMRBs]);

  const tableData = useMemo(() => {
    return filteredMRBs.slice(0, 20).map(mrb => ({
      id: mrb.id,
      mrbNumber: mrb.mrbNumber,
      vendorCode: mrb.vendor,
      vendorName: mrb.vendorName,
      materialCode: mrb.materialNumber,
      blockedQuantity: mrb.blockedQuantity,
      purchaseAction: mrb.purchaseAction || '-',
      expectedReplacement: mrb.expectedReplacementDate ? format(parseISO(mrb.expectedReplacementDate), 'dd/MM/yyyy') : '-',
      status: mrb.status,
      isRepeatVendor: repeatVendors.has(mrb.vendor),
    }));
  }, [filteredMRBs, repeatVendors]);

  const clearFilters = () => {
    setSelectedPlant('all');
    setSelectedVendor('all');
    setSelectedMaterial('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Purchase Head – Vendor MRB Performance</h1>
              <p className="text-muted-foreground">Vendor quality & replacement analytics</p>
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
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Vendor MRBs"
            value={kpis.vendorMRBs}
            icon={Users}
            variant="primary"
            drillDownUrl="/worklist?filter=vendor"
          />
          <KPICard
            title="Replacement Required"
            value={`${kpis.replacePercent}%`}
            icon={RefreshCcw}
            variant={kpis.replacePercent > 30 ? 'destructive' : 'warning'}
          />
          <KPICard
            title="Avg Lead Time"
            value={`${kpis.avgLeadTime} days`}
            icon={Clock}
            variant="info"
          />
          <KPICard
            title="Pending with Purchase"
            value={kpis.pendingPurchase}
            icon={AlertCircle}
            variant="warning"
            drillDownUrl="/worklist?pending=purchase"
          />
          <KPICard
            title="Scrap Cost"
            value={`₹${(kpis.scrapCost / 1000).toFixed(0)}K`}
            icon={DollarSign}
            variant="destructive"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Vendors (MRB Count)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={top10Vendors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="vendor" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(210, 85%, 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replacement Lead Time Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={leadTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgDays" stroke="hsl(160, 60%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purchase Action Split</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={purchaseActionSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {purchaseActionSplit.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vendor MRB Details</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/worklist">View All <ExternalLink className="w-4 h-4 ml-2" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MRB Number</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead className="text-right">Blocked Qty</TableHead>
                    <TableHead>Purchase Action</TableHead>
                    <TableHead>Expected Replacement</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow
                      key={row.id}
                      className={row.isRepeatVendor ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : ''}
                    >
                      <TableCell>
                        <Link to={`/mrb/${row.id}`} className="text-primary hover:underline font-medium">
                          {row.mrbNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.vendorName}
                        {row.isRepeatVendor && (
                          <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-500">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Repeat
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell className="text-right">{row.blockedQuantity}</TableCell>
                      <TableCell>{row.purchaseAction}</TableCell>
                      <TableCell>{row.expectedReplacement}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {row.status.replace('_', ' ')}
                        </Badge>
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
