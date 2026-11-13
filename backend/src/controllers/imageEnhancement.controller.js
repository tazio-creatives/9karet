import { AppError } from '../utils/AppError.js';
import { enhanceJewelleryImage } from '../services/imageEnhancementService.js';

export async function enhance(req, res, next) {
  try {
    if (!req.file) throw new AppError(400, 'No image uploaded');

    const { buffer, mimeType } = await enhanceJewelleryImage(req.file.buffer, req.file.mimetype);
    res.json({
      image: `data:${mimeType};base64,${buffer.toString('base64')}`,
      mimeType,
    });
  } catch (err) {
    next(err);
  }
}
