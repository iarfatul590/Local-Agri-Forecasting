import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import ApiSettingsScreen from "./screens/ApiSettingsScreen";
import DashboardScreen from "./screens/DashboardScreen";
import OperationsScreen from "./screens/OperationsScreen";
import { bottomTabIds, navigationItems, type ModuleId } from "./data/navigation";
import { emptyWorkspace, type ApiConfig, type RecordBucket, type WorkspaceData, type WorkspaceRecord } from "./data/types";
import { loadApiConfig, loadUpazilaFilter, loadWorkspace, saveApiConfig, saveUpazilaFilter, saveWorkspace } from "./services/localStore";

export default function App() {
  const [module, setModule] = useState<ModuleId>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [selectedUpazila, setSelectedUpazila] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const workspaceRef = useRef<WorkspaceData>(emptyWorkspace);
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const [config, setConfig] = useState<ApiConfig>({ apiBaseUrl: "", weatherEndpoint: "", marketEndpoint: "" });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([loadWorkspace(), loadApiConfig(), loadUpazilaFilter()])
      .then(([workspace, apiConfig, upazilaFilter]) => {
        if (!active) return;
        workspaceRef.current = workspace;
        setData(workspace);
        setConfig(apiConfig);
        setSelectedUpazila(upazilaFilter);
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
    Object.values(data)
      .flatMap((records) => records.map((record) => record.upazila?.trim()))
      .filter((name): name is string => Boolean(name)),
  )).sort((left, right) => left.localeCompare(right, "bn")), [data]);
  const visibleData: WorkspaceData = useMemo(() => selectedUpazila ? {
    farmers: data.farmers.filter((record) => record.upazila === selectedUpazila),
    crops: data.crops.filter((record) => record.upazila === selectedUpazila),
    buyers: data.buyers.filter((record) => record.upazila === selectedUpazila),
    collection: data.collection.filter((record) => record.upazila === selectedUpazila),
    finance: data.finance.filter((record) => record.upazila === selectedUpazila),
  } : data, [data, selectedUpazila]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#247446" size="large" />
        <Text style={styles.loadingText}>সংরক্ষিত তথ্য লোড হচ্ছে…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable accessibilityLabel="মেনু খুলুন" accessibilityRole="button" onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <View style={styles.appTitleWrap}>
          <Text style={styles.appTitle}>কৃষি সংযোগ</Text>
          <Text style={styles.appSubtitle}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="উপজেলা ফিল্টার নির্বাচন করুন" onPress={() => setRegionPickerOpen(true)} style={styles.locationChip}>
          <Text numberOfLines={1} style={styles.locationText}>{selectedUpazila ?? "সব উপজেলা"} ▾</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.loadError}>
          <Text style={styles.errorTitle}>স্থানীয় তথ্য লোড করা যায়নি</Text>
          <Text style={styles.errorCopy}>{loadError}</Text>
          <Text style={styles.errorCopy}>অ্যাপ বন্ধ করে আবার খুলুন। সংরক্ষিত তথ্য মুছে ফেলা হয়নি।</Text>
        </View>
      ) : module === "dashboard" ? (
        <DashboardScreen data={visibleData} config={config} onNavigate={setModule} />
      ) : module === "settings" ? (
        <ApiSettingsScreen config={config} onSave={updateConfig} />
      ) : (
        <OperationsScreen module={module} data={visibleData} upazila={selectedUpazila ?? ""} onAdd={addRecord} />
      )}

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
  safeArea: { backgroundColor: "#fff", flex: 1 },
  centered: { alignItems: "center", backgroundColor: "#f2f7f2", flex: 1, justifyContent: "center" },
  loadingText: { color: "#63766c", fontSize: 14, marginTop: 12 },
  appBar: { alignItems: "center", backgroundColor: "#fff", borderBottomColor: "#e5ede7", borderBottomWidth: 1, flexDirection: "row", minHeight: 62, paddingHorizontal: 14 },
  menuButton: { alignItems: "center", height: 44, justifyContent: "center", width: 42 },
  menuIcon: { color: "#19352a", fontSize: 24 },
  appTitleWrap: { flex: 1, paddingLeft: 8 },
  appTitle: { color: "#19352a", fontSize: 16, fontWeight: "800" },
  appSubtitle: { color: "#63766c", fontSize: 12, marginTop: 2 },
  locationChip: { backgroundColor: "#eaf3ec", borderRadius: 12, maxWidth: 140, paddingHorizontal: 10, paddingVertical: 9 },
  locationText: { color: "#247446", fontSize: 11, fontWeight: "700" },
  tabBar: { backgroundColor: "#fff", borderTopColor: "#dce8df", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", minHeight: 58, paddingHorizontal: 4, paddingTop: 5 },
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
