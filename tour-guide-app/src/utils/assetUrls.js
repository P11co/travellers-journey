import { buildApiUrl } from '../services/apiService';

export const resolveBackendAssetUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  return buildApiUrl(pathOrUrl);
};

export const backendImageSource = (pathOrUrl) => {
  const uri = resolveBackendAssetUrl(pathOrUrl);
  return uri ? { uri } : null;
};
