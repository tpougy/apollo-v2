import type { Page } from "@playwright/test";

// Shared date-picker interaction for e2e specs, driving the shadcn
// Popover+Calendar composition that replaced the native <input type="date">
// (ENTFRM-02). Mirrors magic-code.ts's style — plain exported async
// functions, no class.

/**
 * Clicks the date-picker trigger Button identified by `testid`, then picks
 * day "15" of whichever month the Calendar currently displays.
 *
 * Day "15" is always the middle of a calendar month and can never collide
 * with an adjacent-month overflow cell in a 6-week grid (10-RESEARCH.md
 * Assumption A4), and this deliberately avoids navigating to a specific
 * past/future month or asserting on the day cell's locale-dependent
 * `aria-label` — both would make the helper locale- and clock-dependent.
 *
 * Returns the resulting "YYYY-MM-DD" string (current year/month, day 15) so
 * callers can assert against the actual picked value instead of a hardcoded
 * literal.
 */
export async function pickDate(page: Page, testid: string): Promise<string> {
  await page.getByTestId(testid).click();
  const popoverContent = page.locator('[data-slot="popover-content"]');
  await popoverContent.getByText("15", { exact: true }).click();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-15`;
}
