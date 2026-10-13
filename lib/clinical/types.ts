export type ConfirmationState = 'not_collected' | 'unknown' | 'patient_reported' | 'ai_suggested' | 'clinician_confirmed';
export type ClinicalFact<T = unknown> = {
  value: T | null;
  state: ConfirmationState;
  source?: string;
  confidence?: number | null;
  reviewedAt?: string | null;
};

export type DentalDraft = {
  chiefComplaint: ClinicalFact<string>;
  historyOfPresentIllness: ClinicalFact<string>;
  medicalHistory: ClinicalFact<string[]>;
  allergies: ClinicalFact<string[]>;
  medications: ClinicalFact<string[]>;
  examinationFindings: ClinicalFact<string[]>;
  assessment: ClinicalFact<string[]>;
  proposedPlan: ClinicalFact<string[]>;
  proceduresDiscussed: ClinicalFact<string[]>;
  proceduresCompleted: ClinicalFact<string[]>;
  prescriptionsSuggested: ClinicalFact<Array<{ name: string; dose: string | null; reason: string | null }>>;
  followUp: ClinicalFact<string>;
  uncertaintyFlags: string[];
};

export type ProcessingState = 'capturing' | 'uploading' | 'queued' | 'transcribing' | 'structuring' | 'needs_review' | 'failed' | 'approved';
