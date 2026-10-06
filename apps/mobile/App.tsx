import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { formatBDT, t, type MonthSummary, type ParseResponse, type TransactionDraft } from "@amar-poribar/shared";

// Android emulator reaches the host machine at 10.0.2.2.
const API = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000";

async function api<T>(path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data as T;
}

interface Family { id: string; name: string }
interface Category { id: string; key: string; nameBn: string; icon: string | null }
interface Account { id: string; type: string }

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark ? colors.dark : colors.light;

  // TODO(P1): persist tokens in expo-secure-store and refresh them.
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<TransactionDraft[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => () => { setMessage(null); fn().catch((e: Error) => setMessage(e.message)); };

  const load = useCallback(async (tok: string) => {
    const me = await api<{ families: Family[] }>("/v1/me", tok);
    const fam = me.families[0] ?? (await api<Family>("/v1/families", tok, { name: "আমার পরিবার" }));
    setFamily(fam);
    const [cats, accs, sum] = await Promise.all([
      api<Category[]>(`/v1/families/${fam.id}/categories`, tok),
      api<Account[]>(`/v1/families/${fam.id}/accounts`, tok),
      api<MonthSummary>(`/v1/families/${fam.id}/reports/summary`, tok),
    ]);
    setCategories(cats); setAccounts(accs); setSummary(sum);
  }, []);

  const requestOtp = run(async () => {
    const res = await api<{ devCode?: string }>("/v1/auth/otp/request", undefined, { phone });
    setOtpSent(true);
    if (res.devCode) setMessage(`Dev OTP: ${res.devCode}`);
  });

  const verify = run(async () => {
    const res = await api<{ accessToken: string }>("/v1/auth/otp/verify", undefined, { phone, code });
    setToken(res.accessToken);
    await load(res.accessToken);
  });

  const parse = run(async () => {
    const res = await api<ParseResponse>(`/v1/families/${family!.id}/ai/parse`, token!, { text, now: new Date().toISOString() });
    setDrafts(res.drafts);
  });

  const confirm = (d: TransactionDraft, i: number) => run(async () => {
    await api(`/v1/families/${family!.id}/transactions`, token!, {
      type: d.type, amountPaisa: d.amountPaisa, feePaisa: d.feePaisa, occurredAt: d.occurredAt,
      categoryId: categories.find((x) => x.key === d.categoryKey)?.id ?? null,
      accountId: accounts.find((a) => a.type === d.accountType)?.id ?? null,
      note: d.note, counterparty: d.counterparty ?? undefined, trxId: d.trxId ?? undefined,
      source: d.source, aiConfidence: d.confidence,
    });
    setDrafts((prev) => {
      const rest = prev?.filter((_, j) => j !== i) ?? [];
      return rest.length ? rest : null;
    });
    setText("");
    await load(token!);
  })();

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>{t("appName")}</Text>

        {!token ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput style={input} placeholder="01XXXXXXXXX" placeholderTextColor={c.muted}
              keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            {otpSent && (
              <TextInput style={input} placeholder="OTP" placeholderTextColor={c.muted}
                keyboardType="number-pad" value={code} onChangeText={setCode} />
            )}
            <Button label={otpSent ? "লগইন" : "OTP পাঠান"} onPress={otpSent ? verify : requestOtp} color={c.accent} />
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <TextInput style={[input, { minHeight: 80 }]} multiline placeholder={t("quickAddPlaceholder")}
                placeholderTextColor={c.muted} value={text} onChangeText={setText} />
              <Button label={t("parse")} onPress={parse} color={c.accent} />
              {drafts?.length === 0 && <Text style={{ color: c.muted, marginTop: 8 }}>{t("noDrafts")}</Text>}
              {drafts?.map((d, i) => (
                <View key={i} style={styles.draft}>
                  <Text style={{ color: c.text, flex: 1 }}>
                    {formatBDT(d.amountPaisa, { bnDigits: true })} · {categories.find((x) => x.key === d.categoryKey)?.nameBn ?? "—"} · {d.note}
                  </Text>
                  <Button label={t("confirm")} onPress={() => confirm(d, i)} color={c.accent} />
                </View>
              ))}
            </View>

            {summary && (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ color: c.muted }}>{t("thisMonth")} · {t("totalExpense")}</Text>
                <Text style={[styles.big, { color: c.text }]}>{formatBDT(summary.expensePaisa, { bnDigits: true })}</Text>
                {summary.byCategory.map((row) => (
                  <View key={row.categoryId ?? "none"} style={styles.draft}>
                    <Text style={{ color: c.text, flex: 1 }}>{row.name}</Text>
                    <Text style={{ color: c.text }}>{formatBDT(row.totalPaisa, { bnDigits: true })}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {message && <Text style={{ color: c.muted }}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: color }]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const colors = {
  light: { bg: "#f7f6f2", surface: "#ffffff", text: "#1d1d1b", muted: "#6b6a65", accent: "#0f7b5f", border: "#e4e2dc" },
  dark: { bg: "#151614", surface: "#1f201d", text: "#ecebe6", muted: "#a3a29b", accent: "#3fbf96", border: "#33342f" },
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "600", marginTop: 24 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 8, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  draft: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  big: { fontSize: 28, fontWeight: "600" },
});
