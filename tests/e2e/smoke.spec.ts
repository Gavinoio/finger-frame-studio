import { expect, test } from "@playwright/test";

test("loads the three product modes", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 909 });
  await page.goto("/?demo");
  await expect(page.getByRole("button", { name: "Live Local" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Live Lucy AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Video AI" })).toBeVisible();
  const githubLink = page.getByRole("link", { name: "Open finger-frame-studio on GitHub" });
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute(
    "href",
    "https://github.com/Gavinoio/finger-frame-studio",
  );
  await expect(githubLink).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "API Settings" }).click();
  await expect(page.getByRole("heading", { name: "API key settings" })).toBeVisible();
  await expect(page.getByText("Gemini API key", { exact: true })).toBeVisible();
  await expect(page.getByText("Decart API key", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear keys" })).toBeVisible();
  const settingsBox = await page.locator("#settings-panel").boundingBox();
  const keyCards = page.locator(".settings-key-field");
  const geminiCardBox = await keyCards.nth(0).boundingBox();
  const decartCardBox = await keyCards.nth(1).boundingBox();
  const rememberBox = await page.locator("#gemini-remember").boundingBox();
  const rememberTextBox = await page
    .getByText("Remember this key on this device")
    .first()
    .boundingBox();
  expect(settingsBox).not.toBeNull();
  expect(geminiCardBox).not.toBeNull();
  expect(decartCardBox).not.toBeNull();
  expect(rememberBox).not.toBeNull();
  expect(rememberTextBox).not.toBeNull();
  expect(settingsBox!.width).toBeCloseTo(500, 0);
  expect(geminiCardBox!.width).toBeCloseTo(decartCardBox!.width, 0);
  expect(rememberBox!.width).toBeCloseTo(16, 0);
  expect(rememberBox!.height).toBeCloseTo(16, 0);
  expect(
    Math.abs(
      rememberBox!.y + rememberBox!.height / 2 - (rememberTextBox!.y + rememberTextBox!.height / 2),
    ),
  ).toBeLessThan(2);
  await page.getByRole("button", { name: "Close API key settings" }).click();
  const headerBox = await page.locator(".app-header").boundingBox();
  const sidebarBox = await page.locator("#sidebar").boundingBox();
  const appBackground = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(headerBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(headerBox!.height).toBeCloseTo(88, 0);
  expect(sidebarBox!.x).toBeCloseTo(12, 0);
  expect(sidebarBox!.y).toBeCloseTo(112, 0);
  expect(sidebarBox!.width).toBeCloseTo(280, 0);
  expect(appBackground).toBe("rgb(5, 7, 12)");
  const expectSingleViewport = async () => {
    const dimensions = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(dimensions.scrollHeight).toBe(dimensions.clientHeight);
    expect(dimensions.bodyScrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  };
  await expectSingleViewport();
  await expect(page.locator("#local-effects .effect-button.active")).toContainText("Van Gogh");
  const localStylesBox = await page.locator("#local-effects").boundingBox();
  const localStageBox = await page.locator("#view-live-local > .stage-card").boundingBox();
  expect(localStylesBox).not.toBeNull();
  expect(localStageBox).not.toBeNull();
  expect(localStageBox!.x).toBeCloseTo(312, 0);
  expect(localStageBox!.y).toBeCloseTo(112, 0);
  expect(localStylesBox!.x + localStylesBox!.width).toBeLessThan(localStageBox!.x);
  await page.keyboard.press("1");
  await expect(page.locator("#local-effects .effect-button.active")).toContainText("Pixelate");
  await page.getByRole("button", { name: "Video AI" }).click();
  await expect(page.getByRole("heading", { name: "Video style" })).toBeVisible();
  await expectSingleViewport();
  await expect(page.locator("#video-custom")).not.toBeVisible();
  await page.locator("#video-style").selectOption("custom");
  await expect(page.locator("#video-custom")).toBeVisible();
  await page.getByRole("button", { name: "Live Lucy AI" }).click();
  await expect(page.locator("#view-live-lucy")).toBeVisible();
  await expect(page.locator("#lucy-status")).toHaveText("Demo preview");
  await expectSingleViewport();
  const lucyStylesBox = await page.locator("#lucy-effects").boundingBox();
  const lucyStageBox = await page.locator("#view-live-lucy > .stage-card").boundingBox();
  expect(lucyStylesBox).not.toBeNull();
  expect(lucyStageBox).not.toBeNull();
  expect(lucyStylesBox!.x + lucyStylesBox!.width).toBeLessThan(lucyStageBox!.x);
  await page.keyboard.press("2");
  await expect(page.locator("#lucy-effects .effect-button.active")).toContainText("Anime");

  await page.setViewportSize({ width: 1440, height: 720 });
  for (const mode of ["Live Local", "Live Lucy AI", "Video AI"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expectSingleViewport();
  }
});
