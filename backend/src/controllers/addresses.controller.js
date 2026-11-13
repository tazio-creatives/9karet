import { createAddressSchema, updateAddressSchema } from '../validators/addresses.validators.js';
import * as addressesService from '../services/addressesService.js';

function toDto(row) {
  return {
    id: row.id,
    type: row.type,
    isDefault: row.is_default,
    name: row.name,
    mobileNumber: row.mobile_number,
    addressLine: row.address_line,
    building: row.building,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
  };
}

export async function list(req, res, next) {
  try {
    const addresses = await addressesService.listAddresses(req.customer.id);
    res.json({ addresses: addresses.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createAddressSchema.parse(req.body);
    const address = await addressesService.createAddress(req.customer.id, input);
    res.status(201).json({ address: toDto(address) });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateAddressSchema.parse(req.body);
    const address = await addressesService.updateAddress(req.customer.id, req.params.id, input);
    res.json({ address: toDto(address) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await addressesService.deleteAddress(req.customer.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
