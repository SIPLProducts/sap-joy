// Shop Floor Stock Data - types and constants only (no mock data)

export interface AvailableStockRecord {
  id: string;
  plant: string;
  materialCode: string;
  materialDescription: string;
  batch: string;
  storageLocation: string;
  availableQuantity: number;
  uom: string;
  vendorCode?: string;
  vendorName?: string;
  grnNo?: string;
  grnItem?: string;
  grnDate?: string;
}

// Block reasons for shop floor
export const shopFloorBlockReasons = [
  'Dimensional Mismatch',
  'Material Quality Issue',
  'Surface Defect',
  'Functional Failure',
  'Wrong Specification',
  'Damage During Handling',
  'Assembly Issue',
  'Documentation Mismatch',
  'Other',
];

// Next review departments
export const shopFloorNextDepartments: { value: string; label: string }[] = [
  { value: 'quality', label: 'Quality' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'plant_head', label: 'Plant Head' },
  { value: 'mrb_committee', label: 'MRB Committee' },
];

// Attachment categories for shop floor
export const shopFloorAttachmentCategories = [
  { value: 'shop_floor_images', label: 'Shop Floor Image' },
  { value: 'failure_evidence', label: 'Failure Evidence' },
  { value: 'operator_notes', label: 'Operator Notes' },
];
