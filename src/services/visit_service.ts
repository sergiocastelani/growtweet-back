import { visitDAO } from "../daos/_setup";
import { IDailyVisit } from "../models/daily_visit";
import { ServiceResponseAsync, SuccessResult } from "./services_types";

/** UTC midnight of the day `now` falls in (server clock). */
function startOfUtcDay(now: Date) : Date
{
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

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
}
