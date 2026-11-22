import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  emptyApiWorkspace,
  type ApiAuthResponse,
  type ApiBuyer,
  type ApiCollectionCenter,
  type ApiCollectionIntake,
  type ApiCrop,
  type ApiDemand,
  type ApiFarmer,
  type ApiFarmerCrop,
  type ApiRole,
  type ApiSession,
  type ApiUpazila,
  type ApiUser,
  type ApiWorkspace,
} from "../data/apiTypes";

const SESSION_KEY = "@agri-link/auth-session-v1";

export function isSecureApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const localHost = url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || /^10(?:\.\d{1,3}){3}$/.test(url.hostname)
      || /^192\.168(?:\.\d{1,3}){2}$/.test(url.hostname)
      || /^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(url.hostname);
    return !url.username && !url.password
      && (url.protocol === "https:" || (url.protocol === "http:" && localHost));
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  public readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isApiSession(value: unknown): value is ApiSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === "string" && typeof record.refreshToken === "string";
}

export async function loadApiSession(): Promise<ApiSession | null> {
  let raw: string | null;
  if (Platform.OS === "web") {
    raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SESSION_KEY);
  } else {
    raw = await SecureStore.getItemAsync(SESSION_KEY);
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("সংরক্ষিত লগইন সেশনের ফরম্যাট সঠিক নয়।");
  }
  if (!isApiSession(parsed)) throw new Error("সংরক্ষিত লগইন সেশন অসম্পূর্ণ।");
  return parsed;
}

export async function saveApiSession(session: ApiSession | null): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof sessionStorage === "undefined") return;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function responseData<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError("সার্ভার থেকে সঠিক JSON উত্তর পাওয়া যায়নি।", response.status);
    }
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `API অনুরোধ ব্যর্থ হয়েছে (HTTP ${response.status})।`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

async function send<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return responseData<T>(response);
}

export async function requestOtp(baseUrl: string, phone: string): Promise<void> {
  await send(baseUrl, "/api/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(
  baseUrl: string,
  input: { phone: string; code: string; name: string; role: "FARMER" | "BUYER" },
): Promise<ApiAuthResponse> {
  return send<ApiAuthResponse>(baseUrl, "/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function optionalRequest<T>(client: ApiClient, path: string): Promise<T | null> {
  try {
    return await client.request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function loadApiWorkspace(client: ApiClient, user: ApiUser): Promise<ApiWorkspace> {
  const [upazilas, crops] = await Promise.all([
    client.request<ApiUpazila[]>("/api/upazilas"),
    client.request<ApiCrop[]>(`/api/crops${user.role === "ADMIN" ? "?includeInactive=true" : ""}`),
  ]);
  const workspace: ApiWorkspace = { ...emptyApiWorkspace, upazilas, crops };

  if (user.role === "FARMER") {
    workspace.farmerProfile = await optionalRequest<ApiFarmer>(client, "/api/farmers/me");
    if (workspace.farmerProfile) {
      workspace.farmerCropPlans = await client.request<ApiFarmerCrop[]>("/api/farmers/me/crops");
      workspace.collection = await client.request<ApiCollectionIntake[]>("/api/collection");
    }
    workspace.demands = await client.request<ApiDemand[]>("/api/demands");
  } else if (user.role === "BUYER") {
    workspace.buyerProfile = await optionalRequest<ApiBuyer>(client, "/api/buyers/me");
    if (workspace.buyerProfile) workspace.demands = await client.request<ApiDemand[]>("/api/demands");
  } else {
    const [collection, centers, farmers] = await Promise.all([
      client.request<ApiCollectionIntake[]>("/api/collection"),
      client.request<ApiCollectionCenter[]>("/api/collection/centers"),
      client.request<ApiFarmer[]>("/api/farmers"),
    ]);
    workspace.collection = collection;
    workspace.collectionCenters = centers;
    workspace.farmers = farmers;
    if (user.role === "ADMIN" || user.role === "FIELD_WORKER") {
      const [buyers, demands] = await Promise.all([
        client.request<ApiBuyer[]>("/api/buyers"),
        client.request<ApiDemand[]>("/api/demands"),
      ]);
      workspace.buyers = buyers;
      workspace.demands = demands;
    }
  }
  return workspace;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly onSessionChange: (session: ApiSession) => Promise<void>;
  private readonly onUnauthorized: () => Promise<void>;
  private session: ApiSession;
  private refreshInFlight: Promise<void> | null = null;

  constructor(
    baseUrl: string,
    session: ApiSession,
    onSessionChange: (session: ApiSession) => Promise<void>,
    onUnauthorized: () => Promise<void>,
  ) {
    this.baseUrl = baseUrl;
    this.session = session;
    this.onSessionChange = onSessionChange;
    this.onUnauthorized = onUnauthorized;
  }

  async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const sendWithAccessToken = () => send<T>(this.baseUrl, path, {
      method: options.method ?? "GET",
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers: { Authorization: `Bearer ${this.session.accessToken}` },
    });

    try {
      return await sendWithAccessToken();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || path.startsWith("/api/auth/")) throw error;
      await this.refresh();
      return sendWithAccessToken();
    }
  }

  private async refresh(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = send<ApiAuthResponse>(this.baseUrl, "/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: this.session.refreshToken }),
      }).then(async (auth) => {
        const updated = { accessToken: auth.accessToken, refreshToken: auth.refreshToken };
        this.session = updated;
        await this.onSessionChange(updated);
        return updated;
      }).then(() => undefined).catch(async (error: unknown) => {
        await this.onUnauthorized();
        throw error;
      }).finally(() => {
        this.refreshInFlight = null;
      });
    }
    await this.refreshInFlight;
  }
}
