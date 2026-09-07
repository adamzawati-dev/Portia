// src/components/SettingsSheet.tsx
// The account sheet — the app's one modal surface. Chrome is Glass.Sheet;
// the rows inside are flat content. Slides up on the sheet spring, drags to
// dismiss (PanResponder feeding a Reanimated value — no extra native deps, and
// the release animation runs as a UI-thread spring), scrim tap closes. Holds:
// adding another bank (the engine folds it in as its history loads; duplicates
// are detected server-side) and sign out (native confirm — destructive).
// Reduce Motion: the sheet appears and disappears instantly.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, PanResponder, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';
import { useSession } from '../auth/session';
import { getAccountsCacheSync } from '../api/accountsCache';
import { connectBank, PlaidCanceled } from '../plaid/link';

const DISMISS_DRAG_PX = 90;
const DISMISS_VELOCITY = 0.8;
const OFFSCREEN_FALLBACK = 480; // until the first onLayout reports real height

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { reduced, springs, durations } = useMotion();
  const { signOut } = useSession();

  const height = useRef(OFFSCREEN_FALLBACK);
  const ty = useSharedValue(OFFSCREEN_FALLBACK);

  useEffect(() => {
    if (open) {
      ty.value = height.current;
      ty.value = withSpring(0, springs.sheet); // immediate under Reduce Motion
    }
  }, [open, springs, ty]);

  const close = useCallback(() => {
    if (reduced) {
      onClose();
      return;
    }
    ty.value = withTiming(height.current, { duration: durations.fast }, (finished) => {
      'worklet';
      if (finished) runOnJS(onClose)();
    });
  }, [reduced, durations, onClose, ty]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          ty.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DRAG_PX || g.vy > DISMISS_VELOCITY) close();
          else ty.value = withSpring(0, springs.sheet);
        },
      }),
    [close, springs, ty],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, height.current], [1, 0]),
  }));

  const [linking, setLinking] = useState(false);
  const addAccount = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const result = await connectBank();
      if (result.duplicate) {
        Alert.alert('Already connected', 'That bank was already linked — nothing changed.');
        return;
      }
      const name = result.linked[0]?.institutionName ?? 'That account';
      Alert.alert('Connected', `${name} is linked — I’ll fold it in as the history loads.`);
      close();
    } catch (e) {
      if (!(e instanceof PlaidCanceled)) {
        Alert.alert('Couldn’t connect', 'That bank didn’t link. Try again.');
      }
    } finally {
      setLinking(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need Sign in with Apple to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (!open) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={close}>
      <View style={styles.host}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Press
            scaleTo={1}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
        </Animated.View>

        <Animated.View
          style={sheetStyle}
          onLayout={(e) => {
            height.current = e.nativeEvent.layout.height + spacing.xl;
          }}
          {...pan.panHandlers}
        >
          <Glass.Sheet radius={radius.sheet} style={styles.sheet}>
            <View style={[styles.inner, { paddingBottom: insets.bottom + spacing.md }]}>
              <View style={styles.grabber} />
              <ConnectedInstitutions />
              <SheetRow
                icon="building.columns.fill"
                label={linking ? 'Opening Plaid…' : 'Add a bank account'}
                onPress={() => void addAccount()}
              />
              <View style={styles.divider} />
              <SheetRow icon="rectangle.portrait.and.arrow.right" label="Sign out" onPress={confirmSignOut} destructive />
            </View>
          </Glass.Sheet>
        </Animated.View>
      </View>
    </Modal>
  );
}

// The institutions Portia can currently see — read from the accounts cache
// (real backend data), shown as quiet metadata above the actions.
function ConnectedInstitutions() {
  const names = getAccountsCacheSync()?.data.institutions.map((i) => i.institutionName) ?? [];
  if (names.length === 0) return null;
  return (
    <View style={styles.connected}>
      <AppText variant="overline" color={palette.textTertiary}>
        CONNECTED
      </AppText>
      <AppText variant="body" color={palette.textSecondary} style={styles.connectedNames}>
        {names.join(' · ')}
      </AppText>
    </View>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? palette.attention : palette.textPrimary;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      <View style={styles.iconWell}>
        <SymbolView name={icon} size={18} tintColor={color} weight="medium" />
      </View>
      <AppText variant="title" color={color}>
        {label}
      </AppText>
    </Press>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: glass.lift.color,
  },
  sheet: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  inner: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.textTertiary,
    marginBottom: spacing.md,
  },
  connected: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  connectedNames: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
  },
  iconWell: {
    width: 34,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.border,
  },
});
