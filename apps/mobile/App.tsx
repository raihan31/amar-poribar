import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  draftToSpeech,
  formatBDT,
  t,
  type MonthlyAiSummary,
  type MonthSummary,
  type ParseResponse,
  type TransactionDraft,
} from "@amar-poribar/shared";
import { speak, startListening, stopListening, stopSpeaking } from "./voice";

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
interface Category { id: string; key: string; kind: string; nameBn: string; icon: string | null }
interface Account { id: string; type: string }
type Colors = typeof colors.light;

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
  const [aiSummary, setAiSummary] = useState<MonthlyAiSummary | null>(null);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<TransactionDraft[] | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => () => { setMessage(null); fn().catch((e: Error) => setMessage(e.message)); };
  const categoryOf = (key: string | null) => categories.find((x) => x.key === key) ?? null;

  const load = useCallback(async (tok: string) => {
    const me = await api<{ families: Family[] }>("/v1/me", tok);
    const fam = me.families[0] ?? (await api<Family>("/v1/families", tok, { name: "আমার পরিবার" }));
    setFamily(fam);
    const [cats, accs, sum, ai] = await Promise.all([
      api<Category[]>(`/v1/families/${fam.id}/categories`, tok),
      api<Account[]>(`/v1/families/${fam.id}/accounts`, tok),
      api<MonthSummary>(`/v1/families/${fam.id}/reports/summary`, tok),
      api<MonthlyAiSummary>(`/v1/families/${fam.id}/ai/summary?locale=bn`, tok),
    ]);
    setCategories(cats); setAccounts(accs); setSummary(sum); setAiSummary(ai);
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

  async function parse(input: string, spoken: boolean) {
    const res = await api<ParseResponse>(`/v1/families/${family!.id}/ai/parse`, token!, { text: input, now: new Date().toISOString() });
    const list = spoken ? res.drafts.map((d) => ({ ...d, source: "voice" as const })) : res.drafts;
    setDrafts(list);
    // Read the result back so the user can check it by ear (FR-VOICE-03).
    const first = list[0];
    if (spoken) speak(first ? draftToSpeech(first, categoryOf(first.categoryKey)?.nameBn ?? null) : t("noDrafts"));
  }

  // Voice entry (FR-VOICE-01): the transcript goes through the same parser as typed text.
  useSpeechRecognitionEvent("result", (event) => {
    const heard = event.results[0]?.transcript?.trim();
    if (!event.isFinal || !heard) return;
    setText(heard);
    parse(heard, true).catch((e: Error) => setMessage(e.message));
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", (event) => { setListening(false); setMessage(event.message); });

  const toggleMic = run(async () => {
    if (listening) { stopListening(); return; }
    stopSpeaking();
    if (await startListening("bn-BD")) setListening(true);
    else setMessage("মাইক্রোফোনের অনুমতি দিন");
  });

  const removeDraft = (i: number) => setDrafts((prev) => {
    const rest = prev?.filter((_, j) => j !== i) ?? [];
    return rest.length ? rest : null;
  });

  const confirm = (d: TransactionDraft, i: number) => run(async () => {
    await api(`/v1/families/${family!.id}/transactions`, token!, {
      type: d.type, amountPaisa: d.amountPaisa, feePaisa: d.feePaisa, occurredAt: d.occurredAt,
      categoryId: categoryOf(d.categoryKey)?.id ?? null,
      accountId: accounts.find((a) => a.type === d.accountType)?.id ?? null,
      note: d.note, counterparty: d.counterparty ?? undefined, trxId: d.trxId ?? undefined,
      source: d.source, aiConfidence: d.confidence,
    });
    removeDraft(i);
    setText("");
    await load(token!);
  })();

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }];
  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.border }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>{t("appName")}</Text>

        {!token ? (
          <View style={card}>
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
            <View style={card}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("tapToSpeak")} onPress={toggleMic}
                style={[styles.mic, { backgroundColor: listening ? c.danger : c.accent }]}>
                <Text style={styles.micIcon}>🎤</Text>
                <Text style={styles.buttonText}>{listening ? t("listening") : t("tapToSpeak")}</Text>
              </Pressable>
              <TextInput style={[input, { minHeight: 64 }]} multiline placeholder={t("quickAddPlaceholder")}
                placeholderTextColor={c.muted} value={text} onChangeText={setText} />
              <Button label={t("parse")} onPress={run(() => parse(text, false))} color={c.accent} />
              {drafts?.map((d, i) => (
                <DraftCard key={i} draft={d} c={c} category={categoryOf(d.categoryKey)}
                  choices={categories.filter((x) => x.kind === (d.type === "income" ? "income" : "expense"))}
                  onPick={(key) => setDrafts((prev) => prev?.map((x, j) => (j === i ? { ...x, categoryKey: key } : x)) ?? null)}
                  onYes={() => confirm(d, i)} onNo={() => removeDraft(i)} />
              ))}
            </View>

            {aiSummary && <SummaryCard summary={aiSummary} c={c} />}

            {summary && (
              <View style={card}>
                <Text style={{ color: c.muted }}>{t("thisMonth")} · {t("totalExpense")}</Text>
                <Text style={[styles.big, { color: c.text }]}>{formatBDT(summary.expensePaisa, { bnDigits: true })}</Text>
                {summary.byCategory.map((row) => (
                  <View key={row.categoryId ?? "none"} style={styles.row}>
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

/** A draft with large ✓/✗ buttons, a 🔊 button and, when needed, an icon category picker. */
function DraftCard(props: {
  draft: TransactionDraft; category: Category | null; choices: Category[]; c: Colors;
  onPick: (key: string) => void; onYes: () => void; onNo: () => void;
}) {
  const { draft, category, choices, c, onPick, onYes, onNo } = props;
  return (
    <View style={[styles.draft, { borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={styles.draftIcon}>{category?.icon ?? "📦"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.draftAmount, { color: c.text }]}>{formatBDT(draft.amountPaisa, { bnDigits: true })}</Text>
          <Text style={{ color: c.muted }}>{category?.nameBn ?? "কিসের খরচ?"}</Text>
        </View>
        <IconButton label="🔊" a11y={t("speak")} color={c.surface} textColor={c.accent} border={c.accent}
          onPress={() => speak(draftToSpeech(draft, category?.nameBn ?? null))} />
      </View>
      {!category && (
        <View style={styles.picker}>
          {choices.map((x) => (
            <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={x.nameBn}
              onPress={() => { speak(x.nameBn); onPick(x.key); }}
              style={[styles.pickerItem, { borderColor: c.border }]}>
              <Text style={styles.pickerIcon}>{x.icon}</Text>
              <Text style={[styles.pickerLabel, { color: c.text }]} numberOfLines={2}>{x.nameBn}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <IconButton label={`✗ ${t("no")}`} a11y={t("no")} color={c.danger} onPress={onNo} grow />
        <IconButton label={`✓ ${t("yes")}`} a11y={t("yes")} color={c.accent} onPress={onYes} grow />
      </View>
    </View>
  );
}

/** Monthly summary in plain words, with a button to hear it (FR-AI-11, FR-VOICE-04). */
function SummaryCard({ summary, c }: { summary: MonthlyAiSummary; c: Colors }) {
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={{ color: c.text, fontWeight: "600", flex: 1, fontSize: 16 }}>{t("monthlySummary")}</Text>
        <IconButton label={`🔊 ${t("speak")}`} a11y={t("speak")} color={c.accent}
          onPress={() => speak(summary.speechText, summary.locale === "bn" ? "bn-BD" : "en-IN")} />
      </View>
      <Text style={{ color: c.text, fontSize: 18, lineHeight: 30 }}>{summary.text}</Text>
    </View>
  );
}

function Button({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: color }]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function IconButton(props: {
  label: string; a11y: string; color: string; onPress: () => void;
  textColor?: string; border?: string; grow?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.a11y} onPress={props.onPress}
      style={[styles.button, { backgroundColor: props.color, flex: props.grow ? 1 : undefined,
        borderWidth: props.border ? 1 : 0, borderColor: props.border }]}>
      <Text style={[styles.buttonText, props.textColor ? { color: props.textColor } : null]}>{props.label}</Text>
    </Pressable>
  );
}

const colors = {
  light: { bg: "#f7f6f2", surface: "#ffffff", text: "#1d1d1b", muted: "#6b6a65", accent: "#0f7b5f", danger: "#b3261e", border: "#e4e2dc" },
  dark: { bg: "#151614", surface: "#1f201d", text: "#ecebe6", muted: "#a3a29b", accent: "#2f9e7b", danger: "#c4473f", border: "#33342f" },
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "600", marginTop: 24 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { minHeight: 52, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 17 },
  mic: { minHeight: 72, borderRadius: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  micIcon: { fontSize: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  draft: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  draftIcon: { fontSize: 36 },
  draftAmount: { fontSize: 22, fontWeight: "600" },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickerItem: { width: "23%", minHeight: 72, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 4 },
  pickerIcon: { fontSize: 26 },
  pickerLabel: { fontSize: 11, textAlign: "center" },
  big: { fontSize: 28, fontWeight: "600" },
});
