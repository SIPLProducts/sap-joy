import React from 'react';
import ProposalCoverPage from './ProposalCoverPage';
import ProposalHeader from './ProposalHeader';

const TechnoCommercialProposal = React.forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="proposal-container">
      <ProposalCoverPage
        title="Techno-Commercial Proposal"
        subtitle="Material Review Board (MRB) Web Application"
        proposalType="Techno-Commercial Proposal"
      />

      {/* Confidentiality Statement */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="confidential-box">
          <div className="confidential-title">CONFIDENTIALITY STATEMENT</div>
          <div className="confidential-text">
            <p>This document contains proprietary and confidential information of Sharvi Infotech Pvt. Ltd. (SIPL). This document is submitted to HBL Power Systems Ltd. solely for the purpose of evaluating the commercial terms for the Material Review Board (MRB) Web Application development project.</p>
            <p style={{ marginTop: '12px' }}>The recipient agrees not to disclose, reproduce, or distribute this document or any of its contents to any third party without the prior written consent of SIPL.</p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">1</span>
            Executive Summary
          </div>
          <div className="proposal-text">
            Sharvi Infotech Pvt. Ltd. (SIPL) presents this Techno-Commercial Proposal for the complete development, deployment, and maintenance of the <strong>Material Review Board (MRB) Web Application</strong> for HBL Power Systems Ltd. This proposal outlines the commercial terms, service level agreements, and engagement model for the project.
          </div>
        </div>

        {/* Scope Highlights */}
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">2</span>
            Scope Highlights
          </div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '30%' }}>Module</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Inward Inspection Management</td><td>SAP API sync for inspection lot data, material blocking/unblocking via SAP, MRB case creation</td></tr>
              <tr><td>2</td><td>Shop Floor Material Blocking</td><td>Stock selection, defect identification, blocking via SAP, and MRB initiation from shop floor</td></tr>
              <tr><td>3</td><td>Material Block & Unblock (SAP)</td><td>Real-time material blocking and unblocking in SAP based on MRB disposition decisions</td></tr>
              <tr><td>4</td><td>MRB Workflow Engine</td><td>Multi-stage approval workflow with configurable steps per plant</td></tr>
              <tr><td>5</td><td>MRB Committee Review</td><td>Optional committee review for complex/high-value cases</td></tr>
              <tr><td>6</td><td>SAP Integration</td><td>Bi-directional data sync — inspection lots, stock, material/vendor master, block/unblock</td></tr>
              <tr><td>7</td><td>Role-Based Dashboards (6 types)</td><td>KPI, Quality, Purchase, Engineering, Executive, Analytics dashboards</td></tr>
              <tr><td>8</td><td>Email Notification System</td><td>Automated workflow notifications with configurable templates</td></tr>
              <tr><td>9</td><td>Print/PDF Generation</td><td>NCR report and MRB Committee Form generation</td></tr>
              <tr><td>10</td><td>User & Plant Management</td><td>Role-based access (roles defined by business), plant configuration, workflow settings</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Implementation Timeline */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">3</span>
            Implementation Timeline
          </div>
          <div className="proposal-text">
            The project will be executed in the following phases:
          </div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '30%' }}>Phase</th>
                <th style={{ width: '15%' }}>Duration</th>
                <th>Key Activities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Requirement Gathering</td>
                <td><strong>1 Week</strong></td>
                <td>Detailed requirement analysis, workflow mapping, SAP API specifications, stakeholder discussions, and sign-off on functional requirements document</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Development</td>
                <td><strong>3 Weeks</strong></td>
                <td>UI/UX development, backend implementation, SAP integration, workflow engine, dashboards, email notifications, print/PDF generation, and role-based access setup</td>
              </tr>
              <tr>
                <td>3</td>
                <td>Testing & Go-Live</td>
                <td><strong>1 Week</strong></td>
                <td>System testing, UAT with HBL team, bug fixes, production deployment, user training, and handover</td>
              </tr>
            </tbody>
          </table>
          <div className="highlight-box">
            <p><strong>Total Project Duration: 5 Weeks</strong></p>
          </div>
        </div>
      </div>

      {/* Commercial Terms */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">4</span>
            Commercial Terms
          </div>

          <div className="proposal-subsection-title">4.1 One-Time Development Cost</div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th>Description</th>
                <th style={{ width: '20%' }}>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>MRB Web Application – Complete Development & Deployment (First Plant)</td>
                <td className="amount-highlight">X,XX,XXX</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>Total (Excl. GST)</td>
                <td className="amount-highlight">X,XX,XXX</td>
              </tr>
            </tbody>
          </table>
          <div className="proposal-text" style={{ fontSize: '10px', fontStyle: 'italic' }}>
            * GST @ 18% will be charged additionally as applicable.
          </div>

          <div className="proposal-subsection-title">4.2 Rollout for Additional Plants</div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th>Description</th>
                <th style={{ width: '20%' }}>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Configuration, customization & deployment per additional plant</td>
                <td className="amount-highlight">XX,XXX</td>
              </tr>
            </tbody>
          </table>
          <div className="proposal-text" style={{ fontSize: '10px', fontStyle: 'italic' }}>
            Includes: Plant-specific workflow configuration, dashboard setup, SAP endpoint configuration, user role setup, and UAT support.
          </div>

          <div className="proposal-subsection-title">4.3 Annual Maintenance & Support (AMS)</div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th>Description</th>
                <th style={{ width: '20%' }}>Amount (INR/Month)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Application Maintenance & Support Services</td>
                <td className="amount-highlight">XX,XXX</td>
              </tr>
            </tbody>
          </table>
          <div className="proposal-text" style={{ fontSize: '10px', fontStyle: 'italic' }}>
            AMS includes: Bug fixes, minor enhancements, performance monitoring, security patches, and SLA-based support.
          </div>
        </div>
      </div>

      {/* SLA */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">5</span>
            Service Level Agreement (SLA)
          </div>
          <div className="proposal-text">
            The following SLA matrix defines the response and resolution commitments during the AMS period:
          </div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Definition</th>
                <th>Response Time</th>
                <th>Resolution Time</th>
                <th>Examples</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sla-very-high">Very High</td>
                <td>System down / critical workflow blocked</td>
                <td>30 minutes</td>
                <td>4 hours</td>
                <td>Login failure, workflow engine failure, data loss</td>
              </tr>
              <tr>
                <td className="sla-high">High</td>
                <td>Major feature impaired</td>
                <td>2 hours</td>
                <td>8 hours</td>
                <td>Dashboard not loading, email failures, SAP sync errors</td>
              </tr>
              <tr>
                <td className="sla-medium">Medium</td>
                <td>Non-critical feature issue</td>
                <td>4 hours</td>
                <td>24 hours</td>
                <td>Print formatting issues, filter not working, UI glitches</td>
              </tr>
              <tr>
                <td className="sla-low">Low</td>
                <td>Minor issue / enhancement request</td>
                <td>8 hours</td>
                <td>48 hours</td>
                <td>Label changes, color adjustments, minor UI improvements</td>
              </tr>
            </tbody>
          </table>
          <div className="highlight-box">
            <p><strong>Note:</strong> SLA timings are applicable during business hours (Monday to Saturday, 9:00 AM to 6:00 PM IST). Critical (Very High) issues will be attended to on best-effort basis outside business hours.</p>
          </div>
        </div>

        {/* Training */}
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">6</span>
            Training Provision
          </div>
          <ul className="proposal-list">
            <li>End-user training for each role group (Quality, Purchase, Engineering, Shop Floor, Admin)</li>
            <li>Train-the-trainer sessions for HBL's internal IT/Quality team</li>
            <li>User manuals and quick reference guides in PDF format</li>
            <li>Video tutorials for key workflows (optional, at additional cost)</li>
            <li>Post-go-live handholding support for 2 weeks</li>
          </ul>
        </div>
      </div>

      {/* Additional Scope & Key Assumptions */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">7</span>
            Additional Scope & Reporting
          </div>
          <ul className="proposal-list">
            <li>Any scope not covered in the original proposal will be treated as a Change Request (CR)</li>
            <li>CRs will be estimated separately and executed upon written approval from HBL</li>
            <li>Monthly progress reports will be shared during the development phase</li>
            <li>Weekly status calls during active development sprints</li>
            <li>Monthly AMS reports covering ticket summary, SLA compliance, and system health</li>
          </ul>
        </div>

        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">8</span>
            Key Assumptions
          </div>
          <ul className="proposal-list">
            <li>Working hours: Monday to Saturday, 9:00 AM to 6:00 PM IST</li>
            <li>AMS contract period: Minimum 12 months, renewable annually</li>
            <li>Communication language: English</li>
            <li>HBL will provide timely access to SAP system, test data, and subject matter experts</li>
            <li>SAP ABAP API development (if needed) will be handled by HBL's SAP team with SIPL providing specifications</li>
            <li>Cloud hosting costs are included in the development cost for the first year; subsequent years will be billed separately</li>
            <li>Any third-party license costs (if applicable) will be borne by HBL</li>
            <li>UAT sign-off within 2 weeks of deployment to test environment</li>
          </ul>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">9</span>
            Terms & Conditions
          </div>

          <div className="proposal-subsection-title">9.1 Payment Terms</div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Percentage</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Project Kickoff</td><td>30%</td><td>Upon signing of agreement and project initiation</td></tr>
              <tr><td>Mid-Development</td><td>30%</td><td>Upon completion of core modules and demo</td></tr>
              <tr><td>UAT Completion</td><td>20%</td><td>Upon successful UAT sign-off</td></tr>
              <tr><td>Go-Live</td><td>20%</td><td>Upon production deployment and handover</td></tr>
            </tbody>
          </table>

          <div className="proposal-subsection-title">9.2 Billing & Invoicing</div>
          <ul className="proposal-list">
            <li>Invoices will be raised as per milestone completion</li>
            <li>Payment due within 30 days from date of invoice</li>
            <li>AMS charges billed monthly in advance</li>
            <li>All amounts are in Indian Rupees (INR) exclusive of GST</li>
          </ul>

          <div className="proposal-subsection-title">9.3 Site Visits</div>
          <ul className="proposal-list">
            <li>Site visits to HBL locations as needed for requirement gathering, UAT, and training</li>
            <li>Travel and accommodation expenses will be borne by HBL or reimbursed at actuals</li>
            <li>Remote support via video calls will be the primary mode of communication</li>
          </ul>

          <div className="proposal-subsection-title">9.4 Validity</div>
          <div className="proposal-text">
            This proposal is valid for a period of <strong>30 days</strong> from the date of submission. After this period, SIPL reserves the right to revise the terms and pricing.
          </div>
        </div>
      </div>

      {/* Why SIPL / Conclusion */}
      <div className="page-break">
        <ProposalHeader documentTitle="Techno-Commercial Proposal – MRB System" />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">10</span>
            Why Sharvi Infotech (SIPL)?
          </div>
          <div className="why-sipl-grid">
            <div className="why-sipl-item">
              <strong>Manufacturing Domain Expertise</strong>
              <span>Deep understanding of quality management, MRB processes, and SAP integration in manufacturing</span>
            </div>
            <div className="why-sipl-item">
              <strong>Trusted HBL Partner</strong>
              <span>Proven track record with HBL on IMS, Calibration, and other critical enterprise systems</span>
            </div>
            <div className="why-sipl-item">
              <strong>End-to-End Delivery</strong>
              <span>Complete ownership from requirement analysis to production deployment and ongoing support</span>
            </div>
            <div className="why-sipl-item">
              <strong>Transparent Engagement</strong>
              <span>Clear milestones, regular reporting, and no hidden costs</span>
            </div>
          </div>

          <div className="highlight-box" style={{ marginTop: '30px' }}>
            <p style={{ textAlign: 'center', fontSize: '14px' }}>
              <strong>We look forward to partnering with HBL Power Systems Ltd. on this strategic initiative to digitize and optimize the Material Review Board process across all plants.</strong>
            </p>
          </div>
        </div>

        <div className="proposal-section" style={{ marginTop: '40px' }}>
          <div className="proposal-subsection-title">Contact Information</div>
          <table className="proposal-table">
            <tbody>
              <tr><td style={{ width: '30%' }}><strong>Company</strong></td><td>Sharvi Infotech Pvt. Ltd.</td></tr>
              <tr><td><strong>Address</strong></td><td>Hyderabad, Telangana, India</td></tr>
              <tr><td><strong>Email</strong></td><td>info@sharviinfotech.com</td></tr>
              <tr><td><strong>Website</strong></td><td>www.sharviinfotech.com</td></tr>
            </tbody>
          </table>
        </div>

        <div className="proposal-footer">
          <p>Sharvi Infotech Pvt. Ltd. | www.sharviinfotech.com</p>
          <p>This document is confidential and intended solely for the use of HBL Power Systems Ltd.</p>
        </div>
      </div>
    </div>
  );
});

TechnoCommercialProposal.displayName = 'TechnoCommercialProposal';
export default TechnoCommercialProposal;
