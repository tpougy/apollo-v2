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

/**
 * Selects an option from a shadcn `Select` (bits-ui) by its visible text —
 * replaces every native `.selectOption(...)` call site broken by the
 * Select conversion (10-02-PLAN.md). Works identically for static-option
 * enum fields and relationship-link fields, since bits-ui's Select renders
 * `role="option"` items either way.
 */
export async function selectByText(page: Page, testid: string, optionText: string): Promise<void> {
  await page.getByTestId(testid).click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

/**
 * Opens a shadcn `Select`'s trigger, reads every visible option's trimmed
 * text, closes it again (Escape), and returns the list — replaces every
 * native `.locator("option").evaluateAll(...)`/`.allTextContents()`
 * enumeration call site broken by the Select conversion.
 */
export async function openAndReadSelectOptions(page: Page, testid: string): Promise<string[]> {
  await page.getByTestId(testid).click();
  const texts = await page.getByRole("listbox").getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
  return texts.map((t) => t.trim());
}
