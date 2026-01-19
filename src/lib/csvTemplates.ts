// CSV Template definitions for inward inspection lot uploads

export const INWARD_INSPECTION_LOT_TEMPLATE_HEADERS = [
  'inspection_lot',
  'material_code',
  'material_description',
  'plant',
  'storage_location',
  'batch',
  'blocked_quantity',
  'transaction_quantity',
  'uom',
  'inspection_date',
  'posting_date',
  'block_reason',
  'vendor_code',
  'vendor_name',
  'po_number',
  'grn_number'
];

export const INWARD_INSPECTION_LOT_SAMPLE_DATA = [
  {
    inspection_lot: 'IL-2024-001',
    material_code: 'MAT-001',
    material_description: 'Steel Rod 10mm',
    plant: 'Plant A',
    storage_location: 'SL01',
    batch: 'BATCH-001',
    blocked_quantity: 100,
    transaction_quantity: 500,
    uom: 'EA',
    inspection_date: '2024-01-15',
    posting_date: '2024-01-15',
    block_reason: 'Quality Issue',
    vendor_code: 'V001',
    vendor_name: 'ABC Suppliers',
    po_number: 'PO-2024-001',
    grn_number: 'GRN-2024-001'
  },
  {
    inspection_lot: 'IL-2024-002',
    material_code: 'MAT-002',
    material_description: 'Copper Wire 2mm',
    plant: 'Plant B',
    storage_location: 'SL02',
    batch: 'BATCH-002',
    blocked_quantity: 50,
    transaction_quantity: 200,
    uom: 'KG',
    inspection_date: '2024-01-16',
    posting_date: '2024-01-16',
    block_reason: 'Dimensional Deviation',
    vendor_code: 'V002',
    vendor_name: 'XYZ Industries',
    po_number: 'PO-2024-002',
    grn_number: 'GRN-2024-002'
  }
];

export function generateCSVTemplate(): string {
  const headers = INWARD_INSPECTION_LOT_TEMPLATE_HEADERS.join(',');
  const sampleRows = INWARD_INSPECTION_LOT_SAMPLE_DATA.map(row => 
    INWARD_INSPECTION_LOT_TEMPLATE_HEADERS.map(header => {
      const value = row[header as keyof typeof row];
      // Escape values containing commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');
  
  return `${headers}\n${sampleRows}`;
}

export function downloadCSVTemplate() {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'inward_inspection_lot_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedInspectionLot {
  inspection_lot: string;
  material_code: string;
  material_description?: string;
  plant: string;
  storage_location?: string;
  batch?: string;
  blocked_quantity: number;
  transaction_quantity: number;
  uom?: string;
  inspection_date?: string;
  posting_date?: string;
  block_reason?: string;
  vendor_code?: string;
  vendor_name?: string;
  po_number?: string;
  grn_number?: string;
}

export interface ParseResult {
  success: boolean;
  data: ParsedInspectionLot[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

export function validateParsedData(data: Record<string, unknown>[]): ParseResult {
  const result: ParseResult = {
    success: true,
    data: [],
    errors: [],
    totalRows: data.length,
    validRows: 0
  };

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 because of header row and 0-indexing
    const errors: string[] = [];

    // Required field validation
    if (!row.inspection_lot && !row['Inspection Lot'] && !row['INSPECTION_LOT']) {
      errors.push(`Row ${rowNum}: Missing inspection_lot`);
    }
    if (!row.material_code && !row['Material Code'] && !row['MATERIAL_CODE']) {
      errors.push(`Row ${rowNum}: Missing material_code`);
    }
    if (!row.plant && !row['Plant'] && !row['PLANT']) {
      errors.push(`Row ${rowNum}: Missing plant`);
    }

    if (errors.length > 0) {
      result.errors.push(...errors);
      result.success = false;
    } else {
      // Normalize field names (handle various formats)
      const normalizedRow: ParsedInspectionLot = {
        inspection_lot: String(row.inspection_lot || row['Inspection Lot'] || row['INSPECTION_LOT'] || ''),
        material_code: String(row.material_code || row['Material Code'] || row['MATERIAL_CODE'] || ''),
        material_description: String(row.material_description || row['Material Description'] || row['MATERIAL_DESCRIPTION'] || ''),
        plant: String(row.plant || row['Plant'] || row['PLANT'] || ''),
        storage_location: String(row.storage_location || row['Storage Location'] || row['STORAGE_LOCATION'] || ''),
        batch: String(row.batch || row['Batch'] || row['BATCH'] || ''),
        blocked_quantity: Number(row.blocked_quantity || row['Blocked Quantity'] || row['BLOCKED_QUANTITY'] || 0),
        transaction_quantity: Number(row.transaction_quantity || row['Transaction Quantity'] || row['TRANSACTION_QUANTITY'] || 0),
        uom: String(row.uom || row['UoM'] || row['UOM'] || 'EA'),
        inspection_date: row.inspection_date || row['Inspection Date'] || row['INSPECTION_DATE'] 
          ? String(row.inspection_date || row['Inspection Date'] || row['INSPECTION_DATE']) 
          : undefined,
        posting_date: row.posting_date || row['Posting Date'] || row['POSTING_DATE']
          ? String(row.posting_date || row['Posting Date'] || row['POSTING_DATE'])
          : undefined,
        block_reason: String(row.block_reason || row['Block Reason'] || row['BLOCK_REASON'] || ''),
        vendor_code: String(row.vendor_code || row['Vendor Code'] || row['VENDOR_CODE'] || ''),
        vendor_name: String(row.vendor_name || row['Vendor Name'] || row['VENDOR_NAME'] || ''),
        po_number: String(row.po_number || row['PO Number'] || row['PO_NUMBER'] || ''),
        grn_number: String(row.grn_number || row['GRN Number'] || row['GRN_NUMBER'] || '')
      };
      
      result.data.push(normalizedRow);
      result.validRows++;
    }
  });

  return result;
}
