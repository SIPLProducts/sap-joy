import React, { createContext, useContext, useState, ReactNode } from 'react';
import { InspectionLotRecord, InwardReportFilters, InwardMRBFormData, DepartmentReviewData } from '@/types/inwardReport';
import { MRBRecord, EmailLog, Attachment } from '@/types/mrb';
import { mockInspectionLotRecords } from '@/data/inwardReportData';

interface InwardMRBRecord extends MRBRecord {
  qualityInspectionComments?: string;
  qualityInspectionDate?: string;
  qualityInspectorName?: string;
  nextReviewDepartment?: string;
  storageLocation?: string;
  batch?: string;
  blockReason?: string;
  departmentReviews?: {
    department: string;
    reviewComments: string;
    action: string;
    reviewedBy: string;
    reviewedAt: string;
    attachments: Attachment[];
  }[];
}

interface InwardMRBContextType {
  inspectionLotRecords: InspectionLotRecord[];
  inwardMRBRecords: InwardMRBRecord[];
  emailLogs: EmailLog[];
  filters: InwardReportFilters;
  setFilters: (filters: InwardReportFilters) => void;
  getFilteredRecords: () => InspectionLotRecord[];
  createInwardMRB: (formData: InwardMRBFormData, attachments: Attachment[]) => InwardMRBRecord;
  getInwardMRBById: (id: string) => InwardMRBRecord | undefined;
  updateInwardMRB: (id: string, updates: Partial<InwardMRBRecord>) => void;
  addDepartmentReview: (mrbId: string, review: DepartmentReviewData, attachments: Attachment[], reviewerName: string) => void;
  addEmailLog: (log: EmailLog) => void;
  getNextMRBNumber: () => string;
}

const InwardMRBContext = createContext<InwardMRBContextType | undefined>(undefined);

export function InwardMRBProvider({ children }: { children: ReactNode }) {
  const [inspectionLotRecords] = useState<InspectionLotRecord[]>(mockInspectionLotRecords);
  const [inwardMRBRecords, setInwardMRBRecords] = useState<InwardMRBRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [filters, setFilters] = useState<InwardReportFilters>({
    plants: [],
    materialCodes: [],
    vendors: [],
    storageLocations: [],
    inspectionLots: [],
  });

  const getFilteredRecords = (): InspectionLotRecord[] => {
    let filtered = [...inspectionLotRecords];

    if (filters.plants.length > 0) {
      filtered = filtered.filter(r => filters.plants.includes(r.plant));
    }
    if (filters.materialCodes.length > 0) {
      filtered = filtered.filter(r => filters.materialCodes.includes(r.materialCode));
    }
    if (filters.vendors.length > 0) {
      filtered = filtered.filter(r => filters.vendors.includes(r.vendorCode));
    }
    if (filters.storageLocations.length > 0) {
      filtered = filtered.filter(r => filters.storageLocations.includes(r.storageLocation));
    }
    if (filters.inspectionLots.length > 0) {
      filtered = filtered.filter(r => filters.inspectionLots.includes(r.inspectionLot));
    }

    return filtered;
  };

  const getNextMRBNumber = (): string => {
    const year = new Date().getFullYear();
    const existingNumbers = inwardMRBRecords
      .filter(mrb => mrb.mrbNumber.startsWith(`MRB-${year}`))
      .map(mrb => {
        const num = parseInt(mrb.mrbNumber.split('-')[2], 10);
        return isNaN(num) ? 0 : num;
      });
    const maxNumber = Math.max(0, ...existingNumbers);
    return `MRB-${year}-${String(maxNumber + 1).padStart(4, '0')}`;
  };

  const createInwardMRB = (formData: InwardMRBFormData, attachments: Attachment[]): InwardMRBRecord => {
    const mrbNumber = getNextMRBNumber();
    const now = new Date().toISOString();
    
    // Map next review department to pending role
    const pendingWithMap: Record<string, 'engineering' | 'purchase' | 'plant_head' | 'quality'> = {
      'engineering': 'engineering',
      'purchase': 'purchase',
      'plant_head': 'plant_head',
      'mrb_committee': 'plant_head',
    };

    const newMRB: InwardMRBRecord = {
      id: `INWARD-${Date.now()}`,
      mrbNumber,
      status: 'quality_review',
      source: 'quality_inspection',
      createdAt: now,
      createdBy: formData.qualityInspectorName || 'Quality User',
      updatedAt: now,
      pendingWith: pendingWithMap[formData.nextReviewDepartment] || 'engineering',
      pendingDays: 0,
      slaStatus: 'green',
      escalationLevel: 'none',
      
      // Material Info from form
      materialNumber: formData.materialCode,
      materialDescription: formData.materialDescription,
      plant: formData.plant,
      vendor: formData.vendorCode,
      vendorName: formData.vendorName,
      
      // Additional Inward fields
      inspectionLot: formData.inspectionLot,
      poNumber: formData.purchaseOrderNumber,
      storageLocation: formData.storageLocation,
      batch: formData.batch,
      blockReason: formData.blockReason,
      
      // Quantities
      totalQuantity: formData.transactionQuantity,
      acceptedQuantity: formData.qualityDecision === 'accept' ? formData.transactionQuantity : 0,
      rejectedQuantity: formData.qualityDecision === 'reject' ? formData.blockedQuantity : 0,
      blockedQuantity: formData.blockedQuantity,
      uom: formData.uom,
      
      // Quality Stage
      qualityDecision: formData.qualityDecision === 'accept' ? 'accept' : 
                       formData.qualityDecision === 'reject' ? 'reject' : 'partial_accept',
      defectCategory: formData.defectCategory === 'electrical' ? 'functional' : 
                      formData.defectCategory === 'mechanical' ? 'dimensional' : undefined,
      defectDescription: formData.defectDescription,
      qualityRemarks: formData.qualityInspectionComments,
      qualityApprovedBy: formData.qualityInspectorName,
      qualityApprovedAt: now,
      
      // Inward-specific fields
      qualityInspectionComments: formData.qualityInspectionComments,
      qualityInspectionDate: formData.qualityInspectionDate,
      qualityInspectorName: formData.qualityInspectorName,
      nextReviewDepartment: formData.nextReviewDepartment,
      
      attachments,
      approvalHistory: [
        {
          id: `AH-${Date.now()}`,
          stage: 'Quality Inspection',
          action: 'forwarded',
          performedBy: formData.qualityInspectorName || 'Quality User',
          performedByRole: 'quality',
          performedAt: now,
          remarks: `Forwarded to ${formData.nextReviewDepartment}`,
        },
      ],
      departmentReviews: [],
    };

    setInwardMRBRecords(prev => [newMRB, ...prev]);
    return newMRB;
  };

  const getInwardMRBById = (id: string): InwardMRBRecord | undefined => {
    return inwardMRBRecords.find(mrb => mrb.id === id);
  };

  const updateInwardMRB = (id: string, updates: Partial<InwardMRBRecord>) => {
    setInwardMRBRecords(prev =>
      prev.map(mrb =>
        mrb.id === id
          ? { ...mrb, ...updates, updatedAt: new Date().toISOString() }
          : mrb
      )
    );
  };

  const addDepartmentReview = (
    mrbId: string, 
    review: DepartmentReviewData, 
    attachments: Attachment[], 
    reviewerName: string
  ) => {
    const mrb = getInwardMRBById(mrbId);
    if (!mrb) return;

    const now = new Date().toISOString();
    const departmentReview = {
      department: mrb.pendingWith,
      reviewComments: review.reviewComments,
      action: review.action,
      reviewedBy: reviewerName,
      reviewedAt: now,
      attachments,
    };

    const statusMap: Record<string, 'approved' | 'rejected' | 'forwarded' | 'returned'> = {
      'approve': 'approved',
      'return_for_clarification': 'returned',
      'approve_with_deviation': 'approved',
      'return_to_vendor': 'approved',
    };

    const newHistoryItem = {
      id: `AH-${Date.now()}`,
      stage: `${mrb.pendingWith} Review`,
      action: statusMap[review.action] || 'approved',
      performedBy: reviewerName,
      performedByRole: mrb.pendingWith,
      performedAt: now,
      remarks: review.reviewComments,
    };

    const updates: Partial<InwardMRBRecord> = {
      departmentReviews: [...(mrb.departmentReviews || []), departmentReview],
      approvalHistory: [...mrb.approvalHistory, newHistoryItem],
      attachments: [...mrb.attachments, ...attachments],
    };

    // Update status based on action
    if (review.forwardToNext && review.nextDepartment) {
      const pendingWithMap: Record<string, 'engineering' | 'purchase' | 'plant_head' | 'quality'> = {
        'engineering': 'engineering',
        'purchase': 'purchase',
        'plant_head': 'plant_head',
        'mrb_committee': 'plant_head',
      };
      updates.pendingWith = pendingWithMap[review.nextDepartment];
      updates.status = review.nextDepartment === 'plant_head' || review.nextDepartment === 'mrb_committee' 
        ? 'final_approval' 
        : review.nextDepartment === 'engineering' 
          ? 'engineering_review' 
          : 'purchase_review';
    } else if (review.action === 'approve' || review.action === 'approve_with_deviation' || review.action === 'return_to_vendor') {
      updates.status = 'final_approval';
      updates.pendingWith = 'plant_head';
    }

    updateInwardMRB(mrbId, updates);
  };

  const addEmailLog = (log: EmailLog) => {
    setEmailLogs(prev => [log, ...prev]);
  };

  return (
    <InwardMRBContext.Provider
      value={{
        inspectionLotRecords,
        inwardMRBRecords,
        emailLogs,
        filters,
        setFilters,
        getFilteredRecords,
        createInwardMRB,
        getInwardMRBById,
        updateInwardMRB,
        addDepartmentReview,
        addEmailLog,
        getNextMRBNumber,
      }}
    >
      {children}
    </InwardMRBContext.Provider>
  );
}

export function useInwardMRB() {
  const context = useContext(InwardMRBContext);
  if (context === undefined) {
    throw new Error('useInwardMRB must be used within an InwardMRBProvider');
  }
  return context;
}
