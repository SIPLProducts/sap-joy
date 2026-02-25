import React, { useRef, useState } from 'react';
import { FileText, Download, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import TechnicalProposal from '@/components/proposals/TechnicalProposal';
import TechnoCommercialProposal from '@/components/proposals/TechnoCommercialProposal';
import { proposalStyles } from '@/components/proposals/ProposalStyles';

const ProposalGenerator = () => {
  const technicalRef = useRef<HTMLDivElement>(null);
  const commercialRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<'technical' | 'commercial' | null>(null);
  const { toast } = useToast();

  const generatePDF = async (type: 'technical' | 'commercial') => {
    const ref = type === 'technical' ? technicalRef : commercialRef;
    if (!ref.current) return;

    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = type === 'technical'
        ? 'SIPL_Technical_Proposal_MRB_HBL.pdf'
        : 'SIPL_Techno_Commercial_Proposal_MRB_HBL.pdf';

      await html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: [] },
        })
        .from(ref.current)
        .save();

      toast({ title: 'PDF Generated', description: `${filename} has been downloaded successfully.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{proposalStyles}</style>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Proposal Generator</h1>
        <p className="text-muted-foreground">Generate and download Technical & Techno-Commercial proposals for the MRB system</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technical">Technical Proposal</TabsTrigger>
          <TabsTrigger value="commercial">Techno-Commercial Proposal</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Technical Proposal
                </CardTitle>
                <CardDescription>
                  Comprehensive technical scope covering all MRB modules, architecture, technology stack, integration points, and security.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button variant="outline" onClick={() => setPreviewMode('technical')}>
                  <Eye className="h-4 w-4 mr-2" />Preview
                </Button>
                <Button onClick={() => generatePDF('technical')} disabled={generating}>
                  <Download className="h-4 w-4 mr-2" />{generating ? 'Generating...' : 'Download PDF'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Techno-Commercial Proposal
                </CardTitle>
                <CardDescription>
                  Commercial terms, SLA matrix, payment milestones, training provision, and terms & conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button variant="outline" onClick={() => setPreviewMode('commercial')}>
                  <Eye className="h-4 w-4 mr-2" />Preview
                </Button>
                <Button onClick={() => generatePDF('commercial')} disabled={generating}>
                  <Download className="h-4 w-4 mr-2" />{generating ? 'Generating...' : 'Download PDF'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {previewMode && (
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {previewMode === 'technical' ? 'Technical' : 'Techno-Commercial'} Proposal Preview
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => generatePDF(previewMode)} disabled={generating} size="sm">
                    <Download className="h-4 w-4 mr-2" />Download PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewMode(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[80vh] border rounded-lg bg-white">
                {previewMode === 'technical' ? (
                  <TechnicalProposal ref={technicalRef} />
                ) : (
                  <TechnoCommercialProposal ref={commercialRef} />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="technical">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Technical Proposal</CardTitle>
              <Button onClick={() => generatePDF('technical')} disabled={generating}>
                <Download className="h-4 w-4 mr-2" />{generating ? 'Generating...' : 'Download PDF'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[80vh] border rounded-lg bg-white">
              <TechnicalProposal ref={technicalRef} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Techno-Commercial Proposal</CardTitle>
              <Button onClick={() => generatePDF('commercial')} disabled={generating}>
                <Download className="h-4 w-4 mr-2" />{generating ? 'Generating...' : 'Download PDF'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[80vh] border rounded-lg bg-white">
              <TechnoCommercialProposal ref={commercialRef} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden refs for PDF generation from overview */}
      {!previewMode && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <TechnicalProposal ref={technicalRef} />
          <TechnoCommercialProposal ref={commercialRef} />
        </div>
      )}
    </div>
  );
};

export default ProposalGenerator;
