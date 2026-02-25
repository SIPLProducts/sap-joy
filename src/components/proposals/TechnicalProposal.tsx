import React from 'react';
import ProposalCoverPage from './ProposalCoverPage';
import ProposalHeader from './ProposalHeader';

const TechnicalProposal = React.forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="proposal-container">
      <ProposalCoverPage
        title="Technical Proposal"
        subtitle="Material Review Board (MRB) Web Application"
        proposalType="Technical Proposal"
      />

      {/* Confidentiality Statement */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={2} totalPages={8} />
        <div className="confidential-box">
          <div className="confidential-title">CONFIDENTIALITY STATEMENT</div>
          <div className="confidential-text">
            <p>This document contains proprietary and confidential information of Sharvi Infotech Pvt. Ltd. (SIPL). This document is submitted to HBL Power Systems Ltd. solely for the purpose of evaluating the proposed solution for the Material Review Board (MRB) Web Application development project.</p>
            <p style={{ marginTop: '12px' }}>The recipient agrees not to disclose, reproduce, or distribute this document or any of its contents to any third party without the prior written consent of SIPL. All intellectual property rights in this document remain with SIPL.</p>
            <p style={{ marginTop: '12px' }}>Any unauthorized use, disclosure, or copying of this document, in whole or in part, is strictly prohibited and may be unlawful.</p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={3} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">1</span>
            Executive Summary
          </div>
          <div className="proposal-text">
            Sharvi Infotech Pvt. Ltd. (SIPL) is pleased to present this Technical Proposal for the development and implementation of a comprehensive <strong>Material Review Board (MRB) Web Application</strong> for HBL Power Systems Ltd.
          </div>
          <div className="proposal-text">
            The MRB system is designed to digitize and streamline the entire non-conforming material management process — from inward inspection and material blocking to multi-stage quality review, purchase evaluation, engineering disposition, and final approval. The system replaces manual, paper-based MRB processes with a real-time, role-based digital workflow that ensures traceability, accountability, and compliance.
          </div>
          <div className="highlight-box">
            <p><strong>Key Value Proposition:</strong> Reduce MRB processing time by up to 60%, eliminate paper-based tracking, provide real-time visibility into material disposition status, and enable data-driven quality improvement decisions through integrated analytics dashboards.</p>
          </div>
        </div>
      </div>

      {/* Scope of Work */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={4} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">2</span>
            Scope of Work
          </div>
          <div className="proposal-text">
            The MRB Web Application covers the following functional areas:
          </div>

          <div className="proposal-subsection-title">2.1 Inward Inspection & Material Blocking</div>
          <ul className="proposal-list">
            <li>Upload inspection lot data from SAP via real-time API synchronization</li>
            <li>View, filter, and search inward inspection records</li>
            <li>Create MRB cases directly from rejected inspection lots</li>
            <li>Track blocked quantities with vendor and PO reference</li>
            <li><strong>Material Block & Unblock via SAP Integration:</strong> Block non-conforming materials in SAP directly from the MRB application and unblock materials upon MRB disposition completion</li>
          </ul>

          <div className="proposal-subsection-title">2.2 MRB Creation (Dual Source)</div>
          <ul className="proposal-list">
            <li><strong>Quality Inspection Source:</strong> Create MRB from inward inspection failures with material, vendor, defect, and quantity details</li>
            <li><strong>Shop Floor Source:</strong> Create MRB from shop floor material issues with production order, batch, and storage location references</li>
            <li><strong>Shop Floor Defect Identification:</strong> When any material defect is identified on the shop floor during production, the material is automatically flagged, blocked in SAP, and routed to MRB for disposition</li>
          </ul>

          <div className="proposal-subsection-title">2.3 Multi-Stage Approval Workflow</div>
          <ul className="proposal-list">
            <li>Configurable plant-wise workflow: Quality Review → Purchase Review → Engineering Review → Final Approval</li>
            <li>Each stage captures decision, remarks, quantities, and timestamps</li>
            <li>Engineering disposition options: Use As-Is, Use with Deviation, Rework, Return to Vendor, Scrap</li>
            
          </ul>

          <div className="proposal-subsection-title">2.4 MRB Committee Review</div>
          <ul className="proposal-list">
            <li>Optional committee review stage for high-value or complex cases</li>
            <li>Committee decision capture with collective remarks</li>
            <li>Integration with the main approval workflow</li>
          </ul>

          <div className="proposal-subsection-title">2.5 SAP Integration</div>
          <ul className="proposal-list">
            <li>Inspection lot data synchronization from SAP via ABAP API (real-time sync)</li>
            <li>Shop floor stock data synchronization from SAP API</li>
            
            <li><strong>Material Blocking in SAP:</strong> Trigger material block posting in SAP when non-conforming material is identified (both inward and shop floor)</li>
            <li><strong>Material Unblocking in SAP:</strong> Trigger material unblock posting in SAP upon MRB disposition (Use As-Is, Rework completed, Deviation approved)</li>
          </ul>

          <div className="proposal-subsection-title">2.6 Role-Based Dashboards</div>
          <ul className="proposal-list">
            <li><strong>KPI Dashboard:</strong> Overview metrics — Open MRBs, pending actions, SLA compliance, aging analysis</li>
            <li><strong>Quality Head Dashboard:</strong> Quality-specific KPIs, defect category trends, vendor quality scores</li>
            <li><strong>Purchase Head Dashboard:</strong> Purchase action tracking, vendor-wise MRB trends, replacement timelines</li>
            <li><strong>Engineering Head Dashboard:</strong> Engineering disposition analysis, deviation tracking, technical resolution metrics</li>
            <li><strong>Executive Summary Dashboard:</strong> Plant-wide aggregated metrics, cross-functional performance overview</li>
            <li><strong>MRB Analytics Dashboard:</strong> Advanced analytics with trend charts, category breakdowns, and forecasting</li>
          </ul>

          <div className="proposal-subsection-title">2.7 Email Notification System</div>
          <ul className="proposal-list">
            <li>Automated email notifications at each workflow stage transition</li>
            <li>Configurable email templates per plant</li>
            
          </ul>

          <div className="proposal-subsection-title">2.8 Print & PDF Generation</div>
          <ul className="proposal-list">
            <li>Non-Conformance Report (NCR) print</li>
            <li>MRB Committee Form print</li>
          </ul>

          <div className="proposal-subsection-title">2.9 User Management & Plant Configuration</div>
          <ul className="proposal-list">
            <li>Role-based access control (roles defined by business)</li>
            <li>User profile management with department and plant assignment</li>
            <li>Plant-wise workflow step configuration</li>
            <li>Dashboard visibility configuration per role and plant</li>
            
          </ul>
        </div>
      </div>

      {/* Module-wise Feature Breakdown */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={5} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">3</span>
            Module-wise Feature Breakdown
          </div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '25%' }}>Module</th>
                <th>Key Features</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Inward Inspection</td><td>SAP API sync, lot management, status tracking, multi-select filtering, material blocking/unblocking via SAP</td></tr>
              <tr><td>2</td><td>Shop Floor Stock</td><td>Material blocking via SAP, defect identification → MRB routing, stock selection, production order tracking, batch management</td></tr>
              <tr><td>3</td><td>MRB Creation</td><td>Dual-source creation, defect categorization, quantity management, vendor linkage</td></tr>
              <tr><td>4</td><td>Approval Workflow</td><td>4-stage configurable workflow, SLA tracking, remarks capture</td></tr>
              <tr><td>5</td><td>MRB Committee</td><td>Committee review, collective decision, integration with main workflow</td></tr>
              <tr><td>6</td><td>Worklist</td><td>Role-based task list, status filters, search, bulk actions</td></tr>
              <tr><td>7</td><td>KPI Dashboard</td><td>Real-time metrics, aging analysis, SLA compliance, trend indicators</td></tr>
              <tr><td>8</td><td>Role Dashboards</td><td>Quality, Purchase, Engineering, Executive views with role-specific metrics</td></tr>
              <tr><td>9</td><td>Analytics</td><td>Trend charts, category breakdowns, vendor analysis, forecasting</td></tr>
              <tr><td>10</td><td>Email System</td><td>Automated notifications, configurable templates</td></tr>
              <tr><td>11</td><td>Print/PDF</td><td>NCR report, MRB Committee Form</td></tr>
              <tr><td>12</td><td>User Management</td><td>Role assignment, profile management, plant-wise access control</td></tr>
              <tr><td>13</td><td>Plant Config</td><td>Workflow steps, dashboard visibility, print settings, SAP API config</td></tr>
              <tr><td>14</td><td>SAP Integration</td><td>Stock sync, material/vendor master, material block/unblock</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration Points */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={6} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">4</span>
            Integration Points
          </div>
          <div className="proposal-subsection-title">4.1 SAP ERP Integration</div>
          <table className="proposal-table">
            <thead>
              <tr>
                <th>Integration Point</th>
                <th>Direction</th>
                <th>Method</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Inspection Lot Data</td><td>SAP → MRB</td><td>API</td><td>Fetch rejected inspection lots with material, vendor, and quantity data via SAP ABAP API</td></tr>
              <tr><td>Shop Floor Stock</td><td>SAP → MRB</td><td>API</td><td>Fetch available stock by material, batch, storage location via SAP API</td></tr>
              <tr><td>Material Block</td><td>MRB → SAP</td><td>API</td><td>Post material block in SAP when non-conforming material is identified (inward or shop floor)</td></tr>
              <tr><td>Material Unblock</td><td>MRB → SAP</td><td>API</td><td>Post material unblock in SAP upon MRB disposition approval</td></tr>
              
              <tr><td>Shop Floor Defect</td><td>MRB → SAP</td><td>API</td><td>Block defective material identified on shop floor and initiate MRB workflow</td></tr>
            </tbody>
          </table>
        </div>

        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">5</span>
            Security & Access Control
          </div>
          <ul className="proposal-list">
            <li><strong>Authorization:</strong> Role-based access control — Roles will be defined by the business (e.g., Quality, Quality Head, Purchase, Purchase Head, Engineering, Engineering Head, Shop Floor, Executive, Admin, MRB Committee)</li>
            <li><strong>Row-Level Security:</strong> Database-level policies ensuring users can only access data relevant to their role and plant</li>
            <li><strong>Plant-Based Isolation:</strong> Multi-plant support with data segregation per plant</li>
          </ul>
        </div>
      </div>

      {/* Implementation Timeline */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={7} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">6</span>
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

      {/* Why SIPL */}
      <div className="page-break">
        <ProposalHeader documentTitle="Technical Proposal – MRB System" pageNumber={8} totalPages={8} />
        <div className="proposal-section">
          <div className="proposal-section-title">
            <span className="proposal-section-number">7</span>
            Why Sharvi Infotech (SIPL)?
          </div>
          <div className="why-sipl-grid">
            <div className="why-sipl-item">
              <strong>Domain Expertise</strong>
              <span>Deep understanding of manufacturing quality processes, MRB workflows, and SAP integration</span>
            </div>
            <div className="why-sipl-item">
              <strong>Proven Track Record</strong>
              <span>Successfully delivered IMS, Calibration, and other enterprise web applications for HBL</span>
            </div>
            <div className="why-sipl-item">
              <strong>Modern Technology</strong>
              <span>Cutting-edge React + TypeScript stack with cloud-native architecture for scalability</span>
            </div>
            <div className="why-sipl-item">
              <strong>Agile Delivery</strong>
              <span>Iterative development with regular demos, feedback incorporation, and rapid deployment</span>
            </div>
            
            <div className="why-sipl-item">
              <strong>Cost Effective</strong>
              <span>Competitive pricing with transparent billing and no hidden costs</span>
            </div>
          </div>
        </div>

        <div className="proposal-footer">
          <p>Sharvi Infotech Pvt. Ltd. | www.sharviinfotech.com</p>
          <p>This document is confidential and intended solely for the use of HBL Power Systems Ltd.</p>
        </div>
      </div>
    </div>
  );
});

TechnicalProposal.displayName = 'TechnicalProposal';
export default TechnicalProposal;
