import { addCartItemSchema, updateCartItemSchema } from '../validators/cart.validators.js';
import * as cartService from '../services/cartService.js';

// Cart works for both guests (cart_session cookie, plan §27) and logged-in
// customers — never both keys at once, since login reassigns/merges the
// guest cart into the user's (see otp.controller.js verify()).
function ownerFromReq(req) {
  return req.customer
    ? { userId: req.customer.id, guestSessionId: undefined }
    : { userId: undefined, guestSessionId: req.cartSessionId };
}

export async function get(req, res, next) {
  try {
    const cart = await cartService.getCart(ownerFromReq(req));
    res.json(cart);
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    const input = addCartItemSchema.parse(req.body);
    const cart = await cartService.addItem(ownerFromReq(req), input);
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { quantity } = updateCartItemSchema.parse(req.body);
    const cart = await cartService.updateItemQuantity(ownerFromReq(req), req.params.variantId, quantity);
    res.json(cart);
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    const cart = await cartService.removeItem(ownerFromReq(req), req.params.variantId);
    res.json(cart);
  } catch (err) {
    next(err);
  }
}
