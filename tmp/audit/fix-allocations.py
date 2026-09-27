from pathlib import Path
p=Path('app/api/allocations/optimize/route.ts');s=p.read_text(encoding='utf-8')
a=s.index('// Realistic Patna-area mock resources')
b=s.index('function buildUnmet(',a)
s=s[:a]+s[b:]
s=s.replace('disasterEventId: eventId || events[0]?.id || "mock-event-1",','disasterEventId: eventId || events[0]?.id || "",')
s=s.replace('if (!eventId) eventId = events[0]?.id ?? "mock-event-1";\n\n    if (!resources.length && !demands.length) {\n      resources = MOCK_RESOURCES;\n      demands = MOCK_DEMANDS;\n    }','if (!eventId) eventId = events[0]?.id ?? "";')
a=s.index('  } catch (error: unknown) {\n    console.warn("[allocations] optimize fell back')
b=s.index('\n  }',a)+4
s=s[:a]+'''  } catch (error: unknown) {
    console.error("[allocations] inventory unavailable", error);
    return NextResponse.json({ ok: false, source: "unavailable", error: "Live resource inventory is unavailable" }, { status: 503 });
  }'''+s[b:]
s=s.replace('''  const plan = await runGreedyAllocation(resources, demands, locked);''','''  if (!eventId && demands.length > 0) {
    return NextResponse.json({ ok: false, error: "An existing disaster event is required" }, { status: 422 });
  }

  const plan = await runGreedyAllocation(resources, demands, locked);''')
a=s.index('  // Phase 13 · Persist the proposed allocations')
b=s.index('\n  return NextResponse.json({',a)
s=s[:a]+'''  let persisted = false;
  if (plan.length > 0 && eventId) {
    try {
      persisted = await persistAllocations(plan, eventId);
    } catch (error) {
      console.error("[allocations] failed to persist allocation plan", error);
    }
  }
'''+s[b:]
s=s.replace('    persisted: true,','    persisted,')
s=s.replace('): Promise<void> {\n  if (!plan.length) return;','): Promise<boolean> {\n  if (!plan.length) return false;')
a=s.index('  // Ensure a disaster event row exists')
b=s.index('\n  for (const allocation of plan)',a)
s=s[:a]+'''  const event = await prisma.disasterEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;
'''+s[b:]
s=s.replace('''  }
}
''','''  }
}
''')
# The final loop's closing brace is the last occurrence in this file.
assert s.rstrip().endswith('  }\n}')
s=s.rstrip()[:-1]+'  return true;\n}\n'
p.write_text(s,encoding='utf-8')

