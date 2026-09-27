from pathlib import Path
p=Path('tests/mobile-device.spec.ts');s=p.read_text(encoding='utf-8')
a=s.index('    // Banner or status should indicate offline mode')
b=s.index('    // Reconnect',a)
s=s[:a]+'''    // A visited public page remains readable offline, with the safety state
    // explicitly unverified when live services cannot be reached.
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /safety status unavailable|offline/i }).first(),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

'''+s[b:]
p.write_text(s,encoding='utf-8')
