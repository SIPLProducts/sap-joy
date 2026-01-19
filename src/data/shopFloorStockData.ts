// Shop Floor Available Stock Mock Data

export interface AvailableStockRecord {
  id: string;
  plant: string;
  materialCode: string;
  materialDescription: string;
  batch: string;
  storageLocation: string;
  availableQuantity: number;
  uom: string;
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const mockAvailableStock: AvailableStockRecord[] = [
  {
    id: generateId(),
    plant: 'Plant-1000',
    materialCode: 'MAT-001',
    materialDescription: 'Industrial Pipe 4 inch',
    batch: 'B2024-001',
    storageLocation: 'SL-01',
    availableQuantity: 500,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-1000',
    materialCode: 'MAT-002',
    materialDescription: 'Gate Valve DN100',
    batch: 'B2024-002',
    storageLocation: 'SL-02',
    availableQuantity: 150,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-1000',
    materialCode: 'MAT-003',
    materialDescription: 'Centrifugal Pump 50HP',
    batch: 'B2024-003',
    storageLocation: 'SL-01',
    availableQuantity: 25,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-2000',
    materialCode: 'MAT-004',
    materialDescription: 'Electric Motor 30KW',
    batch: 'B2024-004',
    storageLocation: 'SL-03',
    availableQuantity: 40,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-2000',
    materialCode: 'MAT-005',
    materialDescription: 'Ball Bearing 6205',
    batch: 'B2024-005',
    storageLocation: 'SL-02',
    availableQuantity: 1000,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-2000',
    materialCode: 'MAT-006',
    materialDescription: 'Stainless Steel Flange',
    batch: 'B2024-006',
    storageLocation: 'SL-04',
    availableQuantity: 200,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-3000',
    materialCode: 'MAT-007',
    materialDescription: 'Hydraulic Cylinder',
    batch: 'B2024-007',
    storageLocation: 'SL-01',
    availableQuantity: 15,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-3000',
    materialCode: 'MAT-008',
    materialDescription: 'Control Valve Actuator',
    batch: 'B2024-008',
    storageLocation: 'SL-03',
    availableQuantity: 30,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-1000',
    materialCode: 'MAT-001',
    materialDescription: 'Industrial Pipe 4 inch',
    batch: 'B2024-009',
    storageLocation: 'SL-03',
    availableQuantity: 250,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-2000',
    materialCode: 'MAT-003',
    materialDescription: 'Centrifugal Pump 50HP',
    batch: 'B2024-010',
    storageLocation: 'SL-02',
    availableQuantity: 10,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-3000',
    materialCode: 'MAT-002',
    materialDescription: 'Gate Valve DN100',
    batch: 'B2024-011',
    storageLocation: 'SL-04',
    availableQuantity: 75,
    uom: 'EA',
  },
  {
    id: generateId(),
    plant: 'Plant-1000',
    materialCode: 'MAT-005',
    materialDescription: 'Ball Bearing 6205',
    batch: 'B2024-012',
    storageLocation: 'SL-01',
    availableQuantity: 800,
    uom: 'EA',
  },
];

// Filter helper functions
export const getUniquePlants = (): string[] => {
  return [...new Set(mockAvailableStock.map(s => s.plant))];
};

export const getUniqueMaterials = (): { code: string; description: string }[] => {
  const materials = new Map<string, string>();
  mockAvailableStock.forEach(s => {
    if (!materials.has(s.materialCode)) {
      materials.set(s.materialCode, s.materialDescription);
    }
  });
  return Array.from(materials.entries()).map(([code, description]) => ({ code, description }));
};

export const getUniqueBatches = (): string[] => {
  return [...new Set(mockAvailableStock.map(s => s.batch))];
};

export const getUniqueStorageLocations = (): string[] => {
  return [...new Set(mockAvailableStock.map(s => s.storageLocation))];
};

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
import type { UserRole } from '@/types/mrb';

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
