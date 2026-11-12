import type { ModuleId } from "./navigation";

export type RecordBucket = "farmers" | "crops" | "buyers" | "collection" | "finance";

export type WorkspaceRecord = {
  id: string;
  createdAt: string;
  [key: string]: string;
};

export type WorkspaceData = Record<RecordBucket, WorkspaceRecord[]>;

export type ApiConfig = {
  apiBaseUrl: string;
  weatherEndpoint: string;
  marketEndpoint: string;
};

export const emptyWorkspace: WorkspaceData = {
  farmers: [],
  crops: [],
  buyers: [],
  collection: [],
  finance: [],
};

export const recordBucketForModule: Partial<Record<ModuleId, RecordBucket>> = {
  farmers: "farmers",
  crops: "crops",
  forecast: "crops",
  buyers: "buyers",
  collection: "collection",
  finance: "finance",
};
