from pathlib import Path
p=Path('lib/nova/nova-reply.test.ts');s=p.read_text().replace('mockCloudGenerate.mockResolvedValue({','mockCloudGenerate.mockResolvedValue({\n      durationMs: 0,');p.write_text(s)
p=Path('AUDIT_REPORT.md');s=p.read_text().replace('- Notion connection failed during the live check. The adapter reports failure; database sharing and credentials need verification.','- Notion returned HTTP 404. Further Notion work was excluded at the user\'s request.');p.write_text(s)
