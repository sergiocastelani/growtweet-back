import { DailyVisit } from "../../models/daily_visit";
import repository from "./_setup";

/** Maps a Prisma `daily_visits` row to the public model; the date becomes UTC "YYYY-MM-DD". */
export function toDailyVisit(row: { date: Date; count: number }) : DailyVisit
{
    return new DailyVisit(row.date.toISOString().slice(0, 10), row.count);
}

export class VisitDAO_Prisma
{
    /**
     * Atomically adds 1 to the row of `date`, creating it with count 1 if missing.
     * @param date UTC midnight of the day to count (precondition; not re-normalized here).
     * @returns the row after the increment.
     */
    async increment(date: Date) : Promise<DailyVisit>
    {
        // Keep this a plain upsert (no select / nested writes / extra where fields)
        // so Prisma runs it as a single atomic INSERT ... ON CONFLICT DO UPDATE.
        const row = await repository.dailyVisit.upsert({
            where: { date },
            create: { date, count: 1 },
            update: { count: { increment: 1 } },
        });

        return toDailyVisit(row);
    }
}
