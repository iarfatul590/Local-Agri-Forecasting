import { ScrollView, StyleSheet, Text, View } from "react-native";
import { navigationItems, type ModuleId } from "../data/navigation";
import type { ApiConfig, WorkspaceData } from "../data/types";
import { formatBengaliNumber, movingAverage, parseYearValues } from "../services/forecast";
import { EmptyState, Notice, PageTitle, Panel, SectionTitle } from "../components/Primitives";

type Props = {
  data: WorkspaceData;
  config: ApiConfig;
  onNavigate: (module: ModuleId) => void;
};

export default function DashboardScreen({ data, config, onNavigate }: Props) {
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageTitle title="কৃষি সংযোগ" subtitle="আপনার এলাকার কৃষি কার্যক্রমের সারসংক্ষেপ" />
      <Notice tone="warning">বাজারদর ও আবহাওয়ার live তথ্য যুক্ত না হওয়া পর্যন্ত কোনো নমুনা সংখ্যা দেখানো হচ্ছে না।</Notice>

      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <Panel key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
          </Panel>
        ))}
      </View>

      <Panel>
        <SectionTitle>দামের প্রবণতা</SectionTitle>
        <Text style={styles.helper}>আপনার সংরক্ষিত ফসলের ৩ বছরের ইনপুটকৃত দামের গড়; কোনো তথ্য না থাকলে চার্ট দেখানো হয় না।</Text>
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
        <Text onPress={() => onNavigate("settings")} style={styles.action}>API সংযোগ কনফিগার করুন →</Text>
      </Panel>

      <Panel>
        <SectionTitle>দ্রুত মডিউল</SectionTitle>
        <View style={styles.quickGrid}>
          {navigationItems.slice(1, 7).map((item) => (
            <Text key={item.id} onPress={() => onNavigate(item.id)} style={styles.quickItem}>
              {item.icon}  {item.label}
            </Text>
          ))}
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f7f2" },
  content: { padding: 18, paddingBottom: 28 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 2 },
  metricCard: { flexBasis: "47%", flexGrow: 1, marginBottom: 0, minHeight: 92, justifyContent: "center" },
  metricLabel: { color: "#63766c", fontSize: 12, fontWeight: "600" },
  metricValue: { color: "#19352a", fontSize: 23, fontWeight: "800", marginTop: 6 },
  helper: { color: "#63766c", fontSize: 13, lineHeight: 19 },
  chart: { flexDirection: "row", height: 160, justifyContent: "space-around", marginTop: 18 },
  chartColumn: { alignItems: "center", flex: 1 },
  chartValue: { color: "#426352", fontSize: 11 },
  barTrack: { backgroundColor: "#edf4ef", borderRadius: 8, flex: 1, justifyContent: "flex-end", marginVertical: 8, overflow: "hidden", width: 30 },
  bar: { backgroundColor: "#39845a", borderRadius: 8, minHeight: 3, width: "100%" },
  chartLabel: { color: "#63766c", fontSize: 12 },
  weatherRow: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 12 },
  weatherIcon: { color: "#7a9bb5", fontSize: 32 },
  weatherCopy: { flex: 1 },
  weatherTitle: { color: "#19352a", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  action: { color: "#247446", fontSize: 14, fontWeight: "800", paddingVertical: 6 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickItem: { backgroundColor: "#eff6f0", borderRadius: 10, color: "#247446", fontSize: 13, fontWeight: "700", overflow: "hidden", padding: 10 },
});
