export interface ConditionPhotoRef {
  id?: string;
  path?: string;
  uri: string;
  note?: string;
  capturedAt?: string;
  painIntensity?: number;
}

export interface ConditionUpdateItem {
  updateNumber: number;
  title: string;
  text: string;
  dateLabel: string;
  painIntensity?: number;
  photoFileName?: string;
  photoUri?: string;
  isResolvedEvent?: boolean;
}

const MAX_DESCRIPTION_LENGTH = 2000;
const UPDATE_LINE_REGEX =
  /^Actualizaci[oó]n\s+(\d+)\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?\s*-\s*(.*)$/i;
const TRAILING_PHOTO_TAG_REGEX = /\s*\[Foto:\s*([^\]]+)\]\s*$/i;

export function extractPhotoFileName(pathOrUri?: string | null): string | undefined {
  if (!pathOrUri) return undefined;
  const withoutQuery = pathOrUri.split('?')[0]?.trim();
  if (!withoutQuery) return undefined;
  const parts = withoutQuery.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last && last.length <= 120 ? last : undefined;
}

export function formatShortUpdateDate(
  input: Date | string | null | undefined = new Date()
): string {
  if (input === null) return '';
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return '';
    const normalized = trimmed.includes(' ') && !trimmed.includes('T')
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return trimmed;
    date = parsed;
  } else {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function sanitizeInlineText(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatUpdateLine(item: ConditionUpdateItem): string {
  const num = Math.max(1, Math.round(item.updateNumber));
  const datePart = item.dateLabel ? ` [${sanitizeInlineText(item.dateLabel)}]` : '';
  let statusPart = '';
  if (item.isResolvedEvent || item.painIntensity === 0) {
    statusPart = ' (Curado · 0/10)';
  } else if (typeof item.painIntensity === 'number' && Number.isFinite(item.painIntensity)) {
    statusPart = ` (Dolor ${Math.max(1, Math.min(10, Math.round(item.painIntensity)))}/10)`;
  }
  const cleanText = sanitizeInlineText(item.text) || 'Seguimiento registrado';
  const photoPart = item.photoFileName ? ` [Foto: ${sanitizeInlineText(item.photoFileName)}]` : '';
  return `Actualización ${num}${datePart}${statusPart} - ${cleanText}${photoPart}`;
}

export function serializeConditionUpdates(
  updates: ConditionUpdateItem[],
  maxLength: number = MAX_DESCRIPTION_LENGTH
): string {
  if (updates.length === 0) return '';

  const working = updates.map((u) => ({ ...u }));
  let serialized = working.map(formatUpdateLine).join('\n');

  if (serialized.length <= maxLength) {
    return serialized;
  }

  for (let i = 0; i < working.length && serialized.length > maxLength; i++) {
    const excess = serialized.length - maxLength;
    const currentText = sanitizeInlineText(working[i].text);
    if (currentText.length > 24) {
      const targetLen = Math.max(18, currentText.length - excess - 3);
      working[i].text = `${currentText.slice(0, targetLen).trim()}...`;
      serialized = working.map(formatUpdateLine).join('\n');
    }
  }

  while (serialized.length > maxLength && working.length > 2) {
    working.splice(1, 1);
    serialized = working.map(formatUpdateLine).join('\n');
  }

  if (serialized.length > maxLength) {
    serialized = serialized.slice(0, maxLength);
  }

  return serialized;
}

export function parseConditionUpdates(options: {
  description?: string | null;
  fallbackPain?: number;
  fallbackDateLabel?: string;
  photos?: ConditionPhotoRef[];
}): ConditionUpdateItem[] {
  const { description, fallbackPain, fallbackDateLabel, photos = [] } = options;
  const raw = (description ?? '').trim();
  const parsed: ConditionUpdateItem[] = [];

  if (raw) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let matchedAny = false;
    for (const line of lines) {
      const match = UPDATE_LINE_REGEX.exec(line);
      if (!match) continue;
      matchedAny = true;

      const updateNumber = Math.max(1, Number(match[1]) || parsed.length + 1);
      const dateLabel = (match[2] ?? '').trim();
      const meta = (match[3] ?? '').trim();
      let body = (match[4] ?? '').trim();

      let isResolvedEvent = false;
      let painIntensity: number | undefined;

      if (/curado/i.test(meta)) {
        isResolvedEvent = true;
        painIntensity = 0;
      } else {
        const painMatch = /(\d+)\s*\/\s*10/.exec(meta);
        if (painMatch) {
          painIntensity = Number(painMatch[1]);
          if (painIntensity === 0) {
            isResolvedEvent = true;
          }
        }
      }

      let photoFileName: string | undefined;
      const photoMatch = TRAILING_PHOTO_TAG_REGEX.exec(body);
      if (photoMatch) {
        photoFileName = photoMatch[1].trim();
        body = body.replace(TRAILING_PHOTO_TAG_REGEX, '').trim();
      }

      parsed.push({
        updateNumber,
        title: `Actualización ${updateNumber}`,
        text: body,
        dateLabel,
        painIntensity,
        photoFileName,
        isResolvedEvent,
      });
    }

    if (!matchedAny) {
      parsed.push({
        updateNumber: 1,
        title: 'Actualización 1',
        text: raw,
        dateLabel: fallbackDateLabel ?? '',
        painIntensity: fallbackPain,
        isResolvedEvent: fallbackPain === 0,
      });
    }
  }

  const usedPhotoIndices = new Set<number>();

  for (const item of parsed) {
    if (!item.photoFileName) continue;
    const needle = item.photoFileName.toLowerCase();
    const foundIdx = photos.findIndex((photo, idx) => {
      if (usedPhotoIndices.has(idx)) return false;
      const candidatePath = (photo.path ?? photo.id ?? '').toLowerCase();
      const candidateUri = photo.uri.toLowerCase();
      return candidatePath.endsWith(needle) || candidatePath.includes(needle) || candidateUri.includes(needle);
    });
    if (foundIdx >= 0) {
      usedPhotoIndices.add(foundIdx);
      item.photoUri = photos[foundIdx].uri;
    }
  }

  for (const item of parsed) {
    if (item.photoUri || item.photoFileName) continue;
    const candidateIdx = item.updateNumber - 1;
    if (candidateIdx >= 0 && candidateIdx < photos.length && !usedPhotoIndices.has(candidateIdx)) {
      usedPhotoIndices.add(candidateIdx);
      const p = photos[candidateIdx];
      item.photoUri = p.uri;
      item.photoFileName = extractPhotoFileName(p.path ?? p.id ?? p.uri);
    }
  }

  let nextNum = parsed.reduce((max, item) => Math.max(max, item.updateNumber), 0) + 1;
  photos.forEach((p, idx) => {
    if (usedPhotoIndices.has(idx)) return;
    parsed.push({
      updateNumber: nextNum,
      title: `Actualización ${nextNum}`,
      text: p.note?.trim() || 'Registro fotográfico de seguimiento',
      dateLabel: p.capturedAt?.trim() || '',
      painIntensity: p.painIntensity,
      photoFileName: extractPhotoFileName(p.path ?? p.id ?? p.uri),
      photoUri: p.uri,
    });
    nextNum += 1;
  });

  return parsed.sort((a, b) => a.updateNumber - b.updateNumber);
}

export function appendConditionUpdate(params: {
  existingDescription?: string | null;
  newText: string;
  painIntensity: number;
  photoPathOrFileName?: string | null;
  isResolvedEvent?: boolean;
  date?: Date;
  fallbackPain?: number;
  fallbackDateLabel?: string;
}): {
  serializedDescription: string;
  updates: ConditionUpdateItem[];
  addedUpdate: ConditionUpdateItem;
} {
  const existing = parseConditionUpdates({
    description: params.existingDescription,
    fallbackPain: params.fallbackPain,
    fallbackDateLabel: params.fallbackDateLabel,
  });

  const nextNumber =
    existing.length > 0 ? Math.max(...existing.map((u) => u.updateNumber)) + 1 : 1;

  const isResolved = Boolean(params.isResolvedEvent || params.painIntensity === 0);
  const addedUpdate: ConditionUpdateItem = {
    updateNumber: nextNumber,
    title: `Actualización ${nextNumber}`,
    text: sanitizeInlineText(params.newText) || (isResolved ? 'Ya no siento el síntoma.' : 'Actualización registrada.'),
    dateLabel: formatShortUpdateDate(params.date ?? new Date()),
    painIntensity: isResolved ? 0 : params.painIntensity,
    photoFileName: extractPhotoFileName(params.photoPathOrFileName),
    isResolvedEvent: isResolved,
  };

  const combined = [...existing, addedUpdate];
  const serializedDescription = serializeConditionUpdates(combined);

  return {
    serializedDescription,
    updates: combined,
    addedUpdate,
  };
}
