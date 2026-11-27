import fs from 'node:fs';
import multer from 'multer';
import { config } from '../config';
import { HttpError } from '../utils/httpError';

/** TC-3: только изображения, всё остальное отклоняется с понятным текстом. */
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] ?? '.bin';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(
        new HttpError(
          400,
          `Недопустимый тип файла. Разрешены JPG, PNG, WEBP / unsupported file type, allowed: JPG, PNG, WEBP`,
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('photo');

/** Удаляет уже сохранённый файл, если дальше валидация не прошла (иначе в volume остаётся мусор). */
export function removeUploadedFile(filePath: string | undefined): void {
  if (!filePath) {
    return;
  }
  fs.promises.unlink(filePath).catch(() => undefined);
}

export function photoUrlFor(file: Express.Multer.File | undefined): string | null {
  return file ? `/uploads/${file.filename}` : null;
}
