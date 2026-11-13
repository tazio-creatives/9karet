import { z } from 'zod';
import { listUsers, findUserById } from '../repositories/users.repository.js';
import { findOrdersByUser } from '../repositories/orders.repository.js';
import { NotFoundError } from '../utils/AppError.js';

const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function toCustomerDto(row) {
  return {
    id: row.id,
    mobileNumber: row.mobile_number,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function toOrderListDto(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: Number(order.total_amount),
    createdAt: order.created_at,
  };
}

export async function list(req, res, next) {
  try {
    const q = listQuerySchema.parse(req.query);
    const { items, total } = await listUsers({
      search: q.search,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
    res.json({
      customers: items.map(toCustomerDto),
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      total,
      totalPages: Math.ceil(total / (q.limit ?? 20)),
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    const user = await findUserById(req.params.id);
    if (!user) throw new NotFoundError('Customer not found');
    const { items } = await findOrdersByUser(user.id, { page: 1, limit: 50 });
    res.json({ customer: toCustomerDto(user), orders: items.map(toOrderListDto) });
  } catch (err) {
    next(err);
  }
}
