// theme/haptics.ts
// The ONLY file that imports expo-haptics. Everything else speaks the app's
// five-verb haptic vocabulary, so intensity stays consistent app-wide:
//   tap     — any ordinary touch (buttons, tabs, advancing a card)
//   commit  — an action that changes state (send, connect, continue, sign in)
//   success — something finished well (link established, diagnostic done)
//   warning — something needs attention (an error surfaced)
//   tick    — selection scrubbing (pickers, segmented switches)
// Every call is fire-and-forget and swallows failures, so a missing native
// module (older build) degrades to silence, never a crash.
import * as Haptics from 'expo-haptics';

const fire = (run: () => Promise<void>) => {
  run().catch(() => {});
};

export const haptic = {
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  commit: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  tick: () => fire(() => Haptics.selectionAsync()),
} as const;
