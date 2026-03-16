import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  BarChart3,
  PieChart,
  Users,
  Building2,
  Wrench,
  ShieldCheck,
  Package,
  FileText,
  ArrowRight,
  Activity,
  CalendarIcon,
  Factory,
  Filter
} from 'lucide-react';
import { getStatusDisplayName, getSLAColor } from '@/data/mockData';
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
  LineChart, 
  Line, 
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area
} from 'recharts';

const CHART_COLORS = [
  'hsl(210, 85%, 35%)',
  'hsl(160, 60%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(270, 60%, 55%)',
  'hsl(199, 89%, 48%)',
  'hsl(142, 70%, 45%)',
  'hsl(320, 70%, 50%)',
];

export default function KPIDashboard() {
  const { mrbRecords, emailLogs, isLoading: mrbLoading, refreshData: refreshMRB } = useMRB();
  const { inwardMRBRecords, inspectionLotRecords, isLoading: inwardLoading, refreshData: refreshInward } = useInwardMRB();
  const { currentRole, roleDisplayName } = useRole();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Derive plants from real MRB data
  const plants = useMemo(() => [...new Set(mrbRecords.map(r => r.plant))], [mrbRecords]);
  
  // Filters State - must be declared before any conditional returns
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Real-time refresh indicator
  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = mrbLoading || inwardLoading;

  const handleRefresh = async () => {
    await Promise.all([refreshMRB(), refreshInward()]);
    setLastRefresh(new Date());
  };

  // Generate last 12 months for dropdown - must be before conditional return
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return months;
  }, []);

  // Use mrbRecords directly - it already contains ALL records (including quality_inspection source)
  // Do NOT combine with inwardMRBRecords as that causes duplication
  const allMRBs = useMemo(() => mrbRecords, [mrbRecords]);

  // Filter MRBs based on selections
  const filteredMRBs = useMemo(() => {
    let filtered = [...allMRBs];

    // Filter by plant
    if (selectedPlant !== 'all') {
      filtered = filtered.filter(mrb => mrb.plant === selectedPlant);
    }

    // Filter by month
    if (selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      filtered = filtered.filter(mrb => {
        if (!mrb.created_at) return false;
        const createdDate = parseISO(mrb.created_at);
        return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
      });
    }

    // Filter by date range
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
  }, [allMRBs, selectedPlant, selectedMonth, dateFrom, dateTo]);


  // Calculate KPIs based on filtered data
  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    // Basic Counts
    const totalMRBs = filteredMRBs.length;
    const openMRBs = filteredMRBs.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');
    const closedMRBs = filteredMRBs.filter(mrb => mrb.closure_status === 'closed');
    const rejectedMRBs = filteredMRBs.filter(mrb => mrb.quality_decision === 'reject' || mrb.status === 'rejected');

    // SLA Status
    const slaGreen = filteredMRBs.filter(mrb => mrb.sla_status === 'green').length;
    const slaYellow = filteredMRBs.filter(mrb => mrb.sla_status === 'yellow').length;
    const slaRed = filteredMRBs.filter(mrb => mrb.sla_status === 'red').length;

    // My Pending
    const myPending = filteredMRBs.filter(mrb => mrb.pending_with === currentRole && mrb.status !== 'closed').length;

    // Average Pending Days
    const avgPendingDays = openMRBs.length > 0 
      ? Math.round(openMRBs.reduce((sum, mrb) => sum + (mrb.pending_days || 0), 0) / openMRBs.length)
      : 0;

    return {
      totalMRBs,
      openMRBs: openMRBs.length,
      closedMRBs: closedMRBs.length,
      rejectedMRBs: rejectedMRBs.length,
      slaGreen,
      slaYellow,
      slaRed,
      myPending,
      avgPendingDays,
    };
  }, [filteredMRBs, currentRole]);

  // Top Reject Reasons Analysis
  const topRejectReasons = useMemo(() => {
    const reasonCounts: Record<string, { count: number; description: string }> = {};
    
    filteredMRBs.forEach(mrb => {
      const isRejected = mrb.quality_decision === 'reject' || mrb.status === 'rejected' || (mrb.rejected_quantity || 0) > 0;
      if (isRejected) {
        const reason = mrb.defect_category || mrb.defect_code || 'unspecified';
        const description = mrb.defect_description || mrb.defect_category || 'No defect detail captured';
        if (!reasonCounts[reason]) {
          reasonCounts[reason] = { count: 0, description };
        }
        reasonCounts[reason].count++;
      }
    });

    return Object.entries(reasonCounts)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredMRBs]);

  // Reject Reasons by Plant
  const rejectReasonsByPlant = useMemo(() => {
    const plantData: Record<string, Record<string, number>> = {};
    
    filteredMRBs.forEach(mrb => {
      const isRejected = mrb.quality_decision === 'reject' || mrb.status === 'rejected' || (mrb.rejected_quantity || 0) > 0;
      if (isRejected) {
        const plant = mrb.plant;
        const reason = mrb.defect_category || 'unspecified';
        
        if (!plantData[plant]) {
          plantData[plant] = {};
        }
        plantData[plant][reason] = (plantData[plant][reason] || 0) + 1;
      }
    });

    return Object.entries(plantData).map(([plant, reasons]) => ({
      plant,
      ...reasons,
      total: Object.values(reasons).reduce((a, b) => a + b, 0),
    }));
  }, [filteredMRBs]);

  // Reject Reasons by Month
  const rejectReasonsByMonth = useMemo(() => {
    const monthData: Record<string, Record<string, number>> = {};
    
    filteredMRBs.forEach(mrb => {
      const isRejected = mrb.quality_decision === 'reject' || mrb.status === 'rejected' || (mrb.rejected_quantity || 0) > 0;
      if (isRejected) {
        if (!mrb.created_at) return;
        const month = format(parseISO(mrb.created_at), 'MMM yyyy');
        const reason = mrb.defect_category || 'unspecified';
        
        if (!monthData[month]) {
          monthData[month] = {};
        }
        monthData[month][reason] = (monthData[month][reason] || 0) + 1;
      }
    });

    return Object.entries(monthData).map(([month, reasons]) => ({
      month,
      ...reasons,
      total: Object.values(reasons).reduce((a, b) => a + b, 0),
    })).reverse();
  }, [filteredMRBs]);

  // Top 5 Vendors with Material Damage
  const topVendorsByDamage = useMemo(() => {
    const vendorDamage: Record<string, { 
      vendorName: string; 
      count: number; 
      totalQuantity: number;
      damageQuantity: number;
    }> = {};
    
    filteredMRBs.forEach(mrb => {
      const damageQuantity = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      const vendorCode = (mrb.vendor_code || '').trim();
      const vendorName = (mrb.vendor_name || '').trim() || vendorCode;

      if (damageQuantity <= 0 || !vendorName) return;
      
      if (!vendorDamage[vendorCode || vendorName]) {
        vendorDamage[vendorCode || vendorName] = { 
          vendorName, 
          count: 0, 
          totalQuantity: 0,
          damageQuantity: 0 
        };
      }

      const key = vendorCode || vendorName;
      vendorDamage[key].count++;
      vendorDamage[key].totalQuantity += Number(mrb.total_quantity || 0);
      vendorDamage[key].damageQuantity += damageQuantity;
    });

    return Object.entries(vendorDamage)
      .map(([code, data]) => ({ vendorCode: code, ...data }))
      .sort((a, b) => b.damageQuantity - a.damageQuantity || b.count - a.count)
      .slice(0, 5);
  }, [filteredMRBs]);

  // Vendor Damage by Month
  const vendorDamageByMonth = useMemo(() => {
    const monthData: Record<string, Record<string, number>> = {};
    const top5Vendors = topVendorsByDamage.map(v => v.vendorCode);
    
    filteredMRBs.forEach(mrb => {
      const damageQuantity = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      const vendorCode = (mrb.vendor_code || '').trim() || ((mrb.vendor_name || '').trim());

      if (damageQuantity > 0 && top5Vendors.includes(vendorCode)) {
        if (!mrb.created_at) return;
        const month = format(parseISO(mrb.created_at), 'MMM yyyy');
        const vendor = ((mrb.vendor_name || vendorCode).trim().split(' ')[0]) || vendorCode;
        
        if (!monthData[month]) {
          monthData[month] = {};
        }
        monthData[month][vendor] = (monthData[month][vendor] || 0) + damageQuantity;
      }
    });

    return Object.entries(monthData).map(([month, vendors]) => ({
      month,
      ...vendors,
    })).reverse();
  }, [filteredMRBs, topVendorsByDamage]);

  // Vendor Damage by Plant
  const vendorDamageByPlant = useMemo(() => {
    const plantData: Record<string, { plant: string; vendors: Record<string, number> }> = {};
    
    filteredMRBs.forEach(mrb => {
      if (mrb.quality_decision === 'reject' || mrb.status === 'rejected' || (mrb.rejected_quantity || 0) > 0) {
        const plant = mrb.plant;
        const vendor = mrb.vendor_name || '';
        
        if (!plantData[plant]) {
          plantData[plant] = { plant, vendors: {} };
        }
        plantData[plant].vendors[vendor] = (plantData[plant].vendors[vendor] || 0) + 1;
      }
    });

    return Object.values(plantData).map(data => ({
      plant: data.plant,
      ...Object.fromEntries(
        Object.entries(data.vendors)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      ),
    }));
  }, [filteredMRBs]);

  // Defect Category Distribution
  const defectCategoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    
    filteredMRBs.forEach(mrb => {
      if (mrb.defect_category) {
        categories[mrb.defect_category] = (categories[mrb.defect_category] || 0) + 1;
      }
    });

    return Object.entries(categories)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMRBs]);

  // SLA Chart Data
  const slaChartData = [
    { name: 'On Track', value: kpis.slaGreen, color: 'hsl(142, 70%, 45%)' },
    { name: 'At Risk', value: kpis.slaYellow, color: 'hsl(45, 93%, 47%)' },
    { name: 'Breached', value: kpis.slaRed, color: 'hsl(0, 72%, 51%)' },
  ];

  const clearFilters = () => {
    setSelectedPlant('all');
    setSelectedMonth('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Show loading state - must be after all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">KPI Dashboard</h1>
              <p className="text-muted-foreground">Top Reject Reasons & Vendor Performance Analytics</p>
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
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/worklist">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Worklist
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="px-6 py-3 bg-muted/50 border-t border-border">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plant</Label>
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger className="w-[160px] h-9 bg-background">
                  <SelectValue placeholder="All Plants" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">All Plants</SelectItem>
                  {plants.map(plant => (
                    <SelectItem key={plant} value={plant}>{plant}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] h-9 bg-background">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">All Months</SelectItem>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] h-9 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] h-9 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <Filter className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Top KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total MRBs</CardTitle>
              <ClipboardList className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.totalMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpis.openMRBs} open</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.rejectedMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.totalMRBs > 0 ? Math.round((kpis.rejectedMRBs / kpis.totalMRBs) * 100) : 0}% rejection rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Breaches</CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.slaRed}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpis.slaYellow} at risk</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle>
              <CheckCircle className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.closedMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. {kpis.avgPendingDays}d pending</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Pending</CardTitle>
              <Users className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.myPending}</p>
              <p className="text-xs text-muted-foreground mt-1">As {roleDisplayName}</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Reject Reasons Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Reject Reasons - Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-destructive" />
                Top Reject Reasons
              </CardTitle>
              <CardDescription>Most common defect categories causing rejections</CardDescription>
            </CardHeader>
            <CardContent>
              {topRejectReasons.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRejectReasons} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="code" type="category" width={80} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name, props) => [value, props.payload.description]}
                      />
                      <Bar dataKey="count" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No rejection data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Defect Category Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                Defect Category Distribution
              </CardTitle>
              <CardDescription>Breakdown by defect type</CardDescription>
            </CardHeader>
            <CardContent>
              {defectCategoryData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={defectCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {defectCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No defect data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reject Reasons by Plant & Month */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By Plant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" />
                Reject Reasons by Plant
              </CardTitle>
              <CardDescription>Defect distribution across plants</CardDescription>
            </CardHeader>
            <CardContent>
              {rejectReasonsByPlant.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rejectReasonsByPlant}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="plant" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="dimensional" name="Dimensional" stackId="a" fill={CHART_COLORS[0]} />
                      <Bar dataKey="surface" name="Surface" stackId="a" fill={CHART_COLORS[1]} />
                      <Bar dataKey="material" name="Material" stackId="a" fill={CHART_COLORS[2]} />
                      <Bar dataKey="functional" name="Functional" stackId="a" fill={CHART_COLORS[3]} />
                      <Bar dataKey="documentation" name="Documentation" stackId="a" fill={CHART_COLORS[4]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No plant rejection data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Month - Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-warning" />
                Reject Trend by Month
              </CardTitle>
              <CardDescription>Monthly rejection pattern</CardDescription>
            </CardHeader>
            <CardContent>
              {rejectReasonsByMonth.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rejectReasonsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="dimensional" name="Dimensional" stackId="1" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="surface" name="Surface" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="material" name="Material" stackId="1" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="functional" name="Functional" stackId="1" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No monthly data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Vendors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-destructive" />
              Top 5 Vendors with Material Damage
            </CardTitle>
            <CardDescription>Vendors with highest rejection/damage incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {topVendorsByDamage.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Vendor Table */}
                <div className="space-y-3">
                  {topVendorsByDamage.map((vendor, index) => (
                    <div key={vendor.vendorCode} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      >
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{vendor.vendorName}</p>
                        <p className="text-xs text-muted-foreground">{vendor.vendorCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{vendor.count} MRBs</p>
                        <p className="text-xs text-destructive">{vendor.rejectedQuantity} units rejected</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vendor Pie Chart */}
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={topVendorsByDamage.map(v => ({ name: v.vendorName.split(' ')[0], value: v.count }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {topVendorsByDamage.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No vendor damage data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor Damage by Month & Plant */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By Month - Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Vendor Damage Trend (Monthly)
              </CardTitle>
              <CardDescription>Top 5 vendors damage trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              {vendorDamageByMonth.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vendorDamageByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      {topVendorsByDamage.slice(0, 5).map((vendor, index) => (
                        <Line 
                          key={vendor.vendorCode}
                          type="monotone" 
                          dataKey={vendor.vendorName.split(' ')[0]} 
                          stroke={CHART_COLORS[index]} 
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS[index] }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No monthly vendor data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Plant - Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-secondary" />
                Vendor Damage by Plant
              </CardTitle>
              <CardDescription>Distribution across plant locations</CardDescription>
            </CardHeader>
            <CardContent>
              {vendorDamageByPlant.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorDamageByPlant}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="plant" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      {topVendorsByDamage.slice(0, 3).map((vendor, index) => (
                        <Bar 
                          key={vendor.vendorCode}
                          dataKey={vendor.vendorName} 
                          fill={CHART_COLORS[index]} 
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No plant vendor data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SLA Status */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>SLA Status Distribution</CardTitle>
              <CardDescription>Current SLA compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={slaChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
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

          {/* Quick Actions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Navigate to key areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
                  <Link to="/worklist">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <span className="text-xs">Worklist</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
                  <Link to="/inward/report">
                    <Package className="w-5 h-5 text-secondary" />
                    <span className="text-xs">Inward Report</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
                  <Link to="/inward/worklist">
                    <FileText className="w-5 h-5 text-warning" />
                    <span className="text-xs">Inward Worklist</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
                  <Link to="/emails">
                    <Activity className="w-5 h-5 text-info" />
                    <span className="text-xs">Email Log</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
