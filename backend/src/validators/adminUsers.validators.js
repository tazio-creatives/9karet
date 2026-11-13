import { z } from 'zod';
import { ADMIN_PERMISSION_MODULES } from '../constants/adminPermissions.js';

const permissionsField = z.array(z.enum(ADMIN_PERMISSION_MODULES)).min(1, 'Select at least one permission');

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  permissions: permissionsField,
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  permissions: permissionsField.optional(),
});

export const createAdminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  fullName: z.string().trim().min(1).max(200),
  roleId: z.string().uuid(),
});

export const updateAdminUserSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(10).max(200).optional(),
});

export const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
