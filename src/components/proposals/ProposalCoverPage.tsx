import React from 'react';

interface ProposalCoverPageProps {
  title: string;
  subtitle: string;
  proposalType: string;
  date?: string;
  version?: string;
}

const ProposalCoverPage: React.FC<ProposalCoverPageProps> = ({
  title,
  subtitle,
  proposalType,
  date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
  version = '1.0',
}) => {
  return (
    <div className="proposal-cover">
      <div className="proposal-cover-content">
        <div className="cover-logo-section">
          <div className="cover-logo-text">SHARVI INFOTECH</div>
          <div className="cover-logo-subtitle">PRIVATE LIMITED</div>
        </div>

        <div className="cover-title">{title}</div>
        <div className="cover-subtitle">{subtitle}</div>

        <div className="cover-divider" />

        <div className="cover-details">
          <div><strong>Proposal Type:</strong> {proposalType}</div>
          <div><strong>Prepared For:</strong> HBL Power Systems Ltd.</div>
          <div><strong>Prepared By:</strong> Sharvi Infotech Pvt. Ltd.</div>
          <div><strong>Date:</strong> {date}</div>
          <div><strong>Version:</strong> {version}</div>
          <div><strong>Document Status:</strong> Final</div>
        </div>
      </div>

      <div className="cover-footer">
        © {new Date().getFullYear()} Sharvi Infotech Pvt. Ltd. | Confidential & Proprietary
      </div>
    </div>
  );
};

export default ProposalCoverPage;
