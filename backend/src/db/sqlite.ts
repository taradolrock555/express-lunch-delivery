import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mockCustomers, mockOrders, mockRiders } from '../data/mockData';
import type {
  Customer,
  CustomerInput,
  Order,
  OrderStatus,
  RiderAssignmentMode,
  Rider,
  RiderStatus,
  RoutePlan,
} from '../types';
import { SQLITE_SCHEMA } from './schema';
import type { ActiveOrderFilter, OrderUpdate, Store } from './store';

type Row = Record<string, unknown>;

const now = () => new Date().toISOString();

const asNumber = (value: unknown): number => Number(value);
const asText = (value: unknown): string => String(value ?? '');

function toCustomer(row: Row): Customer {
  return {
    id: asNumber(row.id),
    name: asText(row.name),
    phone: asText(row.phone),
    address: asText(row.address),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
  };
}

function toRider(row: Row): Rider {
  return {
    id: asNumber(row.id),
    name: asText(row.name),
    jobCode: asText(row.job_code),
    status: asText(row.status) as RiderStatus,
  };
}

function toOrder(row: Row): Order {
  return {
    id: asNumber(row.id),
    customerId: asNumber(row.customer_id),
    riderId: row.rider_id === null || row.rider_id === undefined ? null : asNumber(row.rider_id),
    assignmentMode: asText(row.assignment_mode) as RiderAssignmentMode,
    totalBoxes: asNumber(row.total_boxes),
    status: asText(row.status) as OrderStatus,
    createdAt: asText(row.created_at),
    updatedAt: asText(row.updated_at),
  };
}

export class SqliteStore implements Store {
  private db: DatabaseSync;

  constructor(private readonly file = process.env.SQLITE_FILE || './data/lunch-delivery.db') {
    const target = file === ':memory:' ? file : path.resolve(file);
    if (target !== ':memory:') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
    }
    this.db = new DatabaseSync(target);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  async init(): Promise<void> {
    this.db.exec(SQLITE_SCHEMA);
    this.ensureOrderRiderColumn();
    this.ensureAssignmentModeColumn();
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM customers').get() as Row;
    if (asNumber(row.count) === 0) {
      this.seed();
    }
  }

  async reset(): Promise<void> {
    this.db.exec(`
      DROP TABLE IF EXISTS route_plans;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS riders;
      DROP TABLE IF EXISTS customers;
    `);
    this.db.exec(SQLITE_SCHEMA);
    this.ensureOrderRiderColumn();
    this.ensureAssignmentModeColumn();
    this.seed();
  }

  /**
   * ฐานข้อมูลเดิมที่สร้างก่อนมีฟีเจอร์เลือกไรเดอร์จะยังไม่มีคอลัมน์ rider_id
   * จึงเพิ่มคอลัมน์ให้อัตโนมัติ โดยออเดอร์เดิมจะยังไม่มีไรเดอร์จนกว่าเจ้าของร้านจะแก้ไข
   */
  private ensureOrderRiderColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(orders)').all() as Row[];
    if (!columns.some((column) => asText(column.name) === 'rider_id')) {
      this.db.exec(
        'ALTER TABLE orders ADD COLUMN rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL;',
      );
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);');
  }

  private ensureAssignmentModeColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(orders)').all() as Row[];
    if (columns.some((column) => asText(column.name) === 'assignment_mode')) {
      return;
    }
    this.db.exec(
      "ALTER TABLE orders ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'auto' CHECK (assignment_mode IN ('auto', 'manual'));",
    );
    // Keep existing explicit rider choices as manual overrides.
    this.db.exec(`
      UPDATE orders
      SET assignment_mode = CASE WHEN rider_id IS NULL THEN 'auto' ELSE 'manual' END
    `);
  }

  private seed(): void {
    const timestamp = now();
    const insertCustomer = this.db.prepare(`
      INSERT INTO customers (id, name, phone, address, latitude, longitude, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRider = this.db.prepare(`
      INSERT INTO riders (id, name, job_code, status) VALUES (?, ?, ?, ?)
    `);
    const insertOrder = this.db.prepare(`
      INSERT INTO orders (id, customer_id, rider_id, assignment_mode, total_boxes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const customer of mockCustomers) {
        insertCustomer.run(
          customer.id,
          customer.name,
          customer.phone,
          customer.address,
          customer.latitude,
          customer.longitude,
          timestamp,
          timestamp,
        );
      }
      for (const rider of mockRiders) {
        insertRider.run(rider.id, rider.name, rider.jobCode, rider.status);
      }
      for (const order of mockOrders) {
        insertOrder.run(
          order.id,
          order.customerId,
          order.riderId,
          order.assignmentMode,
          order.totalBoxes,
          order.status,
          order.createdAt,
          order.updatedAt,
        );
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async listCustomers(): Promise<Customer[]> {
    const rows = this.db.prepare('SELECT * FROM customers ORDER BY id').all() as Row[];
    return rows.map(toCustomer);
  }

  async getCustomer(id: number): Promise<Customer | null> {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Row | undefined;
    return row ? toCustomer(row) : null;
  }

  async createCustomer(input: CustomerInput): Promise<Customer> {
    const timestamp = now();
    const result = this.db.prepare(`
      INSERT INTO customers (name, phone, address, latitude, longitude, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name,
      input.phone,
      input.address,
      input.latitude,
      input.longitude,
      timestamp,
      timestamp,
    );
    const id = Number(result.lastInsertRowid);
    const customer = await this.getCustomer(id);
    if (!customer) throw new Error('สร้างข้อมูลลูกค้าไม่สำเร็จ');
    return customer;
  }

  async updateCustomer(id: number, input: CustomerInput): Promise<Customer | null> {
    const result = this.db.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, address = ?, latitude = ?, longitude = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.name,
      input.phone,
      input.address,
      input.latitude,
      input.longitude,
      now(),
      id,
    );
    if (Number(result.changes) === 0) return null;
    return this.getCustomer(id);
  }

  async deleteCustomer(id: number): Promise<Customer | null> {
    const customer = await this.getCustomer(id);
    if (!customer) return null;
    this.db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return customer;
  }

  async customerHasOrders(customerId: number): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 AS found FROM orders WHERE customer_id = ? LIMIT 1')
      .get(customerId) as Row | undefined;
    return Boolean(row);
  }

  async listOrders(): Promise<Order[]> {
    const rows = this.db.prepare('SELECT * FROM orders ORDER BY id').all() as Row[];
    return rows.map(toOrder);
  }

  async getOrder(id: number): Promise<Order | null> {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Row | undefined;
    return row ? toOrder(row) : null;
  }

  async createOrder(
    customerId: number,
    totalBoxes: number,
    riderId: number | null,
  ): Promise<Order> {
    const timestamp = now();
    const result = this.db.prepare(`
      INSERT INTO orders (customer_id, rider_id, assignment_mode, total_boxes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      customerId,
      riderId,
      riderId === null ? 'auto' : 'manual',
      totalBoxes,
      timestamp,
      timestamp,
    );
    const id = Number(result.lastInsertRowid);
    const order = await this.getOrder(id);
    if (!order) throw new Error('สร้างออเดอร์ไม่สำเร็จ');
    return order;
  }

  async updateOrder(id: number, update: OrderUpdate): Promise<Order | null> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (update.customerId !== undefined) {
      sets.push('customer_id = ?');
      values.push(update.customerId);
    }
    if (update.riderId !== undefined) {
      sets.push('rider_id = ?');
      values.push(update.riderId ?? null);
    }
    if (update.assignmentMode !== undefined) {
      sets.push('assignment_mode = ?');
      values.push(update.assignmentMode);
    }
    if (update.totalBoxes !== undefined) {
      sets.push('total_boxes = ?');
      values.push(update.totalBoxes);
    }
    if (update.status !== undefined) {
      sets.push('status = ?');
      values.push(update.status);
    }
    if (sets.length === 0) {
      return this.getOrder(id);
    }

    sets.push('updated_at = ?');
    values.push(now(), id);
    const result = this.db
      .prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values);
    if (Number(result.changes) === 0) return null;
    return this.getOrder(id);
  }

  async deleteOrder(id: number): Promise<Order | null> {
    const order = await this.getOrder(id);
    if (!order) return null;
    this.db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return order;
  }

  async countActiveOrders(filter: ActiveOrderFilter): Promise<number> {
    const clauses = ["status NOT IN ('delivered', 'cancelled')"];
    const values: number[] = [];

    if (filter.customerId !== undefined) {
      clauses.push('customer_id = ?');
      values.push(filter.customerId);
    }
    if (filter.riderId !== undefined) {
      clauses.push('rider_id = ?');
      values.push(filter.riderId);
    }
    if (filter.pinnedRiderOnly) {
      clauses.push("(assignment_mode = 'manual' OR status = 'delivering')");
    }
    if (filter.excludeOrderId !== undefined) {
      clauses.push('id <> ?');
      values.push(filter.excludeOrderId);
    }

    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM orders WHERE ${clauses.join(' AND ')}`)
      .get(...values) as Row;
    return asNumber(row.count);
  }

  async listRiders(): Promise<Rider[]> {
    const rows = this.db.prepare('SELECT * FROM riders ORDER BY id').all() as Row[];
    return rows.map(toRider);
  }

  async getRider(id: number): Promise<Rider | null> {
    const row = this.db.prepare('SELECT * FROM riders WHERE id = ?').get(id) as Row | undefined;
    return row ? toRider(row) : null;
  }

  async getRiderByJobCode(jobCode: string): Promise<Rider | null> {
    const row = this.db
      .prepare('SELECT * FROM riders WHERE UPPER(job_code) = UPPER(?)')
      .get(jobCode) as Row | undefined;
    return row ? toRider(row) : null;
  }

  async getRoutePlan(): Promise<RoutePlan | null> {
    const row = this.db
      .prepare('SELECT plan_json FROM route_plans WHERE id = 1')
      .get() as Row | undefined;
    if (!row) return null;
    try {
      return JSON.parse(asText(row.plan_json)) as RoutePlan;
    } catch {
      return null;
    }
  }

  async saveRoutePlan(
    plan: RoutePlan,
    assignments: Array<{ orderId: number; riderId: number }> = [],
  ): Promise<void> {
    const updateAutoAssignment = this.db.prepare(`
      UPDATE orders
      SET rider_id = ?, updated_at = ?
      WHERE id = ? AND assignment_mode = 'auto' AND status IN ('ready', 'delivering')
    `);
    const savePlan = this.db.prepare(`
      INSERT INTO route_plans (id, plan_json, published_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET plan_json = excluded.plan_json, published_at = excluded.published_at
    `);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const timestamp = now();
      for (const assignment of assignments) {
        updateAutoAssignment.run(assignment.riderId, timestamp, assignment.orderId);
      }
      savePlan.run(JSON.stringify(plan), plan.publishedAt);
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async clearRoutePlan(): Promise<void> {
    this.db.prepare('DELETE FROM route_plans WHERE id = 1').run();
  }
}
