const normalizeExtension = (extension?: string) => {
  if (!extension) return 'jpg';
  const sanitized = extension.replace('.', '').toLowerCase();
  return sanitized || 'jpg';
};

const makeFileId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

export const buildAvatarPath = (userId: string, extension?: string) =>
  `${userId}/${makeFileId()}.${normalizeExtension(extension)}`;

export const buildClosetCoverPath = (userId: string, closetId: string, extension?: string) =>
  `${userId}/${closetId}/${makeFileId()}.${normalizeExtension(extension)}`;

export const buildItemPrimaryImagePath = (userId: string, itemId: string, extension?: string) =>
  `${userId}/${itemId}/primary/${makeFileId()}.${normalizeExtension(extension)}`;

export const buildItemExtraImagePath = (userId: string, itemId: string, extension?: string) =>
  `${userId}/${itemId}/extra/${makeFileId()}.${normalizeExtension(extension)}`;
