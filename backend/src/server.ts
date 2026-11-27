import { config } from './config';
import { createApp } from './app';
import { prisma } from './prisma';

async function main(): Promise<void> {
  const app = createApp();

  await prisma.$connect();

  const server = app.listen(config.port, () => {
    console.log(`[cityfix] API слушает http://localhost:${config.port}/api (${config.env})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[cityfix] ${signal}: останавливаюсь / shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[cityfix] не удалось запустить API / failed to start API:', error);
  process.exit(1);
});
