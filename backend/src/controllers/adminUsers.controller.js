import {
  createAdminUserSchema,
  updateAdminUserSchema,
  listAdminUsersQuerySchema,
  createRoleSchema,
  updateRoleSchema,
} from '../validators/adminUsers.validators.js';
import * as adminUsersService from '../services/adminUsersService.js';
import { listAdminUsers } from '../repositories/adminUsers.repository.js';
import { listRoles, countAdminUsersByRoleId } from '../repositories/adminRoles.repository.js';

function toAdminUserDto(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    role: { id: row.role_id, name: row.role_name, permissions: row.permissions },
    createdAt: row.created_at,
  };
}

function toRoleDto(row) {
  return { id: row.id, name: row.name, permissions: row.permissions };
}

export async function list(req, res, next) {
  try {
    const q = listAdminUsersQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const { items, total } = await listAdminUsers({ page, limit });
    res.json({
      adminUsers: items.map(toAdminUserDto),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function roles(req, res, next) {
  try {
    const rows = await listRoles();
    const withCounts = await Promise.all(
      rows.map(async (r) => ({ ...toRoleDto(r), adminUserCount: await countAdminUsersByRoleId(r.id) })),
    );
    res.json({ roles: withCounts });
  } catch (err) {
    next(err);
  }
}

export async function createRole(req, res, next) {
  try {
    const input = createRoleSchema.parse(req.body);
    const role = await adminUsersService.createRole(input);
    res.status(201).json({ role: toRoleDto(role) });
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const input = updateRoleSchema.parse(req.body);
    const role = await adminUsersService.updateRole(req.params.id, input);
    res.json({ role: toRoleDto(role) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createAdminUserSchema.parse(req.body);
    const admin = await adminUsersService.createAdminUser(input);
    res.status(201).json({ adminUser: toAdminUserDto(admin) });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateAdminUserSchema.parse(req.body);
    const admin = await adminUsersService.updateAdminUser(req.params.id, req.admin.id, input);
    res.json({ adminUser: toAdminUserDto(admin) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await adminUsersService.deleteAdminUser(req.params.id, req.admin.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
