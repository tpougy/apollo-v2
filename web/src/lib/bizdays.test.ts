import { describe, expect, test } from "bun:test";
import cases from "../../../shared/bizdays.testcases.json";
import {
  addBusinessDays,
  CalendarRangeError,
  InvalidDateError,
  isBusinessDay,
  nextBusinessDay,
} from "./bizdays";

interface Case {
  id: string;
  op: "isBusinessDay" | "addBusinessDays" | "nextBusinessDay";
  date: string;
  n?: number;
  expected?: boolean | string;
  error?: "InvalidDateError" | "CalendarRangeError";
}

const ERROR_CLASSES = {
  InvalidDateError,
  CalendarRangeError,
} as const;

describe("bizdays fixture parity", () => {
  for (const c of cases as Case[]) {
    test(c.id, () => {
      const hasExpected = Object.hasOwn(c, "expected");
      const hasError = Object.hasOwn(c, "error");

      if (hasExpected === hasError) {
        throw new Error(
          `Fixture case ${c.id} must have exactly one of "expected"/"error", got hasExpected=${hasExpected} hasError=${hasError}`,
        );
      }

      const run = (): boolean | string => {
        switch (c.op) {
          case "isBusinessDay":
            return isBusinessDay(c.date);
          case "addBusinessDays":
            if (c.n === undefined) {
              throw new Error(`Fixture case ${c.id} is addBusinessDays but has no "n"`);
            }
            return addBusinessDays(c.date, c.n);
          case "nextBusinessDay":
            return nextBusinessDay(c.date);
          default:
            throw new Error(`Fixture case ${c.id} has unrecognized op: ${String(c.op)}`);
        }
      };

      if (hasError) {
        const expectedErrorName: string = c.error as string;
        const errorClass = ERROR_CLASSES[expectedErrorName as keyof typeof ERROR_CLASSES];
        if (!errorClass) {
          throw new Error(
            `Fixture case ${c.id} has unrecognized error class: ${expectedErrorName}`,
          );
        }
        expect(run).toThrow(errorClass);
        try {
          run();
          throw new Error(`Fixture case ${c.id} expected to throw but did not`);
        } catch (thrown) {
          expect((thrown as Error).name).toBe(expectedErrorName);
        }
      } else {
        const expectedValue: boolean | string = c.expected as boolean | string;
        expect(run()).toBe(expectedValue);
      }
    });
  }
});
