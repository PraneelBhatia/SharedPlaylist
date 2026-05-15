import { test, expect } from "@playwright/test";

test.describe("SharedPlaylist smoke", () => {
  test("dashboard renders empty state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /No shared playlists/ })).toBeVisible();
    await expect(page.getByText(/Share a playlist to start syncing/)).toBeVisible();
  });

  test("dead invite link shows generic message with no leaked info", async ({ page }) => {
    await page.goto("/i/totally-fake-token");
    await expect(page.getByText(/this invite has expired/i)).toBeVisible();
    // Privacy check: no creator or playlist name disclosed.
    const body = (await page.content()).toLowerCase();
    expect(body).not.toContain("road trip");
    expect(body).not.toContain("alice");
  });

  test("share creation flow: provider tabs render", async ({ page }) => {
    await page.goto("/share/new");
    await expect(page.getByText(/Where it lives/i)).toBeVisible();
    await expect(page.getByRole("tab", { name: /Spotify/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Apple Music/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /YouTube/i })).toBeVisible();
  });

  test("admin route is invisible to non-owners (returns 404)", async ({ page }) => {
    const response = await page.goto("/admin/stats");
    expect(response?.status()).toBe(404);
  });
});
