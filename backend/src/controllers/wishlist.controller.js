import { addWishlistItemSchema } from '../validators/wishlist.validators.js';
import * as wishlistService from '../services/wishlistService.js';

function ownerFromReq(req) {
  return req.customer
    ? { userId: req.customer.id, guestSessionId: undefined }
    : { userId: undefined, guestSessionId: req.cartSessionId };
}

export async function get(req, res, next) {
  try {
    const wishlist = await wishlistService.getWishlist(ownerFromReq(req));
    res.json(wishlist);
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    const { productId } = addWishlistItemSchema.parse(req.body);
    const wishlist = await wishlistService.addItem(ownerFromReq(req), productId);
    res.status(201).json(wishlist);
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    const wishlist = await wishlistService.removeItem(ownerFromReq(req), req.params.productId);
    res.json(wishlist);
  } catch (err) {
    next(err);
  }
}
