// Inward Report Types for MRB Inward Module

export interface InspectionLotRecord {
  id: string;
  inspectionLot: string;
  materialCode: string;
  materialDescription: string;
  plant: string;
  storageLocation: string;
  batch: string;
  blockedQuantity: number;
  transactionQuantity: number;
  uom: string;
  inspectionLotCreatedDate: string;
  postingDate: string;
  blockReason: string;
  vendorCode: string;
  vendorName: string;
  purchaseOrderNumber: string;
}

export interface InwardReportFilters {
  plants: string[];
  materialCodes: string[];
  vendors: string[];
  storageLocations: string[];
  inspectionLots: string[];
}

export type NextReviewDepartment = 'engineering' | 'purchase' | 'plant_head' | 'mrb_committee';

export type InwardQualityDecision = 'accept' | 'reject' | 'accept_with_deviation';

export type InwardDefectCategory = 'electrical' | 'mechanical';

export interface InwardMRBFormData {
  // Auto-populated (read-only)
  inspectionLot: string;
  materialCode: string;
  materialDescription: string;
  plant: string;
  storageLocation: string;
  batch: string;
  blockedQuantity: number;
  transactionQuantity: number;
  uom: string;
  blockReason: string;
  vendorCode: string;
  vendorName: string;
  purchaseOrderNumber: string;
  
  // Quality Inspection Input
  qualityDecision: InwardQualityDecision | '';
  defectCategory: InwardDefectCategory | '';
  defectDescription: string;
  qualityInspectionComments: string;
  qualityInspectionDate: string;
  qualityInspectorName: string;
  
  // Next Review Department
  nextReviewDepartment: NextReviewDepartment | '';
}

export interface DepartmentReviewData {
  reviewComments: string;
  action: 'approve' | 'return_for_clarification' | 'approve_with_deviation' | 'return_to_vendor' | '';
  forwardToNext: boolean;
  nextDepartment?: NextReviewDepartment;
}
