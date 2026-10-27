import 'dotenv/config';
import { store } from './db';

async function main(): Promise<void> {
  await store.init();
  await store.reset();
  const [customers, riders, orders] = await Promise.all([
    store.listCustomers(),
    store.listRiders(),
    store.listOrders(),
  ]);
  console.log(
    `Seed completed: ${customers.length} customers, ${riders.length} riders, ${orders.length} orders`,
  );
  console.log('รหัสพนักงานตัวอย่าง: JOB-001 ถึง JOB-010');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
