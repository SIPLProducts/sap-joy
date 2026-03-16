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
  FileSpreadsheet,
  TrendingDown,
  Package,
  AlertCircle,
  Clock,
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

const CHART_COLORS = ['hsl(210, 85%, 35%)', 'hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 55%)'];

export default function QualityHeadDashboard() {
  const { mrbRecords, isLoading: mrbLoading, refreshData: refreshMRB } = useMRB();
  const { inwardMRBRecords, inspectionLotRecords, isLoading: inwardLoading, refreshData: refreshInward } = useInwardMRB();
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const isLoading = mrbLoading || inwardLoading;

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refreshMRB(), refreshInward()]);
    setLastRefresh(new Date());
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

  const allMRBs = useMemo(() => [...mrbRecords, ...inwardMRBRecords], [mrbRecords, inwardMRBRecords]);

  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];
    if (selectedPlant !== 'all') filtered = filtered.filter(mrb => mrb.plant === selectedPlant);
    if (selectedVendor !== 'all') filtered = filtered.filter(mrb => mrb.vendor_code === selectedVendor);
    if (selectedMaterial !== 'all') filtered = filtered.filter(mrb => mrb.material_number === selectedMaterial);
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
  }, [allMRBs, selectedPlant, selectedVendor, selectedMaterial, dateFrom, dateTo]);

  const filteredLots = useMemo(() => {
    let lots = [...inspectionLotRecords];
    if (selectedPlant !== 'all') lots = lots.filter(lot => lot.plant === selectedPlant);
    if (selectedVendor !== 'all') lots = lots.filter(lot => lot.vendorCode === selectedVendor);
    return lots;
  }, [inspectionLotRecords, selectedPlant, selectedVendor]);

  const kpis = useMemo(() => {
    const totalLots = filteredLots.length;
    const rejectedLots = filteredMRBs.filter(mrb => mrb.quality_decision === 'reject').length;
    const rejectionRate = totalLots > 0 ? Math.round((rejectedLots / totalLots) * 100) : 0;
    const totalBlockedQty = filteredMRBs.reduce((sum, mrb) => sum + (mrb.blocked_quantity || 0), 0);
    const qualityRaised = filteredMRBs.filter(mrb => mrb.source === 'quality_inspection').length;
    
    const avgTimeToRaise = filteredMRBs.length > 0
      ? Math.round(filteredMRBs.reduce((sum, mrb) => sum + (mrb.pending_days || 0), 0) / filteredMRBs.length)
      : 0;

    return { totalLots, rejectionRate, totalBlockedQty, qualityRaised, avgTimeToRaise };
  }, [filteredLots, filteredMRBs]);

  const defectCategorySplit = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredMRBs.forEach(mrb => {
      const label = mrb.defect_category || mrb.defect_description || 'Not specified';
      const shortLabel = label.length > 25 ? label.substring(0, 23) + '…' : label;
      categories[shortLabel] = (categories[shortLabel] || 0) + 1;
    });
    const sorted = Object.entries(categories)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
    if (sorted.length > 6) {
      const top = sorted.slice(0, 6);
      const othersValue = sorted.slice(6).reduce((sum, item) => sum + item.value, 0);
      return [...top, { name: 'Others', value: othersValue }];
    }
    return sorted;
  }, [filteredMRBs]);

  const topRejectionReasons = useMemo(() => {
    const reasons: Record<string, number> = {};
    filteredMRBs.forEach(mrb => {
      const reason = (mrb.defect_description || mrb.defect_category || mrb.defect_code || 'Not specified').trim();
      const shortReason = reason.length > 30 ? reason.substring(0, 28) + '…' : reason;
      reasons[shortReason] = (reasons[shortReason] || 0) + 1;
    });
    return Object.entries(reasons)
      .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredMRBs]);

  const vendorRejectionTrend = useMemo(() => {
    const vendorData: Record<string, Record<string, number>> = {};
    filteredMRBs.forEach(mrb => {
      if (mrb.quality_decision === 'reject' || mrb.status === 'rejected') {
        if (!mrb.created_at) return;
        const month = format(parseISO(mrb.created_at), 'MMM');
        const vendor = mrb.vendor_name?.split(' ')[0] || 'Unknown';
        if (!vendorData[month]) vendorData[month] = {};
        vendorData[month][vendor] = (vendorData[month][vendor] || 0) + 1;
      }
    });
    return Object.entries(vendorData).map(([month, vendors]) => ({ month, ...vendors }));
  }, [filteredMRBs]);

  const blockedQtyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months[format(date, 'MMM yyyy')] = 0;
    }
    filteredMRBs.forEach(mrb => {
      if (!mrb.created_at) return;
      const month = format(parseISO(mrb.created_at), 'MMM yyyy');
      if (months[month] !== undefined) {
        months[month] += mrb.blocked_quantity || 0;
      }
    });
    return Object.entries(months).map(([month, qty]) => ({ month, quantity: qty }));
  }, [filteredMRBs]);

  const tableData = useMemo(() => {
    // Build a lookup from inspection lot to MRB record
    const mrbByLot = new Map<string, typeof filteredMRBs[0]>();
    filteredMRBs.forEach(mrb => {
      if (mrb.inspection_lot) mrbByLot.set(mrb.inspection_lot, mrb);
    });

    return filteredLots.slice(0, 20).map(lot => {
      const mrb = mrbByLot.get(lot.inspectionLot);
      return {
        id: lot.inspectionLot,
        inspectionLot: lot.inspectionLot,
        materialCode: lot.materialCode,
        vendorName: lot.vendorName,
        blockedQuantity: lot.blockedQuantity,
        defectCategory: mrb?.defect_description || mrb?.defect_category || lot.blockReason || '-',
        qualityDecision: mrb?.quality_decision
          ? mrb.quality_decision.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : 'Pending Review',
        mrbStatus: mrb
          ? mrb.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : 'No MRB',
      };
    });
  }, [filteredLots, filteredMRBs]);

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
              <h1 className="text-2xl font-bold text-foreground">Quality Head – MRB Quality Performance</h1>
              <p className="text-muted-foreground">Inspection & rejection analytics</p>
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
                {filteredLots.length} Lots
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
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Total Inspection Lots"
            value={kpis.totalLots}
            icon={FileSpreadsheet}
            variant="primary"
            drillDownUrl="/inward/report"
          />
          <KPICard
            title="Rejection Rate"
            value={`${kpis.rejectionRate}%`}
            icon={TrendingDown}
            variant={kpis.rejectionRate > 20 ? 'destructive' : 'warning'}
          />
          <KPICard
            title="Total Blocked Qty"
            value={kpis.totalBlockedQty.toLocaleString()}
            icon={Package}
            variant="info"
          />
          <KPICard
            title="MRBs by Quality"
            value={kpis.qualityRaised}
            icon={AlertCircle}
            variant="primary"
            drillDownUrl="/worklist?source=quality"
          />
          <KPICard
            title="Avg Time to Raise"
            value={`${kpis.avgTimeToRaise} days`}
            icon={Clock}
            variant="default"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Defect Category Split</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={defectCategorySplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name.split('/')[0]}: ${value}` : ''}
                  >
                    {defectCategorySplit.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Rejection Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topRejectionReasons} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(210, 85%, 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor Rejection Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={vendorRejectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {Object.keys(vendorRejectionTrend[0] || {}).filter(k => k !== 'month').slice(0, 3).map((vendor, i) => (
                    <Line key={vendor} type="monotone" dataKey={vendor} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blocked Qty Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={blockedQtyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="quantity" stroke="hsl(160, 60%, 40%)" fill="hsl(160, 60%, 40%)" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Inspection Lot Details</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/inward/report">View All <ExternalLink className="w-4 h-4 ml-2" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inspection Lot</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="text-right">Blocked Qty</TableHead>
                    <TableHead>Defect Category</TableHead>
                    <TableHead>Quality Decision</TableHead>
                    <TableHead>MRB Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.inspectionLot}</TableCell>
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell>{row.vendorName}</TableCell>
                      <TableCell className="text-right">{row.blockedQuantity}</TableCell>
                      <TableCell className="capitalize">{row.defectCategory}</TableCell>
                      <TableCell>
                        <Badge variant={row.qualityDecision === 'rejected' ? 'destructive' : 'secondary'}>
                          {row.qualityDecision}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.mrbStatus === 'MRB Created' ? 'default' : 'outline'}>
                          {row.mrbStatus}
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
