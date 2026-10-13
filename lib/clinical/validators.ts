import { z } from 'zod';

export const patientCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(180),
  patient_number: z.string().trim().max(80).optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  sex: z.enum(['female', 'male', 'unspecified']).default('unspecified'),
  phone: z.string().trim().max(40).optional().nullable(),
  chief_complaint: z.string().trim().max(2000).optional().nullable(),
}).strict();

export const finishRecordingSchema = z.object({
  recording_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
}).strict();
