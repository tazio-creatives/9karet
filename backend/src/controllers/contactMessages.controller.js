import {
  createContactMessageSchema,
  listContactMessagesQuerySchema,
  updateContactMessageSchema,
} from '../validators/contactMessages.validators.js';
import {
  insertContactMessage,
  findContactMessages,
  findContactMessageById,
  updateContactMessage,
  countNewContactMessages,
} from '../repositories/contactMessages.repository.js';
import { enqueueEmail } from '../services/emailService.js';
import { env } from '../config/env.js';
import { NotFoundError } from '../utils/AppError.js';

function toDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    orderNumber: row.order_number,
    message: row.message,
    status: row.status,
    adminNote: row.admin_note,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public storefront "Contact Us" form. Saved first, then two emails are
// queued: a notification to the support inbox and an acknowledgement to the
// customer. A filled honeypot gets the same success response (so bots learn
// nothing) but is never stored or emailed.
export async function create(req, res, next) {
  try {
    const input = createContactMessageSchema.parse(req.body);
    if (input.website) {
      return res.status(201).json({ ok: true });
    }

    const row = await insertContactMessage({
      name: input.name,
      email: input.email,
      phone: input.phone,
      orderNumber: input.orderNumber,
      message: input.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
    });

    // The message is already saved (and visible in Admin → Messages), so an
    // email-queue hiccup must not turn the customer's submission into an error.
    try {
      await enqueueEmail(env.contactInboxEmail, 'CONTACT_MESSAGE_RECEIVED', {
        name: row.name,
        email: row.email,
        phone: row.phone,
        orderNumber: row.order_number,
        message: row.message,
      });
      await enqueueEmail(row.email, 'CONTACT_ACKNOWLEDGEMENT', { name: row.name });
    } catch (err) {
      console.error(`Contact message ${row.id} saved, but queuing its emails failed:`, err);
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const q = listContactMessagesQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [{ items, total }, newCount] = await Promise.all([
      findContactMessages({ status: q.status, search: q.search, page, limit }),
      countNewContactMessages(),
    ]);
    res.json({
      messages: items.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      newCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const existing = await findContactMessageById(req.params.id);
    if (!existing) throw new NotFoundError('Message not found');
    const fields = updateContactMessageSchema.parse(req.body);
    const updated = await updateContactMessage(existing.id, fields, req.admin.id);
    res.json({ message: toDto(updated) });
  } catch (err) {
    next(err);
  }
}
