// Shop Floor Stock CSV Template and Parsing

export const SHOP_FLOOR_STOCK_TEMPLATE_HEADERS = [
  'plant',
  'material_code',
  'material_description',
  'batch',
  'storage_location',
  'available_quantity',
  'uom',
  'production_order',
  'reservation_number',
];

export const SHOP_FLOOR_STOCK_SAMPLE_DATA = [
  {
    plant: 'Plant-1000',
    material_code: 'MAT-001',
    material_description: 'Industrial Pipe 4 inch',
    batch: 'B2024-001',
    storage_location: 'SL-01',
    available_quantity: 500,
    uom: 'EA',
    production_order: 'PO-2024-001',
    reservation_number: 'RES-001',
  },
  {
    plant: 'Plant-2000',
    material_code: 'MAT-002',
    material_description: 'Gate Valve DN100',
    batch: 'B2024-002',
    storage_location: 'SL-02',
    available_quantity: 150,
    uom: 'EA',
    production_order: 'PO-2024-002',
    reservation_number: 'RES-002',
  },
];

export function generateShopFloorCSVTemplate(): string {
  const headers = SHOP_FLOOR_STOCK_TEMPLATE_HEADERS.join(',');
  const sampleRows = SHOP_FLOOR_STOCK_SAMPLE_DATA.map(row => 
    SHOP_FLOOR_STOCK_TEMPLATE_HEADERS.map(header => {
      const value = row[header as keyof typeof row];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');
  
  return `${headers}\n${sampleRows}`;
}

export function downloadShopFloorCSVTemplate() {
  const csvContent = generateShopFloorCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'shop_floor_stock_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedShopFloorStock {
  plant: string;
  material_code: string;
  material_description?: string;
  batch?: string;
  storage_location?: string;
  available_quantity: number;
  uom?: string;
  production_order?: string;
  reservation_number?: string;
}

export interface ShopFloorStockParseResult {
  success: boolean;
  data: ParsedShopFloorStock[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

// Normalize field names to handle different column header formats
function normalizeFieldName(field: string): string {
  const normalized = field.toLowerCase().trim()
    .replace(/[\s-_]+/g, '_')
    .replace(/^"|"$/g, '');
  
  const mappings: Record<string, string> = {
    'plant': 'plant',
    'plant_code': 'plant',
    'plant_id': 'plant',
    'material': 'material_code',
    'material_code': 'material_code',
    'material_number': 'material_code',
    'mat_code': 'material_code',
    'material_description': 'material_description',
    'material_desc': 'material_description',
    'description': 'material_description',
    'batch': 'batch',
    'batch_number': 'batch',
    'batch_no': 'batch',
    'storage_location': 'storage_location',
    'sloc': 'storage_location',
    'storage_loc': 'storage_location',
    'available_quantity': 'available_quantity',
    'available_qty': 'available_quantity',
    'qty': 'available_quantity',
    'quantity': 'available_quantity',
    'uom': 'uom',
    'unit': 'uom',
    'unit_of_measure': 'uom',
    'production_order': 'production_order',
    'prod_order': 'production_order',
    'po_number': 'production_order',
    'reservation_number': 'reservation_number',
    'reservation': 'reservation_number',
    'res_number': 'reservation_number',
  };
  
  return mappings[normalized] || normalized;
}

export function validateShopFloorStockData(data: Record<string, unknown>[]): ShopFloorStockParseResult {
  const errors: string[] = [];
  const validData: ParsedShopFloorStock[] = [];
  
  data.forEach((row, index) => {
    const rowNum = index + 2; // Account for header row
    
    // Normalize all field names
    const normalizedRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = normalizeFieldName(key);
      normalizedRow[normalizedKey] = value;
    });
    
    // Required field validation
    const plant = String(normalizedRow.plant || '').trim();
    const materialCode = String(normalizedRow.material_code || '').trim();
    const quantityValue = normalizedRow.available_quantity;
    
    if (!plant) {
      errors.push(`Row ${rowNum}: Plant is required`);
      return;
    }
    
    if (!materialCode) {
      errors.push(`Row ${rowNum}: Material code is required`);
      return;
    }
    
    // Parse quantity
    let availableQuantity: number;
    if (typeof quantityValue === 'number') {
      availableQuantity = quantityValue;
    } else {
      availableQuantity = parseFloat(String(quantityValue || '0').replace(/,/g, ''));
    }
    
    if (isNaN(availableQuantity) || availableQuantity < 0) {
      errors.push(`Row ${rowNum}: Invalid available quantity`);
      return;
    }
    
    // Build valid record
    validData.push({
      plant,
      material_code: materialCode,
      material_description: String(normalizedRow.material_description || '').trim() || undefined,
      batch: String(normalizedRow.batch || '').trim() || undefined,
      storage_location: String(normalizedRow.storage_location || '').trim() || undefined,
      available_quantity: availableQuantity,
      uom: String(normalizedRow.uom || 'EA').trim(),
      production_order: String(normalizedRow.production_order || '').trim() || undefined,
      reservation_number: String(normalizedRow.reservation_number || '').trim() || undefined,
    });
  });
  
  return {
    success: errors.length === 0 && validData.length > 0,
    data: validData,
    errors,
    totalRows: data.length,
    validRows: validData.length,
  };
}
