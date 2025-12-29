// User Roles
export type UserRole = 'quality' | 'purchase' | 'engineering' | 'plant_head' | 'shop_floor';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  plant: string;
}

// MRB Status
export type MRBStatus = 
  | 'draft'
  | 'quality_review'
  | 'purchase_review'
  | 'engineering_review'
  | 'final_approval'
  | 'approved'
  | 'rejected'
  | 'closed';

// MRB Source
export type MRBSource = 'quality_inspection' | 'shop_floor';

// Quality Decisions
export type QualityDecision = 'accept' | 'reject' | 'partial_accept' | 'blocked';

// Engineering Decisions
export type EngineeringDecision = 
  | 'use_as_is'
  | 'use_with_deviation'
  | 'rework_required'
  | 'return_to_vendor'
  | 'scrap_material';

// Defect Categories
export type DefectCategory = 
  | 'dimensional'
  | 'surface'
  | 'material'
  | 'functional'
  | 'documentation'
  | 'packaging'
  | 'other';

// SLA Status
export type SLAStatus = 'green' | 'yellow' | 'red';

// Escalation Level
export type EscalationLevel = 'none' | 'L1' | 'L2' | 'L3';

// Attachment Types
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  category: AttachmentCategory;
}

export type AttachmentCategory = 
  | 'inspection_report'
  | 'test_results'
  | 'photos'
  | 'specifications'
  | 'vendor_communication'
  | 'vendor_response'
  | 'commercial_documents'
  | 'engineering_notes'
  | 'deviation_documents'
  | 'drawings'
  | 'final_approval_document'
  | 'deviation_letter'
  | 'committee_notes'
  | 'shop_floor_images'
  | 'failure_evidence'
  | 'operator_notes'
  | 'other';

// Email Log
export interface EmailLog {
  id: string;
  mrbId: string;
  mrbNumber: string;
  subject: string;
  recipients: string[];
  cc?: string[];
  template: EmailTemplate;
  sentAt: string;
  sentBy: string;
  status: 'sent' | 'pending' | 'failed';
  body?: string;
}

export type EmailTemplate = 
  | 'quality_to_engineering'
  | 'quality_to_purchase'
  | 'purchase_to_vendor'
  | 'engineering_decision'
  | 'final_approval'
  | 'escalation_l1'
  | 'escalation_l2'
  | 'sla_warning'
  | 'mrb_closure';

// Approval History
export interface ApprovalHistoryItem {
  id: string;
  stage: string;
  action: 'approved' | 'rejected' | 'forwarded' | 'returned';
  performedBy: string;
  performedByRole: UserRole;
  performedAt: string;
  remarks?: string;
}

// Main MRB Record
export interface MRBRecord {
  id: string;
  mrbNumber: string;
  status: MRBStatus;
  source: MRBSource;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  pendingWith: UserRole;
  pendingDays: number;
  slaStatus: SLAStatus;
  escalationLevel: EscalationLevel;
  
  // Material Info
  materialNumber: string;
  materialDescription: string;
  plant: string;
  vendor: string;
  vendorName: string;
  
  // GRN/Inspection Info
  grnNumber?: string;
  inspectionLot?: string;
  poNumber?: string;
  
  // Quantities
  totalQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  blockedQuantity: number;
  uom: string;
  
  // Quality Stage
  qualityDecision?: QualityDecision;
  defectCategory?: DefectCategory;
  defectCode?: string;
  defectDescription?: string;
  qualityRemarks?: string;
  qualityApprovedBy?: string;
  qualityApprovedAt?: string;
  
  // Purchase Stage
  vendorResponsibility?: string;
  purchaseAction?: string;
  vendorReplacementRequired?: boolean;
  expectedReplacementDate?: string;
  purchaseRemarks?: string;
  purchaseApprovedBy?: string;
  purchaseApprovedAt?: string;
  
  // Engineering Stage
  engineeringDecision?: EngineeringDecision;
  engineeringRemarks?: string;
  technicalReferenceNumber?: string;
  engineeringApprovedBy?: string;
  engineeringApprovedAt?: string;
  
  // Final Approval Stage
  finalDecision?: 'approved' | 'rejected';
  finalApprovedQuantity?: number;
  finalRejectedQuantity?: number;
  deviationApprovalNumber?: string;
  deviationValidityDate?: string;
  finalRemarks?: string;
  finalApprovedBy?: string;
  finalApprovedAt?: string;
  
  // SAP Posting
  sapStockUpdateStatus?: 'pending' | 'posted' | 'failed';
  returnDeliveryNumber?: string;
  reworkOrderNumber?: string;
  scrapDocumentNumber?: string;
  
  // Closure
  closureStatus?: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  
  // Shop Floor Specific
  productionOrderNumber?: string;
  issuedQuantity?: number;
  issueIdentifiedBy?: string;
  issueIdentifiedDate?: string;
  issueDescription?: string;
  impactOnProduction?: string;
  immediateBlockRequired?: boolean;
  deviationRequested?: boolean;
  
  // Attachments
  attachments: Attachment[];
  
  // History
  approvalHistory: ApprovalHistoryItem[];
}

// Filter State
export interface MRBFilters {
  status?: MRBStatus[];
  source?: MRBSource[];
  plant?: string[];
  vendor?: string[];
  slaStatus?: SLAStatus[];
  escalationLevel?: EscalationLevel[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalMRBs: number;
  pendingReviews: number;
  slaBreaches: number;
  closedThisMonth: number;
  byStatus: Record<MRBStatus, number>;
  byRole: Record<UserRole, number>;
  avgResolutionDays: number;
}
