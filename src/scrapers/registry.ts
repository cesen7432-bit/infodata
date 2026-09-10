import { Source } from "@prisma/client";
import { SourceHandler } from "./types/scraper.types";
import { dataDiverServiceHandler } from "./datadiverservice/adapter";
import { satjeHandler } from "./satje/adapter";
import { sriHandler } from "./sri/adapter";
import { antHandler } from "./ant/adapter";
import { rpHandler } from "./rp/adapter";
import { env } from "../config/env";

export const SOURCE_SLUGS: Record<string, Source> = {
  datadiverservice: Source.DATADIVERSERVICE,
  satje: Source.SATJE,
  sri: Source.SRI,
  ant: Source.ANT,
  rp: Source.RP,
};

const HANDLERS: Record<Source, SourceHandler> = {
  [Source.DATADIVERSERVICE]: dataDiverServiceHandler,
  [Source.SATJE]: satjeHandler,
  [Source.SRI]: sriHandler,
  [Source.ANT]: antHandler,
  [Source.RP]: rpHandler,
};

export function getSourceHandler(source: Source): SourceHandler {
  return HANDLERS[source];
}

export const ALL_SOURCES: Source[] = Object.values(Source);

export const QUEUE_CONCURRENCY: Record<Source, number> = {
  [Source.DATADIVERSERVICE]: env.QUEUE_CONCURRENCY_DATADIVERSERVICE,
  [Source.SATJE]: env.QUEUE_CONCURRENCY_SATJE,
  [Source.SRI]: env.QUEUE_CONCURRENCY_SRI,
  [Source.ANT]: env.QUEUE_CONCURRENCY_ANT,
  [Source.RP]: env.QUEUE_CONCURRENCY_RP,
};
