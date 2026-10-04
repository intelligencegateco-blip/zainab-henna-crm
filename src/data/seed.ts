/**
 * Demo data for a henna artist working across Venezuela.
 *
 * All people, phone numbers (555 exchange), emails (example.com) and handles are
 * fictional. Dates are generated relative to "now" so the dashboard always has
 * upcoming appointments, overdue follow-ups and recent history to show.
 */
import { addDays, format, setHours, setMinutes, subDays } from 'date-fns';
import type {
  Booking,
  BookingStatus,
  Contact,
  CrmSnapshot,
  EventType,
  FollowUp,
  Interaction,
  InteractionType,
  LeadSource,
  PipelineStage,
  Service,
} from '../types/models';
import { STAGE_INDEX } from '../lib/constants';

const SERVICES: Omit<Service, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'S-01',
    name: 'Bridal Henna',
    description: 'Full bridal henna for hands and feet, with a design consultation and an aftercare kit.',
    basePrice: 180,
    priceUnit: 'flat',
    durationMinutes: 240,
    active: true,
  },
  {
    id: 'S-02',
    name: 'Traditional Henna',
    description: 'Classic floral, paisley and vine patterns on one or both hands.',
    basePrice: 35,
    priceUnit: 'per_person',
    durationMinutes: 45,
    active: true,
  },
  {
    id: 'S-03',
    name: 'Party / Event Henna',
    description: 'Quick, elegant designs for guests at birthdays, showers and celebrations.',
    basePrice: 15,
    priceUnit: 'per_person',
    durationMinutes: 20,
    active: true,
  },
  {
    id: 'S-04',
    name: 'Individual Henna Appointment',
    description: 'A one-on-one studio session for a small design.',
    basePrice: 25,
    priceUnit: 'flat',
    durationMinutes: 30,
    active: true,
  },
  {
    id: 'S-05',
    name: 'Custom Henna Design',
    description: 'A design drawn from scratch around the client’s references, ideal for photoshoots.',
    basePrice: 60,
    priceUnit: 'flat',
    durationMinutes: 90,
    active: true,
  },
  {
    id: 'S-06',
    name: 'Group / Event Package',
    description: 'Henna station for up to 10 guests, including setup and aftercare cards.',
    basePrice: 220,
    priceUnit: 'flat',
    durationMinutes: 240,
    active: true,
  },
  {
    id: 'S-07',
    name: 'Jagua Temporary Tattoo',
    description: 'Blue-black jagua gel designs. Paused while supplies are restocked.',
    basePrice: 40,
    priceUnit: 'flat',
    durationMinutes: 45,
    active: false,
  },
];

interface PastBooking {
  daysAgo: number;
  serviceId: string;
  price: number;
  group?: number;
  event?: EventType;
  status?: BookingStatus;
}

interface Spec {
  name: string;
  phone: string;
  ig?: string;
  email?: boolean;
  location: string;
  area?: string;
  source: LeadSource;
  serviceId: string;
  event: EventType;
  /** Event date offset in days from today (negative = past). */
  eventIn: number;
  group: number;
  value: number;
  stage: PipelineStage;
  createdAgo: number;
  time?: string;
  notes: string;
  inquiry: string;
  history?: PastBooking[];
}

const SPECS: Spec[] = [
  { name: 'Valentina Rojas', phone: '+58 414-555-0142', ig: '@valen.rojas.ccs', email: true, location: 'Caracas', area: 'Altamira', source: 'instagram', serviceId: 'S-01', event: 'wedding', eventIn: 45, group: 4, value: 270, stage: 'booking_confirmed', createdAgo: 40, time: '09:00', notes: 'Moroccan-style patterns with fine Indian detailing on the palms. Bride plus 3 bridesmaids.', inquiry: 'Asked about bridal henna for her wedding and whether bridesmaids can be added.' },
  { name: 'Mariana Gutiérrez', phone: '+58 412-555-0187', email: true, location: 'Valencia', area: 'El Viñedo', source: 'whatsapp', serviceId: 'S-03', event: 'birthday', eventIn: 12, group: 12, value: 180, stage: 'quote_sent', createdAgo: 6, notes: 'Daughter’s quinceañera. Simple designs for 12 guests, about 2 hours.', inquiry: 'Wants henna for guests at her daughter’s quinceañera.' },
  { name: 'Daniela Pérez', phone: '+58 424-555-0119', ig: '@dani.perez.v', email: true, location: 'Caracas', area: 'Las Mercedes', source: 'referral', serviceId: 'S-01', event: 'bridal', eventIn: -58, group: 1, value: 180, stage: 'completed', createdAgo: 120, time: '10:00', notes: 'Referred by Samira Haddad. Prefers a very dark stain; reminded her to keep hands dry for 12 hours.', inquiry: 'Referred by a friend; asked about availability for bridal henna.' },
  { name: 'Andrea Méndez', phone: '+58 414-555-0163', email: true, location: 'Maracaibo', area: 'Tierra Negra', source: 'website', serviceId: 'S-06', event: 'baby_shower', eventIn: 20, group: 10, value: 220, stage: 'deposit_pending', createdAgo: 9, time: '15:00', notes: 'Baby shower for her sister. Pastel theme; would like small belly henna for the mom-to-be.', inquiry: 'Submitted the website form for a baby shower group package.' },
  { name: 'Gabriela Torres', phone: '+58 416-555-0105', ig: '@gabitorres.lch', location: 'Lechería', source: 'instagram', serviceId: 'S-04', event: 'individual', eventIn: 0, group: 1, value: 25, stage: 'booking_confirmed', createdAgo: 200, time: '16:00', notes: 'Regular client. Likes minimalist finger designs. Usually pays in cash (USD).', inquiry: 'Asked for a small finger design before a trip.', history: [ { daysAgo: 150, serviceId: 'S-04', price: 25 }, { daysAgo: 82, serviceId: 'S-05', price: 60, event: 'photoshoot' }, { daysAgo: 31, serviceId: 'S-02', price: 35 } ] },
  { name: 'Camila Fernández', phone: '+58 412-555-0131', email: true, location: 'Caracas', area: 'Chacao', source: 'facebook', serviceId: 'S-02', event: 'graduation', eventIn: 30, group: 3, value: 105, stage: 'contacted', createdAgo: 3, notes: 'Graduation from UCV. Wants matching designs with two friends.', inquiry: 'Messaged the Facebook page about henna for three graduates.' },
  { name: 'Sofía Ramírez', phone: '+58 424-555-0176', ig: '@sofi.ramirez.foto', location: 'Barquisimeto', source: 'whatsapp', serviceId: 'S-05', event: 'photoshoot', eventIn: 8, group: 1, value: 60, stage: 'consultation', createdAgo: 5, notes: 'Editorial shoot for a local jewelry brand. Designs need to frame gold rings and bracelets.', inquiry: 'Photographer asking for custom henna for a jewelry campaign.' },
  { name: 'Isabella Morales', phone: '+58 414-555-0158', ig: '@isa.morales', location: 'Caracas', area: 'El Hatillo', source: 'instagram', serviceId: 'S-03', event: 'festival', eventIn: -20, group: 25, value: 375, stage: 'lost', createdAgo: 50, notes: 'Wanted a henna stand at a cultural fair. Chose a cheaper vendor.', inquiry: 'Asked for a quote for a henna stand at a weekend cultural fair.' },
  { name: 'Lucía Herrera', phone: '+58 412-555-0144', email: true, location: 'Maracay', source: 'website', serviceId: 'S-01', event: 'wedding', eventIn: 90, group: 1, value: 180, stage: 'new_inquiry', createdAgo: 1, notes: '', inquiry: 'Website inquiry: bridal henna for a January wedding.' },
  { name: 'Paola Castillo', phone: '+58 426-555-0190', ig: '@paocastillo.mgta', location: 'Porlamar', source: 'referral', serviceId: 'S-06', event: 'party', eventIn: -10, group: 10, value: 220, stage: 'cancelled', createdAgo: 45, time: '17:00', notes: 'Beach party cancelled because of weather. Open to rebooking in December; deposit kept as credit.', inquiry: 'Referred by Rania Khoury; wants henna for a beach party.' },
  { name: 'Fabiola Medina', phone: '+58 414-555-0127', location: 'Caracas', area: 'Los Palos Grandes', source: 'walk_in', serviceId: 'S-04', event: 'individual', eventIn: -15, group: 1, value: 25, stage: 'completed', createdAgo: 70, time: '11:00', notes: 'Missed her first appointment; came back two weeks later.', inquiry: 'Walked into the studio asking for a small wrist design.', history: [ { daysAgo: 45, serviceId: 'S-04', price: 25, status: 'no_show' } ] },
  { name: 'Yusmary Contreras', phone: '+58 424-555-0112', email: true, location: 'Puerto La Cruz', source: 'whatsapp', serviceId: 'S-03', event: 'birthday', eventIn: 18, group: 15, value: 225, stage: 'awaiting_response', createdAgo: 10, notes: '30th birthday at a beach house. Checking guest count before confirming.', inquiry: 'Asked for henna at her 30th birthday for around 15 guests.' },
  { name: 'Nayeli Briceño', phone: '+58 416-555-0139', ig: '@nayeli.andes', location: 'Mérida', source: 'instagram', serviceId: 'S-05', event: 'photoshoot', eventIn: 25, group: 2, value: 120, stage: 'new_inquiry', createdAgo: 0, notes: '', inquiry: 'Instagram DM: custom henna for a couple’s photoshoot in the páramo.' },
  { name: 'Samira Haddad', phone: '+58 412-555-0101', ig: '@samira.haddad', email: true, location: 'Caracas', area: 'La Castellana', source: 'referral', serviceId: 'S-01', event: 'wedding', eventIn: 15, group: 6, value: 480, stage: 'booking_confirmed', createdAgo: 65, time: '14:00', notes: 'Henna night (laylat al-henna) two days before the wedding. Bride plus 5 family members. Traditional Lebanese motifs.', inquiry: 'Asked about a henna night for her wedding.', history: [ { daysAgo: 240, serviceId: 'S-02', price: 70, group: 2, event: 'festival' } ] },
  { name: 'Layla Nasser', phone: '+58 414-555-0166', ig: '@layla.nasser.vzla', email: true, location: 'Valencia', area: 'Prebo', source: 'instagram', serviceId: 'S-01', event: 'bridal', eventIn: -100, group: 1, value: 200, stage: 'completed', createdAgo: 150, time: '10:00', notes: 'Added a small design on the back of the neck (+$20). Very happy; sent photos.', inquiry: 'Saw bridal work on Instagram and asked for a date.' },
  { name: 'Fátima Zerpa', phone: '+58 424-555-0183', location: 'Maracaibo', source: 'facebook', serviceId: 'S-02', event: 'festival', eventIn: -70, group: 4, value: 140, stage: 'completed', createdAgo: 95, time: '13:00', notes: 'Eid gathering with her sisters and cousins.', inquiry: 'Asked for traditional henna for four people at Eid.' },
  { name: 'Rosa Villalobos', phone: '+58 412-555-0150', location: 'Caracas', area: 'Los Palos Grandes', source: 'other', serviceId: 'S-04', event: 'individual', eventIn: 6, group: 1, value: 25, stage: 'contacted', createdAgo: 4, notes: 'Saw a flyer at a café. Prefers weekday afternoons.', inquiry: 'Called after seeing a flyer at a café.' },
  { name: 'Carolina Salazar', phone: '+58 414-555-0109', email: true, location: 'Caracas', area: 'Altamira', source: 'website', serviceId: 'S-06', event: 'baby_shower', eventIn: 5, group: 10, value: 220, stage: 'booking_confirmed', createdAgo: 25, time: '15:30', notes: 'Garden baby shower. Bring a table and two chairs; client provides shade.', inquiry: 'Website booking request for a baby shower package.' },
  { name: 'Verónica Lugo', phone: '+58 416-555-0172', email: true, location: 'Valencia', source: 'whatsapp', serviceId: 'S-03', event: 'graduation', eventIn: 22, group: 8, value: 120, stage: 'quote_sent', createdAgo: 8, notes: 'Graduation party for 8 friends from the nursing class.', inquiry: 'Asked for henna for a graduation party.' },
  { name: 'Alejandra Ochoa', phone: '+58 424-555-0124', ig: '@ale.ochoa', email: true, location: 'Lechería', source: 'instagram', serviceId: 'S-01', event: 'wedding', eventIn: 60, group: 5, value: 420, stage: 'deposit_pending', createdAgo: 21, time: '10:00', notes: 'Bride plus 4 bridesmaids. Needs travel to Lechería; travel cost included in quote.', inquiry: 'Asked for bridal henna plus bridesmaids for a wedding in Lechería.' },
  { name: 'Mónica Rivas', phone: '+58 412-555-0195', location: 'Caracas', area: 'Chacao', source: 'referral', serviceId: 'S-02', event: 'birthday', eventIn: -35, group: 2, value: 70, stage: 'completed', createdAgo: 140, time: '18:00', notes: 'Birthday treat for her and her mother.', inquiry: 'Referred by Gabriela; asked for a quick studio session.', history: [ { daysAgo: 125, serviceId: 'S-04', price: 25, event: 'individual' } ] },
  { name: 'Estefanía Blanco', phone: '+58 414-555-0136', ig: '@estefi.blanco.mcy', location: 'Maracay', source: 'instagram', serviceId: 'S-05', event: 'photoshoot', eventIn: 14, group: 1, value: 60, stage: 'awaiting_response', createdAgo: 12, notes: 'Maternity photoshoot. Sent three design options; waiting for her pick.', inquiry: 'Asked about belly henna for a maternity photoshoot.' },
  { name: 'Rania Khoury', phone: '+58 426-555-0148', ig: '@rania.khoury', email: true, location: 'Porlamar', source: 'whatsapp', serviceId: 'S-01', event: 'wedding', eventIn: 28, group: 1, value: 200, stage: 'booking_confirmed', createdAgo: 33, time: '11:00', notes: 'Destination wedding on Margarita. Flight and hotel covered by the client.', inquiry: 'WhatsApp message asking about traveling to Margarita for a wedding.' },
  { name: 'Kimberly Parra', phone: '+58 416-555-0115', location: 'Barquisimeto', source: 'facebook', serviceId: 'S-03', event: 'party', eventIn: -5, group: 20, value: 300, stage: 'lost', createdAgo: 30, notes: 'Budget too tight for 20 guests. Offered a 10-guest package; no reply.', inquiry: 'Asked for henna for a 20-person party.' },
  { name: 'Natalia Aponte', phone: '+58 424-555-0161', email: true, location: 'Caracas', area: 'Las Mercedes', source: 'website', serviceId: 'S-04', event: 'individual', eventIn: 3, group: 1, value: 25, stage: 'new_inquiry', createdAgo: 1, notes: '', inquiry: 'Website request for an individual appointment this week.' },
  { name: 'Yasmín Arráez', phone: '+58 412-555-0178', location: 'Valencia', source: 'walk_in', serviceId: 'S-02', event: 'individual', eventIn: -48, group: 1, value: 35, stage: 'completed', createdAgo: 60, time: '12:00', notes: 'Visited during a pop-up at a Valencia market.', inquiry: 'Stopped by the pop-up stand at the market.' },
  { name: 'Oriana Quintero', phone: '+58 414-555-0193', ig: '@ori.quintero', location: 'Caracas', area: 'Santa Fe', source: 'instagram', serviceId: 'S-03', event: 'baby_shower', eventIn: 35, group: 12, value: 180, stage: 'consultation', createdAgo: 7, notes: 'Boho theme. Wants a henna moodboard before deciding.', inquiry: 'Asked about henna for guests at a boho baby shower.' },
  { name: 'Victoria Lander', phone: '+58 416-555-0129', email: true, location: 'Mérida', source: 'referral', serviceId: 'S-06', event: 'festival', eventIn: 40, group: 10, value: 220, stage: 'contacted', createdAgo: 2, notes: 'University cultural week. Needs an invoice for the student council.', inquiry: 'Student council asked for a henna station during cultural week.' },
  { name: 'Amira Saab', phone: '+58 424-555-0110', ig: '@amira.saab', email: true, location: 'Caracas', area: 'San Bernardino', source: 'instagram', serviceId: 'S-02', event: 'festival', eventIn: -22, group: 1, value: 35, stage: 'completed', createdAgo: 240, time: '17:30', notes: 'Bridal client from earlier this year; came back for Eid.', inquiry: 'Asked for traditional henna for Eid.', history: [ { daysAgo: 205, serviceId: 'S-01', price: 180, event: 'bridal' } ] },
  { name: 'Diana Sifontes', phone: '+58 412-555-0153', email: true, location: 'Maracay', source: 'website', serviceId: 'S-02', event: 'birthday', eventIn: -132, group: 3, value: 105, stage: 'completed', createdAgo: 160, time: '16:00', notes: 'Birthday at home with two friends.', inquiry: 'Website form: henna for a small birthday at home.' },
];

const CHANNEL_FOR_SOURCE: Record<LeadSource, InteractionType> = {
  instagram: 'instagram',
  whatsapp: 'whatsapp',
  website: 'email',
  facebook: 'note',
  referral: 'whatsapp',
  walk_in: 'in_person',
  other: 'call',
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, '.');

/** Stable pseudo-random hour so generated timestamps look natural but don't change between runs. */
const hourFor = (seed: number) => 9 + (seed * 7) % 10;

export function createSeedData(now: Date = new Date(), options: { exchangeRate?: number; businessName?: string } = {}): CrmSnapshot {
  const day = (offset: number) => format(addDays(now, offset), 'yyyy-MM-dd');
  const at = (daysAgo: number, seed: number) => {
    const d = setMinutes(setHours(subDays(now, daysAgo), hourFor(seed)), (seed * 13) % 60);
    // Never generate a timestamp in the future.
    return (d > now ? subDays(now, 0) : d).toISOString();
  };
  const atClamped = (daysAgo: number, seed: number) => {
    const iso = at(Math.max(daysAgo, 0), seed);
    return new Date(iso) > now ? new Date(now.getTime() - 3600_000).toISOString() : iso;
  };

  const seedTime = subDays(now, 260).toISOString();
  const services: Service[] = SERVICES.map((s) => ({ ...s, createdAt: seedTime, updatedAt: seedTime }));
  const contacts: Contact[] = [];
  const bookings: Booking[] = [];
  const interactions: Interaction[] = [];
  const followUps: FollowUp[] = [];
  let bookingSeq = 2001;
  let interactionSeq = 1;
  let followUpSeq = 1;

  const addInteraction = (contactId: string, type: InteractionType, summary: string, daysAgo: number, seed: number) => {
    interactions.push({
      id: `I-${String(interactionSeq++).padStart(4, '0')}`,
      contactId,
      type,
      summary,
      occurredAt: atClamped(daysAgo, seed),
    });
  };

  const venueFor = (spec: Spec) =>
    spec.event === 'individual' || spec.serviceId === 'S-04'
      ? 'Studio, Chacao'
      : `${spec.area ? `${spec.area}, ` : ''}${spec.location}`;

  SPECS.forEach((spec, index) => {
    const id = `C-${1001 + index}`;
    const stageIdx = STAGE_INDEX[spec.stage];
    const service = SERVICES.find((s) => s.id === spec.serviceId)!;
    const channel = CHANNEL_FOR_SOURCE[spec.source];
    const created = spec.createdAgo;
    const seed = index + 3;

    // ---- Conversation history, following the stages the lead has passed through ----
    addInteraction(id, channel === 'note' ? 'instagram' : channel, spec.inquiry, created, seed);
    const step = Math.max(1, Math.floor(created / 6));
    const touch = (n: number) => Math.max(0, created - step * n);

    if (spec.stage !== 'new_inquiry') {
      addInteraction(id, 'whatsapp', `Sent the price list and portfolio highlights for ${service.name.toLowerCase()}.`, touch(1), seed + 1);
    }
    if (stageIdx >= STAGE_INDEX.consultation) {
      addInteraction(id, 'call', 'Video call to review design references, placement and stain care.', touch(2), seed + 2);
    }
    if (stageIdx >= STAGE_INDEX.quote_sent) {
      addInteraction(id, 'whatsapp', `Sent quote for $${spec.value} (${spec.group} ${spec.group === 1 ? 'person' : 'people'}).`, touch(3), seed + 3);
    }
    if (stageIdx >= STAGE_INDEX.awaiting_response && spec.stage !== 'lost') {
      addInteraction(id, 'whatsapp', 'Followed up on the quote. Client is checking the date with family.', touch(4), seed + 4);
    }
    if (stageIdx >= STAGE_INDEX.deposit_pending && spec.stage !== 'lost') {
      addInteraction(id, 'whatsapp', 'Client accepted. Holding the date until the 30% deposit arrives.', touch(4.5), seed + 5);
    }
    if (stageIdx >= STAGE_INDEX.booking_confirmed && spec.stage !== 'lost') {
      const method = ['Zelle', 'Pago Móvil', 'cash (USD)', 'Binance Pay'][index % 4];
      addInteraction(id, 'note', `Deposit of $${Math.round(spec.value * 0.3)} received via ${method}. Date confirmed.`, touch(5), seed + 6);
    }
    if (spec.stage === 'completed') {
      addInteraction(id, 'whatsapp', 'Appointment done. Sent aftercare tips; client shared photos the next day.', Math.max(0, -spec.eventIn - 1), seed + 7);
    }
    if (spec.stage === 'cancelled') {
      addInteraction(id, 'call', 'Client cancelled. Offered to move the deposit to a new date.', Math.max(0, -spec.eventIn + 2), seed + 8);
    }
    if (spec.stage === 'lost') {
      addInteraction(id, 'note', 'Marked as lost: client went with another option.', Math.max(0, created - step * 3), seed + 9);
    }

    // ---- Bookings ----
    const mkBooking = (
      offset: number,
      status: BookingStatus,
      opts: { serviceId?: string; price?: number; group?: number; event?: EventType; time?: string; deposit?: number } = {},
    ) => {
      const sid = opts.serviceId ?? spec.serviceId;
      const svc = SERVICES.find((s) => s.id === sid)!;
      const price = opts.price ?? spec.value;
      const createdDaysAgo = Math.max(1, Math.min(created, -offset + 14));
      const deposit = opts.deposit ?? (status === 'pending' ? 0 : Math.round(price * 0.3));
      bookings.push({
        id: `B-${bookingSeq++}`,
        contactId: id,
        serviceId: sid,
        eventType: opts.event ?? spec.event,
        date: day(offset),
        startTime: opts.time ?? spec.time ?? '10:00',
        durationMinutes: svc.priceUnit === 'per_person' ? Math.min(480, svc.durationMinutes * (opts.group ?? spec.group)) : svc.durationMinutes,
        location: venueFor(spec),
        groupSize: opts.group ?? spec.group,
        price,
        deposit: Math.min(deposit, price),
        balancePaid: status === 'completed',
        status,
        notes: '',
        origin: spec.source === 'website' ? 'website' : 'pipeline',
        createdAt: at(createdDaysAgo, seed),
        updatedAt: at(Math.max(0, -offset), seed),
      });
    };

    for (const past of spec.history ?? []) {
      mkBooking(-past.daysAgo, past.status ?? 'completed', {
        serviceId: past.serviceId,
        price: past.price,
        group: past.group ?? 1,
        event: past.event ?? 'individual',
        time: '15:00',
        deposit: past.status === 'no_show' ? 0 : undefined,
      });
    }
    if (spec.stage === 'booking_confirmed') mkBooking(spec.eventIn, 'confirmed');
    if (spec.stage === 'deposit_pending') mkBooking(spec.eventIn, 'pending');
    if (spec.stage === 'completed') mkBooking(spec.eventIn, 'completed');
    if (spec.stage === 'cancelled') mkBooking(spec.eventIn, 'cancelled');

    // ---- Follow-ups for open leads, with a realistic mix of overdue / today / upcoming ----
    const open = stageIdx <= STAGE_INDEX.deposit_pending;
    if (open) {
      const due = [-2, 0, 1, 3, 0, -1, 5, 2][index % 8];
      const notes: Partial<Record<PipelineStage, string>> = {
        new_inquiry: 'Reply with prices and availability',
        contacted: 'Check if she saw the portfolio',
        consultation: 'Send design sketch for approval',
        quote_sent: 'Ask if the quote works for her budget',
        awaiting_response: 'Gentle nudge about the date',
        deposit_pending: 'Remind about deposit to secure the date',
      };
      followUps.push({
        id: `F-${String(followUpSeq++).padStart(4, '0')}`,
        contactId: id,
        dueDate: day(due),
        note: notes[spec.stage] ?? 'Follow up',
        createdAt: at(Math.max(0, created - 1), seed),
      });
    }
    if (spec.stage === 'completed' && spec.eventIn > -40) {
      followUps.push({
        id: `F-${String(followUpSeq++).padStart(4, '0')}`,
        contactId: id,
        dueDate: day(index % 2 ? 4 : -1),
        note: 'Ask for a review and photos for the portfolio',
        createdAt: at(Math.max(0, -spec.eventIn), seed),
      });
    }
    // A completed follow-up so the history view has something to show.
    if (stageIdx >= STAGE_INDEX.quote_sent) {
      followUps.push({
        id: `F-${String(followUpSeq++).padStart(4, '0')}`,
        contactId: id,
        dueDate: day(-Math.max(1, Math.floor(created / 2))),
        note: 'Confirm she received the quote',
        createdAt: at(created, seed),
        completedAt: at(Math.max(0, Math.floor(created / 2)), seed + 1),
      });
    }

    const own = interactions.filter((i) => i.contactId === id);
    const lastContactAt = own.map((i) => i.occurredAt).sort().at(-1);
    contacts.push({
      id,
      fullName: spec.name,
      phone: spec.phone,
      email: spec.email ? `${slug(spec.name)}@example.com` : undefined,
      instagram: spec.ig,
      location: spec.location,
      source: spec.source,
      serviceId: spec.serviceId,
      eventType: spec.event,
      eventDate: day(spec.eventIn),
      groupSize: spec.group,
      estimatedValue: spec.value,
      stage: spec.stage,
      stageUpdatedAt: at(Math.max(0, created - step * 4), seed),
      notes: spec.notes,
      archived: false,
      createdAt: at(created, seed),
      updatedAt: lastContactAt ?? at(created, seed),
      lastContactAt,
    });
  });

  return {
    contacts,
    bookings,
    services,
    interactions,
    followUps,
    settings: {
      businessName: options.businessName ?? 'Zainab Henna',
      baseCurrency: 'USD',
      exchangeRate: options.exchangeRate ?? 190,
      exchangeRateUpdatedAt: now.toISOString(),
      currencyDisplay: 'both',
    },
  };
}
