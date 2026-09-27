from pathlib import Path
p=Path('components/dashboard/PredictionChart.tsx')
s=p.read_text(encoding='utf-8')
a=s.index('// 7-day mock forecast')
b=s.index('const ACCENT',a)
s=s[:a]+s[b:]
s=s.replace('const GREEN = "#10b981"; // severity-green-500\n','')
s=s.replace('source: "real" | "mock";', 'source: "real" | "unavailable";')
s=s.replace('.then((res) => res.json())', '.then((res) => { if (!res.ok) throw new Error("Prediction history unavailable"); return res.json(); })')
s=s.replace('setHistory({ source: "mock", points: [] })','setHistory({ source: "unavailable", points: [] })')
s=s.replace('"FLOOD FORECAST TREND"', '"FLOOD RISK HISTORY"').replace('Demo Data','Unavailable').replace('runs off flood_predictions','No verified predictions')
a=s.index('      {isReal ? (\n        <RiskChart')
b=s.index('\n      <p className="mt-1',a)
s=s[:a]+'''      {isReal ? (
        <RiskChart points={history.points} />
      ) : (
        <div className="flex h-64 w-full items-center justify-center text-sm text-slate-400" role="status">
          No verified flood predictions are available yet.
        </div>
      )}
''' + s[b:]
s=s.replace('`Danger threshold ≈ ${DANGER_LEVEL_M} m`','"Prediction history appears after live model results are saved."')
p.write_text(s,encoding='utf-8')
p=Path('app/api/predictions/history/route.ts');s=p.read_text(encoding='utf-8')
s=s.replace('const day = DAY_ORDER[new Date(row.predictionTimestamp).getDay()];','const day = new Date(row.predictionTimestamp).toISOString().slice(0, 10);')
s=s.replace('.sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]))','.sort((a, b) => a[0].localeCompare(b[0]))')
s=s.replace('const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];\n\n','')
s=s.replace('// Bucket predictions by weekday and average the risk index per day.','// Bucket by ISO date so weeks remain chronological and never merge.')
p.write_text(s,encoding='utf-8')
p=Path('app/api/public/shelters/route.ts');s=p.read_text(encoding='utf-8').replace('orderBy: { createdAt: "desc" },','where: { isDemo: false },\n      orderBy: { createdAt: "desc" },');p.write_text(s,encoding='utf-8')
p=Path('app/api/flood/route.ts');s=p.read_text(encoding='utf-8');a=s.index('  } catch (error: unknown) {');b=s.index('\n}',a);s=s[:a]+'''  } catch (error: unknown) {
    console.error("Flood fetch failed:", error);
    return NextResponse.json({ ok: false, source: "unavailable", error: "Live flood data is unavailable" }, { status: 503 });
  }'''+s[b:];p.write_text(s,encoding='utf-8')
