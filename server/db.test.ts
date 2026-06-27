import { describe, it, expect } from "vitest";
import { insertIdOf } from "./db";

/**
 * Regression: drizzle/mysql2 returnerar insert-resultat som en TUPLE
 * [ResultSetHeader, FieldPacket[]] — inte ett objekt med .insertId på toppnivå.
 * Den gamla koden läste res.insertId → undefined → 0, vilket orphanade alla
 * seedade kontakter/signaler till companyId=0 (varje bolag öppnades utan kontakter).
 */
describe("insertIdOf (mysql2-insert-id, fångar companyId=0-regressionen)", () => {
  it("läser insertId ur tuple-formen [ResultSetHeader, FieldPacket[]]", () => {
    const res = [{ insertId: 42, affectedRows: 1 }, []];
    expect(insertIdOf(res)).toBe(42);
  });

  it("ger ALDRIG 0 när en giltig tuple-insert returnerades (kärn-buggen)", () => {
    const res = [{ insertId: 7 }, []];
    expect(insertIdOf(res)).not.toBe(0);
    expect(insertIdOf(res)).toBe(7);
  });

  it("är defensiv mot objekt-form ifall drivern/versionen ändras", () => {
    expect(insertIdOf({ insertId: 99 })).toBe(99);
  });

  it("faller tillbaka till 0 endast när inget id finns", () => {
    expect(insertIdOf([{ affectedRows: 1 }, []])).toBe(0);
    expect(insertIdOf(null)).toBe(0);
    expect(insertIdOf(undefined)).toBe(0);
  });
});
