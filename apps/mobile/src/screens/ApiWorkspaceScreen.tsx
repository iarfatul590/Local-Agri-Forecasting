import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ModuleId } from "../data/navigation";
import type {
  ApiBuyer,
  ApiCollectionCenter,
  ApiCrop,
  ApiDemand,
  ApiFarmer,
  ApiUpazila,
  ApiUser,
  ApiWorkspace,
} from "../data/apiTypes";
import { ApiClient } from "../services/api";
import { normalizeNumerals } from "../services/forecast";
import { ChoiceField, EmptyState, Field, Notice, PageTitle, Panel, PrimaryButton, SectionTitle } from "../components/Primitives";

type Props = {
  module: "farmers" | "crops" | "buyers" | "collection";
  user: ApiUser;
  client: ApiClient;
  data: ApiWorkspace;
  onRefresh: () => Promise<void>;
};

type Option = { label: string; value: string };
type Choice = { label: string; value: string };

const buyerTypes: Choice[] = [
  { label: "পাইকার", value: "WHOLESALER" },
  { label: "দোকান", value: "RETAIL_SHOP" },
  { label: "রেস্টুরেন্ট", value: "RESTAURANT" },
  { label: "প্রক্রিয়াজাতকারী", value: "PROCESSOR" },
  { label: "অন্যান্য", value: "OTHER" },
];

function OptionField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  if (!options.length) return <EmptyState>এই তালিকায় এখনো কোনো বিকল্প নেই। আগে রেফারেন্স তথ্য seed করুন।</EmptyState>;
  return (
    <View style={styles.optionField}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: option.value === value }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, option.value === value ? styles.optionSelected : null]}
          >
            <Text style={[styles.optionText, option.value === value ? styles.optionTextSelected : null]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecordRow({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.record}>
      <View style={styles.recordCopy}>
        <Text style={styles.recordTitle}>{title}</Text>
        {detail ? <Text style={styles.recordDetail}>{detail}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.rowAction}>
          <Text style={styles.rowActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function upazilaName(upazilas: ApiUpazila[], id: string): string {
  return upazilas.find((upazila) => upazila.id === id)?.nameBn ?? "উপজেলা নেই";
}

function cropName(crops: ApiCrop[], id: string): string {
  return crops.find((crop) => crop.id === id)?.nameBn ?? "ফসল নেই";
}

function buyerTypeName(value: string): string {
  return buyerTypes.find((type) => type.value === value)?.label ?? value;
}

function numericValue(value: string): number {
  return Number(normalizeNumerals(value.trim()));
}

export default function ApiWorkspaceScreen({ module, user, client, data, onRefresh }: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning">("success");
  const [upazilaId, setUpazilaId] = useState("");
  const [landSize, setLandSize] = useState("");
  const [buyerType, setBuyerType] = useState(buyerTypes[0].value);
  const [businessName, setBusinessName] = useState("");
  const [cropId, setCropId] = useState("");
  const [cropArea, setCropArea] = useState("");
  const [demandQuantity, setDemandQuantity] = useState("");
  const [demandPrice, setDemandPrice] = useState("");
  const [cropCode, setCropCode] = useState("");
  const [cropNameBn, setCropNameBn] = useState("");
  const [cropNameEn, setCropNameEn] = useState("");
  const [centerId, setCenterId] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [receivedKg, setReceivedKg] = useState("");
  const [acceptedKg, setAcceptedKg] = useState("");

  useEffect(() => {
    const profileUpazilaId = data.farmerProfile?.upazilaId ?? data.buyerProfile?.upazilaId ?? "";
    setUpazilaId(profileUpazilaId || data.upazilas[0]?.id || "");
    setLandSize(data.farmerProfile ? String(data.farmerProfile.landSizeAcres) : "");
    setBuyerType(data.buyerProfile?.buyerType ?? buyerTypes[0].value);
    setBusinessName(data.buyerProfile?.businessName ?? "");
    setCropId((current) => current || data.crops.find((crop) => crop.isActive)?.id || "");
    setCenterId((current) => current || data.collectionCenters[0]?.id || "");
    setFarmerId((current) => current || data.farmers[0]?.id || "");
  }, [data]);

  async function perform(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await onRefresh();
      setMessage(successMessage);
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API অনুরোধ সম্পন্ন হয়নি।");
      setMessageTone("warning");
    } finally {
      setBusy(false);
    }
  }

  const upazilaOptions = data.upazilas.map((upazila) => ({
    label: `${upazila.nameBn} · ${upazila.districtBn}`,
    value: upazila.id,
  }));
  const cropOptions = data.crops.filter((crop) => crop.isActive).map((crop) => ({
    label: crop.nameBn,
    value: crop.id,
  }));
  const centerOptions = data.collectionCenters.map((center) => ({
    label: `${center.nameBn} · ${center.upazila?.nameBn ?? upazilaName(data.upazilas, center.upazilaId)}`,
    value: center.id,
  }));
  const farmerOptions = data.farmers.map((farmer) => ({
    label: `${farmer.user?.name ?? "কৃষক"} · ${upazilaName(data.upazilas, farmer.upazilaId)}`,
    value: farmer.id,
  }));

  const title: Record<Props["module"], string> = {
    farmers: "কৃষক ব্যবস্থাপনা",
    crops: "ফসলের ক্যাটালগ",
    buyers: "ক্রেতা ও চাহিদা",
    collection: "সংগ্রহ ও স্টক",
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, desktop ? styles.contentWide : null]} keyboardShouldPersistTaps="handled">
      <PageTitle title={title[module]} subtitle={`${user.name} · ${user.role}`} />
      {message ? <Notice tone={messageTone}>{message}</Notice> : null}
      {module === "farmers" ? renderFarmers() : null}
      {module === "crops" ? renderCrops() : null}
      {module === "buyers" ? renderBuyers() : null}
      {module === "collection" ? renderCollection() : null}
    </ScrollView>
  );

  function renderFarmers() {
    if (user.role === "FARMER") {
      const profile = data.farmerProfile;
      return (
        <>
          <Panel>
            <SectionTitle>{profile ? "আমার কৃষক প্রোফাইল" : "কৃষক প্রোফাইল তৈরি করুন"}</SectionTitle>
            <Text style={styles.helper}>নাম ও ফোন আপনার যাচাইকৃত অ্যাকাউন্ট থেকে নেওয়া হয়েছে।</Text>
            <OptionField label="উপজেলা" value={upazilaId} options={upazilaOptions} onChange={setUpazilaId} />
            <Field label="জমির পরিমাণ (একর)" value={landSize} onChangeText={setLandSize} placeholder="যেমন ১.৫" keyboardType="numeric" />
            <PrimaryButton
              label={busy ? "সংরক্ষণ হচ্ছে…" : profile ? "প্রোফাইল আপডেট করুন" : "প্রোফাইল সংরক্ষণ করুন"}
              onPress={() => void perform(async () => {
                const acres = numericValue(landSize);
                if (!upazilaId || !Number.isFinite(acres) || acres <= 0) throw new Error("উপজেলা ও জমির সঠিক পরিমাণ দিন।");
                await client.request("/api/farmers/me", {
                  method: profile ? "PATCH" : "POST",
                  body: { upazilaId, landSizeAcres: acres },
                });
              }, "প্রোফাইল সংরক্ষিত হয়েছে।")}
              disabled={busy || !upazilaOptions.length}
            />
          </Panel>
          {profile ? (
            <Panel>
              <SectionTitle>আমার ফসল পরিকল্পনা</SectionTitle>
              <OptionField label="ফসল" value={cropId} options={cropOptions} onChange={setCropId} />
              <Field label="জমির পরিমাণ (একর, ঐচ্ছিক)" value={cropArea} onChangeText={setCropArea} placeholder="যেমন ০.৫" keyboardType="numeric" />
              <PrimaryButton
                label={busy ? "যোগ হচ্ছে…" : "ফসল পরিকল্পনা যোগ করুন"}
                onPress={() => void perform(async () => {
                  if (!cropId) throw new Error("আগে ফসলের ক্যাটালগ seed করুন।");
                  const areaAcres = numericValue(cropArea);
                  if (cropArea && (!Number.isFinite(areaAcres) || areaAcres <= 0)) throw new Error("জমির পরিমাণ ধনাত্মক সংখ্যা হতে হবে।");
                  await client.request("/api/farmers/me/crops", {
                    method: "POST",
                    body: {
                      cropId,
                      ...(cropArea ? { areaAcres } : {}),
                    },
                  });
                  setCropArea("");
                }, "ফসল পরিকল্পনা যোগ হয়েছে।")}
                disabled={busy || !cropOptions.length}
              />
              {!data.farmerCropPlans.length ? <EmptyState>এখনো কোনো ফসল পরিকল্পনা নেই।</EmptyState> : null}
              {data.farmerCropPlans.map((plan) => (
                <RecordRow
                  key={plan.id}
                  title={plan.crop?.nameBn ?? cropName(data.crops, plan.cropId)}
                  detail={plan.areaAcres ? `${plan.areaAcres} একর` : "জমির পরিমাণ দেওয়া হয়নি"}
                  actionLabel="মুছুন"
                  onAction={() => void perform(async () => {
                    await client.request(`/api/farmers/me/crops/${plan.id}`, { method: "DELETE" });
                  }, "পরিকল্পনা মুছে ফেলা হয়েছে।")}
                />
              ))}
            </Panel>
          ) : null}
        </>
      );
    }
    if (!["ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"].includes(user.role)) {
      return <Panel><Notice>এই অ্যাকাউন্টে কৃষক তালিকা দেখার অনুমতি নেই।</Notice></Panel>;
    }
    return (
      <Panel>
        <SectionTitle>নিবন্ধিত কৃষক ({data.farmers.length})</SectionTitle>
        {!data.farmers.length ? <EmptyState>কৃষক রেকর্ড নেই। কৃষক নিজে OTP দিয়ে নিবন্ধন করে প্রোফাইল তৈরি করতে পারবেন।</EmptyState> : null}
        {data.farmers.map((farmer) => (
          <RecordRow
            key={farmer.id}
            title={farmer.user?.name ?? "কৃষক"}
            detail={`${upazilaName(data.upazilas, farmer.upazilaId)} · ${farmer.landSizeAcres} একর · ${farmer.user?.phone ?? ""}`}
          />
        ))}
      </Panel>
    );
  }

  function renderCrops() {
    return (
      <>
        {user.role === "ADMIN" ? (
          <Panel>
            <SectionTitle>ক্যাটালগে ফসল যোগ করুন</SectionTitle>
            <Field label="কোড" value={cropCode} onChangeText={setCropCode} placeholder="rice" />
            <Field label="ফসলের নাম (বাংলা)" value={cropNameBn} onChangeText={setCropNameBn} placeholder="ধান" />
            <Field label="ফসলের নাম (ইংরেজি)" value={cropNameEn} onChangeText={setCropNameEn} placeholder="Rice" />
            <PrimaryButton
              label={busy ? "যোগ হচ্ছে…" : "ফসল যোগ করুন"}
              onPress={() => void perform(async () => {
                await client.request("/api/crops", {
                  method: "POST",
                  body: { code: cropCode.trim(), nameBn: cropNameBn.trim(), nameEn: cropNameEn.trim(), unit: "kg" },
                });
                setCropCode("");
                setCropNameBn("");
                setCropNameEn("");
              }, "ফসল যোগ হয়েছে।")}
              disabled={busy}
            />
          </Panel>
        ) : null}
        <Panel>
          <SectionTitle>ফসল ক্যাটালগ ({data.crops.filter((crop) => crop.isActive).length})</SectionTitle>
          {!data.crops.length ? <EmptyState>ক্যাটালগ খালি। Admin অ্যাকাউন্ট দিয়ে ফসল যোগ করুন অথবা seed script চালান।</EmptyState> : null}
          {data.crops.map((crop) => (
            <RecordRow
              key={crop.id}
              title={`${crop.nameBn} · ${crop.nameEn}`}
              detail={`কোড ${crop.code} · ${crop.unit}${crop.isActive ? "" : " · নিষ্ক্রিয়"}`}
              actionLabel={user.role === "ADMIN" && crop.isActive ? "নিষ্ক্রিয় করুন" : undefined}
              onAction={user.role === "ADMIN" && crop.isActive ? () => void perform(async () => {
                await client.request(`/api/crops/${crop.id}`, { method: "PATCH", body: { isActive: false } });
              }, "ফসল আপডেট হয়েছে।") : undefined}
            />
          ))}
        </Panel>
        {user.role === "FARMER" ? (
          <Panel>
            <SectionTitle>আমার ফসল পরিকল্পনা ({data.farmerCropPlans.length})</SectionTitle>
            {!data.farmerCropPlans.length ? <EmptyState>কৃষক মডিউল থেকে নিজের জমির ফসল পরিকল্পনা যোগ করুন।</EmptyState> : null}
            {data.farmerCropPlans.map((plan) => (
              <RecordRow key={plan.id} title={plan.crop?.nameBn ?? cropName(data.crops, plan.cropId)} detail={plan.expectedYieldKg ? `সম্ভাব্য ফলন ${plan.expectedYieldKg} কেজি` : undefined} />
            ))}
          </Panel>
        ) : null}
      </>
    );
  }

  function renderBuyers() {
    if (user.role === "BUYER") {
      const buyer = data.buyerProfile;
      return (
        <>
          <Panel>
            <SectionTitle>{buyer ? "আমার ক্রেতা প্রোফাইল" : "ক্রেতা প্রোফাইল তৈরি করুন"}</SectionTitle>
            <OptionField label="উপজেলা" value={upazilaId} options={upazilaOptions} onChange={setUpazilaId} />
            <OptionField label="ক্রেতার ধরন" value={buyerType} options={buyerTypes} onChange={setBuyerType} />
            <Field label="প্রতিষ্ঠানের নাম (ঐচ্ছিক)" value={businessName} onChangeText={setBusinessName} placeholder="প্রতিষ্ঠানের নাম" />
            <PrimaryButton
              label={busy ? "সংরক্ষণ হচ্ছে…" : buyer ? "প্রোফাইল আপডেট করুন" : "প্রোফাইল সংরক্ষণ করুন"}
              onPress={() => void perform(async () => {
                if (!upazilaId) throw new Error("উপজেলা নির্বাচন করুন।");
                await client.request("/api/buyers/me", {
                  method: buyer ? "PATCH" : "POST",
                  body: { upazilaId, buyerType, businessName: businessName.trim() || null },
                });
              }, "প্রোফাইল সংরক্ষিত হয়েছে।")}
              disabled={busy || !upazilaOptions.length}
            />
          </Panel>
          {buyer ? (
            <Panel>
              <SectionTitle>নতুন চাহিদা পোস্ট</SectionTitle>
              <OptionField label="ফসল" value={cropId} options={cropOptions} onChange={setCropId} />
              <Field label="পরিমাণ (কেজি)" value={demandQuantity} onChangeText={setDemandQuantity} placeholder="পরিমাণ লিখুন" keyboardType="numeric" />
              <Field label="লক্ষ্য দাম (৳/কেজি, ঐচ্ছিক)" value={demandPrice} onChangeText={setDemandPrice} placeholder="দাম লিখুন" keyboardType="numeric" />
              <PrimaryButton
                label={busy ? "পোস্ট হচ্ছে…" : "চাহিদা পোস্ট করুন"}
                onPress={() => void perform(async () => {
                  const quantityKg = numericValue(demandQuantity);
                  if (!cropId || !Number.isFinite(quantityKg) || quantityKg <= 0) throw new Error("ফসল ও সঠিক পরিমাণ দিন।");
                  const targetPriceBdtKg = numericValue(demandPrice);
                  if (demandPrice && (!Number.isFinite(targetPriceBdtKg) || targetPriceBdtKg <= 0)) throw new Error("লক্ষ্য দাম ধনাত্মক সংখ্যা হতে হবে।");
                  await client.request("/api/demands", {
                    method: "POST",
                    body: {
                      cropId,
                      upazilaId: buyer.upazilaId,
                      quantityKg,
                      ...(demandPrice ? { targetPriceBdtKg } : {}),
                    },
                  });
                  setDemandQuantity("");
                  setDemandPrice("");
                }, "চাহিদা পোস্ট করা হয়েছে।")}
                disabled={busy || !cropOptions.length}
              />
            </Panel>
          ) : null}
          <DemandList />
        </>
      );
    }

    return (
      <>
        {user.role === "ADMIN" || user.role === "FIELD_WORKER" ? (
          <Panel>
            <SectionTitle>ক্রেতা তালিকা ({data.buyers.length})</SectionTitle>
            {!data.buyers.length ? <EmptyState>এখনো ক্রেতা প্রোফাইল নেই।</EmptyState> : null}
            {data.buyers.map((buyer) => (
              <RecordRow
                key={buyer.id}
                title={buyer.businessName || buyer.user?.name || "ক্রেতা"}
                detail={`${buyerTypeName(buyer.buyerType)} · ${upazilaName(data.upazilas, buyer.upazilaId)} · ${buyer.user?.phone ?? ""}`}
              />
            ))}
          </Panel>
        ) : null}
        <DemandList />
      </>
    );
  }

  function DemandList() {
    return (
      <Panel>
        <SectionTitle>{user.role === "BUYER" ? "আমার চাহিদা" : "খোলা চাহিদা"} ({data.demands.length})</SectionTitle>
        {!data.demands.length ? <EmptyState>কোনো চাহিদা পোস্ট নেই।</EmptyState> : null}
        {data.demands.map((demand) => (
          <RecordRow
            key={demand.id}
            title={`${demand.crop?.nameBn ?? cropName(data.crops, demand.cropId)} · ${demand.quantityKg} কেজি`}
            detail={`${demand.status} · ${demand.upazila?.nameBn ?? upazilaName(data.upazilas, demand.upazilaId)}${demand.targetPriceBdtKg ? ` · ৳${demand.targetPriceBdtKg}/কেজি` : ""}`}
            actionLabel={user.role === "BUYER" && demand.status !== "CANCELLED" && demand.status !== "FILLED" ? "বাতিল" : undefined}
            onAction={user.role === "BUYER" && demand.status !== "CANCELLED" && demand.status !== "FILLED" ? () => void perform(async () => {
              await client.request(`/api/demands/${demand.id}`, { method: "PATCH", body: { status: "CANCELLED" } });
            }, "চাহিদার অবস্থা আপডেট হয়েছে।") : undefined}
          />
        ))}
      </Panel>
    );
  }

  function renderCollection() {
    if (user.role === "ADMIN" || user.role === "FIELD_WORKER" || user.role === "COLLECTION_MANAGER") {
      return (
        <>
          <Panel>
            <SectionTitle>সংগ্রহ লগ যোগ করুন</SectionTitle>
            <OptionField label="সংগ্রহ কেন্দ্র" value={centerId} options={centerOptions} onChange={setCenterId} />
            <OptionField label="কৃষক" value={farmerId} options={farmerOptions} onChange={setFarmerId} />
            <OptionField label="ফসল" value={cropId} options={cropOptions} onChange={setCropId} />
            <Field label="গৃহীত পরিমাণ (কেজি)" value={receivedKg} onChangeText={setReceivedKg} placeholder="পরিমাণ লিখুন" keyboardType="numeric" />
            <Field label="গ্রহণযোগ্য পরিমাণ (কেজি)" value={acceptedKg} onChangeText={setAcceptedKg} placeholder="পরিমাণ লিখুন" keyboardType="numeric" />
            <PrimaryButton
              label={busy ? "সংরক্ষণ হচ্ছে…" : "সংগ্রহ সংরক্ষণ করুন"}
              onPress={() => void perform(async () => {
                const received = numericValue(receivedKg);
                const accepted = numericValue(acceptedKg);
                if (!centerId || !farmerId || !cropId || !Number.isFinite(received) || received <= 0 || !Number.isFinite(accepted) || accepted < 0 || accepted > received) {
                  throw new Error("কেন্দ্র, কৃষক, ফসল এবং গ্রহণযোগ্য পরিমাণসহ সঠিক পরিমাণ দিন।");
                }
                await client.request("/api/collection", {
                  method: "POST",
                  body: { centerId, farmerId, cropId, receivedKg: received, acceptedKg: accepted },
                });
                setReceivedKg("");
                setAcceptedKg("");
              }, "সংগ্রহ লগ সংরক্ষিত হয়েছে।")}
              disabled={busy || !centerOptions.length || !farmerOptions.length || !cropOptions.length}
            />
          </Panel>
          <CollectionList />
        </>
      );
    }
    if (user.role === "FARMER") return <CollectionList />;
    return <Panel><Notice>এই অ্যাকাউন্টে সংগ্রহের তথ্য দেখার অনুমতি নেই।</Notice></Panel>;
  }

  function CollectionList() {
    return (
      <Panel>
        <SectionTitle>সংগ্রহ রেকর্ড ({data.collection.length})</SectionTitle>
        {!data.collection.length ? <EmptyState>এখনো কোনো সংগ্রহ রেকর্ড নেই।</EmptyState> : null}
        {data.collection.map((entry) => (
          <RecordRow
            key={entry.id}
            title={`${entry.crop?.nameBn ?? cropName(data.crops, entry.cropId)} · ${entry.acceptedKg} কেজি`}
            detail={`${entry.stage} · ${entry.center?.nameBn ?? "সংগ্রহ কেন্দ্র"} · মোট ${entry.receivedKg} কেজি`}
            actionLabel={["ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"].includes(user.role) && entry.stage !== "STORED" ? "স্টকে রাখুন" : undefined}
            onAction={["ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"].includes(user.role) && entry.stage !== "STORED" ? () => void perform(async () => {
              await client.request(`/api/collection/${entry.id}`, { method: "PATCH", body: { stage: "STORED" } });
            }, "সংগ্রহ রেকর্ড আপডেট হয়েছে।") : undefined}
          />
        ))}
      </Panel>
    );
  }
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f7f2", flex: 1 },
  content: { alignSelf: "center", maxWidth: 1180, padding: 18, paddingBottom: 32, width: "100%" },
  contentWide: { paddingHorizontal: 34, paddingTop: 30 },
  helper: { color: "#68796f", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  optionField: { marginBottom: 15 },
  optionLabel: { color: "#354c40", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: { backgroundColor: "#f4f7f2", borderColor: "#e3eae2", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  optionSelected: { backgroundColor: "#2f7b4e", borderColor: "#2f7b4e" },
  optionText: { color: "#354c40", fontSize: 12, fontWeight: "600" },
  optionTextSelected: { color: "#fff" },
  record: { alignItems: "center", borderBottomColor: "#e8eee8", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 12 },
  recordCopy: { flex: 1 },
  recordTitle: { color: "#183a2d", fontSize: 14, fontWeight: "800" },
  recordDetail: { color: "#68796f", fontSize: 12, lineHeight: 18, marginTop: 4 },
  rowAction: { backgroundColor: "#eaf3ec", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  rowActionText: { color: "#247446", fontSize: 12, fontWeight: "800" },
});
