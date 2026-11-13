import { z } from 'zod';

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(200),
  phone: optionalText(30).refine((v) => !v || /^[+\d][\d\s-]{6,}$/.test(v), 'Please enter a valid phone number'),
  orderNumber: optionalText(60),
  message: z.string().trim().min(10, 'Please tell us a little more (at least 10 characters)').max(5000),
  // Honeypot — a field real visitors never see or fill (hidden in the form);
  // bots that auto-fill every input give themselves away.
  website: z.string().optional(),
});

export const listContactMessagesQuerySchema = z.object({
  status: z.enum(['NEW', 'READ', 'RESOLVED']).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const updateContactMessageSchema = z
  .object({
    status: z.enum(['NEW', 'READ', 'RESOLVED']).optional(),
    adminNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
