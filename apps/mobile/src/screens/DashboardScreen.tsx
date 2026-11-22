import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { navigationItems, type ModuleId } from "../data/navigation";
import type { ApiConfig, WorkspaceData } from "../data/types";
import { formatBengaliNumber, movingAverage, parseYearValues } from "../services/forecast";
import { EmptyState, Notice, PageTitle, Panel, SectionTitle } from "../components/Primitives";

type Props = {
  data: WorkspaceData;
  config: ApiConfig;
  apiConnected: boolean;
  onNavigate: (module: ModuleId) => void;
};

export default function DashboardScreen({ data, config, apiConnected, onNavigate }: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const collected = data.collection.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const monthlyIncome = data.finance
    .filter((item) => item.createdAt.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((sum, item) => sum + (Number(item.commission) || 0) + (Number(item.processingCharge) || 0), 0);
  const yearlyPrices = [0, 1, 2].map((yearIndex) => {
    const entered = data.crops
      .map((crop) => parseYearValues(crop.prices ?? ""))
      .filter((values): values is number[] => values !== null)
      .map((values) => values[yearIndex]);
    return entered.length ? entered.reduce((sum, value) => sum + value, 0) / entered.length : null;
  });
  const chartMax = Math.max(...yearlyPrices.filter((price): price is number => price !== null), 1);
  const hasPrices = yearlyPrices.some((price) => price !== null);
  const weatherConfigured = Boolean(config.weatherEndpoint.trim());

  const metrics = [
    { label: "মোট কৃষক", value: formatBengaliNumber(data.farmers.length) },
    { label: "সক্রিয় ফসল", value: formatBengaliNumber(data.crops.length) },
    { label: "সংগ্রহ (কেজি)", value: formatBengaliNumber(collected) },
    { label: "মাসিক আয় (৳)", value: formatBengaliNumber(monthlyIncome) },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, desktop ? styles.contentWide : null]}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>আপনার কর্মক্ষেত্র</Text>
          <Text style={styles.heroTitle}>কৃষির হিসাব, এক জায়গায়</Text>
          <Text style={styles.heroSubtitle}>স্থানীয় কৃষি কার্যক্রমের তথ্য সহজে দেখুন ও পরিচালনা করুন।</Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeLabel}>ডেটা মোড</Text>
          <Text style={styles.heroBadgeValue}>{apiConnected ? "API সংযুক্ত" : "এই ডিভাইসে"}</Text>
        </View>
      </View>
      <PageTitle title="ড্যাশবোর্ড" subtitle="আপনার এলাকার কৃষি কার্যক্রমের সারসংক্ষেপ" />
      <Notice tone="warning">বাজারদর ও আবহাওয়ার live তথ্য যুক্ত না হওয়া পর্যন্ত কোনো নমুনা সংখ্যা দেখানো হচ্ছে না।</Notice>

      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <Panel key={metric.label} style={[styles.metricCard, desktop ? styles.metricCardWide : null]}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
          </Panel>
        ))}
      </View>

      <Panel>
        <SectionTitle>দামের প্রবণতা</SectionTitle>
        <Text style={styles.helper}>আপনার সংরক্ষিত ফসলের ৩ বছরের ইনপুটকৃত দামের গড়।</Text>
        {hasPrices ? (
          <View style={styles.chart}>
            {yearlyPrices.map((price, index) => (
              <View key={index} style={styles.chartColumn}>
                <Text style={styles.chartValue}>{price === null ? "—" : formatBengaliNumber(price)}</Text>
                <View style={styles.barTrack}>
                  {price !== null ? <View style={[styles.bar, { height: `${Math.max(8, (price / chartMax) * 100)}%` }]} /> : null}
                </View>
                <Text style={styles.chartLabel}>{formatBengaliNumber(new Date().getFullYear() - 3 + index)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState>ফসল মডিউলে তিন বছরের দাম যোগ করলে এখানে প্রবণতা দেখা যাবে।</EmptyState>
        )}
      </Panel>

      <Panel>
        <SectionTitle>আবহাওয়া</SectionTitle>
        <View style={styles.weatherRow}>
          <Text style={styles.weatherIcon}>☁</Text>
          <View style={styles.weatherCopy}>
            <Text style={styles.weatherTitle}>{weatherConfigured ? "Weather endpoint সংরক্ষিত" : "আবহাওয়া API সংযুক্ত নয়"}</Text>
            <Text style={styles.helper}>
              {weatherConfigured
                ? "API সংযোগ পাতায় গিয়ে endpoint পরীক্ষা করুন। এই dashboard-এ এখনো লাইভ আবহাওয়া দেখানো হচ্ছে না।"
                : "লাইভ আবহাওয়া দেখাতে API সংযোগ পাতায় endpoint কনফিগার ও পরীক্ষা করুন।"}
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => onNavigate("settings")} style={styles.actionButton}>
          <Text style={styles.action}>API সংযোগ কনফিগার করুন <Text style={styles.actionArrow}>→</Text></Text>
        </Pressable>
      </Panel>

      <Panel>
        <SectionTitle>দ্রুত মডিউল</SectionTitle>
        <View style={styles.quickGrid}>
          {navigationItems.slice(1, 7).map((item) => (
            <Pressable accessibilityRole="button" key={item.id} onPress={() => onNavigate(item.id)} style={styles.quickItem}>
              <Text style={styles.quickIcon}>{item.icon}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
              <Text style={styles.quickArrow}>↗</Text>
            </Pressable>
          ))}
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f7f2", flex: 1 },
  content: { alignSelf: "center", maxWidth: 1180, padding: 18, paddingBottom: 32, width: "100%" },
  contentWide: { paddingHorizontal: 34, paddingTop: 30 },
  hero: { alignItems: "center", backgroundColor: "#153e30", borderRadius: 20, flexDirection: "row", justifyContent: "space-between", marginBottom: 28, minHeight: 158, overflow: "hidden", padding: 26 },
  heroCopy: { flex: 1, paddingRight: 18 },
  heroEyebrow: { color: "#b8d7c1", fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginBottom: 9 },
  heroTitle: { color: "#fff", fontSize: 25, fontWeight: "900", lineHeight: 32 },
  heroSubtitle: { color: "#d0e2d5", fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 520 },
  heroBadge: { backgroundColor: "#245743", borderColor: "#47765d", borderRadius: 14, borderWidth: 1, minWidth: 112, paddingHorizontal: 13, paddingVertical: 11 },
  heroBadgeLabel: { color: "#b8d7c1", fontSize: 10, fontWeight: "700" },
  heroBadgeValue: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 5 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  metricCard: { borderTopColor: "#72a67d", borderTopWidth: 3, flexBasis: "46%", flexGrow: 1, justifyContent: "center", marginBottom: 0, minHeight: 105 },
  metricCardWide: { flexBasis: "22%" },
  metricLabel: { color: "#68796f", fontSize: 12, fontWeight: "700" },
  metricValue: { color: "#183a2d", fontSize: 25, fontWeight: "900", marginTop: 8 },
  helper: { color: "#68796f", fontSize: 13, lineHeight: 20 },
  chart: { flexDirection: "row", height: 160, justifyContent: "space-around", marginTop: 18 },
  chartColumn: { alignItems: "center", flex: 1 },
  chartValue: { color: "#426352", fontSize: 11, fontWeight: "700" },
  barTrack: { backgroundColor: "#edf4ef", borderRadius: 8, flex: 1, justifyContent: "flex-end", marginVertical: 8, overflow: "hidden", width: 30 },
  bar: { backgroundColor: "#39845a", borderRadius: 8, minHeight: 3, width: "100%" },
  chartLabel: { color: "#63766c", fontSize: 12 },
  weatherRow: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 12 },
  weatherIcon: { color: "#7a9bb5", fontSize: 32 },
  weatherCopy: { flex: 1 },
  weatherTitle: { color: "#183a2d", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  actionButton: { alignSelf: "flex-start", marginTop: 2 },
  action: { color: "#2f7b4e", fontSize: 13, fontWeight: "800", paddingVertical: 8 },
  actionArrow: { fontSize: 16 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: { alignItems: "center", backgroundColor: "#f5f8f4", borderColor: "#e5ece4", borderRadius: 12, borderWidth: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 12, width: "48%" },
  quickIcon: { color: "#2f7b4e", fontSize: 17, textAlign: "center", width: 24 },
  quickLabel: { color: "#315b45", flex: 1, fontSize: 12, fontWeight: "700", marginLeft: 7 },
  quickArrow: { color: "#91a296", fontSize: 13 },
});
