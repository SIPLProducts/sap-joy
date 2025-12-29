import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { useMRB } from '@/contexts/MRBContext';
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
import { MRBStatus } from '@/types/mrb';

const statuses: MRBStatus[] = ['draft', 'quality_review', 'purchase_review', 'engineering_review', 'final_approval', 'approved', 'rejected', 'closed'];

export default function Worklist() {
  const { mrbRecords, filters, setFilters } = useMRB();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRecords = mrbRecords.filter(mrb => {
    const matchesSearch = !searchTerm || 
      mrb.mrbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mrb.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || mrb.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">MRB Worklist</h1>
        <p className="text-muted-foreground">View and manage all Material Review Board records</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>All MRB Records ({filteredRecords.length})</CardTitle>
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
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRB Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Pending With</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((mrb) => (
                  <TableRow key={mrb.id} className={mrb.escalationLevel !== 'none' ? 'bg-red-50/50' : ''}>
                    <TableCell className="font-medium">
                      <Link to={`/mrb/${mrb.id}`} className="text-primary hover:underline">
                        {mrb.mrbNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(mrb.status)}>
                        {getStatusDisplayName(mrb.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{mrb.materialNumber}</p>
                        <p className="text-xs text-muted-foreground">{mrb.materialDescription}</p>
                      </div>
                    </TableCell>
                    <TableCell>{mrb.vendorName}</TableCell>
                    <TableCell>{mrb.plant}</TableCell>
                    <TableCell>{getRoleDisplayName(mrb.pendingWith)}</TableCell>
                    <TableCell>
                      <Badge className={getSLAColor(mrb.slaStatus)}>
                        {mrb.pendingDays} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mrb.escalationLevel !== 'none' && (
                        <Badge className={`${getEscalationColor(mrb.escalationLevel)} animate-pulse-slow`}>
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {mrb.escalationLevel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/mrb/${mrb.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
