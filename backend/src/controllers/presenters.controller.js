import { findActivePresenters, findPresenterById } from '../repositories/presenters.repository.js';
import { NotFoundError } from '../utils/AppError.js';

function listDto(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    styleLabel: row.style_label,
    mainPreviewImageUrl: row.main_preview_image_url,
    supportedJewelleryTypes: row.supported_jewellery_types,
    isDefault: row.is_default,
  };
}

function detailDto(row) {
  return {
    ...listDto(row),
    frontPortraitUrl: row.front_portrait_url,
    face45Url: row.face_45_url,
    sideProfileUrl: row.side_profile_url,
    jewelleryPlacementUrl: row.jewellery_placement_url,
  };
}

// Step 3's picker grid — active presenters only, optionally scoped to the
// job's confirmed jewellery type.
export async function list(req, res, next) {
  try {
    const presenters = await findActivePresenters({ jewelleryType: req.query.jewelleryType || undefined });
    res.json({ presenters: presenters.map(listDto) });
  } catch (err) {
    next(err);
  }
}

// "View References" modal — full reference image set. Not gated on
// is_active, so a job that already picked a since-deactivated presenter can
// still render it.
export async function getOne(req, res, next) {
  try {
    const presenter = await findPresenterById(req.params.id);
    if (!presenter) throw new NotFoundError('Presenter not found');
    res.json({ presenter: detailDto(presenter) });
  } catch (err) {
    next(err);
  }
}
