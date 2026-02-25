export const proposalStyles = `
  .proposal-container {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #1a1a2e;
    line-height: 1.6;
    max-width: 210mm;
    margin: 0 auto;
    background: white;
  }

  .proposal-cover {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #0f1b4c 0%, #1a237e 40%, #283593 100%);
    color: white;
    padding: 40px;
    page-break-after: always;
    position: relative;
    overflow: hidden;
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

  .cover-logos-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-bottom: 60px;
  }

  .cover-logo-img {
    height: 50px;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  .cover-logo-hbl {
    height: 40px;
  }

  .cover-logo-divider {
    width: 2px;
    height: 40px;
    background: rgba(255,255,255,0.3);
  }

  .cover-title {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
    line-height: 1.2;
  }

  .cover-subtitle {
    font-size: 20px;
    font-weight: 400;
    opacity: 0.9;
    margin-bottom: 60px;
  }

  .cover-divider {
    width: 120px;
    height: 3px;
    background: #ffd54f;
    margin: 0 auto 60px auto;
  }

  .cover-details {
    font-size: 14px;
    opacity: 0.85;
    line-height: 2;
  }

  .cover-details strong {
    color: #ffd54f;
  }

  .cover-footer {
    position: absolute;
    bottom: 30px;
    left: 0;
    right: 0;
    font-size: 11px;
    opacity: 0.6;
    z-index: 1;
  }

  /* Page Header */
  .proposal-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    border-bottom: 2px solid #1a237e;
    margin-bottom: 24px;
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
    height: 28px;
    object-fit: contain;
  }

  .header-logo-hbl {
    height: 22px;
  }

  /* Section Styling */
  .proposal-section {
    padding: 0 20px;
    margin-bottom: 28px;
  }

  .proposal-section-title {
    font-size: 20px;
    font-weight: 700;
    color: #1a237e;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8eaf6;
    page-break-after: avoid;
  }

  .proposal-section-number {
    display: inline-block;
    background: #1a237e;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    text-align: center;
    line-height: 28px;
    font-size: 14px;
    margin-right: 10px;
  }

  .proposal-subsection-title {
    font-size: 16px;
    font-weight: 600;
    color: #283593;
    margin: 16px 0 8px 0;
  }

  .proposal-text {
    font-size: 12px;
    color: #333;
    margin-bottom: 12px;
    text-align: justify;
  }

  .proposal-list {
    font-size: 12px;
    color: #333;
    padding-left: 20px;
    margin-bottom: 12px;
  }

  .proposal-list li {
    margin-bottom: 6px;
  }

  /* Table styling */
  .proposal-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 11px;
  }

  .proposal-table th {
    background: #1a237e;
    color: white;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 11px;
  }

  .proposal-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
  }

  .proposal-table tr:nth-child(even) {
    background: #f5f5f5;
  }

  .proposal-table tr:hover {
    background: #e8eaf6;
  }

  /* Confidential box */
  .confidential-box {
    border: 2px solid #c62828;
    padding: 24px;
    margin: 40px 20px;
    background: #fff8f8;
  }

  .confidential-title {
    color: #c62828;
    font-size: 18px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 16px;
  }

  .confidential-text {
    font-size: 11px;
    color: #555;
    text-align: justify;
    line-height: 1.8;
  }

  /* Highlight box */
  .highlight-box {
    background: #e8eaf6;
    border-left: 4px solid #1a237e;
    padding: 16px 20px;
    margin: 16px 0;
    border-radius: 0 4px 4px 0;
  }

  .highlight-box p {
    font-size: 12px;
    color: #1a237e;
    margin: 0;
  }

  /* Page break */
  .page-break {
    page-break-before: always;
  }

  /* SLA colors */
  .sla-very-high { color: #c62828; font-weight: 600; }
  .sla-high { color: #e65100; font-weight: 600; }
  .sla-medium { color: #f9a825; font-weight: 600; }
  .sla-low { color: #2e7d32; font-weight: 600; }

  /* Commercial amount */
  .amount-highlight {
    font-size: 16px;
    font-weight: 700;
    color: #1a237e;
  }

  /* Footer */
  .proposal-footer {
    text-align: center;
    font-size: 10px;
    color: #999;
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    margin-top: 40px;
  }

  /* Why SIPL section */
  .why-sipl-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 16px 0;
  }

  .why-sipl-item {
    background: #f5f5f5;
    padding: 12px 16px;
    border-radius: 4px;
    border-left: 3px solid #1a237e;
  }

  .why-sipl-item strong {
    display: block;
    font-size: 12px;
    color: #1a237e;
    margin-bottom: 4px;
  }

  .why-sipl-item span {
    font-size: 11px;
    color: #555;
  }
`;
