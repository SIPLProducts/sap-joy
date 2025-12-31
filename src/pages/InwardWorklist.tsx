import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useRole } from '@/contexts/RoleContext';
import { getStatusDisplayName, getStatusColor, getSLAColor, getEscalationColor } from '@/data/mockData';

export default function InwardWorklist() {
  const navigate = useNavigate();
  const { inwardMRBRecords } = useInwardMRB();
  const { currentRole } = useRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter records based on role and filters
  const filteredRecords = inwardMRBRecords.filter((mrb) => {
    // Role-based filtering
    if (currentRole !== 'quality' && currentRole !== 'plant_head') {
      if (mrb.pendingWith !== currentRole) {
        return false;
      }
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        mrb.mrbNumber.toLowerCase().includes(searchLower) ||
        mrb.materialNumber.toLowerCase().includes(searchLower) ||
        mrb.materialDescription.toLowerCase().includes(searchLower) ||
        mrb.vendorName.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && mrb.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPendingWithLabel = (pendingWith: string) => {
    const labels: Record<string, string> = {
      quality: 'Quality',
      purchase: 'Purchase',
      engineering: 'Engineering',
      plant_head: 'Plant Head',
    };
    return labels[pendingWith] || pendingWith;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">MRB Inward Worklist</h1>
                <p className="text-sm text-muted-foreground">
                  View and manage MRBs created from Inward Report
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/inward/report')}>
              Go to Inward Report
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6">
        <Card className="border-border shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by MRB, Material, or Vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="quality_review">Quality Review</SelectItem>
                  <SelectItem value="purchase_review">Purchase Review</SelectItem>
                  <SelectItem value="engineering_review">Engineering Review</SelectItem>
                  <SelectItem value="final_approval">Final Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">
              MRB Records ({filteredRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold whitespace-nowrap">MRB Number</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Material</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Description</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Vendor</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Plant</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Pending With</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">SLA</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Created</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        {inwardMRBRecords.length === 0
                          ? 'No MRBs have been created yet. Go to Inward Report to create one.'
                          : 'No records match your search criteria'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((mrb) => (
                      <TableRow key={mrb.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-primary">
                          {mrb.mrbNumber}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(mrb.status)}>
                            {getStatusDisplayName(mrb.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mrb.materialNumber}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {mrb.materialDescription}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {mrb.vendorName}
                        </TableCell>
                        <TableCell>{mrb.plant}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPendingWithLabel(mrb.pendingWith)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSLAColor(mrb.slaStatus)}>
                            {mrb.slaStatus.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(mrb.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/inward/mrb/${mrb.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
