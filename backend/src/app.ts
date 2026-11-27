import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((value) => value.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Фото заявок: только чтение из volume `uploads`
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: true, index: false }));

  app.use('/api', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Маршрут не найден / route not found' });
  });

  app.use(errorHandler);
  return app;
}
