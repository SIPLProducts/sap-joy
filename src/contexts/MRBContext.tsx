import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MRBRecord, EmailLog, MRBFilters } from '@/types/mrb';
import { mockMRBRecords, mockEmailLogs } from '@/data/mockData';

interface MRBContextType {
  mrbRecords: MRBRecord[];
  emailLogs: EmailLog[];
  filters: MRBFilters;
  setFilters: (filters: MRBFilters) => void;
  getMRBById: (id: string) => MRBRecord | undefined;
  updateMRB: (id: string, updates: Partial<MRBRecord>) => void;
  createMRB: (mrb: MRBRecord) => void;
  addEmailLog: (log: EmailLog) => void;
  getFilteredMRBs: () => MRBRecord[];
  getNextMRBNumber: () => string;
}

const MRBContext = createContext<MRBContextType | undefined>(undefined);

export function MRBProvider({ children }: { children: ReactNode }) {
  const [mrbRecords, setMRBRecords] = useState<MRBRecord[]>(mockMRBRecords);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(mockEmailLogs);
  const [filters, setFilters] = useState<MRBFilters>({});

  const getMRBById = (id: string): MRBRecord | undefined => {
    return mrbRecords.find(mrb => mrb.id === id);
  };

  const updateMRB = (id: string, updates: Partial<MRBRecord>) => {
    setMRBRecords(prev =>
      prev.map(mrb =>
        mrb.id === id
          ? { ...mrb, ...updates, updatedAt: new Date().toISOString() }
          : mrb
      )
    );
  };

  const createMRB = (mrb: MRBRecord) => {
    setMRBRecords(prev => [mrb, ...prev]);
  };

  const addEmailLog = (log: EmailLog) => {
    setEmailLogs(prev => [log, ...prev]);
  };

  const getFilteredMRBs = (): MRBRecord[] => {
    let filtered = [...mrbRecords];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(mrb => filters.status!.includes(mrb.status));
    }

    if (filters.source && filters.source.length > 0) {
      filtered = filtered.filter(mrb => filters.source!.includes(mrb.source));
    }

    if (filters.plant && filters.plant.length > 0) {
      filtered = filtered.filter(mrb => filters.plant!.includes(mrb.plant));
    }

    if (filters.vendor && filters.vendor.length > 0) {
      filtered = filtered.filter(mrb => filters.vendor!.includes(mrb.vendor));
    }

    if (filters.slaStatus && filters.slaStatus.length > 0) {
      filtered = filtered.filter(mrb => filters.slaStatus!.includes(mrb.slaStatus));
    }

    if (filters.escalationLevel && filters.escalationLevel.length > 0) {
      filtered = filtered.filter(mrb => filters.escalationLevel!.includes(mrb.escalationLevel));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        mrb =>
          mrb.mrbNumber.toLowerCase().includes(searchLower) ||
          mrb.materialNumber.toLowerCase().includes(searchLower) ||
          mrb.materialDescription.toLowerCase().includes(searchLower) ||
          mrb.vendorName.toLowerCase().includes(searchLower)
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(mrb => mrb.createdAt >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      filtered = filtered.filter(mrb => mrb.createdAt <= filters.dateTo!);
    }

    return filtered;
  };

  const getNextMRBNumber = (): string => {
    const year = new Date().getFullYear();
    const existingNumbers = mrbRecords
      .filter(mrb => mrb.mrbNumber.startsWith(`MRB-${year}`))
      .map(mrb => {
        const num = parseInt(mrb.mrbNumber.split('-')[2], 10);
        return isNaN(num) ? 0 : num;
      });
    const maxNumber = Math.max(0, ...existingNumbers);
    return `MRB-${year}-${String(maxNumber + 1).padStart(4, '0')}`;
  };

  return (
    <MRBContext.Provider
      value={{
        mrbRecords,
        emailLogs,
        filters,
        setFilters,
        getMRBById,
        updateMRB,
        createMRB,
        addEmailLog,
        getFilteredMRBs,
        getNextMRBNumber,
      }}
    >
      {children}
    </MRBContext.Provider>
  );
}

export function useMRB() {
  const context = useContext(MRBContext);
  if (context === undefined) {
    throw new Error('useMRB must be used within a MRBProvider');
  }
  return context;
}
