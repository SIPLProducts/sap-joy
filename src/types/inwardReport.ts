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

export type NextReviewDepartment = 'engineering' | 'purchase' | 'plant_head' | 'quality_head' | 'mrb_committee';

export type InwardQualityDecision = 
  | 'accept' 
  | 'reject' 
  | 'partial_accept' 
  | 'accept_with_deviation' 
  | 'hold_for_review' 
  | 'rework_required' 
  | 'return_to_vendor' 
  | 'conditional_release';

export type InwardDefectCategory = 
  | 'dimensional' 
  | 'surface' 
  | 'material' 
  | 'functional' 
  | 'electrical' 
  | 'mechanical' 
  | 'documentation' 
  | 'packaging' 
  | 'labeling' 
  | 'contamination' 
  | 'quantity' 
  | 'other';

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
  
  // Next Review Department(s) - supports multiple selection
  nextReviewDepartments: NextReviewDepartment[];
}

export interface DepartmentReviewData {
  reviewComments: string;
  action: 'approve' | 'return_for_clarification' | 'approve_with_deviation' | 'return_to_vendor' | '';
  forwardToNext: boolean;
  nextDepartments?: NextReviewDepartment[];
}
