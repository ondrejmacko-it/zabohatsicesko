import { monthOf, monthWeeks } from "@/lib/time";

const WEEKDAYS = ["po", "út", "st", "čt", "pá", "so", "ne"];

/**
 * Malý měsíční přehled dnů (po–ne). Sdílí ho výběr cílového dne při přesunu i Přejít na datum, obsah
 * buňky dodá volající. `fromDay` vynechá celé týdny před ním, ať přehled zbytečně nerostl.
 */
export function MonthDays({
  monthKey,
  fromDay,
  label,
  renderDay,
}: {
  monthKey: string;
  fromDay?: string;
  label: string;
  renderDay: (day: string) => React.ReactNode;
}) {
  const weeks = monthWeeks(monthKey).filter((week) => week.some((day) => monthOf(day) === monthKey && (!fromDay || day >= fromDay)));
  return (
    <div className="month-days" role="group" aria-label={label}>
      {WEEKDAYS.map((name) => (
        <span key={name} className="month-days-head" aria-hidden="true">
          {name}
        </span>
      ))}
      {weeks.flat().map((day) =>
        monthOf(day) === monthKey ? (
          <span key={day} className="month-days-cell">
            {renderDay(day)}
          </span>
        ) : (
          <span key={day} className="month-days-cell" aria-hidden="true" />
        ),
      )}
    </div>
  );
}

/** Číslo dne v měsíci bez nuly na začátku („7“). */
export const dayNumber = (day: string) => String(Number(day.slice(8)));
