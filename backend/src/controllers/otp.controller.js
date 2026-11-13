import { otpSendSchema, otpVerifySchema } from '../validators/otp.validators.js';
import { sendOtp, verifyOtp } from '../services/otpService.js';
import { mergeCartsOnLogin } from '../services/cartService.js';
import { mergeWishlistsOnLogin } from '../services/wishlistService.js';

export async function send(req, res, next) {
  try {
    const { mobile, purpose } = otpSendSchema.parse(req.body);
    await sendOtp(mobile, purpose);
    // 202: OTP is being delivered asynchronously by the SMS provider; the
    // code itself is never included in the response (plan §12).
    res.status(202).json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
}

export async function verify(req, res, next) {
  try {
    const { mobile, otp, purpose } = otpVerifySchema.parse(req.body);
    const result = await verifyOtp(mobile, otp, purpose, {
      authenticatedUserId: req.customer?.id,
    });

    if (purpose === 'PHONE_CHANGE') {
      return res.json({
        verified: true,
        user: {
          id: result.user.id,
          mobileNumber: result.user.mobile_number,
          fullName: result.user.full_name,
          email: result.user.email,
        },
      });
    }

    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.customerId = result.user.id;

      // Fold whatever was in the guest cart_session cookie's cart/wishlist
      // into the now-identified user's (plan §11/§27) — best-effort, never
      // blocks login on a merge failure.
      try {
        await Promise.all([
          mergeCartsOnLogin(req.cartSessionId, result.user.id),
          mergeWishlistsOnLogin(req.cartSessionId, result.user.id),
        ]);
      } catch (mergeErr) {
        console.error('Cart/wishlist merge-on-login failed:', mergeErr);
      }

      res.json({
        verified: true,
        isNewUser: result.isNewUser,
        user: {
          id: result.user.id,
          mobileNumber: result.user.mobile_number,
          fullName: result.user.full_name,
          email: result.user.email,
        },
      });
    });
  } catch (err) {
    next(err);
  }
}
