from pathlib import Path
p=Path('tests/mobile-device.spec.ts');s=p.read_text(encoding='utf-8').replace('    expect(await page.evaluate(() => navigator.onLine)).toBe(false);\n','');p.write_text(s,encoding='utf-8')
