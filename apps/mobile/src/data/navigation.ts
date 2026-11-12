export type ModuleId =
  | "dashboard"
  | "farmers"
  | "crops"
  | "forecast"
  | "buyers"
  | "collection"
  | "finance"
  | "reports"
  | "settings";

export const navigationItems: { id: ModuleId; label: string; icon: string }[] = [
  { id: "dashboard", label: "ড্যাশবোর্ড", icon: "⌂" },
  { id: "farmers", label: "কৃষক", icon: "♧" },
  { id: "crops", label: "ফসল", icon: "❋" },
  { id: "forecast", label: "পূর্বাভাস", icon: "⌁" },
  { id: "buyers", label: "ক্রেতা/পাইকার", icon: "⇄" },
  { id: "collection", label: "সংগ্রহ ও স্টক", icon: "▣" },
  { id: "finance", label: "আয়-ব্যয়", icon: "৳" },
  { id: "reports", label: "রিপোর্ট", icon: "▤" },
  { id: "settings", label: "API সংযোগ", icon: "⚙" },
];

export const bottomTabIds: ModuleId[] = [
  "dashboard",
  "farmers",
  "crops",
  "buyers",
  "collection",
];
