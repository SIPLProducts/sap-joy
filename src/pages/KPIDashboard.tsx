import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
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
  const { profile } = useAuth();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Derive plants from real MRB data
  const plants = useMemo(() => [...new Set(mrbRecords.map(r => r.plant))], [mrbRecords]);
  
  // Filters State - must be declared before any conditional returns
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
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

    // Filter by source (shop_floor / quality_inspection)
    if (selectedSource !== 'all') {
      filtered = filtered.filter(mrb => mrb.source === selectedSource);
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
  }, [allMRBs, selectedPlant, selectedSource, selectedMonth, dateFrom, dateTo]);


  // Calculate KPIs based on filtered data
  const kpis = useMemo(() => {
    // Basic Counts
    const totalMRBs = filteredMRBs.length;
    const shopFloorMRBs = filteredMRBs.filter(mrb => mrb.source === 'shop_floor').length;
    const inwardMRBs = filteredMRBs.filter(mrb => mrb.source === 'quality_inspection').length;
    const openMRBs = filteredMRBs.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');
    const closedMRBs = filteredMRBs.filter(mrb => mrb.closure_status === 'closed' || mrb.status === 'closed');
    const approvedMRBs = filteredMRBs.filter(mrb => mrb.status === 'approved');
    const rejectedMRBs = filteredMRBs.filter(mrb => mrb.quality_decision === 'reject' || mrb.status === 'rejected');
    const acceptedMRBs = filteredMRBs.filter(mrb => mrb.quality_decision === 'accept' || mrb.quality_decision === 'partial_accept');
    const pendingMRBs = filteredMRBs.filter(mrb => mrb.status !== 'closed' && mrb.status !== 'approved' && mrb.status !== 'rejected');

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
      shopFloorMRBs,
      inwardMRBs,
      openMRBs: openMRBs.length,
      closedMRBs: closedMRBs.length,
      approvedMRBs: approvedMRBs.length,
      rejectedMRBs: rejectedMRBs.length,
      acceptedMRBs: acceptedMRBs.length,
      pendingMRBs: pendingMRBs.length,
      slaGreen,
      slaYellow,
      slaRed,
      myPending,
      avgPendingDays,
    };
  }, [filteredMRBs, currentRole]);

  // Top Reject Reasons Analysis – uses live defect_description from mrb_records
  const topRejectReasons = useMemo(() => {
    const reasonCounts: Record<string, { count: number; description: string; damageQty: number }> = {};
    
    filteredMRBs.forEach(mrb => {
      const damageQty = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      if (damageQty <= 0) return; // only count records with actual damage

      // Use the most specific label available from the live record
      const reason = (mrb.defect_description || mrb.defect_category || mrb.defect_code || 'Not specified').trim();
      const shortLabel = reason.length > 30 ? reason.substring(0, 28) + '…' : reason;

      if (!reasonCounts[shortLabel]) {
        reasonCounts[shortLabel] = { count: 0, description: reason, damageQty: 0 };
      }
      reasonCounts[shortLabel].count++;
      reasonCounts[shortLabel].damageQty += damageQty;
    });

    return Object.entries(reasonCounts)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.damageQty - a.damageQty || b.count - a.count)
      .slice(0, 10);
  }, [filteredMRBs]);

  // Reject Reasons by Plant
  const rejectReasonsByPlant = useMemo(() => {
    const plantData: Record<string, Record<string, number>> = {};
    
    filteredMRBs.forEach(mrb => {
      const damageQty = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      if (damageQty <= 0) return;

      const plant = mrb.plant;
      const reason = mrb.defect_description || mrb.defect_category || 'Not specified';
      const shortReason = reason.length > 20 ? reason.substring(0, 18) + '…' : reason;
      
      if (!plantData[plant]) {
        plantData[plant] = {};
      }
      plantData[plant][shortReason] = (plantData[plant][shortReason] || 0) + 1;
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
      const damageQty = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      if (damageQty <= 0 || !mrb.created_at) return;

      const month = format(parseISO(mrb.created_at), 'MMM yyyy');
      const reason = mrb.defect_description || mrb.defect_category || 'Not specified';
      const shortReason = reason.length > 20 ? reason.substring(0, 18) + '…' : reason;
      
      if (!monthData[month]) {
        monthData[month] = {};
      }
      monthData[month][shortReason] = (monthData[month][shortReason] || 0) + 1;
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
      const damageQuantity = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      const vendor = (mrb.vendor_name || mrb.vendor_code || '').trim();
      if (damageQuantity <= 0 || !vendor) return;

      const plant = mrb.plant;
      
      if (!plantData[plant]) {
        plantData[plant] = { plant, vendors: {} };
      }
      plantData[plant].vendors[vendor] = (plantData[plant].vendors[vendor] || 0) + damageQuantity;
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

  // Defect Category Distribution – uses live defect_description when defect_category is null
  const defectCategoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    
    filteredMRBs.forEach(mrb => {
      const damageQty = Number(mrb.rejected_quantity || 0) + Number(mrb.blocked_quantity || 0);
      if (damageQty <= 0) return;

      const label = mrb.defect_category || mrb.defect_description || 'Not specified';
      const shortLabel = label.length > 25 ? label.substring(0, 23) + '…' : label;
      categories[shortLabel] = (categories[shortLabel] || 0) + 1;
    });

    const sorted = Object.entries(categories)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
      .sort((a, b) => b.value - a.value);

    // Show top 8, group rest as "Others"
    if (sorted.length > 8) {
      const top = sorted.slice(0, 8);
      const othersValue = sorted.slice(8).reduce((sum, item) => sum + item.value, 0);
      return [...top, { name: 'Others', value: othersValue }];
    }
    return sorted;
  }, [filteredMRBs]);

  // SLA Chart Data
  const slaChartData = [
    { name: 'On Track', value: kpis.slaGreen, color: 'hsl(142, 70%, 45%)' },
    { name: 'At Risk', value: kpis.slaYellow, color: 'hsl(45, 93%, 47%)' },
    { name: 'Breached', value: kpis.slaRed, color: 'hsl(0, 72%, 51%)' },
  ];

  const clearFilters = () => {
    setSelectedPlant('all');
    setSelectedSource('all');
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
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-[160px] h-9 bg-background">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="shop_floor">Shop Floor</SelectItem>
                  <SelectItem value="quality_inspection">Inward</SelectItem>
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
        {/* Welcome Card */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Welcome back, {profile?.full_name || 'User'}! 👋
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Plant: {profile?.plant || 'All Plants'}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="text-center px-4 py-2 bg-background/80 rounded-lg border border-border">
                  <p className="text-lg font-bold text-foreground">{kpis.shopFloorMRBs}</p>
                  <p className="text-[10px] text-muted-foreground">Shop Floor</p>
                </div>
                <div className="text-center px-4 py-2 bg-background/80 rounded-lg border border-border">
                  <p className="text-lg font-bold text-foreground">{kpis.inwardMRBs}</p>
                  <p className="text-[10px] text-muted-foreground">Inward</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total MRBs</CardTitle>
              <ClipboardList className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.totalMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpis.shopFloorMRBs} shop floor • {kpis.inwardMRBs} inward</p>
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

          <Card className="bg-gradient-to-br from-accent/30 to-accent/10 border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
              <ShieldCheck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.acceptedMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.totalMRBs > 0 ? Math.round((kpis.acceptedMRBs / kpis.totalMRBs) * 100) : 0}% acceptance rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.pendingMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. {kpis.avgPendingDays}d</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <CheckCircle className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.approvedMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">Final approved</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-muted to-muted/50 border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{kpis.closedMRBs}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
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
                <div style={{ height: Math.max(300, defectCategoryData.length * 38) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={defectCategoryData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tick={{ fill: 'hsl(var(--foreground))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} barSize={20}>
                        {defectCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
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
                      {(() => {
                        const allKeys = new Set<string>();
                        rejectReasonsByPlant.forEach(d => Object.keys(d).forEach(k => { if (k !== 'plant' && k !== 'total') allKeys.add(k); }));
                        return [...allKeys].slice(0, 8).map((key, i) => (
                          <Bar key={key} dataKey={key} name={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ));
                      })()}
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
                      {(() => {
                        const allKeys = new Set<string>();
                        rejectReasonsByMonth.forEach(d => Object.keys(d).forEach(k => { if (k !== 'month' && k !== 'total') allKeys.add(k); }));
                        return [...allKeys].slice(0, 8).map((key, i) => (
                          <Area key={key} type="monotone" dataKey={key} name={key} stackId="1" stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.6} />
                        ));
                      })()}
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
                          <p className="font-bold text-foreground">{vendor.damageQuantity} units</p>
                          <p className="text-xs text-muted-foreground">{vendor.count} live MRBs</p>
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
