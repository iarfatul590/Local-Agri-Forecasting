import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyWorkspace, type ApiConfig, type WorkspaceData } from "../data/types";

const WORKSPACE_KEY = "@agri-link/workspace-v1";
const API_CONFIG_KEY = "@agri-link/api-config-v1";
const UPAZILA_FILTER_KEY = "@agri-link/upazila-filter-v1";

function isWorkspaceRecord(value: unknown): value is WorkspaceData["farmers"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.createdAt === "string"
    && Number.isFinite(Date.parse(record.createdAt))
    && Object.values(record).every((field) => typeof field === "string");
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const raw = await AsyncStorage.getItem(WORKSPACE_KEY);
  if (!raw) return emptyWorkspace;

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("সংরক্ষিত তথ্যের ফরম্যাট সঠিক নয়।");
  }

  const candidate = parsed as Partial<WorkspaceData>;
  for (const bucket of Object.keys(emptyWorkspace) as (keyof WorkspaceData)[]) {
    const records = candidate[bucket];
    if (records !== undefined && (!Array.isArray(records) || !records.every(isWorkspaceRecord))) {
      throw new Error(`সংরক্ষিত ${bucket} তথ্যের ফরম্যাট সঠিক নয়।`);
    }
  }
  return { ...emptyWorkspace, ...candidate };
}

export async function saveWorkspace(data: WorkspaceData): Promise<void> {
  await AsyncStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
}

export async function loadApiConfig(): Promise<ApiConfig> {
  const raw = await AsyncStorage.getItem(API_CONFIG_KEY);
  if (!raw) {
    return {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
      weatherEndpoint: "",
      marketEndpoint: "",
    };
  }

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("সংরক্ষিত API কনফিগারেশন সঠিক নয়।");
  }

  const candidate = parsed as Partial<ApiConfig>;
  for (const key of ["apiBaseUrl", "weatherEndpoint", "marketEndpoint"] as const) {
    if (candidate[key] !== undefined && typeof candidate[key] !== "string") {
      throw new Error("সংরক্ষিত API কনফিগারেশন সঠিক নয়।");
    }
  }
  return {
    apiBaseUrl: "",
    weatherEndpoint: "",
    marketEndpoint: "",
    ...candidate,
  };
}

export async function saveApiConfig(config: ApiConfig): Promise<void> {
  await AsyncStorage.setItem(API_CONFIG_KEY, JSON.stringify(config));
}

export async function loadUpazilaFilter(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(UPAZILA_FILTER_KEY);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (parsed !== null && typeof parsed !== "string") {
    throw new Error("সংরক্ষিত উপজেলা ফিল্টারের ফরম্যাট সঠিক নয়।");
  }
  return parsed;
}

export async function saveUpazilaFilter(upazila: string | null): Promise<void> {
  await AsyncStorage.setItem(UPAZILA_FILTER_KEY, JSON.stringify(upazila));
}
