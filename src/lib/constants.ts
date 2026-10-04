import type {
  BookingStatus,
  EventType,
  InteractionType,
  LeadSource,
  LeadStatus,
  PipelineStage,
} from '../types/models';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const LEAD_SOURCES: Option<LeadSource>[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
];

export const EVENT_TYPES: Option<EventType>[] = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'bridal', label: 'Bridal henna' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'party', label: 'Party' },
  { value: 'baby_shower', label: 'Baby shower' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'festival', label: 'Festival' },
  { value: 'individual', label: 'Individual appointment' },
  { value: 'other', label: 'Other' },
];

/** Pipeline stages in order. `open` = the lead still needs work from Zainab. */
export const PIPELINE_STAGES: (Option<PipelineStage> & { open: boolean; hint: string })[] = [
  { value: 'new_inquiry', label: 'New inquiry', open: true, hint: 'Reply within a day' },
  { value: 'contacted', label: 'Contacted', open: true, hint: 'First reply sent' },
  { value: 'consultation', label: 'Consultation', open: true, hint: 'Gathering requirements' },
  { value: 'quote_sent', label: 'Quote sent', open: true, hint: 'Price shared' },
  { value: 'awaiting_response', label: 'Awaiting client', open: true, hint: 'Ball in their court' },
  { value: 'deposit_pending', label: 'Deposit pending', open: true, hint: 'Date held, unpaid' },
  { value: 'booking_confirmed', label: 'Booking confirmed', open: false, hint: 'On the calendar' },
  { value: 'completed', label: 'Completed', open: false, hint: 'Service delivered' },
  { value: 'cancelled', label: 'Cancelled', open: false, hint: 'Booking called off' },
  { value: 'lost', label: 'Lost', open: false, hint: 'Did not book' },
];

export const BOOKING_STATUSES: Option<BookingStatus>[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];

export const LEAD_STATUSES: Option<LeadStatus>[] = [
  { value: 'new', label: 'New' },
  { value: 'active', label: 'Active' },
  { value: 'customer', label: 'Customer' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
];

export const INTERACTION_TYPES: Option<InteractionType>[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram DM' },
  { value: 'call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In person' },
  { value: 'note', label: 'Note' },
];

export const LOCATIONS = [
  'Caracas',
  'Valencia',
  'Maracaibo',
  'Barquisimeto',
  'Maracay',
  'Lechería',
  'Puerto La Cruz',
  'Porlamar',
  'Mérida',
  'Other',
];

const labelMap = <T extends string>(options: Option<T>[]) =>
  Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;

export const SOURCE_LABEL = labelMap(LEAD_SOURCES);
export const EVENT_LABEL = labelMap(EVENT_TYPES);
export const STAGE_LABEL = labelMap(PIPELINE_STAGES);
export const BOOKING_STATUS_LABEL = labelMap(BOOKING_STATUSES);
export const LEAD_STATUS_LABEL = labelMap(LEAD_STATUSES);
export const INTERACTION_LABEL: Record<InteractionType, string> = {
  ...labelMap(INTERACTION_TYPES),
  system: 'Update',
};

export const STAGE_INDEX: Record<PipelineStage, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s.value, i]),
) as Record<PipelineStage, number>;

/**
 * Validated categorical chart palette derived from the logo gold
 * (passes lightness, chroma, CVD and contrast checks on the light surface).
 * Assign in this fixed order; never cycle past the end — fold into "Other".
 */
export const CHART_COLORS = ['#A8772A', '#008DA0', '#B0402A', '#3E5CA8', '#5F7F1E', '#8A45A0', '#C9668A'];
