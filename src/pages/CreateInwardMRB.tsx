import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Send, X, Upload, FileText, Trash2, CheckCircle2, AlertCircle, Clock, Sparkles, Lightbulb, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  nextReviewDepartments, 
  inwardQualityDecisions, 
  inwardDefectCategories,
  inwardAttachmentCategories 
} from '@/data/inwardReportData';
import type { Database } from '@/integrations/supabase/types';
import { fetchPlantWorkflow, DEPT_TO_ROLE, DEPT_TO_STATUS, ROLE_TO_DEPT } from '@/lib/workflowRouting';

type QualityDecision = Database['public']['Enums']['quality_decision'];
type DefectCategory = Database['public']['Enums']['defect_category'];

interface InspectionLotRecord {
  id: string;
  inspectionLot: string;
  plant: string;
  materialCode: string;
  materialDescription: string;
  vendorCode: string;
  vendorName: string;
  storageLocation: string;
  batch: string;
  poNumber: string;
  poItemNumber: string;
  grnNumber: string;
  transactionQuantity: number;
  uom: string;
  blockedQuantity: number;
  blockReason: string;
  inspectionDate: string;
  status: 'pending' | 'mrb_created' | 'cleared';
  purchaseOrderNumber?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  category: string;
}

interface FormData {
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
  poItemNumber: string;
  grnNumber: string;
  qualityDecision: string;
  defectCategory: string;
  defectDescription: string;
  qualityInspectionComments: string;
  qualityInspectionDate: string;
  qualityInspectorName: string;
  nextReviewDepartments: string[];
}

interface ValidationErrors {
  qualityDecision?: string;
  qualityInspectorName?: string;
  nextReviewDepartments?: string;
  qualityInspectionDate?: string;
}

const AUTOSAVE_KEY = 'mrb_draft_autosave';
const AUTOSAVE_INTERVAL = 5000; // 5 seconds

export default function CreateInwardMRB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { createMRB, getNextMRBNumber } = useMRBDatabase();
  const { user, profile, userRole } = useAuth();
  
  const inspectionLot = location.state?.inspectionLot as InspectionLotRecord | undefined;

  // Redirect if no inspection lot data
  if (!inspectionLot) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Inspection Lot Selected</h2>
          <p className="text-muted-foreground mb-6">
            Please select an inspection lot from the Inward Report to create an MRB.
          </p>
          <Button onClick={() => navigate('/inward/report')}>
            Go to Inward Report
          </Button>
        </div>
      </div>
    );
  }

  // Get saved draft from localStorage
  const getSavedDraft = useCallback((): Partial<FormData> | null => {
    try {
      const saved = localStorage.getItem(`${AUTOSAVE_KEY}_${inspectionLot.inspectionLot}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    return null;
  }, [inspectionLot.inspectionLot]);

  const savedDraft = getSavedDraft();

  const [formData, setFormData] = useState<FormData>({
    // Auto-populated from inspection lot
    inspectionLot: inspectionLot.inspectionLot,
    materialCode: inspectionLot.materialCode,
    materialDescription: inspectionLot.materialDescription,
    plant: inspectionLot.plant,
    storageLocation: inspectionLot.storageLocation,
    batch: inspectionLot.batch,
    blockedQuantity: inspectionLot.blockedQuantity,
    transactionQuantity: inspectionLot.transactionQuantity,
    uom: inspectionLot.uom,
    blockReason: inspectionLot.blockReason,
    vendorCode: inspectionLot.vendorCode,
    vendorName: inspectionLot.vendorName,
    purchaseOrderNumber: inspectionLot.purchaseOrderNumber || inspectionLot.poNumber || '',
    poItemNumber: inspectionLot.poItemNumber || '',
    grnNumber: inspectionLot.grnNumber || '',
    
    // Quality inspection input - restore from draft or empty
    qualityDecision: savedDraft?.qualityDecision || '',
    defectCategory: savedDraft?.defectCategory || '',
    defectDescription: savedDraft?.defectDescription || '',
    qualityInspectionComments: savedDraft?.qualityInspectionComments || '',
    qualityInspectionDate: savedDraft?.qualityInspectionDate || new Date().toISOString().split('T')[0],
    qualityInspectorName: savedDraft?.qualityInspectorName || profile?.full_name || '',
    nextReviewDepartments: savedDraft?.nextReviewDepartments || [],
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('inspection_report');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(savedDraft ? new Date() : null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Smart routing suggestions based on quality decision
  // Smart routing based on quality decision
  const getDecisionBasedDepartments = useCallback((decision: string): string[] => {
    const routingMap: Record<string, string[]> = {
      'accept': [], // No routing needed for simple accept
      'reject': ['purchase', 'quality_head'],
      'partial_accept': ['purchase', 'engineering'],
      'accept_with_deviation': ['engineering', 'quality_head'],
      'hold_for_review': ['engineering', 'quality_head'],
      'rework_required': ['engineering'],
      'return_to_vendor': ['purchase'],
      'conditional_release': ['engineering', 'plant_head'],
      'blocked': ['quality_head'],
    };
    return routingMap[decision] || [];
  }, []);

  // Smart routing based on defect category
  const getDefectBasedDepartments = useCallback((defectCategory: string): string[] => {
    const defectRoutingMap: Record<string, string[]> = {
      'dimensional': ['engineering'], // Technical evaluation needed
      'surface': ['quality_head'], // Quality assessment
      'material': ['engineering', 'purchase'], // Technical + vendor coordination
      'functional': ['engineering'], // Technical evaluation
      'electrical': ['engineering'], // Technical evaluation
      'mechanical': ['engineering'], // Technical evaluation
      'documentation': ['purchase'], // Vendor documentation issue
      'packaging': ['purchase'], // Vendor packaging issue
      'labeling': ['purchase'], // Vendor labeling issue
      'contamination': ['quality_head', 'engineering'], // Quality + technical
      'quantity': ['purchase'], // Vendor quantity issue
      'other': ['quality_head'], // Escalate to quality head
    };
    return defectRoutingMap[defectCategory] || [];
  }, []);

  // Combined smart routing - merges decision-based and defect-based recommendations
  const recommendedDepartments = useMemo(() => {
    const decisionDepts = getDecisionBasedDepartments(formData.qualityDecision);
    const defectDepts = getDefectBasedDepartments(formData.defectCategory);
    
    // Merge and deduplicate
    const combined = [...new Set([...decisionDepts, ...defectDepts])];
    
    console.log('Smart Routing Debug:', {
      qualityDecision: formData.qualityDecision,
      defectCategory: formData.defectCategory,
      decisionBasedDepts: decisionDepts,
      defectBasedDepts: defectDepts,
      recommendedDepartments: combined
    });
    
    return combined;
  }, [formData.qualityDecision, formData.defectCategory, getDecisionBasedDepartments, getDefectBasedDepartments]);

  // Auto-select departments when recommendations change
  useEffect(() => {
    if (recommendedDepartments.length > 0 && formData.nextReviewDepartments.length === 0) {
      // Only auto-apply if user hasn't selected anything yet
      setFormData(prev => ({
        ...prev,
        nextReviewDepartments: recommendedDepartments,
      }));
    }
  }, [recommendedDepartments]);

  // Check if a department is recommended
  const isDepartmentRecommended = useCallback((deptValue: string): boolean => {
    return recommendedDepartments.includes(deptValue);
  }, [recommendedDepartments]);

  // Auto-apply recommended departments
  const handleApplyRecommendations = useCallback(() => {
    if (recommendedDepartments.length > 0) {
      const newDepartments = [...new Set([...formData.nextReviewDepartments, ...recommendedDepartments])];
      setFormData(prev => ({
        ...prev,
        nextReviewDepartments: newDepartments,
      }));
      setTouchedFields(prev => new Set(prev).add('nextReviewDepartments'));
    }
  }, [recommendedDepartments, formData.nextReviewDepartments]);

  // Real-time validation
  const validateField = useCallback((field: keyof FormData, value: any): string | undefined => {
    switch (field) {
      case 'qualityDecision':
        if (!value) return 'Quality decision is required';
        break;
      case 'qualityInspectorName':
        if (!value || value.trim() === '') return 'Inspector name is required';
        if (value.length < 2) return 'Name must be at least 2 characters';
        break;
      case 'nextReviewDepartments':
        if (!value || value.length === 0) return 'Select at least one department';
        break;
      case 'qualityInspectionDate':
        if (!value) return 'Inspection date is required';
        const date = new Date(value);
        if (date > new Date()) return 'Date cannot be in the future';
        break;
    }
    return undefined;
  }, []);

  // Validate all fields and return errors
  const validateAllFields = useCallback((): ValidationErrors => {
    const errors: ValidationErrors = {};
    const fieldsToValidate: (keyof FormData)[] = [
      'qualityDecision',
      'qualityInspectorName',
      'nextReviewDepartments',
      'qualityInspectionDate'
    ];
    
    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        errors[field as keyof ValidationErrors] = error;
      }
    });
    
    return errors;
  }, [formData, validateField]);

  // Update validation errors when form changes
  useEffect(() => {
    const errors = validateAllFields();
    setValidationErrors(errors);
  }, [formData, validateAllFields]);

  // Autosave functionality
  useEffect(() => {
    const saveToLocalStorage = () => {
      try {
        const dataToSave = {
          qualityDecision: formData.qualityDecision,
          defectCategory: formData.defectCategory,
          defectDescription: formData.defectDescription,
          qualityInspectionComments: formData.qualityInspectionComments,
          qualityInspectionDate: formData.qualityInspectionDate,
          qualityInspectorName: formData.qualityInspectorName,
          nextReviewDepartments: formData.nextReviewDepartments,
        };
        localStorage.setItem(`${AUTOSAVE_KEY}_${inspectionLot.inspectionLot}`, JSON.stringify(dataToSave));
        setLastSaved(new Date());
      } catch (e) {
        console.error('Autosave error:', e);
      }
    };

    const timer = setInterval(saveToLocalStorage, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [formData, inspectionLot.inspectionLot]);

  // Mark field as touched on blur
  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  // Check if field has error and is touched
  const getFieldError = (field: keyof ValidationErrors): string | undefined => {
    if (touchedFields.has(field)) {
      return validationErrors[field];
    }
    return undefined;
  };

  // Form validity check
  const isFormValid = useMemo(() => {
    return Object.keys(validateAllFields()).length === 0;
  }, [validateAllFields]);

  // Clear autosave on successful submit
  const clearAutosave = useCallback(() => {
    localStorage.removeItem(`${AUTOSAVE_KEY}_${inspectionLot.inspectionLot}`);
  }, [inspectionLot.inspectionLot]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: Attachment[] = Array.from(files).map((file) => ({
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: formData.qualityInspectorName || 'Quality User',
        uploadedAt: new Date().toISOString(),
        category: selectedCategory,
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.qualityDecision) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Quality Decision',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.qualityInspectorName) {
      toast({
        title: 'Validation Error',
        description: 'Please enter the Quality Inspector Name',
        variant: 'destructive',
      });
      return;
    }
    if (formData.nextReviewDepartments.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one Next Review Department',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const mrbNumber = await getNextMRBNumber();
      
      // Map quality decision to database enum
      const qualityDecisionMap: Record<string, QualityDecision> = {
        'accept': 'accept',
        'reject': 'reject',
        'partial_accept': 'partial_accept',
        'block': 'blocked',
      };
      
      // Map defect category
      const defectCategoryMap: Record<string, DefectCategory> = {
        'electrical': 'functional',
        'mechanical': 'dimensional',
        'dimensional': 'dimensional',
        'surface': 'surface',
        'material': 'material',
        'documentation': 'documentation',
        'packaging': 'packaging',
        'other': 'other',
      };

      // Determine pending_with and status based on next review department
      const pendingWithMap: Record<string, Database['public']['Enums']['app_role']> = {
        'engineering': 'engineering',
        'purchase': 'purchase',
        'plant_head': 'executive',
        'quality_head': 'quality_head',
      };

      // Map department to status
      const statusMap: Record<string, Database['public']['Enums']['mrb_status']> = {
        'engineering': 'engineering_review',
        'purchase': 'purchase_review',
        'plant_head': 'final_approval',
        'quality_head': 'quality_review',
      };

      const firstDept = formData.nextReviewDepartments[0];
      const pendingWith = pendingWithMap[firstDept] || 'quality';
      const mrbStatus = statusMap[firstDept] || 'quality_review';

      const newMRB = await createMRB({
        mrb_number: mrbNumber,
        status: mrbStatus,
        source: 'quality_inspection',
        created_by: user?.id || '',
        pending_with: pendingWith,
        pending_days: 0,
        sla_status: 'green',
        escalation_level: 'none',
        material_number: formData.materialCode,
        material_description: formData.materialDescription,
        plant: formData.plant,
        vendor_code: formData.vendorCode,
        vendor_name: formData.vendorName,
        inspection_lot: formData.inspectionLot,
        po_number: formData.purchaseOrderNumber,
        grn_number: formData.grnNumber || null,
        total_quantity: formData.transactionQuantity,
        blocked_quantity: formData.blockedQuantity,
        accepted_quantity: formData.qualityDecision === 'accept' ? formData.transactionQuantity : 0,
        rejected_quantity: formData.qualityDecision === 'reject' ? formData.blockedQuantity : 0,
        uom: formData.uom,
        quality_decision: qualityDecisionMap[formData.qualityDecision] || 'blocked',
        defect_category: defectCategoryMap[formData.defectCategory] || null,
        defect_description: formData.defectDescription || formData.blockReason,
        quality_remarks: formData.qualityInspectionComments,
        quality_approved_by: user?.id,
        quality_approved_at: new Date().toISOString(),
      });

      if (newMRB) {
        // Update the inspection lot status to 'mrb_created'
        if (formData.inspectionLot) {
          await supabase
            .from('inward_inspection_lots')
            .update({ status: 'mrb_created' })
            .eq('inspection_lot', formData.inspectionLot);
        }

        // Log email notification for MRB forwarding
        try {
          const departmentLabels = formData.nextReviewDepartments.map(d => 
            nextReviewDepartments.find(dept => dept.value === d)?.label || d
          );
          const qualityDecisionLabel = inwardQualityDecisions.find(d => d.value === formData.qualityDecision)?.label || formData.qualityDecision;

          // Fetch recipients from profiles matching the pending_with role
          const { data: roleUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', pendingWith);

          let recipientEmails: string[] = [];
          if (roleUsers && roleUsers.length > 0) {
            const userIds = roleUsers.map(r => r.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('email, plant')
              .in('user_id', userIds);
            if (profiles) {
              recipientEmails = profiles
                .filter(p => p.plant === formData.plant || !p.plant)
                .map(p => p.email);
            }
          }

          const emailSubject = `Approval Request: Quality Non-Conformance | ${formData.vendorName} | Lot ${formData.inspectionLot}`;
          
          const emailBody = `Dear Material Review Board,

A quality discrepancy has been identified in a recent shipment of ${formData.materialDescription} from ${formData.vendorName}. To maintain our production schedule and quality standards, we require your collective review and approval on the proposed disposition.

1. Defect Overview
   Total Quantity: ${formData.transactionQuantity} ${formData.uom}
   Blocked Quantity: ${formData.blockedQuantity} ${formData.uom}
   Primary Issue: ${formData.defectDescription || formData.blockReason || 'N/A'}
   Quality Decision: ${qualityDecisionLabel}
   Defect Category: ${formData.defectCategory ? inwardDefectCategories.find(c => c.value === formData.defectCategory)?.label || formData.defectCategory : 'N/A'}

2. Material & Vendor Details
   Material Code: ${formData.materialCode}
   Plant: ${formData.plant}
   Vendor Code: ${formData.vendorCode}
   GRN Number: ${formData.grnNumber || 'N/A'}
   PO Number: ${formData.purchaseOrderNumber || 'N/A'}
   PO Item: ${formData.poItemNumber || 'N/A'}
   Inspection Lot: ${formData.inspectionLot}

3. Proposed Disposition
   Recommended Action: ${qualityDecisionLabel}
   Routed To: ${departmentLabels.join(', ')}

4. Required Action
   Please review the Non-Conformance Report (NCR) and provide your decision at the earliest.

Best regards,
${formData.qualityInspectorName}
Quality Department`;

          await supabase.from('email_logs').insert({
            mrb_id: newMRB.id,
            mrb_number: mrbNumber,
            subject: emailSubject,
            body: emailBody,
            recipients: recipientEmails.length > 0 ? recipientEmails : ['mrb-board@hbl.com'],
            template: 'quality_to_engineering',
            sent_by: user?.id || '',
            status: 'sent',
          });
        } catch (emailError) {
          console.error('Email log error (non-blocking):', emailError);
        }

        // Clear autosave on successful submission
        clearAutosave();
        
        const departmentLabels2 = formData.nextReviewDepartments.map(d => 
          nextReviewDepartments.find(dept => dept.value === d)?.label || d
        );
        const qualityDecisionLabel2 = inwardQualityDecisions.find(d => d.value === formData.qualityDecision)?.label || formData.qualityDecision;

        toast({
          title: '✅ MRB Created Successfully',
          description: (
            <div className="mt-2 space-y-2">
              <p className="font-medium">MRB Number: <span className="text-primary">{mrbNumber}</span></p>
              <p>Quality Decision: <span className="font-medium">{qualityDecisionLabel2}</span></p>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Routed to:</p>
                <div className="flex flex-wrap gap-1">
                  {departmentLabels2.map((dept, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {dept}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ),
          duration: 6000,
        });

        navigate('/worklist');
      }
    } catch (error) {
      console.error('Error creating MRB:', error);
      toast({
        title: 'Error',
        description: 'Failed to create MRB. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    try {
      const dataToSave = {
        qualityDecision: formData.qualityDecision,
        defectCategory: formData.defectCategory,
        defectDescription: formData.defectDescription,
        qualityInspectionComments: formData.qualityInspectionComments,
        qualityInspectionDate: formData.qualityInspectionDate,
        qualityInspectorName: formData.qualityInspectorName,
        nextReviewDepartments: formData.nextReviewDepartments,
      };
      localStorage.setItem(`${AUTOSAVE_KEY}_${inspectionLot.inspectionLot}`, JSON.stringify(dataToSave));
      setLastSaved(new Date());
      toast({
        title: 'Draft Saved',
        description: 'MRB draft has been saved successfully.',
      });
    } catch (e) {
      toast({
        title: 'Save Failed',
        description: 'Could not save draft. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Clear draft
  const handleClearDraft = () => {
    clearAutosave();
    setFormData(prev => ({
      ...prev,
      qualityDecision: '',
      defectCategory: '',
      defectDescription: '',
      qualityInspectionComments: '',
      qualityInspectionDate: new Date().toISOString().split('T')[0],
      qualityInspectorName: profile?.full_name || '',
      nextReviewDepartments: [],
    }));
    setTouchedFields(new Set());
    setLastSaved(null);
    toast({
      title: 'Draft Cleared',
      description: 'Form has been reset.',
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/inward/report')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Create MRB – Quality Inspection (Inward)
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Inspection Lot: {inspectionLot.inspectionLot}</span>
                  {lastSaved && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Clock className="h-3 w-3" />
                      Auto-saved at {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastSaved && (
                <Button variant="ghost" size="sm" onClick={handleClearDraft} className="text-muted-foreground">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Draft
                </Button>
              )}
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button variant="ghost" onClick={() => navigate('/inward/report')}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-6 max-w-full">
        {/* Section 1: Auto-Populated Data (Read-Only) */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Material & Inspection Lot Information
            </h2>
            <p className="text-sm text-muted-foreground">
              Auto-populated from selected inspection lot (Read-only)
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Inspection Lot</Label>
                <Input value={formData.inspectionLot} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Material Code</Label>
                <Input value={formData.materialCode} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-muted-foreground">Material Description</Label>
                <Input value={formData.materialDescription} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Plant</Label>
                <Input value={formData.plant} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Storage Location</Label>
                <Input value={formData.storageLocation} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Batch</Label>
                <Input value={formData.batch} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Unit of Measure</Label>
                <Input value={formData.uom} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Blocked Quantity</Label>
                <Input value={formData.blockedQuantity.toString()} readOnly className="bg-muted font-medium text-destructive" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Transaction Quantity</Label>
                <Input value={formData.transactionQuantity.toString()} readOnly className="bg-muted" />
              </div>
              {/* Block Reason hidden from create form */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Vendor Code</Label>
                <Input value={formData.vendorCode} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">GRN Number</Label>
                <Input value={formData.grnNumber} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-muted-foreground">Vendor Name</Label>
                <Input value={formData.vendorName} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Purchase Order Number</Label>
                <Input value={formData.purchaseOrderNumber} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">PO Item Number</Label>
                <Input value={formData.poItemNumber} readOnly className="bg-muted" />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Quality Inspection Input */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Quality Inspection Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter inspection findings and decision
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Inspection Decision <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.qualityDecision}
                  onValueChange={(value) => {
                    setFormData({ ...formData, qualityDecision: value });
                    handleFieldBlur('qualityDecision');
                  }}
                >
                  <SelectTrigger className={`bg-background h-11 ${getFieldError('qualityDecision') ? 'border-destructive' : formData.qualityDecision ? 'border-green-500' : ''}`}>
                    <SelectValue placeholder="Select Quality Decision" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50 max-h-[350px]">
                    {inwardQualityDecisions.map((decision) => {
                      const colorClasses: Record<string, string> = {
                        green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                        red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                        amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
                        blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                        orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                        purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                        yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                      };
                      return (
                        <SelectItem 
                          key={decision.value} 
                          value={decision.value}
                          className="py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colorClasses[decision.color] || 'bg-gray-100 text-gray-800'}`}>
                              {decision.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{decision.description}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {getFieldError('qualityDecision') && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('qualityDecision')}
                  </p>
                )}
                {formData.qualityDecision && !getFieldError('qualityDecision') && (() => {
                  const selected = inwardQualityDecisions.find(d => d.value === formData.qualityDecision);
                  const colorClasses: Record<string, string> = {
                    green: 'text-green-600',
                    red: 'text-red-600',
                    amber: 'text-amber-600',
                    blue: 'text-blue-600',
                    orange: 'text-orange-600',
                    purple: 'text-purple-600',
                    yellow: 'text-yellow-600',
                  };
                  return (
                    <p className={`text-xs flex items-center gap-1 mt-1 ${colorClasses[selected?.color || ''] || 'text-green-600'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {selected?.label}
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Defect Category</Label>
                <Select
                  value={formData.defectCategory}
                  onValueChange={(value) => setFormData({ ...formData, defectCategory: value })}
                >
                  <SelectTrigger className={`bg-background h-11 ${formData.defectCategory ? 'border-green-500' : ''}`}>
                    <SelectValue placeholder="Select Defect Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50 max-h-[350px]">
                    {inwardDefectCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value} className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{category.label}</span>
                          <span className="text-xs text-muted-foreground">{category.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.defectCategory && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {inwardDefectCategories.find(c => c.value === formData.defectCategory)?.label}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Inspection Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.qualityInspectionDate}
                  onChange={(e) => setFormData({ ...formData, qualityInspectionDate: e.target.value })}
                  onBlur={() => handleFieldBlur('qualityInspectionDate')}
                  className={`bg-background ${getFieldError('qualityInspectionDate') ? 'border-destructive' : formData.qualityInspectionDate ? 'border-green-500' : ''}`}
                />
                {getFieldError('qualityInspectionDate') && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('qualityInspectionDate')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Inspector Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.qualityInspectorName}
                  onChange={(e) => setFormData({ ...formData, qualityInspectorName: e.target.value })}
                  onBlur={() => handleFieldBlur('qualityInspectorName')}
                  placeholder="Enter inspector name"
                  className={`bg-background ${getFieldError('qualityInspectorName') ? 'border-destructive' : formData.qualityInspectorName ? 'border-green-500' : ''}`}
                />
                {getFieldError('qualityInspectorName') && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('qualityInspectorName')}
                  </p>
                )}
                {formData.qualityInspectorName && !getFieldError('qualityInspectorName') && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Valid
                  </p>
                )}
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-foreground">Defect Description</Label>
                <Input
                  value={formData.defectDescription}
                  onChange={(e) => setFormData({ ...formData, defectDescription: e.target.value })}
                  placeholder="Describe the defect"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label className="text-foreground">Quality Inspection Comments</Label>
                <Textarea
                  value={formData.qualityInspectionComments}
                  onChange={(e) => setFormData({ ...formData, qualityInspectionComments: e.target.value })}
                  placeholder="Enter detailed inspection comments..."
                  rows={4}
                  className="bg-background resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 3: Attachments */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Quality Attachments
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload inspection reports, test results, photos, or specifications
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {inwardAttachmentCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="relative">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                />
              </Button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(att.size / 1024).toFixed(1)} KB • {att.category}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(att.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No attachments uploaded yet
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Section 4: Next Review Department */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Workflow Routing
            </h2>
            <p className="text-sm text-muted-foreground">
              Select department(s) for next review
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Smart Routing Suggestion Banner */}
              {recommendedDepartments.length > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Smart Routing Applied
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {formData.qualityDecision && formData.defectCategory ? (
                          <>Based on "{inwardQualityDecisions.find(d => d.value === formData.qualityDecision)?.label}" + "{inwardDefectCategories.find(c => c.value === formData.defectCategory)?.label}" defect</>
                        ) : formData.qualityDecision ? (
                          <>Based on "{inwardQualityDecisions.find(d => d.value === formData.qualityDecision)?.label}" decision</>
                        ) : formData.defectCategory ? (
                          <>Based on "{inwardDefectCategories.find(c => c.value === formData.defectCategory)?.label}" defect category</>
                        ) : null}
                        {' → '}
                        <span className="font-medium">
                          {recommendedDepartments.map(d => 
                            nextReviewDepartments.find(dept => dept.value === d)?.label
                          ).join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>
                  {formData.nextReviewDepartments.length === 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleApplyRecommendations}
                      className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                    >
                      <Lightbulb className="h-4 w-4 mr-1 text-amber-600" />
                      Apply
                    </Button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-foreground">
                  Next Review Department(s) <span className="text-destructive">*</span>
                </Label>
                {formData.nextReviewDepartments.length > 0 && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {formData.nextReviewDepartments.length} selected
                  </span>
                )}
                {touchedFields.has('nextReviewDepartments') && formData.nextReviewDepartments.length === 0 && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Select at least one department
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nextReviewDepartments.map((dept) => {
                  const isSelected = formData.nextReviewDepartments.includes(dept.value);
                  const isRecommended = isDepartmentRecommended(dept.value);
                  
                  return (
                    <label
                      key={dept.value}
                      className={`relative flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : isRecommended
                          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            handleFieldBlur('nextReviewDepartments');
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                nextReviewDepartments: [...formData.nextReviewDepartments, dept.value],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                nextReviewDepartments: formData.nextReviewDepartments.filter(
                                  (d) => d !== dept.value
                                ),
                              });
                            }
                          }}
                          className="h-4 w-4 text-primary mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${
                              isSelected ? 'text-primary' : 'text-foreground'
                            }`}>
                              {dept.label}
                            </span>
                            {isRecommended && !isSelected && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                <Sparkles className="h-3 w-3" />
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{dept.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer with Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border shadow-lg">
        <div className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {isFormValid ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>
                    Decision: <strong className="text-foreground">{
                      inwardQualityDecisions.find(d => d.value === formData.qualityDecision)?.label || formData.qualityDecision
                    }</strong>
                    <span className="ml-2">
                      → Forward to: {formData.nextReviewDepartments.map(d => 
                        nextReviewDepartments.find(dept => dept.value === d)?.label
                      ).join(', ')}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {!formData.qualityDecision && 'Select a quality decision'}
                  {formData.qualityDecision && formData.nextReviewDepartments.length === 0 && 'Select at least one review department'}
                  {formData.qualityDecision && formData.nextReviewDepartments.length > 0 && !formData.qualityInspectorName && 'Enter inspector name'}
                </span>
              )}
            </div>
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isFormValid}
            size="lg"
            className="min-w-[180px]"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
