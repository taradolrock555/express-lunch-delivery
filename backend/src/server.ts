import 'dotenv/config';
import { app } from './app';
import { store } from './db';

async function main(): Promise<void> {
  await store.init();
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    console.log(`Express Lunch Delivery API is running at http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
