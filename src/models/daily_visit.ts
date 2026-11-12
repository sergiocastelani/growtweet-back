export interface IDailyVisit
{
    date: string;   // UTC calendar day, "YYYY-MM-DD"
    count: number;
}

export class DailyVisit implements IDailyVisit {
    constructor(
        public date: string,
        public count: number,
    )
    {}
}
