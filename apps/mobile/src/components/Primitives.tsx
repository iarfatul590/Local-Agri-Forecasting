import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const colors = {
  ink: "#183a2d",
  muted: "#68796f",
  green: "#2f7b4e",
  border: "#e3eae2",
  surface: "#ffffff",
  background: "#f4f7f2",
};

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.pageTitle}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "success" }) {
  return (
    <View style={[styles.notice, tone === "warning" ? styles.warning : tone === "success" ? styles.success : null]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "url";
  multiline?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline ? styles.multiline : null, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9b92"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onChange(option)}
            accessibilityState={{ selected: value === option }}
            style={({ pressed }) => [styles.choice, value === option ? styles.choiceSelected : null, pressed ? styles.pressed : null]}
          >
            <Text style={[styles.choiceText, value === option ? styles.choiceTextSelected : null]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondaryButton : null,
        disabled ? styles.disabledButton : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.buttonText, secondary ? styles.secondaryButtonText : null]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  pageTitle: { marginBottom: 22 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", letterSpacing: -0.5, lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, lineHeight: 22 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
    shadowColor: "#183a2d",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginBottom: 14 },
  notice: { backgroundColor: "#edf4fa", borderLeftColor: "#4b8aa1", borderLeftWidth: 3, borderRadius: 12, marginBottom: 16, padding: 14 },
  warning: { backgroundColor: "#fff5e6", borderLeftColor: "#d58a32" },
  success: { backgroundColor: "#eaf5ec", borderLeftColor: "#3d8b57" },
  noticeText: { color: colors.ink, fontSize: 13, lineHeight: 21 },
  fieldWrap: { marginBottom: 15 },
  label: { color: "#354c40", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  input: {
    backgroundColor: "#fcfdfb",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  multiline: { minHeight: 82 },
  inputError: { borderColor: "#c93737", backgroundColor: "#fffafa" },
  errorText: { color: "#b52d2d", fontSize: 12, marginTop: 4 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  choiceSelected: { backgroundColor: colors.green },
  choiceText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  choiceTextSelected: { color: "#fff" },
  button: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButton: { backgroundColor: "#eaf3ec" },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButtonText: { color: colors.green },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 8 },
});
