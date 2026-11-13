import { apiFetch } from './client';
import type { JewelleryType } from './aiStudio';

export interface PresenterSummary {
  id: string;
  displayName: string;
  styleLabel: string;
  mainPreviewImageUrl: string;
  supportedJewelleryTypes: JewelleryType[];
  isDefault: boolean;
}

export interface PresenterDetail extends PresenterSummary {
  frontPortraitUrl: string;
  face45Url: string;
  sideProfileUrl: string;
  jewelleryPlacementUrl: string;
}

export function fetchPresenters(jewelleryType?: JewelleryType) {
  const query = jewelleryType ? `?jewelleryType=${jewelleryType}` : '';
  return apiFetch<{ presenters: PresenterSummary[] }>(`/admin/presenters${query}`);
}

export function fetchPresenter(id: string) {
  return apiFetch<{ presenter: PresenterDetail }>(`/admin/presenters/${id}`);
}
