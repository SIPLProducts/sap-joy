import React, { useState } from 'react';
import { 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageSquare, 
  Book, 
  FileText, 
  ChevronDown,
  ExternalLink,
  Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const faqs = [
  {
    category: 'general',
    question: 'What is the MRB System?',
    answer: 'The Material Review Board (MRB) System is a digital platform for managing non-conforming materials. It streamlines the process of identifying, reviewing, and dispositioning materials that do not meet quality specifications.'
  },
  {
    category: 'general',
    question: 'Who can access the MRB System?',
    answer: 'Access is role-based. Quality inspectors, purchase team, engineering, shop floor personnel, and management can access the system based on their assigned roles. Contact your administrator for access requests.'
  },
  {
    category: 'inward',
    question: 'How do I create an Inward MRB?',
    answer: 'Navigate to Inward Report, search for pending inspection lots, select a record, and click "Create MRB". Fill in the quality decision, defect details, and select the departments for review. The system will route the MRB automatically.'
  },
  {
    category: 'inward',
    question: 'What are the different quality decisions available?',
    answer: 'Available decisions include: Accept, Reject, Partial Accept, Accept with Deviation, Hold for Review, Rework Required, Return to Vendor, and Conditional Release. Each decision triggers different routing workflows.'
  },
  {
    category: 'shopfloor',
    question: 'How do I block material on the shop floor?',
    answer: 'Go to Shop Floor Stock Selection, filter by plant/material/batch, select the stock item, and click "Proceed to Block". Fill in the issue details and submit. An MRB will be created automatically.'
  },
  {
    category: 'workflow',
    question: 'How does the approval workflow work?',
    answer: 'MRBs flow through stages: Quality Review → Purchase Review → Engineering Review → Final Approval. Each department reviews and either approves, returns for clarification, or rejects. Smart routing suggests appropriate departments based on the quality decision.'
  },
  {
    category: 'workflow',
    question: 'What do the SLA colors mean?',
    answer: 'Green indicates the MRB is within SLA (0-3 days). Yellow is a warning (4-7 days). Red indicates SLA breach (8+ days). Management dashboards track SLA compliance across all MRBs.'
  },
  {
    category: 'reports',
    question: 'How do I export MRB data?',
    answer: 'Most list views have an "Export" button that allows you to download data in CSV or Excel format. For detailed reports, visit the Analytics Dashboard which provides comprehensive metrics and charts.'
  },
  {
    category: 'reports',
    question: 'How do I print an MRB document?',
    answer: 'Open the MRB detail page and click the "Print" button. You can preview the document and adjust printer settings before printing. The document includes all relevant details and approval history.'
  }
];

const quickLinks = [
  { title: 'Inward Report', url: '/inward/report', description: 'View and manage inspection lots' },
  { title: 'Worklist', url: '/worklist', description: 'View all MRBs assigned to you' },
  { title: 'Analytics Dashboard', url: '/dashboard/analytics', description: 'View MRB metrics and trends' },
  { title: 'User Management', url: '/admin/users', description: 'Manage user accounts and roles' }
];

const HelpSupport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('faq');

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const faqCategories = [
    { id: 'all', label: 'All' },
    { id: 'general', label: 'General' },
    { id: 'inward', label: 'Inward MRB' },
    { id: 'shopfloor', label: 'Shop Floor' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'reports', label: 'Reports' }
  ];

  const [selectedCategory, setSelectedCategory] = useState('all');

  const displayedFaqs = filteredFaqs.filter(faq => 
    selectedCategory === 'all' || faq.category === selectedCategory
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
            <p className="text-sm text-muted-foreground">Find answers, resources, and contact support</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="faq">FAQs</TabsTrigger>
            <TabsTrigger value="contact">Contact Support</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-4 mt-4">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {faqCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* FAQ List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
                <CardDescription>
                  {displayedFaqs.length} question{displayedFaqs.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {displayedFaqs.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {displayedFaqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No FAQs match your search. Try different keywords or contact support.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="mt-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-base">Email Support</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Send us an email for non-urgent queries. We typically respond within 24 hours.
                  </p>
                  <a 
                    href="mailto:mrb-support@company.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    mrb-support@company.com
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-base">Phone Support</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    For urgent issues, call our support hotline during business hours (9 AM - 6 PM).
                  </p>
                  <a 
                    href="tel:+911234567890" 
                    className="text-primary hover:underline font-medium"
                  >
                    +91 1234 567 890
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <CardTitle className="text-base">IT Helpdesk</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    For technical issues, login problems, or access requests, contact IT.
                  </p>
                  <a 
                    href="mailto:it-helpdesk@company.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    it-helpdesk@company.com
                  </a>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Submit a Support Request</CardTitle>
                <CardDescription>
                  Describe your issue and we'll get back to you as soon as possible
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Subject</label>
                    <Input placeholder="Brief description of your issue" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                      <option>Technical Issue</option>
                      <option>Access Request</option>
                      <option>Feature Request</option>
                      <option>Training Request</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <textarea 
                    className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                    placeholder="Please provide detailed information about your issue..."
                  />
                </div>
                <Button>Submit Request</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Book className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <CardTitle className="text-base">User Guide</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Comprehensive guide covering all features of the MRB system.
                  </p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <CardTitle className="text-base">Quick Start Guide</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Get started quickly with the essential features and workflows.
                  </p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Links</CardTitle>
                <CardDescription>Jump to commonly used features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {quickLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{link.title}</p>
                        <p className="text-xs text-muted-foreground">{link.description}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Application Version</p>
                    <p className="font-medium">MRB System v2.0.0</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium">January 2026</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Browser Support</p>
                    <p className="font-medium">Chrome, Firefox, Edge, Safari</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Support Hours</p>
                    <p className="font-medium">Mon-Fri, 9:00 AM - 6:00 PM IST</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HelpSupport;
