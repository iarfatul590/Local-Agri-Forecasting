import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ModuleId } from "../data/navigation";
import type { RecordBucket, WorkspaceData, WorkspaceRecord } from "../data/types";
import { formatBengaliNumber, movingAverage, normalizeNumerals, parseNumericInput, parseYearValues } from "../services/forecast";
import {
  ChoiceField,
  EmptyState,
  Field,
  Notice,
  PageTitle,
  Panel,
  PrimaryButton,
  SectionTitle,
} from "../components/Primitives";

type Props = {
  module: Exclude<ModuleId, "dashboard" | "settings">;
  data: WorkspaceData;
  upazila: string;
  onAdd: (bucket: RecordBucket, record: WorkspaceRecord) => Promise<void>;
};

type FieldSpec = {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  required?: boolean;
};

const fieldsByBucket: Record<RecordBucket, FieldSpec[]> = {
  farmers: [
    { key: "name", label: "কৃষকের নাম", placeholder: "নাম লিখুন", required: true },
    { key: "phone", label: "মোবাইল নম্বর", placeholder: "01XXXXXXXXX", keyboardType: "phone-pad", required: true },
    { key: "upazila", label: "উপজেলা", placeholder: "উপজেলার নাম", required: true },
    { key: "land", label: "জমির পরিমাণ (একর)", placeholder: "যেমন ১.৫", keyboardType: "numeric", required: true },
    { key: "crop", label: "প্রধান ফসল", placeholder: "ফসলের নাম", required: true },
  ],
  crops: [
    { key: "name", label: "ফসলের নাম", placeholder: "যেমন ধান", required: true },
    { key: "variety", label: "জাত", placeholder: "জাতের নাম" },
    { key: "upazila", label: "উপজেলা", placeholder: "উপজেলার নাম", required: true },
    { key: "prices", label: "গত ৩ বছরের দাম (৳/কেজি)", placeholder: "কমা দিয়ে লিখুন: ৩০, ৩২, ৩৫", required: true },
    { key: "yields", label: "গত ৩ বছরের উৎপাদন (কেজি)", placeholder: "কমা দিয়ে লিখুন: ১২০০, ১৩০০, ১২৫০", required: true },
    { key: "plantingWindow", label: "স্থানীয় অভিজ্ঞতায় চাষের সময়", placeholder: "মাস/মৌসুম লিখুন (ঐচ্ছিক)" },
    { key: "harvestWindow", label: "ফসল ওঠা/বিক্রির সম্ভাব্য সময়", placeholder: "মাস/মৌসুম লিখুন (ঐচ্ছিক)" },
  ],
  buyers: [
    { key: "name", label: "প্রতিষ্ঠান/ক্রেতার নাম", placeholder: "নাম লিখুন", required: true },
    { key: "phone", label: "যোগাযোগ নম্বর", placeholder: "01XXXXXXXXX", keyboardType: "phone-pad", required: true },
    { key: "upazila", label: "উপজেলা", placeholder: "উপজেলার নাম", required: true },
    { key: "crop", label: "যে ফসল চান", placeholder: "ফসলের নাম", required: true },
    { key: "demand", label: "চাহিদা (কেজি)", placeholder: "পরিমাণ লিখুন", keyboardType: "numeric", required: true },
  ],
  collection: [
    { key: "upazila", label: "উপজেলা", placeholder: "উপজেলার নাম", required: true },
    { key: "crop", label: "ফসল", placeholder: "ফসলের নাম", required: true },
    { key: "farmer", label: "কৃষক", placeholder: "কৃষকের নাম", required: true },
    { key: "quantity", label: "সংগ্রহ (কেজি)", placeholder: "পরিমাণ লিখুন", keyboardType: "numeric", required: true },
    { key: "spoiled", label: "নষ্ট (কেজি)", placeholder: "না থাকলে ০ লিখুন", keyboardType: "numeric", required: true },
  ],
  finance: [
    { key: "upazila", label: "উপজেলা", placeholder: "উপজেলার নাম", required: true },
    { key: "salesVolume", label: "লেনদেনের মোট মূল্য (৳)", placeholder: "পরিমাণ লিখুন", keyboardType: "numeric", required: true },
    { key: "commissionRate", label: "কমিশন হার (%)", placeholder: "যেমন ২", keyboardType: "numeric", required: true },
    { key: "processingCharge", label: "প্রসেসিং চার্জ (৳)", placeholder: "পরিমাণ লিখুন", keyboardType: "numeric", required: true },
    { key: "operatingCost", label: "অপারেটিং ব্যয় (৳)", placeholder: "পরিমাণ লিখুন", keyboardType: "numeric", required: true },
  ],
};

const titles: Record<Exclude<ModuleId, "dashboard" | "settings">, string> = {
  farmers: "কৃষক ব্যবস্থাপনা",
  crops: "ফসল তথ্য",
  forecast: "ফসল পূর্বাভাস",
  buyers: "ক্রেতা ও চাহিদা",
  collection: "সংগ্রহ ও স্টক",
  finance: "আয়-ব্যয়",
  reports: "রিপোর্ট",
};

const bucketForModule: Partial<Record<Props["module"], RecordBucket>> = {
  farmers: "farmers",
  crops: "crops",
  forecast: "crops",
  buyers: "buyers",
  collection: "collection",
  finance: "finance",
};

function OperationsForm({ bucket, upazila, onAdd }: { bucket: RecordBucket; upazila: string; onAdd: Props["onAdd"] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feeStatus, setFeeStatus] = useState("পরিশোধিত");
  const [channel, setChannel] = useState("SMS");
  const [buyerType, setBuyerType] = useState("পাইকার");
  const [grading, setGrading] = useState("অপেক্ষমাণ");
  const [drying, setDrying] = useState("অপেক্ষমাণ");
  const [packing, setPacking] = useState("অপেক্ষমাণ");

  useEffect(() => {
    if (!upazila || !fieldsByBucket[bucket].some((field) => field.key === "upazila")) return;
    setValues((current) => current.upazila ? current : { ...current, upazila });
  }, [bucket, upazila]);

  async function submit() {
    const nextErrors: Record<string, string> = {};
    const normalizedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, normalizeNumerals(value.trim())]),
    );
    for (const field of fieldsByBucket[bucket]) {
      const value = normalizedValues[field.key] ?? "";
      if (field.required && !value) nextErrors[field.key] = "এই তথ্যটি আবশ্যক।";
      else if (field.keyboardType === "numeric" && value && parseNumericInput(value) === null) {
        nextErrors[field.key] = "শুধু শূন্য বা ধনাত্মক সংখ্যা লিখুন।";
      }
    }

    if (bucket === "farmers" && normalizedValues.phone && !/^(?:\+?88)?01[3-9]\d{8}$/.test(normalizedValues.phone.replace(/[\s-]/g, ""))) {
      nextErrors.phone = "বাংলাদেশের সঠিক মোবাইল নম্বর লিখুন।";
    }
    if (bucket === "buyers" && normalizedValues.phone && !/^(?:\+?88)?01[3-9]\d{8}$/.test(normalizedValues.phone.replace(/[\s-]/g, ""))) {
      nextErrors.phone = "বাংলাদেশের সঠিক মোবাইল নম্বর লিখুন।";
    }
    if (bucket === "collection" && Number(normalizedValues.spoiled) > Number(normalizedValues.quantity)) {
      nextErrors.spoiled = "নষ্টের পরিমাণ মোট সংগ্রহের চেয়ে বেশি হতে পারবে না।";
    }
    if (bucket === "finance" && Number(normalizedValues.commissionRate) > 100) {
      nextErrors.commissionRate = "কমিশন হার ১০০%-এর বেশি হতে পারবে না।";
    }
    if (bucket === "crops") {
      if (!parseYearValues(normalizedValues.prices ?? "")) nextErrors.prices = "ঠিক ৩টি দাম কমা দিয়ে লিখুন (যেমন ৩০, ৩২, ৩৫)।";
      if (!parseYearValues(normalizedValues.yields ?? "")) nextErrors.yields = "ঠিক ৩টি উৎপাদন কমা দিয়ে লিখুন।";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (saving) return;
    setSaving(true);

    const extra: Record<string, string> = {};
    if (bucket === "farmers") Object.assign(extra, { feeStatus, channel });
    if (bucket === "buyers") extra.buyerType = buyerType;
    if (bucket === "collection") Object.assign(extra, { grading, drying, packing });
    if (bucket === "finance") {
      const sales = Number(normalizedValues.salesVolume);
      extra.commission = String((sales * Number(normalizedValues.commissionRate)) / 100);
    }

    try {
      await onAdd(bucket, {
        ...normalizedValues,
        ...extra,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      });
      setValues(upazila && fieldsByBucket[bucket].some((field) => field.key === "upazila") ? { upazila } : {});
      setErrors({});
      Alert.alert("সংরক্ষিত", "তথ্যটি এই ডিভাইসে সংরক্ষণ করা হয়েছে।");
    } catch (error) {
      Alert.alert("সংরক্ষণ হয়নি", error instanceof Error ? error.message : "স্থানীয় স্টোরেজে তথ্য রাখা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <SectionTitle>{bucket === "farmers" ? "নতুন কৃষক নিবন্ধন" : bucket === "crops" ? "৩ বছরের ফসলের তথ্য" : bucket === "buyers" ? "ক্রেতা/চাহিদা যোগ করুন" : bucket === "collection" ? "সংগ্রহ লগ যোগ করুন" : "নতুন আর্থিক এন্ট্রি"}</SectionTitle>
      {fieldsByBucket[bucket].map((field) => (
        <Field
          key={field.key}
          label={field.label}
          value={values[field.key] ?? ""}
          onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
          placeholder={field.placeholder}
          keyboardType={field.keyboardType}
          error={errors[field.key]}
        />
      ))}
      {bucket === "farmers" ? (
        <>
          <ChoiceField label="সদস্য ফি" value={feeStatus} options={["পরিশোধিত", "বাকি"]} onChange={setFeeStatus} />
          <ChoiceField label="যোগাযোগ চ্যানেল" value={channel} options={["SMS", "WhatsApp", "ভয়েস"]} onChange={setChannel} />
        </>
      ) : null}
      {bucket === "buyers" ? <ChoiceField label="ক্রেতার ধরন" value={buyerType} options={["পাইকার", "দোকানদার", "রেস্টুরেন্ট", "প্রক্রিয়াজাতকারী"]} onChange={setBuyerType} /> : null}
      {bucket === "collection" ? (
        <>
          <ChoiceField label="Grading" value={grading} options={["অপেক্ষমাণ", "চলমান", "সম্পন্ন"]} onChange={setGrading} />
          <ChoiceField label="শুকানো" value={drying} options={["অপেক্ষমাণ", "চলমান", "সম্পন্ন"]} onChange={setDrying} />
          <ChoiceField label="প্যাকেজিং" value={packing} options={["অপেক্ষমাণ", "চলমান", "সম্পন্ন"]} onChange={setPacking} />
        </>
      ) : null}
      <PrimaryButton label={saving ? "সংরক্ষণ হচ্ছে…" : "তথ্য সংরক্ষণ করুন"} onPress={() => void submit()} disabled={saving} />
    </Panel>
  );
}

function ForecastSummary({ crops }: { crops: WorkspaceRecord[] }) {
  const forecasts = useMemo(() => crops.map((crop) => ({
    crop,
    priceValues: parseYearValues(crop.prices ?? ""),
    yieldValues: parseYearValues(crop.yields ?? ""),
  })), [crops]);

  return (
    <Panel>
      <SectionTitle>৩ বছরের moving average</SectionTitle>
      <Notice>গণনা শুধু আপনার নিজে প্রবেশ করানো ৩ বছরের տվյալের গড়; এটি নিশ্চিত ভবিষ্যদ্বাণী নয়। চাষ/বিক্রির সিদ্ধান্তে স্থানীয় কৃষি অফিস ও বর্তমান বাজার যাচাই করুন।</Notice>
      {!forecasts.length ? <EmptyState>পূর্বাভাস দেখতে আগে ফসল মডিউলে তিন বছরের দাম ও উৎপাদন যোগ করুন।</EmptyState> : null}
      {forecasts.map(({ crop, priceValues, yieldValues }) => {
        const averagePrice = priceValues ? movingAverage(priceValues) : null;
        const averageYield = yieldValues ? movingAverage(yieldValues) : null;
        return (
          <View key={crop.id} style={styles.record}>
            <Text style={styles.recordTitle}>{crop.name}</Text>
            <Text style={styles.recordMeta}>৩ বছরের গড় দাম: {averagePrice === null ? "—" : `৳ ${formatBengaliNumber(averagePrice)}/কেজি`}</Text>
            <Text style={styles.recordMeta}>৩ বছরের গড় উৎপাদন: {averageYield === null ? "—" : `${formatBengaliNumber(averageYield)} কেজি`}</Text>
            <Text style={styles.recordMeta}>আপনার দেওয়া চাষের সময়: {crop.plantingWindow || "তথ্য দেওয়া হয়নি"}</Text>
            <Text style={styles.recordMeta}>আপনার দেওয়া ফসল ওঠা/বিক্রির সময়: {crop.harvestWindow || "তথ্য দেওয়া হয়নি"}</Text>
            <Text style={styles.recordAdvice}>
              {priceValues && averagePrice !== null
                ? (priceValues[2] >= averagePrice
                  ? "সর্বশেষ ইনপুট দাম ৩ বছরের গড়ের সমান/উপরে। বিক্রির আগে বর্তমান স্থানীয় দর মিলিয়ে নিন।"
                  : "সর্বশেষ ইনপুট দাম ৩ বছরের গড়ের নিচে। বাজার ও ক্রেতার দর তুলনা করে বিক্রির সিদ্ধান্ত নিন।")
                : "দামের তিন বছরের তথ্য অসম্পূর্ণ; বিক্রির সময় নির্ধারণে বর্তমান স্থানীয় বাজারদর যাচাই করুন।"}
            </Text>
            <Text style={styles.recordAdvice}>চাষের সময় চূড়ান্ত করার আগে আপনার দেওয়া মৌসুম স্থানীয় কৃষি অফিসের ফসল ক্যালেন্ডারের সঙ্গে যাচাই করুন।</Text>
          </View>
        );
      })}
    </Panel>
  );
}

function BuyerMatching({ farmers, buyers }: { farmers: WorkspaceRecord[]; buyers: WorkspaceRecord[] }) {
  const matches = buyers.flatMap((buyer) => farmers
    .filter((farmer) => (farmer.crop ?? "").trim().toLocaleLowerCase() === (buyer.crop ?? "").trim().toLocaleLowerCase())
    .map((farmer) => ({ buyer, farmer })));
  return (
    <Panel>
      <SectionTitle>ফসলভিত্তিক সম্ভাব্য মিল</SectionTitle>
      <Text style={styles.recordMeta}>নাম/ফসলের লেখা হুবহু মিললে তালিকা দেখায়; এটি যোগাযোগের নিশ্চয়তা বা স্বয়ংক্রিয় চুক্তি নয়।</Text>
      {!matches.length ? <EmptyState>মিল দেখাতে কৃষকের প্রধান ফসল ও ক্রেতার চাহিদার ফসল একই নামে যোগ করুন।</EmptyState> : null}
      {matches.map(({ farmer, buyer }, index) => (
        <View key={`${buyer.id}-${farmer.id}-${index}`} style={styles.record}>
          <Text style={styles.recordTitle}>{farmer.name} ↔ {buyer.name}</Text>
          <Text style={styles.recordMeta}>{farmer.crop} · {buyer.buyerType} · চাহিদা {buyer.demand} կգ</Text>
        </View>
      ))}
    </Panel>
  );
}

function FinanceSummary({ records }: { records: WorkspaceRecord[] }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const entries = records.filter((record) => record.createdAt.slice(0, 7) === thisMonth);
  const commission = entries.reduce((sum, record) => sum + (Number(record.commission) || 0), 0);
  const processing = entries.reduce((sum, record) => sum + (Number(record.processingCharge) || 0), 0);
  const costs = entries.reduce((sum, record) => sum + (Number(record.operatingCost) || 0), 0);
  const balance = commission + processing - costs;
  return (
    <Panel>
      <SectionTitle>চলতি মাসের cash flow</SectionTitle>
      {!entries.length ? <EmptyState>এই মাসের কোনো আর্থিক এন্ট্রি নেই। ফর্মে লেনদেন ও ব্যয়ের তথ্য যোগ করুন।</EmptyState> : null}
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>কমিশন আয়</Text><Text style={styles.money}>৳ {formatBengaliNumber(commission)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>প্রসেসিং চার্জ</Text><Text style={styles.money}>৳ {formatBengaliNumber(processing)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>অপারেটিং ব্যয়</Text><Text style={styles.money}>৳ {formatBengaliNumber(costs)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordTitle}>ব্যয় বাদে অবশিষ্ট</Text><Text style={styles.money}>৳ {formatBengaliNumber(balance)}</Text></View>
      <Notice tone={entries.length ? (balance >= 0 ? "success" : "warning") : "info"}>
        {entries.length ? (balance >= 0 ? "এই মাসে রেকর্ড করা আয় অপারেটিং ব্যয় পূরণ করেছে।" : `ব্রেক-ইভেনের জন্য আরও ৳ ${formatBengaliNumber(Math.abs(balance))} আয় প্রয়োজন।`) : "ব্রেক-ইভেন দেখাতে বাস্তব আয়-ব্যয়ের তথ্য যোগ করুন।"}
      </Notice>
    </Panel>
  );
}

function ReportsSummary({ data }: { data: WorkspaceData }) {
  const spoiled = data.collection.reduce((sum, entry) => sum + (Number(entry.spoiled) || 0), 0);
  const collected = data.collection.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const wasteRate = collected > 0 ? (spoiled / collected) * 100 : null;
  return (
    <Panel>
      <SectionTitle>রেকর্ড-ভিত্তিক রিপোর্ট</SectionTitle>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>কৃষক</Text><Text style={styles.money}>{formatBengaliNumber(data.farmers.length)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>ফসল</Text><Text style={styles.money}>{formatBengaliNumber(data.crops.length)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>ক্রেতা/চাহিদা</Text><Text style={styles.money}>{formatBengaliNumber(data.buyers.length)}</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>সংগ্রহ</Text><Text style={styles.money}>{formatBengaliNumber(collected)} কেজি</Text></View>
      <View style={styles.summaryLine}><Text style={styles.recordMeta}>নষ্ট হওয়ার হার</Text><Text style={styles.money}>{wasteRate === null ? "তথ্য নেই" : `${formatBengaliNumber(wasteRate)}%`}</Text></View>
      <Notice>রিপোর্টটি এই ডিভাইসে সংরক্ষিত এন্ট্রি থেকে তৈরি; কোনো sample বা অনুমানভিত্তিক ব্যবসায়িক সংখ্যা নেই।</Notice>
    </Panel>
  );
}

export default function OperationsScreen({ module, data, upazila, onAdd }: Props) {
  if (module === "reports") {
    return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PageTitle title={titles.reports} /><ReportsSummary data={data} /></ScrollView>;
  }
  if (module === "finance") {
    return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PageTitle title={titles.finance} subtitle="কমিশন, প্রসেসিং চার্জ ও মাসিক ব্যয়ের হিসাব" /><FinanceSummary records={data.finance} /><OperationsForm bucket="finance" upazila={upazila} onAdd={onAdd} /><RecordList bucket="finance" records={data.finance} /></ScrollView>;
  }

  const bucket = bucketForModule[module];
  if (!bucket) return null;
  const moduleRecords = data[bucket];
  const isForecast = module === "forecast";
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageTitle title={titles[module]} subtitle={module === "farmers" ? "কৃষকের জমি, ফসল, সদস্য ফি ও যোগাযোগের তথ্য" : module === "buyers" ? "পাইকার, দোকানদার, রেস্টুরেন্ট ও প্রক্রিয়াজাতকারীর চাহিদা" : module === "collection" ? "সংগ্রহ, grading, শুকানো, packaging ও অপচয়" : undefined} />
      {module === "farmers" ? <Notice>SMS/WhatsApp/ভয়েস চ্যানেল পছন্দ সংরক্ষিত হয়; বার্তা পাঠাতে আলাদা provider/API সংযোগ লাগবে।</Notice> : null}
      {isForecast ? <ForecastSummary crops={data.crops} /> : <OperationsForm bucket={bucket} upazila={upazila} onAdd={onAdd} />}
      {module === "buyers" ? <BuyerMatching farmers={data.farmers} buyers={data.buyers} /> : null}
      {module === "collection" ? <CollectionSummary records={data.collection} /> : null}
      <RecordList bucket={bucket} records={moduleRecords} />
    </ScrollView>
  );
}

function CollectionSummary({ records }: { records: WorkspaceRecord[] }) {
  const total = records.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const spoiled = records.reduce((sum, item) => sum + (Number(item.spoiled) || 0), 0);
  return (
    <Panel>
      <SectionTitle>স্টক সারাংশ</SectionTitle>
      <Text style={styles.recordMeta}>সংগ্রহ {formatBengaliNumber(total)} কেজি · নষ্ট {formatBengaliNumber(spoiled)} কেজি · অবশিষ্ট {formatBengaliNumber(Math.max(0, total - spoiled))} কেজি</Text>
    </Panel>
  );
}

function RecordList({ bucket, records }: { bucket: RecordBucket; records: WorkspaceRecord[] }) {
  const headings: Record<RecordBucket, (record: WorkspaceRecord) => string> = {
    farmers: (item) => item.name,
    crops: (item) => item.name,
    buyers: (item) => `${item.name} · ${item.buyerType}`,
    collection: (item) => `${item.crop} · ${item.farmer}`,
    finance: (item) => `লেনদেন ৳ ${formatBengaliNumber(Number(item.salesVolume) || 0)}`,
  };
  return (
    <Panel>
      <SectionTitle>সংরক্ষিত তালিকা ({formatBengaliNumber(records.length)})</SectionTitle>
      {!records.length ? <EmptyState>এখনো কোনো তথ্য নেই। ফর্ম পূরণ করে সংরক্ষণ করুন।</EmptyState> : null}
      {records.slice().reverse().map((record) => (
        <View key={record.id} style={styles.record}>
          <Text style={styles.recordTitle}>{headings[bucket](record)}</Text>
          {bucket === "farmers" ? <Text style={styles.recordMeta}>{record.upazila} · জমি {record.land} একর · ফি {record.feeStatus} · {record.channel}</Text> : null}
          {bucket === "crops" ? <Text style={styles.recordMeta}>{record.upazila} · জাত {record.variety || "উল্লেখ নেই"} · চাষ {record.plantingWindow || "তথ্য নেই"} · ফসল ওঠা {record.harvestWindow || "তথ্য নেই"}</Text> : null}
          {bucket === "buyers" ? <Text style={styles.recordMeta}>{record.crop} · চাহিদা {record.demand} কেজি · {record.upazila}</Text> : null}
          {bucket === "collection" ? <Text style={styles.recordMeta}>{record.quantity} কেজি · grading {record.grading} · শুকানো {record.drying} · প্যাকেজিং {record.packing}</Text> : null}
          {bucket === "finance" ? <Text style={styles.recordMeta}>কমিশন ৳ {formatBengaliNumber(Number(record.commission) || 0)} · প্রসেসিং ৳ {formatBengaliNumber(Number(record.processingCharge) || 0)} · ব্যয় ৳ {formatBengaliNumber(Number(record.operatingCost) || 0)}</Text> : null}
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f2f7f2", flex: 1 },
  content: { padding: 18, paddingBottom: 28 },
  record: { borderBottomColor: "#e5ede7", borderBottomWidth: 1, paddingVertical: 12 },
  recordTitle: { color: "#19352a", fontSize: 15, fontWeight: "800" },
  recordMeta: { color: "#63766c", fontSize: 13, lineHeight: 20, marginTop: 3 },
  recordAdvice: { color: "#247446", fontSize: 13, lineHeight: 19, marginTop: 7 },
  summaryLine: { alignItems: "center", borderBottomColor: "#e5ede7", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  money: { color: "#19352a", fontSize: 14, fontWeight: "800" },
});
