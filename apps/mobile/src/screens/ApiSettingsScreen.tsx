import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import type { ApiConfig } from "../data/types";
import { Field, Notice, PageTitle, Panel, PrimaryButton, SectionTitle } from "../components/Primitives";

type Props = {
  config: ApiConfig;
  onSave: (config: ApiConfig) => Promise<void>;
};

type TestKind = "health" | "weather" | "market";

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || /^10(?:\.\d{1,3}){3}$/.test(hostname)
    || /^192\.168(?:\.\d{1,3}){2}$/.test(hostname)
    || /^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(hostname);
}

function isAllowedUrl(url: URL): boolean {
  return !url.username && !url.password
    && (url.protocol === "https:" || (url.protocol === "http:" && isLocalDevelopmentHost(url.hostname)));
}

export default function ApiSettingsScreen({ config, onSave }: Props) {
  const [draft, setDraft] = useState(config);
  const [testing, setTesting] = useState<TestKind | null>(null);
  const [testResults, setTestResults] = useState<Record<TestKind, string>>({ health: "", weather: "", market: "" });

  useEffect(() => setDraft(config), [config]);

  function update(key: keyof ApiConfig, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const apiBaseUrl = draft.apiBaseUrl.trim().replace(/\/+$/, "");
    const weatherEndpoint = draft.weatherEndpoint.trim();
    const marketEndpoint = draft.marketEndpoint.trim();
    if ((weatherEndpoint || marketEndpoint) && !apiBaseUrl) {
      Alert.alert("অসম্পূর্ণ কনফিগারেশন", "Weather বা market endpoint দেওয়া হলে API base URL-ও দিতে হবে।");
      return;
    }
    if (apiBaseUrl) {
      try {
        const baseUrl = new URL(apiBaseUrl);
        if (!isAllowedUrl(baseUrl)) {
          Alert.alert("অনিরাপদ URL", "HTTPS ব্যবহার করুন (local development-এ localhost/LAN IP গ্রহণযোগ্য)।");
          return;
        }
        for (const endpoint of [weatherEndpoint, marketEndpoint]) {
          if (endpoint && !isAllowedUrl(new URL(endpoint, `${apiBaseUrl}/`))) {
            Alert.alert("অনিরাপদ endpoint", "HTTPS endpoint ব্যবহার করুন (local development-এ localhost/LAN IP গ্রহণযোগ্য)।");
            return;
          }
        }
      } catch {
        Alert.alert("ভুল URL", "API base URL এবং endpoint সঠিকভাবে লিখুন।");
        return;
      }
    }
    try {
      await onSave({ apiBaseUrl, weatherEndpoint, marketEndpoint });
      Alert.alert("সংরক্ষিত", "API endpoint এই ডিভাইসে সংরক্ষণ করা হয়েছে।");
    } catch (error) {
      Alert.alert("সংরক্ষণ হয়নি", error instanceof Error ? error.message : "API কনফিগারেশন সংরক্ষণ করা যায়নি।");
    }
  }

  async function testConnection(kind: TestKind) {
    const base = draft.apiBaseUrl.trim().replace(/\/+$/, "");
    const endpoint = kind === "health" ? "/api/health" : draft[kind === "weather" ? "weatherEndpoint" : "marketEndpoint"].trim();
    if (!base || !endpoint) {
      const message = !base
        ? "আগে API base URL পূরণ করুন।"
        : `${kind === "weather" ? "Weather" : "Market"} endpoint পূরণ করুন।`;
      setTestResults((current) => ({ ...current, [kind]: message }));
      return;
    }
    let url: URL;
    try {
      url = new URL(endpoint, `${base}/`);
      if (!isAllowedUrl(url)) {
        setTestResults((current) => ({ ...current, [kind]: "সুরক্ষিত সংযোগের জন্য HTTPS ব্যবহার করুন (local development-এ localhost/LAN IP গ্রহণযোগ্য)।" }));
        return;
      }
    } catch {
      setTestResults((current) => ({ ...current, [kind]: "API URL সঠিক নয়।" }));
      return;
    }

    setTesting(kind);
    setTestResults((current) => ({ ...current, [kind]: "" }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
      const target = kind === "health" ? "API health" : kind === "weather" ? "Weather endpoint" : "Market endpoint";
      setTestResults((current) => ({
        ...current,
        [kind]: response.ok ? `${target} সংযোগ সফল (HTTP ${response.status})।` : `সার্ভার উত্তর দিয়েছে, কিন্তু status HTTP ${response.status}।`,
      }));
    } catch (error) {
      setTestResults((current) => ({
        ...current,
        [kind]: controller.signal.aborted
          ? "১০ সেকেন্ডে উত্তর আসেনি; API URL ও নেটওয়ার্ক পরীক্ষা করুন।"
          : `সংযোগ করা যায়নি: ${error instanceof Error ? error.message : "নেটওয়ার্ক ত্রুটি"}`,
      }));
    } finally {
      clearTimeout(timeoutId);
      setTesting(null);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageTitle title="API সংযোগ" subtitle="Weather ও market data endpoint কনফিগার করুন" />
      <Notice tone="warning">API key বা secret mobile app-এ লিখবেন না। Provider credentials শুধু API server-এর apps/api/.env-এ রাখুন; EXPO_PUBLIC_* মান app bundle-এ প্রকাশিত হয়।</Notice>
      <Panel>
        <SectionTitle>Endpoint কনফিগারেশন</SectionTitle>
        <Field label="API base URL" value={draft.apiBaseUrl} onChangeText={(value) => update("apiBaseUrl", value)} placeholder="https://api.example.com" keyboardType="url" />
        <Field label="Weather endpoint path বা URL" value={draft.weatherEndpoint} onChangeText={(value) => update("weatherEndpoint", value)} placeholder="/api/weather" keyboardType="url" />
        <Field label="Market endpoint path বা URL" value={draft.marketEndpoint} onChangeText={(value) => update("marketEndpoint", value)} placeholder="/api/market-prices" keyboardType="url" />
        <PrimaryButton label="Endpoint সংরক্ষণ" onPress={() => void save()} />
      </Panel>
      <Panel>
        <SectionTitle>Connection test</SectionTitle>
        <Text style={styles.help}>প্রতিটি পরীক্ষা ১০ সেকেন্ডের মধ্যে timeout হবে এবং endpoint-এ GET request পাঠাবে। API-তে authenticated/private endpoint হলে server-side test route ব্যবহার করুন।</Text>
        {(["health", "weather", "market"] as const).map((kind) => testResults[kind] ? (
          <Notice key={kind} tone={testResults[kind].includes("সংযোগ সফল") ? "success" : "warning"}>{testResults[kind]}</Notice>
        ) : null)}
        <PrimaryButton label={testing === "health" ? "পরীক্ষা হচ্ছে…" : "API health পরীক্ষা (/api/health)"} onPress={() => void testConnection("health")} disabled={testing !== null} />
        <PrimaryButton label={testing === "weather" ? "পরীক্ষা হচ্ছে…" : "Weather endpoint পরীক্ষা"} onPress={() => void testConnection("weather")} disabled={testing !== null} secondary />
        <PrimaryButton label={testing === "market" ? "পরীক্ষা হচ্ছে…" : "Market endpoint পরীক্ষা"} onPress={() => void testConnection("market")} disabled={testing !== null} secondary />
      </Panel>
      <Panel>
        <SectionTitle>Environment variables</SectionTitle>
        <Text style={styles.code}>apps/mobile/.env: EXPO_PUBLIC_API_URL=http://localhost:4000</Text>
        <Text style={styles.code}>apps/api/.env: provider API key/secret (server only)</Text>
        <Text style={styles.help}>`.env` ফাইল commit করবেন না। ফোনে localhost বলতে ফোনটিকেই বোঝায়; physical device-এ API base URL হিসেবে আপনার development computer-এর LAN IP বা HTTPS server URL ব্যবহার করুন।</Text>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f2f7f2", flex: 1 },
  content: { padding: 18, paddingBottom: 28 },
  help: { color: "#63766c", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  code: { backgroundColor: "#f2f7f2", borderRadius: 8, color: "#19352a", fontSize: 12, marginBottom: 8, padding: 10 },
});
