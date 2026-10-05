import { AppError } from '../utils/AppError.js';
import { checkDeliveryPincode, isValidPincode } from '../services/deliveryCheckService.js';

export async function checkPincode(req, res, next) {
  try {
    const { pincode } = req.params;
    if (!isValidPincode(pincode)) throw new AppError(400, 'Please enter a valid 6-digit pincode.');
    res.json(await checkDeliveryPincode(pincode));
  } catch (err) {
    next(err);
  }
}
