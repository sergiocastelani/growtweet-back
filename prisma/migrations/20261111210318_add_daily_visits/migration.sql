-- CreateTable
CREATE TABLE "daily_visits" (
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_visits_pkey" PRIMARY KEY ("date")
);
