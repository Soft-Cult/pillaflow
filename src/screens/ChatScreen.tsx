import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import {
  applyProposal,
  cancelProposal,
  type ProposalRow,
  sendToAgent,
} from "../utils/agent";
import { colors, shadows } from "../utils/theme";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
};

const TOP_SAFE_AREA_EDGES = ["top"] as const;

function prettyActionTitle(actionType: string) {
  switch (actionType) {
    case "create_task":
      return "Create task";
    case "update_task":
      return "Update task";
    case "create_habit":
      return "Create habit";
    case "complete_habit":
      return "Complete habit";
    case "create_note":
      return "Create note";
    case "log_health_daily":
      return "Log health (daily)";
    case "add_food_entry":
      return "Add food entry";
    case "create_routine":
      return "Create routine";
    case "add_routine_task":
      return "Add routine task";
    case "create_reminder":
      return "Create reminder";
    case "create_chore":
      return "Add to chores list";
    case "create_grocery":
      return "Add grocery item";
    default:
      return actionType;
  }
}

function formatTime(value: number | Date) {
  const date = typeof value === "number" ? new Date(value) : value;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getProposalSummary(payload: any) {
  if (!payload || typeof payload !== "object") return "";
  const title =
    payload.title ||
    payload.name ||
    payload.task ||
    payload.habit ||
    payload.note ||
    payload.reminder ||
    payload.grocery ||
    payload.text;
  const timing =
    payload.when ||
    payload.time ||
    payload.date ||
    payload.due_at ||
    payload.due_date ||
    payload.scheduled_for;
  if (title && timing) return `${title} - ${timing}`;
  if (title) return String(title);
  if (timing) return String(timing);
  return "";
}

export default function ChatScreen() {
  const {
    authUser,
    profile,
    themeColors,
    themeName,
    isPremium,
    isPremiumUser,
    ensureTasksLoaded,
    ensureHabitsLoaded,
    ensureNotesLoaded,
    ensureHealthLoaded,
    ensureRoutinesLoaded,
    ensureRemindersLoaded,
    ensureChoresLoaded,
    ensureGroceriesLoaded,
  } = useApp();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === "premium" ||
      profile?.plan === "pro" ||
      profile?.plan === "paid"
  );
  const isDark = themeName === "dark";
  const palette = themeColors || colors;
  const bottomInset = Math.max(insets.bottom, 12);
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const primaryGradient = useMemo(
    () => [
      palette.primaryGradientStart || palette.primary,
      palette.primaryGradientEnd || palette.primary,
    ],
    [palette.primaryGradientStart, palette.primaryGradientEnd, palette.primary]
  );

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "m0",
      role: "assistant",
      text: "Tell me what you want to do: tasks, habits, routines, lists, reminders, groceries, health logs, or notes.",
      time: formatTime(Date.now()),
    },
  ]);
  const [pendingProposals, setPendingProposals] = useState<ProposalRow[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typingAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!sending) return;
    typingAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(typingAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sending, typingAnim]);

  const dotOneOpacity = typingAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.35, 1, 0.35, 0.35],
  });
  const dotTwoOpacity = typingAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.35, 0.35, 1, 0.35],
  });
  const dotThreeOpacity = typingAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [1, 0.35, 0.35, 1],
  });


  const quickActions = useMemo(
    () => [
      {
        id: "quick-task",
        label: "Create a task",
        prompt: "Create a task for tomorrow at 6pm.",
      },
      {
        id: "quick-habit",
        label: "Add a habit",
        prompt: "Add a daily habit to stretch for 10 minutes.",
      },
      {
        id: "quick-health",
        label: "Log my health",
        prompt: "Log my health for today.",
      },
      {
        id: "quick-reminder",
        label: "Set reminder",
        prompt: "Set a reminder for tomorrow morning.",
      },
    ],
    []
  );

  const suggestedActions = useMemo(
    () => [
      {
        id: "suggest-morning",
        label: "Add a morning routine",
        icon: "sunny-outline",
        tint: isDark ? "rgba(245, 158, 11, 0.2)" : "#FFF4D6",
        iconColor: palette.routine || "#F59E0B",
        prompt: "Create a morning routine with 3 steps.",
      },
      {
        id: "suggest-water",
        label: "Track water intake",
        icon: "water-outline",
        tint: isDark ? "rgba(59, 130, 246, 0.2)" : "#E8F3FF",
        iconColor: palette.info || "#3B82F6",
        prompt: "Log 500ml of water today.",
      },
      {
        id: "suggest-reminder",
        label: "Set a reminder",
        icon: "notifications-outline",
        tint: isDark ? "rgba(16, 185, 129, 0.2)" : "#E6F7F1",
        iconColor: palette.finance || "#10B981",
        prompt: "Set a reminder for this evening.",
      },
      {
        id: "suggest-meal",
        label: "Log a meal",
        icon: "restaurant-outline",
        tint: isDark ? "rgba(236, 72, 153, 0.2)" : "#FDE7F3",
        iconColor: palette.health || "#EC4899",
        prompt: "Log a meal for lunch today.",
      },
    ],
    [isDark, palette.routine, palette.info, palette.finance, palette.health]
  );

  const pendingItems = pendingProposals.filter((p) => p.status === "pending");

  async function refreshDataForProposal(actionType?: string) {
    const force = { force: true as const };
    switch (actionType) {
      case "create_task":
      case "update_task":
        await ensureTasksLoaded(force);
        return;
      case "create_habit":
      case "complete_habit":
        await ensureHabitsLoaded(force);
        return;
      case "create_note":
        await ensureNotesLoaded(force);
        return;
      case "log_health_daily":
      case "add_food_entry":
        await ensureHealthLoaded(force);
        return;
      case "create_routine":
      case "add_routine_task":
        await ensureRoutinesLoaded(force);
        return;
      case "create_reminder":
        await ensureRemindersLoaded(force);
        return;
      case "create_chore":
        await ensureChoresLoaded(force);
        return;
      case "create_grocery":
        await ensureGroceriesLoaded(force);
        return;
      default:
        await Promise.all([
          ensureTasksLoaded(force),
          ensureHabitsLoaded(force),
          ensureNotesLoaded(force),
          ensureHealthLoaded(force),
          ensureRoutinesLoaded(force),
          ensureRemindersLoaded(force),
          ensureChoresLoaded(force),
          ensureGroceriesLoaded(force),
        ]);
    }
  }

  async function onSend() {
    if (!isPremiumActive) return;
    const text = input.trim();
    if (!text || sending) return;
    if (!authUser?.id) {
      setMessages((prev) => [
        ...prev,
        {
          id: `auth-${Date.now()}`,
          role: "assistant",
          text: "Please sign in again to use the AI assistant.",
          time: formatTime(Date.now()),
        },
      ]);
      return;
    }

    setInput("");
    setSending(true);

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      time: formatTime(Date.now()),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await sendToAgent(text, conversationId);

      if (res.conversationId) {
      setConversationId(res.conversationId);
      }
      
      const botMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.assistantText || "(no response)",
        time: formatTime(Date.now()),
      };
      setMessages((prev) => [...prev, botMsg]);

      if (res.proposals?.length) {
        setPendingProposals((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of res.proposals) {
            if (!seen.has(p.id)) merged.push(p);
          }
          return merged;
        });
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Error: ${e?.message ?? String(e)}`,
          time: formatTime(Date.now()),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function onApprove(proposalId: string) {
    const proposal = pendingProposals.find((p) => p.id === proposalId);

    setPendingProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "applied" } : p))
    );

    try {
      await applyProposal(proposalId);
      try {
        await refreshDataForProposal(proposal?.action_type);
      } catch {}
      setMessages((prev) => [
        ...prev,
        {
          id: `ok-${Date.now()}`,
          role: "assistant",
          text: "Done. Saved to your account.",
          time: formatTime(Date.now()),
        },
      ]);
    } catch (e: any) {
      setPendingProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: "failed" as any } : p))
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `fail-${Date.now()}`,
          role: "assistant",
          text: `Couldn't apply that: ${e?.message ?? String(e)}`,
          time: formatTime(Date.now()),
        },
      ]);
    }
  }

  async function onCancel(proposalId: string) {
    setPendingProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "declined" } : p))
    );
    try {
      await cancelProposal(proposalId);
    } catch {
      // ignore
    }
  }

  if (!isPremiumActive) {
    return (
      <SafeAreaView edges={TOP_SAFE_AREA_EDGES} style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={primaryGradient} style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Offline</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.lockedWrap, { paddingBottom: bottomInset + 8 }]}>
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Premium required</Text>
            <Text style={styles.lockedCopy}>
              Upgrade to a premium plan to unlock the Pillaflow AI agent and start chatting.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Paywall", { source: "chat" })}
              activeOpacity={0.9}
              style={styles.lockedButton}
            >
              <LinearGradient colors={primaryGradient} style={styles.lockedButtonInner}>
                <Text style={styles.lockedButtonText}>View Pillaflow Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <SafeAreaView edges={TOP_SAFE_AREA_EDGES} style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={primaryGradient} style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.chatArea}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) =>
              item.role === "user" ? (
                <View style={styles.userBlock}>
                  <LinearGradient colors={primaryGradient} style={styles.userBubble}>
                    <Text style={styles.userText}>{item.text}</Text>
                  </LinearGradient>
                  {item.time ? <Text style={styles.timeLabelRight}>{item.time}</Text> : null}
                </View>
              ) : (
                <View style={styles.assistantBlock}>
                  <View style={styles.assistantRow}>
                    <LinearGradient colors={primaryGradient} style={styles.assistantAvatar}>
                      <Ionicons name="sparkles" size={14} color="#fff" />
                    </LinearGradient>
                    <View style={styles.assistantBubble}>
                      <Text style={styles.assistantText}>{item.text}</Text>
                    </View>
                  </View>
                  {item.time ? <Text style={styles.timeLabelLeft}>{item.time}</Text> : null}
                </View>
              )
            }
            ListFooterComponent={
              <View style={styles.footer}>
                {sending ? (
                  <View style={styles.typingWrap}>
                    <View style={styles.assistantRow}>
                      <LinearGradient colors={primaryGradient} style={styles.assistantAvatar}>
                        <Ionicons name="sparkles" size={14} color="#fff" />
                      </LinearGradient>
                      <View style={[styles.assistantBubble, styles.typingBubble]}>
                        <View style={styles.typingDots}>
                          <Animated.View style={[styles.typingDot, { opacity: dotOneOpacity }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dotTwoOpacity }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dotThreeOpacity }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}
                <View style={styles.quickActions}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickActionsRow}
                  >
                    {quickActions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        style={styles.quickActionPill}
                        activeOpacity={0.85}
                        onPress={() => setInput(action.prompt)}
                      >
                        <Text style={styles.quickActionText}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <Text style={styles.sectionTitle}>Suggested actions</Text>
                {pendingItems.length > 0 ? (
                  <View style={styles.proposalStack}>
                    {pendingItems
                      .slice()
                      .reverse()
                      .map((p) => {
                        const summary = getProposalSummary(p.action_payload);
                        return (
                          <View key={p.id} style={styles.proposalCard}>
                            <Text style={styles.proposalTitle}>{prettyActionTitle(p.action_type)}</Text>
                            {summary ? (
                              <Text style={styles.proposalSummary}>{summary}</Text>
                            ) : (
                              <Text style={styles.proposalPayload} numberOfLines={4}>
                                {JSON.stringify(p.action_payload, null, 2)}
                              </Text>
                            )}
                            <View style={styles.proposalActions}>
                              <TouchableOpacity
                                onPress={() => onApprove(p.id)}
                                style={[styles.proposalButton, styles.proposalApprove]}
                              >
                                <Text style={styles.proposalButtonText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => onCancel(p.id)}
                                style={[styles.proposalButton, styles.proposalCancel]}
                              >
                                <Text style={styles.proposalCancelText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                ) : (
                  <View style={styles.suggestionGrid}>
                    {suggestedActions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        style={styles.suggestionCard}
                        activeOpacity={0.85}
                        onPress={() => setInput(action.prompt)}
                      >
                        <View style={[styles.suggestionIcon, { backgroundColor: action.tint }]}>
                          <Ionicons name={action.icon as any} size={18} color={action.iconColor} />
                        </View>
                        <Text style={styles.suggestionText}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            }
          />
        </View>

        <View style={[styles.inputDock, { paddingBottom: bottomInset }]}>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type your message..."
              placeholderTextColor={palette.placeholder || palette.textSecondary}
              style={styles.inputField}
              multiline
              blurOnSubmit={false}
              onSubmitEditing={onSend}
            />

            <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
              <Ionicons name="mic" size={18} color={palette.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSend}
              disabled={sending}
              style={styles.sendButton}
              activeOpacity={0.9}
            >
              <LinearGradient colors={primaryGradient} style={styles.gradientButtonInner}>
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: typeof colors, isDark: boolean) => {
  const surfaceBorder = isDark ? "#1F1F27" : "#E8E2F2";
  const surface = isDark ? "#14141B" : "#FFFFFF";
  const shell = isDark ? "#0C0C10" : "#F7F1FF";
  const cardShadow = isDark ? {} : shadows.small;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: surfaceBorder,
      backgroundColor: shell,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: palette.text,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#22C55E",
    },
    statusText: {
      fontSize: 12,
      color: palette.textSecondary,
    },
    headerActions: {
      flexDirection: "row",
      gap: 10,
    },
    chatArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    messageList: {
      flex: 1,
      paddingHorizontal: 16,
    },
    messageContent: {
      paddingVertical: 8,
      paddingBottom: 20,
    },
    assistantBlock: {
      alignSelf: "flex-start",
      marginVertical: 6,
      maxWidth: "86%",
    },
    assistantRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
    },
    assistantAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    assistantBubble: {
      padding: 12,
      borderRadius: 16,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: surfaceBorder,
      ...cardShadow,
    },
    assistantText: {
      color: palette.text,
      fontSize: 14,
      lineHeight: 20,
    },
    userBlock: {
      alignSelf: "flex-end",
      marginVertical: 6,
      maxWidth: "86%",
    },
    userBubble: {
      padding: 12,
      borderRadius: 16,
    },
    userText: {
      color: "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
    },
    timeLabelLeft: {
      marginLeft: 38,
      marginTop: 4,
      fontSize: 11,
      color: palette.textSecondary,
    },
    timeLabelRight: {
      marginTop: 4,
      alignSelf: "flex-end",
      fontSize: 11,
      color: palette.textSecondary,
    },
    typingWrap: {
      marginVertical: 6,
      alignSelf: "flex-start",
    },
    typingBubble: {
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    typingDots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.textSecondary,
    },
    footer: {
      paddingTop: 8,
      paddingBottom: 4,
    },
    quickActions: {
      marginTop: 6,
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 6,
      paddingRight: 6,
    },
    quickActionPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: surfaceBorder,
      ...cardShadow,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: palette.text,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: palette.text,
      marginBottom: 10,
      marginTop: 12,
    },
    suggestionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    suggestionCard: {
      width: "48%",
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: surface,
      ...cardShadow,
    },
    suggestionIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    suggestionText: {
      fontSize: 13,
      fontWeight: "600",
      color: palette.text,
    },
    proposalStack: {
      gap: 12,
    },
    proposalCard: {
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: surface,
      ...cardShadow,
    },
    proposalTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: palette.text,
    },
    proposalSummary: {
      marginTop: 6,
      fontSize: 13,
      color: palette.textSecondary,
    },
    proposalPayload: {
      marginTop: 6,
      fontSize: 12,
      color: palette.textSecondary,
    },
    proposalActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    proposalButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
    },
    proposalApprove: {
      backgroundColor: palette.primary,
    },
    proposalCancel: {
      backgroundColor: isDark ? "#1E1E27" : "#F1EEF8",
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    proposalButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 12,
    },
    proposalCancelText: {
      color: palette.text,
      fontWeight: "700",
      fontSize: 12,
    },
    inputDock: {
      paddingHorizontal: 12,
      paddingTop: 8,
      backgroundColor: palette.background,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    inputField: {
      flex: 1,
      minHeight: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: palette.text,
      backgroundColor: isDark ? "#101015" : "#FFFFFF",
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    gradientButtonInner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      overflow: "hidden",
    },
    lockedWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    lockedCard: {
      width: "100%",
      maxWidth: 460,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: surface,
      ...cardShadow,
    },
    lockedTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: palette.text,
      marginBottom: 8,
    },
    lockedCopy: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textSecondary,
    },
    lockedButton: {
      marginTop: 16,
      borderRadius: 14,
      overflow: "hidden",
    },
    lockedButtonInner: {
      paddingVertical: 12,
      alignItems: "center",
    },
    lockedButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
};






