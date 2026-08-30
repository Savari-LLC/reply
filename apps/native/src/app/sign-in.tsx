import {
  useOauth,
  useSignInWithGoogle,
  type OauthFlowErrorCode,
} from "@convex-dev/auth/providers/oauth/react";
import { useSignInWithPassword } from "@convex-dev/auth/providers/password/react";
import { api } from "@reply/backend/convex/_generated/api";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { SymbolView } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";

const oauthErrorMessages: Record<OauthFlowErrorCode, string> = {
  access_denied: "Google sign-in was cancelled.",
  expired: "That sign-in took too long. Please try again.",
  rejected: "Google sign-in was declined.",
  oauth_error: "Google sign-in failed. Please try again.",
  invalid_flow: "This sign-in cannot be completed here. Please try again.",
};

export default function SignInScreen() {
  const { signIn, pending } = useSignInWithPassword(api.auth.signInWithPassword);
  const { signInGoogle } = useSignInWithGoogle(api.auth);
  const { flowError } = useOauth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !pending && !googlePending;

  async function handleGoogle() {
    if (googlePending || pending) return;
    setGooglePending(true);
    setError(null);
    try {
      // The auth component only allows http(s) redirect origins, so the flow
      // bounces through this deployment's /mobile/oauth bridge, which forwards
      // the one-time code back to the app's own URL (closing the session).
      const appReturnUrl = Linking.createURL("oauth");
      const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
      if (!siteUrl) {
        throw new Error("EXPO_PUBLIC_CONVEX_SITE_URL is not set");
      }
      const bridgeUrl = `${siteUrl}/mobile/oauth?app=${encodeURIComponent(appReturnUrl)}`;
      const started = await signInGoogle({ redirectTo: bridgeUrl });
      if (!("redirect" in started)) {
        throw new Error("Google sign-in did not return a redirect URL");
      }
      const result = await WebBrowser.openAuthSessionAsync(
        started.redirect.toString(),
        appReturnUrl,
      );
      if (result.type !== "success") {
        return; // Cancelled or dismissed; not an error.
      }
      const callback = new URL(result.url);
      const code = callback.searchParams.get("convexAuthCode");
      if (!code) {
        setError(oauthErrorMessages.oauth_error);
        return;
      }
      const completed = await signInGoogle({ code });
      if ("signedIn" in completed && completed.signedIn) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // On failure the ambient client records a flow error, rendered below.
    } catch {
      setError(oauthErrorMessages.oauth_error);
    } finally {
      setGooglePending(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const result = await signIn({ username: username.trim(), password });
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    switch (result.userError.error) {
      case "USER_NOT_FOUND":
        setError("No account exists with that username.");
        return;
      case "INVALID_CREDENTIALS":
        setError("Incorrect username or password.");
        return;
      case "PASSWORD_TOO_SHORT":
        setError(
          `Password must be at least ${result.userError.minimumLength} characters.`,
        );
        return;
      case "PASSWORD_TOO_LONG":
        setError(
          `Password must be at most ${result.userError.maximumLength} characters.`,
        );
        return;
      case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
        setError("Password cannot start or end with whitespace.");
        return;
      case "RATE_LIMITED":
        setError(
          `Too many attempts. Try again in ${Math.ceil(
            result.userError.retryAfterMs / 1000,
          )} seconds.`,
        );
        return;
      default:
        setError("Something went wrong. Please try again.");
    }
  }

  const displayError =
    error ??
    (flowError !== null
      ? (flowError.message ?? oauthErrorMessages[flowError.code])
      : null);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.hero}>
              <View style={styles.logoRow}>
                <Image
                  source={require("../../assets/images/brand/logo-mark.png")}
                  style={styles.logoMark}
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.wordmark}>reply</Text>
              </View>
              <Text style={styles.kicker}>Your focused communication workspace</Text>
              <Text style={styles.heroTitle}>
                Turn context into a thoughtful reply.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.welcome}>WELCOME</Text>
              <Text style={styles.cardTitle}>Sign in to continue</Text>
              <Text style={styles.cardSubtitle}>
                Use Google or your Reply username and password.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: googlePending, busy: googlePending }}
                testID="google-sign-in-button"
                onPress={handleGoogle}
                disabled={googlePending || pending}
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed && styles.googleButtonPressed,
                  (googlePending || pending) && styles.submitDisabled,
                ]}
              >
                {googlePending ? (
                  <ActivityIndicator size="small" color={colors.textSubtle} />
                ) : (
                  <Text style={styles.googleG}>G</Text>
                )}
                <Text style={styles.googleButtonText}>
                  {googlePending ? "Opening Google…" : "Continue with Google"}
                </Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR USE PASSWORD</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    returnKeyType="next"
                    editable={!pending}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    accessibilityLabel="Username"
                    testID="username-input"
                  />
                </View>
                <View style={styles.separator} />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    editable={!pending}
                    onSubmitEditing={handleSubmit}
                    accessibilityLabel="Password"
                    testID="password-input"
                  />
                </View>
              </View>

              {displayError ? (
                <View style={styles.errorBox} accessibilityLiveRegion="polite">
                  <SymbolView
                    name="exclamationmark.circle"
                    size={15}
                    tintColor={colors.destructive}
                  />
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit, busy: pending }}
                testID="sign-in-button"
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.submit,
                  pressed && styles.submitPressed,
                  !canSubmit && styles.submitDisabled,
                ]}
              >
                {pending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>Sign in</Text>
                )}
              </Pressable>

              <View style={styles.hint}>
                <SymbolView
                  name="lock.fill"
                  size={13}
                  tintColor={colors.textMuted}
                />
                <Text style={styles.hintText}>
                  New accounts are created on the web. Ask your workspace admin
                  for an invite.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brandDark,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  hero: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 36,
    gap: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 38,
    height: 38,
  },
  wordmark: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  kicker: {
    color: colors.brandYellow,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  card: {
    backgroundColor: colors.authCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 6,
  },
  welcome: {
    color: colors.brandRust,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: colors.brandDark,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 14,
  },
  googleButtonPressed: {
    backgroundColor: colors.hover,
  },
  googleG: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textStrong,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  fieldGroup: {
    borderRadius: 14,
    backgroundColor: colors.authField,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    fontSize: 16,
    color: colors.textStrong,
    paddingVertical: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.destructiveBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: 13,
    lineHeight: 17,
  },
  submit: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
  },
  submitPressed: {
    backgroundColor: colors.brandDarkPressed,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 18,
    backgroundColor: "#f0f2ee",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
