import { visitDAO } from "../daos/_setup";
import { IDailyVisit } from "../models/daily_visit";
import { ServiceResponseAsync, SuccessResult } from "./services_types";

/** UTC midnight of the day `now` falls in (server clock). */
function startOfUtcDay(now: Date) : Date
{
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Bounds of the `last` parameter of the day list (FR-10; the max is the Postgres INT max). */
const MIN_LIST_DAYS = 1;
const MAX_LIST_DAYS = 2147483647;

export class VisitService
{
    /** Counts one visit for the current UTC day. Resolves with 201 and the updated day row. */
    public async register() : ServiceResponseAsync<IDailyVisit>
    {
        const visit = await visitDAO.increment(startOfUtcDay(new Date()));

        return SuccessResult("Visit registered", visit, 201);
    }

    /** All-time number of visits. Resolves with 200 and `{ total }`. */
    public async total() : ServiceResponseAsync<{ total: number }>
    {
        const total = await visitDAO.total();

        return SuccessResult("Visit total found", { total });
    }

    /**
     * Lists the most recent day rows, newest first.
     * @param last requested number of days; any integer, clamped to [MIN_LIST_DAYS, MAX_LIST_DAYS].
     * @returns 200 with "Visits found" and the rows (an empty array when there are none).
     */
    public async list(last: number) : ServiceResponseAsync<IDailyVisit[]>
    {
        const take = Math.min(Math.max(last, MIN_LIST_DAYS), MAX_LIST_DAYS);
        const visits = await visitDAO.listLatest(take);

        return SuccessResult("Visits found", visits);
    }
}
