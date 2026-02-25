import React from 'react';
import hblLogo from '@/assets/hbl-logo-proposal.png';
import sharviLogo from '@/assets/sharvi-logo.png';

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
        <div className="cover-logos-row">
          <img src={sharviLogo} alt="Sharvi Infotech" className="cover-logo-img" />
          <div className="cover-logo-divider" />
          <img src={hblLogo} alt="HBL Power Systems" className="cover-logo-img cover-logo-hbl" />
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
