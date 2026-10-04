import { z } from 'zod';
import {
  BOOKING_STATUSES,
  EVENT_TYPES,
  INTERACTION_TYPES,
  LEAD_SOURCES,
  PIPELINE_STAGES,
} from './constants';

/**
 * Validation schemas shared by forms, the local data source and the website
 * intake endpoint. A backend can reuse these exact rules.
 */

const values = <T extends string>(opts: { value: T }[]) => opts.map((o) => o.value) as [T, ...T[]];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');
const optionalIsoDate = z.union([isoDate, z.literal('')]).optional().transform((v) => v || undefined);
const optionalText = z.string().trim().optional().transform((v) => v || undefined);

// Phone numbers: digits with optional +, spaces, dashes, parentheses. 7–20 digits.
const phone = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .refine((v) => /^[+()\d\s-]+$/.test(v), 'Use digits, spaces, + or -')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 20;
  }, 'Phone number looks too short or too long');

const money = z.coerce
  .number({ message: 'Enter an amount' })
  .min(0, 'Amount cannot be negative')
  .max(1_000_000, 'Amount looks too large');

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(120),
  phone,
  email: z
    .union([z.string().trim().email('Enter a valid email'), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  instagram: optionalText.transform((v) => (v ? (v.startsWith('@') ? v : `@${v}`) : undefined)),
  location: z.string().trim().min(1, 'Choose a location'),
  source: z.enum(values(LEAD_SOURCES)),
  serviceId: optionalText,
  eventType: z.enum(values(EVENT_TYPES)),
  eventDate: optionalIsoDate,
  groupSize: z.coerce.number().int('Whole number only').min(1, 'At least 1 person').max(500),
  estimatedValue: money,
  stage: z.enum(values(PIPELINE_STAGES)),
  notes: z.string().max(4000).default(''),
});
export type ContactFormValues = z.input<typeof contactSchema>;

export const bookingSchema = z
  .object({
    contactId: z.string().min(1, 'Choose a customer'),
    serviceId: z.string().min(1, 'Choose a service'),
    eventType: z.enum(values(EVENT_TYPES)),
    date: isoDate,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 14:30'),
    durationMinutes: z.coerce.number().int().min(10, 'At least 10 minutes').max(24 * 60),
    location: z.string().trim().min(1, 'Enter where the appointment happens'),
    groupSize: z.coerce.number().int('Whole number only').min(1, 'At least 1 person').max(500),
    price: money,
    deposit: money,
    balancePaid: z.boolean().default(false),
    status: z.enum(values(BOOKING_STATUSES)),
    notes: z.string().max(4000).default(''),
    origin: z.enum(['pipeline', 'manual', 'website']).default('manual'),
  })
  .refine((b) => b.deposit <= b.price, { path: ['deposit'], message: 'Deposit cannot exceed the price' });

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a service name').max(80),
  description: z.string().trim().max(600).default(''),
  basePrice: money,
  priceUnit: z.enum(['flat', 'per_person']),
  durationMinutes: z.coerce.number().int().min(5, 'At least 5 minutes').max(24 * 60),
  active: z.boolean(),
});

export const interactionSchema = z.object({
  contactId: z.string().min(1),
  type: z.enum([...values(INTERACTION_TYPES), 'system']),
  summary: z.string().trim().min(2, 'Write a short summary').max(2000),
  occurredAt: z.string().min(1),
});

export const followUpSchema = z.object({
  contactId: z.string().min(1),
  dueDate: isoDate,
  note: z.string().trim().max(500).default(''),
});

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1, 'Enter a business name'),
  exchangeRate: z.coerce.number().positive('Rate must be above zero').max(1_000_000),
  currencyDisplay: z.enum(['USD', 'VES', 'both']),
});

/**
 * Public website inquiry payload. This is the contract for the future
 * `POST /api/inquiries` endpoint the business website will call.
 */
export const websiteInquirySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone,
  email: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  instagram: optionalText,
  location: z.string().trim().min(1).default('Other'),
  serviceId: optionalText,
  eventType: z.enum(values(EVENT_TYPES)).default('other'),
  eventDate: optionalIsoDate,
  groupSize: z.coerce.number().int().min(1).max(500).default(1),
  message: z.string().trim().max(4000).default(''),
});
export type WebsiteInquiry = z.input<typeof websiteInquirySchema>;

/** Flatten a ZodError into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export class ValidationError extends Error {
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Check the highlighted fields.');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(fieldErrors(result.error));
  return result.data;
}
