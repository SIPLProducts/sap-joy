import { InspectionLotRecord } from '@/types/inwardReport';

// Helper to generate dates
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

// Storage Locations
export const storageLocations = [
  { code: 'SL01', name: 'Main Warehouse', plant: 'Plant-1000' },
  { code: 'SL02', name: 'Raw Material Store', plant: 'Plant-1000' },
  { code: 'SL03', name: 'Inbound Receiving', plant: 'Plant-2000' },
  { code: 'SL04', name: 'Quality Hold Area', plant: 'Plant-2000' },
  { code: 'SL05', name: 'Inspection Bay', plant: 'Plant-3000' },
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

// Mock Inspection Lot Records for Inward Report
export const mockInspectionLotRecords: InspectionLotRecord[] = [
  {
    id: 'IL-001',
    inspectionLot: 'IL-2024-6001',
    materialCode: 'MAT-001',
    materialDescription: 'Industrial Pipe 4 inch',
    plant: 'Plant-1000',
    storageLocation: 'SL01',
    batch: 'BATCH-2024-001',
    blockedQuantity: 150,
    transactionQuantity: 200,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(3),
    postingDate: daysAgo(2),
    blockReason: 'Quality Hold - Pending Inspection',
    vendorCode: 'V001',
    vendorName: 'ABC Industrial Supplies',
    purchaseOrderNumber: 'PO-2024-4001',
  },
  {
    id: 'IL-002',
    inspectionLot: 'IL-2024-6002',
    materialCode: 'MAT-002',
    materialDescription: 'Gate Valve DN100',
    plant: 'Plant-1000',
    storageLocation: 'SL02',
    batch: 'BATCH-2024-002',
    blockedQuantity: 25,
    transactionQuantity: 50,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(5),
    postingDate: daysAgo(4),
    blockReason: 'Dimensional Non-Conformance',
    vendorCode: 'V004',
    vendorName: 'Global Valve Corp',
    purchaseOrderNumber: 'PO-2024-4002',
  },
  {
    id: 'IL-003',
    inspectionLot: 'IL-2024-6003',
    materialCode: 'MAT-003',
    materialDescription: 'Centrifugal Pump 50HP',
    plant: 'Plant-2000',
    storageLocation: 'SL03',
    batch: 'BATCH-2024-003',
    blockedQuantity: 5,
    transactionQuantity: 5,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(2),
    postingDate: daysAgo(1),
    blockReason: 'Functional Test Failure',
    vendorCode: 'V003',
    vendorName: 'Delta Pump Solutions',
    purchaseOrderNumber: 'PO-2024-4003',
  },
  {
    id: 'IL-004',
    inspectionLot: 'IL-2024-6004',
    materialCode: 'MAT-004',
    materialDescription: 'Electric Motor 30KW',
    plant: 'Plant-2000',
    storageLocation: 'SL04',
    batch: 'BATCH-2024-004',
    blockedQuantity: 10,
    transactionQuantity: 20,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(7),
    postingDate: daysAgo(6),
    blockReason: 'Material Defect',
    vendorCode: 'V002',
    vendorName: 'XYZ Metal Works',
    purchaseOrderNumber: 'PO-2024-4004',
  },
  {
    id: 'IL-005',
    inspectionLot: 'IL-2024-6005',
    materialCode: 'MAT-005',
    materialDescription: 'Ball Bearing 6205',
    plant: 'Plant-3000',
    storageLocation: 'SL05',
    batch: 'BATCH-2024-005',
    blockedQuantity: 500,
    transactionQuantity: 1000,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(1),
    postingDate: daysAgo(1),
    blockReason: 'Packaging Damage',
    vendorCode: 'V005',
    vendorName: 'Prime Bearings Ltd',
    purchaseOrderNumber: 'PO-2024-4005',
  },
  {
    id: 'IL-006',
    inspectionLot: 'IL-2024-6006',
    materialCode: 'MAT-006',
    materialDescription: 'Stainless Steel Flange',
    plant: 'Plant-1000',
    storageLocation: 'SL01',
    batch: 'BATCH-2024-006',
    blockedQuantity: 75,
    transactionQuantity: 100,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(4),
    postingDate: daysAgo(3),
    blockReason: 'Documentation Missing',
    vendorCode: 'V001',
    vendorName: 'ABC Industrial Supplies',
    purchaseOrderNumber: 'PO-2024-4006',
  },
  {
    id: 'IL-007',
    inspectionLot: 'IL-2024-6007',
    materialCode: 'MAT-007',
    materialDescription: 'Hydraulic Cylinder',
    plant: 'Plant-2000',
    storageLocation: 'SL03',
    batch: 'BATCH-2024-007',
    blockedQuantity: 8,
    transactionQuantity: 12,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(6),
    postingDate: daysAgo(5),
    blockReason: 'Supplier Issue - Investigation Required',
    vendorCode: 'V002',
    vendorName: 'XYZ Metal Works',
    purchaseOrderNumber: 'PO-2024-4007',
  },
  {
    id: 'IL-008',
    inspectionLot: 'IL-2024-6008',
    materialCode: 'MAT-008',
    materialDescription: 'Control Valve Actuator',
    plant: 'Plant-3000',
    storageLocation: 'SL05',
    batch: 'BATCH-2024-008',
    blockedQuantity: 15,
    transactionQuantity: 30,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(8),
    postingDate: daysAgo(7),
    blockReason: 'Functional Test Failure',
    vendorCode: 'V004',
    vendorName: 'Global Valve Corp',
    purchaseOrderNumber: 'PO-2024-4008',
  },
  {
    id: 'IL-009',
    inspectionLot: 'IL-2024-6009',
    materialCode: 'MAT-001',
    materialDescription: 'Industrial Pipe 4 inch',
    plant: 'Plant-3000',
    storageLocation: 'SL05',
    batch: 'BATCH-2024-009',
    blockedQuantity: 300,
    transactionQuantity: 500,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(10),
    postingDate: daysAgo(9),
    blockReason: 'Dimensional Non-Conformance',
    vendorCode: 'V001',
    vendorName: 'ABC Industrial Supplies',
    purchaseOrderNumber: 'PO-2024-4009',
  },
  {
    id: 'IL-010',
    inspectionLot: 'IL-2024-6010',
    materialCode: 'MAT-002',
    materialDescription: 'Gate Valve DN100',
    plant: 'Plant-2000',
    storageLocation: 'SL04',
    batch: 'BATCH-2024-010',
    blockedQuantity: 40,
    transactionQuantity: 60,
    uom: 'EA',
    inspectionLotCreatedDate: daysAgo(12),
    postingDate: daysAgo(11),
    blockReason: 'Material Defect',
    vendorCode: 'V004',
    vendorName: 'Global Valve Corp',
    purchaseOrderNumber: 'PO-2024-4010',
  },
];

// Get unique values for filters
export const getUniquePlants = (): string[] => {
  return [...new Set(mockInspectionLotRecords.map(r => r.plant))];
};

export const getUniqueMaterialCodes = (): string[] => {
  return [...new Set(mockInspectionLotRecords.map(r => r.materialCode))];
};

export const getUniqueVendorCodes = (): string[] => {
  return [...new Set(mockInspectionLotRecords.map(r => r.vendorCode))];
};

export const getUniqueStorageLocations = (): string[] => {
  return [...new Set(mockInspectionLotRecords.map(r => r.storageLocation))];
};

export const getUniqueInspectionLots = (): string[] => {
  return [...new Set(mockInspectionLotRecords.map(r => r.inspectionLot))];
};

// Next Review Departments
export const nextReviewDepartments = [
  { value: 'engineering', label: 'Engineering / Design' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'plant_head', label: 'Plant Head' },
  { value: 'mrb_committee', label: 'MRB Committee' },
];

// Quality Decisions for Inward
export const inwardQualityDecisions = [
  { value: 'accept', label: 'Accept' },
  { value: 'reject', label: 'Reject' },
  { value: 'accept_with_deviation', label: 'Accept with Deviation' },
];

// Defect Categories for Inward
export const inwardDefectCategories = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical' },
];

// Attachment Categories for Inward
export const inwardAttachmentCategories = [
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'test_results', label: 'Test Result Document' },
  { value: 'photos', label: 'Photos / Images' },
  { value: 'specifications', label: 'Specification / Drawing' },
];
