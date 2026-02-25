import React from 'react';

interface ProposalHeaderProps {
  documentTitle: string;
  documentRef?: string;
}

const ProposalHeader: React.FC<ProposalHeaderProps> = ({ documentTitle, documentRef = 'SIPL/HBL/MRB/2025' }) => {
  return (
    <div className="proposal-page-header">
      <div className="header-left">SHARVI INFOTECH PVT. LTD.</div>
      <div>{documentTitle}</div>
      <div>Ref: {documentRef}</div>
    </div>
  );
};

export default ProposalHeader;
