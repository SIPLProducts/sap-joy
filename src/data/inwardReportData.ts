// Next Review Departments - typed for multi-select support
import { NextReviewDepartment } from '@/types/inwardReport';

export const nextReviewDepartments: { value: NextReviewDepartment; label: string; description: string }[] = [
  { value: 'engineering', label: 'Engineering', description: 'Technical evaluation and deviation approval' },
  { value: 'purchase', label: 'Purchase', description: 'Vendor coordination and replacement/return' },
  { value: 'plant_head', label: 'Plant Head', description: 'Final approval for critical decisions' },
  { value: 'quality_head', label: 'Quality Head', description: 'Quality escalation and policy decisions' },
  { value: 'mrb_committee', label: 'MRB Committee', description: 'Cross-functional committee for complex decisions' },
];

// Quality Decisions for Inward Inspection
export const inwardQualityDecisions = [
  { value: 'accept', label: 'Accept', description: 'Material meets all specifications', color: 'green' },
  { value: 'reject', label: 'Reject', description: 'Material does not meet specifications - return/scrap required', color: 'red' },
  { value: 'partial_accept', label: 'Partial Accept', description: 'Accept partial quantity, reject remainder', color: 'amber' },
  { value: 'accept_with_deviation', label: 'Accept with Deviation', description: 'Accept with documented deviation approval', color: 'blue' },
  { value: 'hold_for_review', label: 'Hold for Review', description: 'Further investigation required before decision', color: 'orange' },
  { value: 'rework_required', label: 'Rework Required', description: 'Material needs rework before acceptance', color: 'purple' },
  { value: 'return_to_vendor', label: 'Return to Vendor', description: 'Material to be returned for replacement/credit', color: 'red' },
  { value: 'conditional_release', label: 'Conditional Release', description: 'Release for limited use with restrictions', color: 'yellow' },
];

// Defect Categories for Inward
export const inwardDefectCategories = [
  { value: 'dimensional', label: 'Dimensional', description: 'Size, shape, or tolerance issues' },
  { value: 'surface', label: 'Surface Defect', description: 'Scratches, dents, corrosion, finish issues' },
  { value: 'material', label: 'Material Composition', description: 'Wrong material grade or composition' },
  { value: 'functional', label: 'Functional Failure', description: 'Does not perform as specified' },
  { value: 'electrical', label: 'Electrical', description: 'Electrical testing failures' },
  { value: 'mechanical', label: 'Mechanical', description: 'Mechanical testing failures' },
  { value: 'documentation', label: 'Documentation', description: 'Missing or incorrect certificates/documents' },
  { value: 'packaging', label: 'Packaging', description: 'Damaged or inadequate packaging' },
  { value: 'labeling', label: 'Labeling', description: 'Incorrect or missing labels/markings' },
  { value: 'contamination', label: 'Contamination', description: 'Foreign particles or contamination' },
  { value: 'quantity', label: 'Quantity Mismatch', description: 'Quantity different from PO/packing list' },
  { value: 'other', label: 'Other', description: 'Other defect not listed above' },
];

// Block Reasons
export const blockReasons = [
  'Quality Hold - Pending Inspection',
  'Dimensional Non-Conformance',
  'Material Defect',
  'Documentation Missing',
  'Supplier Issue - Investigation Required',
  'Packaging Damage',
  'Functional Test Failure',
];

// Attachment Categories for Inward
export const inwardAttachmentCategories = [
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'test_results', label: 'Test Result Document' },
  { value: 'photos', label: 'Photos / Images' },
  { value: 'specifications', label: 'Specification / Drawing' },
  { value: 'vendor_certificate', label: 'Vendor Certificate' },
  { value: 'material_test_certificate', label: 'Material Test Certificate (MTC)' },
  { value: 'non_conformance_report', label: 'Non-Conformance Report (NCR)' },
  { value: 'deviation_request', label: 'Deviation Request' },
];
