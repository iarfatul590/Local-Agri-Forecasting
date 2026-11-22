import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ApiAuthResponse } from "../data/apiTypes";
import { ApiError, isSecureApiBaseUrl, requestOtp, verifyOtp } from "../services/api";
import { normalizeNumerals } from "../services/forecast";
import { Field, Notice, PageTitle, Panel, PrimaryButton, ChoiceField } from "../components/Primitives";

type Props = {
  apiBaseUrl: string;
  onSaveApiBaseUrl: (url: string) => Promise<void>;
  onAuthenticated: (response: ApiAuthResponse) => Promise<void>;
};

export default function AuthScreen({ apiBaseUrl, onSaveApiBaseUrl, onAuthenticated }: Props) {
  const [baseUrl, setBaseUrl] = useState(apiBaseUrl);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"FARMER" | "BUYER">("FARMER");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode() {
    const url = baseUrl.trim().replace(/\/+$/, "");
    if (!url) {
      setMessage("আগে API base URL দিন।");
      return;
    }
    if (!isSecureApiBaseUrl(url)) {
      setMessage("HTTPS ব্যবহার করুন; শুধু local development-এ localhost বা LAN IP গ্রহণযোগ্য।");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await onSaveApiBaseUrl(url);
      await requestOtp(url, normalizeNumerals(phone.trim()));
      setRequested(true);
      setMessage("OTP চাওয়া হয়েছে। স্থানীয় উন্নয়ন পরিবেশে API server-এর terminal-এ কোডটি দেখুন।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OTP অনুরোধ পাঠানো যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!requested) {
      setMessage("আগে OTP পাঠানোর অনুরোধ করুন।");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const auth = await verifyOtp(baseUrl.trim().replace(/\/+$/, ""), {
        phone: normalizeNumerals(phone.trim()),
        code: normalizeNumerals(code.trim()),
        name: name.trim(),
        role,
      });
      await onAuthenticated(auth);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "লগইন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <Text style={styles.brandMark}>ক</Text>
        <Text style={styles.brandName}>কৃষি সংযোগ</Text>
        <Text style={styles.brandCopy}>আপনার এলাকার কৃষি কার্যক্রম নিরাপদে পরিচালনা করুন</Text>
      </View>
      {message ? <Notice tone={message.includes("OTP চাওয়া") ? "success" : "warning"}>{message}</Notice> : null}
      <Panel>
        <PageTitle title="ফোন নম্বর দিয়ে প্রবেশ" subtitle="OTP দিয়ে যাচাই করুন; প্রথমবারে নাম ও ব্যবহারকারীর ধরনও দিন।" />
        <Field label="API base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="http://localhost:4000" keyboardType="url" />
        <Field label="বাংলাদেশি মোবাইল নম্বর" value={phone} onChangeText={setPhone} placeholder="01XXXXXXXXX বা +8801XXXXXXXXX" keyboardType="phone-pad" />
        <PrimaryButton label={busy ? "অনুরোধ পাঠানো হচ্ছে…" : "OTP পাঠান"} onPress={() => void sendCode()} disabled={busy} secondary />
        {requested ? (
          <>
            <Field label="OTP কোড" value={code} onChangeText={setCode} placeholder="৬ সংখ্যার কোড" keyboardType="numeric" />
            <Field label="নাম (নতুন অ্যাকাউন্টে আবশ্যক)" value={name} onChangeText={setName} placeholder="আপনার নাম" />
            <ChoiceField
              label="অ্যাকাউন্টের ধরন (নতুন অ্যাকাউন্ট)"
              value={role === "FARMER" ? "কৃষক" : "ক্রেতা"}
              options={["কৃষক", "ক্রেতা"]}
              onChange={(value) => setRole(value === "কৃষক" ? "FARMER" : "BUYER")}
            />
            <PrimaryButton label={busy ? "যাচাই হচ্ছে…" : "যাচাই করে প্রবেশ করুন"} onPress={() => void signIn()} disabled={busy} />
          </>
        ) : null}
      </Panel>
      <Text style={styles.footer}>কোনো OTP না এলে API server সচল আছে কি না এবং base URL ঠিক আছে কি না দেখুন।</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f7f2", flex: 1 },
  content: { alignSelf: "center", maxWidth: 520, padding: 20, paddingBottom: 36, width: "100%" },
  brand: { alignItems: "center", paddingVertical: 28 },
  brandMark: { alignItems: "center", backgroundColor: "#d8f0d7", borderRadius: 18, color: "#12382d", fontSize: 32, fontWeight: "900", overflow: "hidden", padding: 12, textAlign: "center", width: 64 },
  brandName: { color: "#173b2e", fontSize: 23, fontWeight: "900", marginTop: 12 },
  brandCopy: { color: "#68796f", fontSize: 13, marginTop: 5, textAlign: "center" },
  footer: { color: "#68796f", fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
});
