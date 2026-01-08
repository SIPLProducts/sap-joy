import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Eye } from 'lucide-react';
import { useMRB } from '@/contexts/MRBContext';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStatusDisplayName, getStatusColor, getSLAColor, getEscalationColor, getRoleDisplayName } from '@/data/mockData';
import { MRBStatus, UserRole, SLAStatus, EscalationLevel } from '@/types/mrb';

const statuses: MRBStatus[] = ['draft', 'quality_review', 'purchase_review', 'engineering_review', 'final_approval', 'approved', 'rejected', 'closed'];

type SourceType = 'all' | 'inward' | 'shop_floor';

interface UnifiedMRBRecord {
  id: string;
  mrbNumber: string;
  status: MRBStatus;
  materialNumber: string;
  materialDescription: string;
  vendorName: string;
  plant: string;
  pendingWith: UserRole;
  pendingDays: number;
  slaStatus: SLAStatus;
  escalationLevel: EscalationLevel;
  createdAt: string;
  source: 'inward' | 'shop_floor';
}

export default function Worklist() {
  const navigate = useNavigate();
  const { mrbRecords } = useMRB();
  const { inwardMRBRecords } = useInwardMRB();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');

  // Combine both MRB sources into unified records
  const unifiedRecords: UnifiedMRBRecord[] = [
    // Shop Floor MRBs (from MRBContext)
    ...mrbRecords.map(mrb => ({
      id: mrb.id,
      mrbNumber: mrb.mrbNumber,
      status: mrb.status,
      materialNumber: mrb.materialNumber,
      materialDescription: mrb.materialDescription,
      vendorName: mrb.vendorName,
      plant: mrb.plant,
      pendingWith: mrb.pendingWith as UserRole,
      pendingDays: mrb.pendingDays,
      slaStatus: mrb.slaStatus as SLAStatus,
      escalationLevel: mrb.escalationLevel as EscalationLevel,
      createdAt: mrb.createdAt,
      source: 'shop_floor' as const,
    })),
    // Inward MRBs (from InwardMRBContext)
    ...inwardMRBRecords.map(mrb => ({
      id: mrb.id,
      mrbNumber: mrb.mrbNumber,
      status: mrb.status,
      materialNumber: mrb.materialNumber,
      materialDescription: mrb.materialDescription,
      vendorName: mrb.vendorName,
      plant: mrb.plant,
      pendingWith: mrb.pendingWith as UserRole,
      pendingDays: mrb.pendingDays || 0,
      slaStatus: mrb.slaStatus as SLAStatus,
      escalationLevel: (mrb.escalationLevel || 'none') as EscalationLevel,
      createdAt: mrb.createdAt,
      source: 'inward' as const,
    })),
  ];

  const filteredRecords = unifiedRecords.filter(mrb => {
    const matchesSearch = !searchTerm || 
      mrb.mrbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || mrb.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || mrb.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Sort by created date descending
  const sortedRecords = [...filteredRecords].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSourceBadge = (source: 'inward' | 'shop_floor') => {
    if (source === 'inward') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Inward</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Shop Floor</Badge>;
  };

  const handleViewClick = (mrb: UnifiedMRBRecord) => {
    if (mrb.source === 'inward') {
      navigate(`/inward/mrb/${mrb.id}`);
    } else {
      navigate(`/mrb/${mrb.id}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Sticky Header with Title and Filters */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">MRB Worklist</h1>
          <p className="text-muted-foreground">View and manage all Material Review Board records</p>
        </div>
        
        {/* Filters Section */}
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-foreground">
              All MRB Records ({sortedRecords.length})
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search MRB, material, vendor..."
                  className="pl-9 w-full sm:w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sourceFilter} onValueChange={(val) => setSourceFilter(val as SourceType)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="inward">Inward</SelectItem>
                  <SelectItem value="shop_floor">Shop Floor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusDisplayName(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full rounded-md border bg-background overflow-hidden flex flex-col">
          {/* Table with sticky header */}
          <div className="flex-1 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">MRB Number</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Source</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Material</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Vendor</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Plant</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Pending With</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">SLA</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Created</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Escalation</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sortedRecords.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={11} className="p-4 text-center py-12 text-muted-foreground">
                      No MRB records found matching your criteria
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((mrb) => (
                    <tr 
                      key={`${mrb.source}-${mrb.id}`} 
                      className={`border-b transition-colors hover:bg-muted/50 ${mrb.escalationLevel !== 'none' ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="p-4 align-middle font-medium text-primary whitespace-nowrap">
                        {mrb.mrbNumber}
                      </td>
                      <td className="p-4 align-middle">
                        {getSourceBadge(mrb.source)}
                      </td>
                      <td className="p-4 align-middle">
                        <Badge className={getStatusColor(mrb.status)}>
                          {getStatusDisplayName(mrb.status)}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <div>
                          <p className="font-medium">{mrb.materialNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{mrb.materialDescription}</p>
                        </div>
                      </td>
                      <td className="p-4 align-middle max-w-[120px] truncate">{mrb.vendorName}</td>
                      <td className="p-4 align-middle whitespace-nowrap">{mrb.plant}</td>
                      <td className="p-4 align-middle whitespace-nowrap">{getRoleDisplayName(mrb.pendingWith)}</td>
                      <td className="p-4 align-middle">
                        <Badge className={getSLAColor(mrb.slaStatus)}>
                          {mrb.pendingDays} days
                        </Badge>
                      </td>
                      <td className="p-4 align-middle whitespace-nowrap">
                        {formatDate(mrb.createdAt)}
                      </td>
                      <td className="p-4 align-middle">
                        {mrb.escalationLevel !== 'none' && (
                          <Badge className={`${getEscalationColor(mrb.escalationLevel)} animate-pulse-slow`}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {mrb.escalationLevel}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <Button variant="outline" size="sm" onClick={() => handleViewClick(mrb)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
