export const proposalStyles = `
  .proposal-container {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #1a1a2e;
    line-height: 1.55;
    max-width: 210mm;
    margin: 0 auto;
    background: white;
  }

  /* Page break - forces new page in PDF */
  .page-break {
    page-break-before: always;
    padding: 12mm 15mm;
    box-sizing: border-box;
  }

  /* Cover Page */
  .proposal-cover {
    width: 210mm;
    height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #0f1b4c 0%, #1a237e 40%, #283593 100%);
    color: white;
    padding: 30px 40px;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }

  .proposal-cover::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }

  .proposal-cover-content {
    position: relative;
    z-index: 1;
  }

  .cover-title {
    font-size: 34px;
    font-weight: 700;
    margin-bottom: 12px;
    line-height: 1.2;
  }

  .cover-subtitle {
    font-size: 18px;
    font-weight: 400;
    opacity: 0.9;
    margin-bottom: 40px;
  }

  .cover-divider {
    width: 100px;
    height: 3px;
    background: #ffd54f;
    margin: 0 auto 40px auto;
  }

  .cover-details {
    font-size: 13px;
    opacity: 0.85;
    line-height: 2;
  }

  .cover-details strong {
    color: #ffd54f;
  }

  .cover-footer {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    font-size: 10px;
    opacity: 0.6;
    z-index: 1;
  }

  /* Page Header */
  .proposal-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 2px solid #1a237e;
    margin-bottom: 14px;
    font-size: 10px;
    color: #666;
  }

  .proposal-page-header .header-left,
  .proposal-page-header .header-right {
    flex: 0 0 auto;
  }

  .proposal-page-header .header-center {
    text-align: center;
    flex: 1;
  }

  .header-logo {
    height: 22px;
    object-fit: contain;
  }

  .header-logo-hbl {
    height: 18px;
  }

  .proposal-page-number {
    text-align: right;
    font-size: 8px;
    color: #aaa;
    margin-top: -10px;
    margin-bottom: 4px;
  }

  /* Section Styling */
  .proposal-section {
    margin-bottom: 16px;
  }

  .proposal-section-title {
    font-size: 17px;
    font-weight: 700;
    color: #1a237e;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 2px solid #e8eaf6;
    page-break-after: avoid;
  }

  .proposal-section-number {
    display: inline-block;
    background: #1a237e;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    text-align: center;
    line-height: 24px;
    font-size: 12px;
    margin-right: 8px;
  }

  .proposal-subsection-title {
    font-size: 13px;
    font-weight: 600;
    color: #283593;
    margin: 10px 0 5px 0;
    page-break-after: avoid;
  }

  .proposal-text {
    font-size: 10.5px;
    color: #333;
    margin-bottom: 8px;
    text-align: justify;
  }

  .proposal-list {
    font-size: 10.5px;
    color: #333;
    padding-left: 16px;
    margin-bottom: 8px;
  }

  .proposal-list li {
    margin-bottom: 3px;
    page-break-inside: avoid;
  }

  /* Table styling */
  .proposal-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 10px;
    page-break-inside: avoid;
  }

  .proposal-table th {
    background: #1a237e;
    color: white;
    padding: 7px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
  }

  .proposal-table td {
    padding: 5px 8px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
  }

  .proposal-table tr {
    page-break-inside: avoid;
  }

  .proposal-table tr:nth-child(even) {
    background: #f8f9ff;
  }

  /* Confidential box */
  .confidential-box {
    border: 2px solid #c62828;
    padding: 20px;
    margin: 20px 0;
    background: #fff8f8;
    page-break-inside: avoid;
  }

  .confidential-title {
    color: #c62828;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 12px;
    letter-spacing: 1px;
  }

  .confidential-text {
    font-size: 10.5px;
    color: #555;
    text-align: justify;
    line-height: 1.7;
  }

  /* Highlight box */
  .highlight-box {
    background: #e8eaf6;
    border-left: 4px solid #1a237e;
    padding: 10px 14px;
    margin: 10px 0;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
  }

  .highlight-box p {
    font-size: 10.5px;
    color: #1a237e;
    margin: 0;
  }

  /* SLA colors */
  .sla-very-high { color: #c62828; font-weight: 600; }
  .sla-high { color: #e65100; font-weight: 600; }
  .sla-medium { color: #f9a825; font-weight: 600; }
  .sla-low { color: #2e7d32; font-weight: 600; }

  /* Commercial amount */
  .amount-highlight {
    font-size: 14px;
    font-weight: 700;
    color: #1a237e;
  }

  /* Footer */
  .proposal-footer {
    text-align: center;
    font-size: 9px;
    color: #999;
    padding: 14px;
    border-top: 1px solid #e0e0e0;
    margin-top: 24px;
  }

  /* Why SIPL section */
  .why-sipl-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 10px 0;
  }

  .why-sipl-item {
    background: #f5f7ff;
    padding: 8px 12px;
    border-radius: 4px;
    border-left: 3px solid #1a237e;
    page-break-inside: avoid;
  }

  .why-sipl-item strong {
    display: block;
    font-size: 10.5px;
    color: #1a237e;
    margin-bottom: 2px;
  }

  .why-sipl-item span {
    font-size: 9.5px;
    color: #555;
  }
`;
