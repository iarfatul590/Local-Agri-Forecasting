import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import ApiSettingsScreen from "./screens/ApiSettingsScreen";
import ApiWorkspaceScreen from "./screens/ApiWorkspaceScreen";
import AuthScreen from "./screens/AuthScreen";
import DashboardScreen from "./screens/DashboardScreen";
import OperationsScreen from "./screens/OperationsScreen";
import { bottomTabIds, navigationItems, type ModuleId } from "./data/navigation";
import { emptyApiWorkspace, type ApiUser, type ApiWorkspace } from "./data/apiTypes";
import { emptyWorkspace, type ApiConfig, type RecordBucket, type WorkspaceData, type WorkspaceRecord } from "./data/types";
import { ApiClient, loadApiSession, loadApiWorkspace, saveApiSession } from "./services/api";
import { loadApiConfig, loadUpazilaFilter, loadWorkspace, saveApiConfig, saveUpazilaFilter, saveWorkspace } from "./services/localStore";

export default function App() {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 980;
  const [module, setModule] = useState<ModuleId>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [selectedUpazila, setSelectedUpazila] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const workspaceRef = useRef<WorkspaceData>(emptyWorkspace);
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const [config, setConfig] = useState<ApiConfig>({ apiBaseUrl: "", weatherEndpoint: "", marketEndpoint: "" });
  const [apiSession, setApiSession] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [apiWorkspace, setApiWorkspace] = useState<ApiWorkspace>(emptyApiWorkspace);
  const [apiError, setApiError] = useState("");
  const [remoteReady, setRemoteReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([loadWorkspace(), loadApiConfig(), loadUpazilaFilter(), loadApiSession()])
      .then(([workspace, apiConfig, upazilaFilter, savedSession]) => {
        if (!active) return;
        workspaceRef.current = workspace;
        setData(workspace);
        setConfig(apiConfig);
        setSelectedUpazila(upazilaFilter);
        setApiSession(savedSession);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "স্থানীয় তথ্য পড়া যায়নি।");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const onSessionChange = useCallback(async (session: { accessToken: string; refreshToken: string }) => {
    await saveApiSession(session);
    setApiSession(session);
  }, []);

  const onUnauthorized = useCallback(async () => {
    await saveApiSession(null);
    setApiSession(null);
    setApiUser(null);
    setApiWorkspace(emptyApiWorkspace);
    setApiError("সেশন শেষ হয়েছে। আবার ফোন নম্বর দিয়ে প্রবেশ করুন।");
  }, []);

  const apiClient = useMemo(() => apiSession && config.apiBaseUrl.trim()
    ? new ApiClient(config.apiBaseUrl.trim().replace(/\/+$/, ""), apiSession, onSessionChange, onUnauthorized)
    : null, [apiSession, config.apiBaseUrl, onSessionChange, onUnauthorized]);

  const refreshApiWorkspace = useCallback(async () => {
    if (!apiClient) return;
    const user = await apiClient.request<ApiUser>("/api/auth/me");
    const workspace = await loadApiWorkspace(apiClient, user);
    setApiUser(user);
    setApiWorkspace(workspace);
    setApiError("");
  }, [apiClient]);

  async function retryApiWorkspace() {
    setRemoteReady(false);
    try {
      await refreshApiWorkspace();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API থেকে তথ্য পড়া যায়নি।");
    } finally {
      setRemoteReady(true);
    }
  }

  useEffect(() => {
    let active = true;
    if (!ready || !apiClient) {
      setRemoteReady(true);
      return () => {
        active = false;
      };
    }

    setRemoteReady(false);
    void (async () => {
      try {
        const user = await apiClient.request<ApiUser>("/api/auth/me");
        const workspace = await loadApiWorkspace(apiClient, user);
        if (!active) return;
        setApiUser(user);
        setApiWorkspace(workspace);
        setApiError("");
      } catch (error) {
        if (!active) return;
        setApiError(error instanceof Error ? error.message : "API থেকে তথ্য পড়া যায়নি।");
      } finally {
        if (active) setRemoteReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [apiClient, ready]);

  async function addRecord(bucket: RecordBucket, record: WorkspaceRecord) {
    const write = writesRef.current.then(async () => {
      const current = workspaceRef.current;
      const updated = { ...current, [bucket]: [record, ...current[bucket]] };
      await saveWorkspace(updated);
      workspaceRef.current = updated;
      setData(updated);
    });
    writesRef.current = write.catch(() => {});
    await write;
  }

  async function updateConfig(updated: ApiConfig) {
    await saveApiConfig(updated);
    setConfig(updated);
  }

  async function authenticate(auth: { accessToken: string; refreshToken: string; user: ApiUser }) {
    const session = { accessToken: auth.accessToken, refreshToken: auth.refreshToken };
    await saveApiSession(session);
    setApiSession(session);
    setApiUser(auth.user);
    setApiError("");
  }

  async function logout() {
    try {
      if (apiClient && apiSession) {
        await apiClient.request("/api/auth/logout", {
          method: "POST",
          body: { refreshToken: apiSession.refreshToken },
        });
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "সার্ভার থেকে লগআউট নিশ্চিত করা যায়নি।");
    } finally {
      await saveApiSession(null);
      setApiSession(null);
      setApiUser(null);
      setApiWorkspace(emptyApiWorkspace);
    }
  }

  async function updateUpazila(upazila: string | null) {
    try {
      await saveUpazilaFilter(upazila);
      setSelectedUpazila(upazila);
      setRegionPickerOpen(false);
    } catch (error) {
      Alert.alert("উপজেলা সংরক্ষণ হয়নি", error instanceof Error ? error.message : "স্থানীয় স্টোরেজে উপজেলা রাখা যায়নি।");
    }
  }

  const title = navigationItems.find((item) => item.id === module)?.label ?? "কৃষি সংযোগ";
  const upazilaOptions = useMemo(() => Array.from(new Set(
    [
      ...Object.values(data).flatMap((records) => records.map((record) => record.upazila?.trim())),
      ...apiWorkspace.upazilas.map((upazila) => upazila.nameBn),
    ].filter((name): name is string => Boolean(name)),
  )).sort((left, right) => left.localeCompare(right, "bn")), [apiWorkspace.upazilas, data]);
  const visibleData: WorkspaceData = useMemo(() => selectedUpazila ? {
    farmers: data.farmers.filter((record) => record.upazila === selectedUpazila),
    crops: data.crops.filter((record) => record.upazila === selectedUpazila),
    buyers: data.buyers.filter((record) => record.upazila === selectedUpazila),
    collection: data.collection.filter((record) => record.upazila === selectedUpazila),
    finance: data.finance.filter((record) => record.upazila === selectedUpazila),
  } : data, [data, selectedUpazila]);
  const dashboardData: WorkspaceData = useMemo(() => {
    const upazilaName = (id: string) => apiWorkspace.upazilas.find((upazila) => upazila.id === id)?.nameBn ?? "";
    const farmers = apiWorkspace.farmers.length
      ? apiWorkspace.farmers
      : apiWorkspace.farmerProfile ? [apiWorkspace.farmerProfile] : [];
    const buyers = apiWorkspace.buyers.length
      ? apiWorkspace.buyers
      : apiWorkspace.buyerProfile ? [apiWorkspace.buyerProfile] : [];
    const remote: WorkspaceData = {
      farmers: farmers.map((farmer) => ({
        id: farmer.id,
        createdAt: new Date().toISOString(),
        name: farmer.user?.name ?? apiUser?.name ?? "কৃষক",
        upazila: upazilaName(farmer.upazilaId),
        land: String(farmer.landSizeAcres),
      })),
      crops: apiWorkspace.crops.map((crop) => ({
        id: crop.id,
        createdAt: new Date().toISOString(),
        name: crop.nameBn,
        prices: "",
        yields: "",
      })),
      buyers: buyers.map((buyer) => ({
        id: buyer.id,
        createdAt: new Date().toISOString(),
        name: buyer.businessName ?? buyer.user?.name ?? apiUser?.name ?? "ক্রেতা",
        buyerType: buyer.buyerType,
        crop: "",
        demand: "",
        upazila: upazilaName(buyer.upazilaId),
      })),
      collection: apiWorkspace.collection.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        quantity: String(entry.receivedKg),
        spoiled: String(Number(entry.receivedKg) - Number(entry.acceptedKg)),
        crop: entry.crop?.nameBn ?? "",
        farmer: entry.farmer?.user?.name ?? "",
        upazila: entry.center?.upazila?.nameBn ?? upazilaName(entry.center?.upazilaId ?? ""),
      })),
      finance: data.finance,
    };
    const filtered: WorkspaceData = selectedUpazila ? {
      ...remote,
      farmers: remote.farmers.filter((record) => record.upazila === selectedUpazila),
      crops: remote.crops,
      buyers: remote.buyers.filter((record) => record.upazila === selectedUpazila),
      collection: remote.collection.filter((record) => record.upazila === selectedUpazila),
      finance: data.finance.filter((record) => record.upazila === selectedUpazila),
    } : remote;
    return {
      ...filtered,
      farmers: filtered.farmers.length ? filtered.farmers : selectedUpazila ? [] : data.farmers,
      crops: filtered.crops.length ? filtered.crops : data.crops,
      buyers: filtered.buyers.length ? filtered.buyers : selectedUpazila ? [] : data.buyers,
      collection: filtered.collection.length ? filtered.collection : selectedUpazila ? [] : data.collection,
      finance: data.finance,
    };
  }, [apiUser, apiWorkspace, data, selectedUpazila]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#247446" size="large" />
        <Text style={styles.loadingText}>সংরক্ষিত তথ্য লোড হচ্ছে…</Text>
      </SafeAreaView>
    );
  }

  if (!apiSession || !config.apiBaseUrl.trim()) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <AuthScreen
          apiBaseUrl={config.apiBaseUrl}
          onSaveApiBaseUrl={(apiBaseUrl) => updateConfig({ ...config, apiBaseUrl })}
          onAuthenticated={authenticate}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={[styles.shell, wideLayout ? styles.wideShell : null]}>
        {wideLayout ? (
          <View style={styles.desktopSidebar}>
            <View style={styles.desktopBrandBlock}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>ক</Text></View>
              <View>
                <Text style={styles.desktopBrand}>কৃষি সংযোগ</Text>
                <Text style={styles.desktopSubtitle}>কৃষি ব্যবস্থাপনা</Text>
              </View>
            </View>
            <Text style={styles.navCaption}>WORKSPACE</Text>
            <ScrollView contentContainerStyle={styles.desktopNavigation}>
              {navigationItems.map((item) => {
                const selected = item.id === module;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={item.id}
                    onPress={() => setModule(item.id)}
                    style={[styles.desktopNavItem, selected ? styles.desktopNavItemSelected : null]}
                  >
                    <Text style={[styles.desktopNavIcon, selected ? styles.desktopNavTextSelected : null]}>{item.icon}</Text>
                    <Text style={[styles.desktopNavText, selected ? styles.desktopNavTextSelected : null]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <Text style={styles.sidebarFooterTitle}>স্থানীয় কৃষির জন্য</Text>
              <Text style={styles.sidebarFooterCopy}>মূল রেকর্ড API-তে; finance ও report এই ডিভাইসে থাকে।</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.mainColumn}>
          <View style={styles.appBar}>
            {!wideLayout ? (
              <Pressable accessibilityLabel="মেনু খুলুন" accessibilityRole="button" onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
                <Text style={styles.menuIcon}>☰</Text>
              </Pressable>
            ) : null}
            <View style={[styles.appTitleWrap, wideLayout ? styles.appTitleWrapWide : null]}>
              <Text style={styles.appTitle}>কৃষি সংযোগ</Text>
              <Text style={styles.appSubtitle}>{title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="উপজেলা ফিল্টার নির্বাচন করুন" onPress={() => setRegionPickerOpen(true)} style={styles.locationChip}>
              <Text style={styles.locationPin}>⌖</Text>
              <Text numberOfLines={1} style={styles.locationText}>{selectedUpazila ?? "সব উপজেলা"}</Text>
              <Text style={styles.locationChevron}>⌄</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logoutButton}>
              <Text style={styles.logoutText}>বের হন</Text>
            </Pressable>
          </View>

          <View style={styles.pageViewport}>
            {loadError ? (
              <View style={styles.loadError}>
                <Text style={styles.errorTitle}>স্থানীয় তথ্য লোড করা যায়নি</Text>
                <Text style={styles.errorCopy}>{loadError}</Text>
                <Text style={styles.errorCopy}>অ্যাপ বন্ধ করে আবার খুলুন। সংরক্ষিত তথ্য মুছে ফেলা হয়নি।</Text>
              </View>
            ) : !remoteReady ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#247446" size="large" />
                <Text style={styles.loadingText}>সার্ভার থেকে তথ্য আসছে…</Text>
              </View>
            ) : apiError ? (
              <View style={styles.loadError}>
                <Text style={styles.errorTitle}>API সংযোগ করা যায়নি</Text>
                <Text style={styles.errorCopy}>{apiError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void retryApiWorkspace()} style={styles.retryButton}>
                  <Text style={styles.retryText}>আবার চেষ্টা করুন</Text>
                </Pressable>
              </View>
            ) : module === "dashboard" ? (
              <DashboardScreen data={dashboardData} config={config} apiConnected={!apiError} onNavigate={setModule} />
            ) : module === "settings" ? (
              <ApiSettingsScreen config={config} onSave={updateConfig} />
            ) : module === "farmers" || module === "crops" || module === "buyers" || module === "collection" ? (
              apiUser && apiClient ? (
                <ApiWorkspaceScreen
                  module={module}
                  user={apiUser}
                  client={apiClient}
                  data={apiWorkspace}
                  onRefresh={refreshApiWorkspace}
                />
              ) : null
            ) : (
              <OperationsScreen module={module} data={visibleData} upazila={selectedUpazila ?? ""} onAdd={addRecord} />
            )}
          </View>

          {!wideLayout ? (
            <View style={styles.tabBar}>
              {bottomTabIds.map((id) => {
                const item = navigationItems.find((entry) => entry.id === id);
                if (!item) return null;
                const selected = id === module;
                return (
                  <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setModule(id)} style={styles.tab}>
                    <Text style={[styles.tabIcon, selected ? styles.tabSelected : null]}>{item.icon}</Text>
                    <Text numberOfLines={1} style={[styles.tabLabel, selected ? styles.tabSelected : null]}>{bottomTabLabels[id] ?? item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      <Modal visible={drawerOpen} animationType="fade" transparent onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerRoot}>
          <Pressable accessibilityLabel="মেনু বন্ধ করুন" style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerBrand}>কৃষি সংযোগ</Text>
              <Text style={styles.drawerSubtitle}>উপজেলাভিত্তিক কৃষি ব্যবস্থাপনা</Text>
            </View>
            <ScrollView>
              {navigationItems.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    setModule(item.id);
                    setDrawerOpen(false);
                  }}
                  style={[styles.drawerItem, module === item.id ? styles.drawerItemSelected : null]}
                >
                  <Text style={[styles.drawerIcon, module === item.id ? styles.tabSelected : null]}>{item.icon}</Text>
                  <Text style={[styles.drawerLabel, module === item.id ? styles.tabSelected : null]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={regionPickerOpen} animationType="fade" transparent onRequestClose={() => setRegionPickerOpen(false)}>
        <View style={styles.regionModalRoot}>
          <Pressable accessibilityLabel="উপজেলা নির্বাচন বন্ধ করুন" style={styles.regionBackdrop} onPress={() => setRegionPickerOpen(false)} />
          <View style={styles.regionDialog}>
            <Text style={styles.regionTitle}>উপজেলা অনুযায়ী দেখুন</Text>
            <Pressable style={styles.regionOption} onPress={() => void updateUpazila(null)}>
              <Text style={[styles.regionOptionText, selectedUpazila === null ? styles.tabSelected : null]}>সব উপজেলা</Text>
            </Pressable>
            {upazilaOptions.map((upazila) => (
              <Pressable key={upazila} style={styles.regionOption} onPress={() => void updateUpazila(upazila)}>
                <Text style={[styles.regionOptionText, selectedUpazila === upazila ? styles.tabSelected : null]}>{upazila}</Text>
              </Pressable>
            ))}
            {!upazilaOptions.length ? <Text style={styles.regionHelp}>কৃষক, ফসল, ক্রেতা, সংগ্রহ বা আয়-ব্যয়ের ফর্মে উপজেলার নাম দিলে এখানে নির্বাচন করা যাবে।</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => setRegionPickerOpen(false)} style={styles.regionClose}>
              <Text style={styles.regionCloseText}>বন্ধ করুন</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const bottomTabLabels: Partial<Record<ModuleId, string>> = {
  dashboard: "হোম",
  farmers: "কৃষক",
  crops: "ফসল",
  buyers: "ক্রেতা",
  collection: "স্টক",
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#f4f7f2", flex: 1 },
  shell: { flex: 1 },
  wideShell: { flexDirection: "row" },
  mainColumn: { flex: 1, minWidth: 0 },
  pageViewport: { flex: 1, minHeight: 0 },
  desktopSidebar: { backgroundColor: "#12382d", paddingHorizontal: 18, paddingTop: 28, width: 252 },
  desktopBrandBlock: { alignItems: "center", flexDirection: "row", gap: 11, marginBottom: 38, paddingHorizontal: 6 },
  brandMark: { alignItems: "center", backgroundColor: "#d8f0d7", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  brandMarkText: { color: "#12382d", fontSize: 21, fontWeight: "900" },
  desktopBrand: { color: "#fff", fontSize: 17, fontWeight: "800" },
  desktopSubtitle: { color: "#a9c5b7", fontSize: 11, marginTop: 3 },
  navCaption: { color: "#86a998", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10, marginLeft: 10 },
  desktopNavigation: { gap: 5, paddingBottom: 16 },
  desktopNavItem: { alignItems: "center", borderRadius: 12, flexDirection: "row", minHeight: 46, paddingHorizontal: 11 },
  desktopNavItemSelected: { backgroundColor: "#245544" },
  desktopNavIcon: { color: "#b1c9bd", fontSize: 18, textAlign: "center", width: 30 },
  desktopNavText: { color: "#d5e4dc", fontSize: 13, fontWeight: "600", marginLeft: 8 },
  desktopNavTextSelected: { color: "#fff", fontWeight: "800" },
  sidebarFooter: { borderColor: "#315b4b", borderRadius: 13, borderWidth: 1, marginTop: "auto", padding: 13 },
  sidebarFooterTitle: { color: "#e5f1e8", fontSize: 12, fontWeight: "700" },
  sidebarFooterCopy: { color: "#a9c5b7", fontSize: 11, lineHeight: 17, marginTop: 4 },
  centered: { alignItems: "center", backgroundColor: "#f2f7f2", flex: 1, justifyContent: "center" },
  loadingText: { color: "#63766c", fontSize: 14, marginTop: 12 },
  appBar: { alignItems: "center", backgroundColor: "#fff", borderBottomColor: "#e5ebe6", borderBottomWidth: 1, flexDirection: "row", minHeight: 72, paddingHorizontal: 22 },
  menuButton: { alignItems: "center", height: 44, justifyContent: "center", width: 42 },
  menuIcon: { color: "#19352a", fontSize: 24 },
  appTitleWrap: { flex: 1, paddingLeft: 8 },
  appTitleWrapWide: { paddingLeft: 4 },
  appTitle: { color: "#173b2e", fontSize: 16, fontWeight: "800" },
  appSubtitle: { color: "#718078", fontSize: 12, marginTop: 3 },
  locationChip: { alignItems: "center", backgroundColor: "#f2f6f1", borderColor: "#e3ebe3", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, maxWidth: 220, paddingHorizontal: 11, paddingVertical: 9 },
  locationPin: { color: "#39845a", fontSize: 16 },
  locationText: { color: "#315b45", flexShrink: 1, fontSize: 12, fontWeight: "700" },
  locationChevron: { color: "#718078", fontSize: 15 },
  logoutButton: { backgroundColor: "#eaf3ec", borderRadius: 10, marginLeft: 8, paddingHorizontal: 10, paddingVertical: 9 },
  logoutText: { color: "#247446", fontSize: 12, fontWeight: "800" },
  tabBar: { backgroundColor: "#fff", borderTopColor: "#e1e9e2", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", minHeight: 62, paddingHorizontal: 4, paddingTop: 5 },
  tab: { alignItems: "center", flex: 1, justifyContent: "center", minWidth: 0, paddingHorizontal: 2 },
  tabIcon: { color: "#61746a", fontSize: 20, lineHeight: 23 },
  tabLabel: { color: "#52665b", fontSize: 11, fontWeight: "600", marginTop: 2 },
  tabSelected: { color: "#247446", fontWeight: "800" },
  drawerRoot: { backgroundColor: "rgba(10, 28, 17, 0.4)", flex: 1, flexDirection: "row" },
  drawerBackdrop: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  drawer: { backgroundColor: "#fff", maxWidth: 340, paddingBottom: 20, paddingHorizontal: 14, paddingTop: 26, width: "82%" },
  drawerHeader: { borderBottomColor: "#e5ede7", borderBottomWidth: 1, marginBottom: 10, paddingBottom: 18, paddingHorizontal: 8 },
  drawerBrand: { color: "#19352a", fontSize: 20, fontWeight: "900" },
  drawerSubtitle: { color: "#63766c", fontSize: 12, marginTop: 5 },
  drawerItem: { alignItems: "center", borderRadius: 11, flexDirection: "row", marginVertical: 2, minHeight: 46, paddingHorizontal: 10 },
  drawerItemSelected: { backgroundColor: "#eaf3ec" },
  drawerIcon: { color: "#718078", fontSize: 18, textAlign: "center", width: 32 },
  drawerLabel: { color: "#354c40", fontSize: 14, fontWeight: "600", marginLeft: 7 },
  loadError: { backgroundColor: "#fff3df", borderRadius: 14, margin: 18, padding: 16 },
  errorTitle: { color: "#6d3b0f", fontSize: 16, fontWeight: "800" },
  errorCopy: { color: "#6d3b0f", fontSize: 13, lineHeight: 20, marginTop: 7 },
  retryButton: { alignSelf: "flex-start", backgroundColor: "#eaf3ec", borderRadius: 9, marginTop: 12, paddingHorizontal: 13, paddingVertical: 10 },
  retryText: { color: "#247446", fontSize: 13, fontWeight: "800" },
  regionModalRoot: { alignItems: "center", backgroundColor: "rgba(10, 28, 17, 0.4)", flex: 1, justifyContent: "center", padding: 22 },
  regionBackdrop: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  regionDialog: { backgroundColor: "#fff", borderRadius: 18, maxHeight: "75%", padding: 18, width: "100%" },
  regionTitle: { color: "#19352a", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  regionOption: { borderBottomColor: "#e5ede7", borderBottomWidth: 1, minHeight: 46, justifyContent: "center", paddingHorizontal: 8 },
  regionOptionText: { color: "#354c40", fontSize: 15, fontWeight: "600" },
  regionHelp: { color: "#63766c", fontSize: 13, lineHeight: 20, paddingVertical: 12 },
  regionClose: { alignItems: "center", backgroundColor: "#eaf3ec", borderRadius: 10, marginTop: 12, paddingVertical: 11 },
  regionCloseText: { color: "#247446", fontSize: 14, fontWeight: "800" },
});
