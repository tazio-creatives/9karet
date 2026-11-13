import { withTransaction } from '../config/db.js';
import { NotFoundError } from '../utils/AppError.js';
import {
  listAddressesByUser,
  findAddressById,
  countAddressesForUserTx,
  clearDefaultForUserTx,
  createAddressTx,
  updateAddressTx,
  setDefaultTx,
  deleteAddress as deleteAddressRow,
} from '../repositories/addresses.repository.js';

export function listAddresses(userId) {
  return listAddressesByUser(userId);
}

async function assertOwned(userId, id) {
  const existing = await findAddressById(id);
  if (!existing || existing.user_id !== userId) throw new NotFoundError('Address not found');
  return existing;
}

// First address for a user always becomes the default (plan §11) — no
// empty-default state to handle at checkout. Flipping the default is done
// inside one transaction so the partial unique index (one default per user)
// never sees two rows briefly both true/both false.
export async function createAddress(userId, input) {
  return withTransaction(async (client) => {
    const isFirst = (await countAddressesForUserTx(client, userId)) === 0;
    const shouldBeDefault = input.isDefault === true || isFirst;
    if (shouldBeDefault) await clearDefaultForUserTx(client, userId);
    return createAddressTx(client, { ...input, userId, isDefault: shouldBeDefault });
  });
}

export async function updateAddress(userId, id, input) {
  await assertOwned(userId, id);
  return withTransaction(async (client) => {
    if (input.isDefault === true) await clearDefaultForUserTx(client, userId);
    return updateAddressTx(client, id, input);
  });
}

export async function deleteAddress(userId, id) {
  const existing = await assertOwned(userId, id);
  await deleteAddressRow(id);

  if (existing.is_default) {
    const remaining = await listAddressesByUser(userId);
    if (remaining.length > 0) {
      await withTransaction((client) => setDefaultTx(client, remaining[0].id));
    }
  }
}

export async function getOwnedAddress(userId, id) {
  return assertOwned(userId, id);
}
