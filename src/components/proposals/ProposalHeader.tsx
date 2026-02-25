import React from 'react';
import hblLogo from '@/assets/hbl-logo-proposal.png';
import sharviLogo from '@/assets/sharvi-logo.png';

interface ProposalHeaderProps {
  documentTitle: string;
  documentRef?: string;
  pageNumber?: number;
  totalPages?: number;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ 
  documentTitle, 
  documentRef = 'SIPL/HBL/MRB/2025',
  pageNumber,
  totalPages,
}) => {
  return (
    <>
      <div className="proposal-page-header">
        <div className="header-left">
          <img src={sharviLogo} alt="Sharvi Infotech" className="header-logo" />
        </div>
        <div className="header-center">
          <div>{documentTitle}</div>
          <div style={{ fontSize: '9px', color: '#999' }}>Ref: {documentRef}</div>
        </div>
        <div className="header-right">
          <img src={hblLogo} alt="HBL" className="header-logo header-logo-hbl" />
        </div>
      </div>
      {pageNumber && totalPages && (
        <div className="proposal-page-number">
          Page {pageNumber} of {totalPages}
        </div>
      )}
    </>
  );
};

export default ProposalHeader;
