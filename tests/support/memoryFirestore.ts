import { Timestamp } from "firebase-admin/firestore";

type Data = Record<string, unknown>;
function copy<T>(value: T): T {
  if (value instanceof Timestamp || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(copy) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  return value;
}

class Ref {
  constructor(readonly db: MemoryFirestore, readonly path: string) {}
  get id() { return this.path.split("/").at(-1)!; }
  get parent(): Query { return new Query(this.db, this.path.split("/").slice(0, -1).join("/")); }
  collection(name: string) { return new Query(this.db, `${this.path}/${name}`); }
  async get() { return new Snapshot(this, this.db.rows.get(this.path)); }
}

class Snapshot {
  private readonly value: Data | undefined;
  constructor(readonly ref: Ref, value: Data | undefined) { this.value = copy(value); }
  get id() { return this.ref.id; }
  get exists() { return this.value !== undefined; }
  data() { return copy(this.value); }
}

type Filter = { field: string; op: string; value: unknown };
class Query {
  constructor(readonly db: MemoryFirestore, readonly path: string, readonly filters: Filter[] = []) {}
  get parent(): Ref | null { return this.path.includes("/") ? new Ref(this.db, this.path.split("/").slice(0, -1).join("/")) : null; }
  doc(id = `auto-${++this.db.sequence}`) { return new Ref(this.db, `${this.path}/${id}`); }
  where(field: string, op: string, value: unknown) { return new Query(this.db, this.path, [...this.filters, { field, op, value }]); }
  orderBy() { return this; }
  limit() { return this; }
  async get() {
    const docs = [...this.db.rows.entries()]
      .filter(([path, data]) => path.startsWith(`${this.path}/`) && path.split("/").length === this.path.split("/").length + 1 && this.filters.every(({ field, op, value }) => {
        const left = data[field] instanceof Timestamp ? data[field].toMillis() : data[field];
        const right = value instanceof Timestamp ? value.toMillis() : value;
        if (op === "==") return left === right;
        if (op === "array-contains") return Array.isArray(left) && left.includes(right);
        if (op === ">=") return Number(left) >= Number(right);
        if (op === "<=") return Number(left) <= Number(right);
        if (op === "<") return Number(left) < Number(right);
        throw new Error(`Unsupported filter ${op}`);
      }))
      .map(([path, data]) => new Snapshot(new Ref(this.db, path), data));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

type Write = { type: "set" | "update" | "delete"; ref: Ref; data?: Data };
class Transaction {
  readonly writes: Write[] = [];
  async get(target: Ref | Query) {
    if (this.writes.length) throw new Error("Firestore forbids reads after writes");
    return target.get();
  }
  async getAll(...refs: Ref[]) { return Promise.all(refs.map((ref) => this.get(ref))); }
  set(ref: Ref, data: Data) { this.writes.push({ type: "set", ref, data }); }
  update(ref: Ref, data: Data) { this.writes.push({ type: "update", ref, data }); }
  delete(ref: Ref) { this.writes.push({ type: "delete", ref }); }
}

// Deliberately small service-test double. Enforces atomic writes, read-before-write,
// and optimistic transaction retries. It does not replace emulator verification.
export class MemoryFirestore {
  rows = new Map<string, Data>();
  sequence = 0;
  version = 0;
  retries = 0;
  collection(path: string) { return new Query(this, path); }
  doc(path: string) { return new Ref(this, path); }
  seed(path: string, data: Data) { this.rows.set(path, copy(data)); this.version++; }
  reset() { this.rows.clear(); this.sequence = 0; this.version++; this.retries = 0; }
  async runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const version = this.version;
      const tx = new Transaction();
      let result: T;
      try { result = await callback(tx); }
      catch (error) {
        if (this.version !== version) { this.retries++; continue; }
        throw error;
      }
      if (this.version !== version) { this.retries++; continue; }
      const next = new Map([...this.rows.entries()].map(([path, data]) => [path, copy(data)]));
      for (const write of tx.writes) {
        if (write.type === "delete") { next.delete(write.ref.path); continue; }
        if (write.type === "update" && !next.has(write.ref.path)) throw new Error(`Missing document ${write.ref.path}`);
        const data = write.type === "set" ? {} : next.get(write.ref.path)!;
        for (const [field, value] of Object.entries(write.data!)) {
          const parts = field.split(".");
          let target: Data = data;
          for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as Data;
          const key = parts.at(-1)!;
          const transform = value as { methodName?: string; operand?: number; elements?: unknown[] } | null;
          switch (transform?.methodName) {
            case "FieldValue.increment": target[key] = Number(target[key] ?? 0) + transform.operand!; break;
            case "FieldValue.arrayUnion": target[key] = [...new Set([...(target[key] as unknown[] ?? []), ...transform.elements!])]; break;
            case "FieldValue.delete": delete target[key]; break;
            case "FieldValue.serverTimestamp": target[key] = Timestamp.now(); break;
            default: target[key] = copy(value);
          }
        }
        next.set(write.ref.path, data);
      }
      if (tx.writes.length) { this.rows = next; this.version++; }
      return result;
    }
    throw new Error("Transaction retry limit");
  }
}
