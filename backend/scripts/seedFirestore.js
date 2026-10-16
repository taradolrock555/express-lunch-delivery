const { app, db } = require('../config/firebase');
const { deleteApp } = require('firebase-admin/app');
const mockData = require('../data/mockData');

async function clearCollection(name) {
  const collection = db.collection(name);
  const snapshot = await collection.get();

  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    snapshot.docs.slice(offset, offset + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function seedCollection(name, records) {
  const batch = db.batch();
  records.forEach((record) => batch.set(db.collection(name).doc(String(record.id)), record));
  await batch.commit();
}

async function seedFirestore() {
  await Promise.all(['customers', 'riders', 'orders'].map(clearCollection));
  await Promise.all([
    seedCollection('customers', mockData.customers),
    seedCollection('riders', mockData.riders),
    seedCollection('orders', mockData.orders)
  ]);
  await db.collection('_metadata').doc('counters').set({
    nextCustomerId: mockData.nextCustomerId,
    nextOrderId: mockData.nextOrderId
  });

  console.log(
    `Seeded ${mockData.customers.length} customers, ${mockData.riders.length} riders, ` +
    `${mockData.orders.length} orders.`
  );
}

seedFirestore()
  .catch((error) => {
    console.error('Failed to seed Firestore:', error);
    process.exitCode = 1;
  })
  .finally(() => deleteApp(app));
