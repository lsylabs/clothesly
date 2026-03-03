import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { hasSupabaseEnv } from '../../config/env';
import { useAuth } from '../../services/AuthContext';
import { getCachedProfile, setCachedProfile } from '../../services/profileCacheService';
import { getCachedSignedImageUrl } from '../../services/imageCacheService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { getMyProfile, updateMyAvatarPath } from '../../services/profileService';
import { buildAvatarPath } from '../../services/storagePaths';
import type { Database } from '../../types/database';

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  hideBorder?: boolean;
};

function SettingRow({ icon, title, subtitle, onPress, hideBorder = false }: SettingRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, hideBorder && styles.rowNoBorder]}>
      <View style={styles.rowIconWrap}>
        <Ionicons color="#0A0A0A" name={icon} size={28} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons color="#0A0A0A" name="chevron-forward" size={28} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);
  const [cachedEmail, setCachedEmail] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? cachedEmail ?? 'Unknown user';
  const metadataFullName = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? null;

  useEffect(() => {
    let active = true;

    const loadProfile = async (forceRemote = false) => {
      setLoadingProfile(true);
      if (!userId) {
        if (active) {
          setLoadingProfile(false);
          setProfile(null);
          setAvatarUri(null);
        }
        return;
      }

      try {
        if (!forceRemote) {
          const cached = await getCachedProfile(userId);
          if (cached) {
            if (!active) return;
            setCachedName(cached.displayName);
            setCachedEmail(cached.email);
            if (cached.avatarPath) {
              const signed = await getCachedSignedImageUrl('avatars', cached.avatarPath).catch(() => null);
              if (active) setAvatarUri(signed);
            } else if (active) {
              setAvatarUri(null);
            }
            setLoadingProfile(false);
            return;
          }
        }

        const nextProfile = await getMyProfile();
        if (!active) return;
        setProfile(nextProfile);

        const resolvedName =
          nextProfile?.full_name?.trim() || String(metadataFullName ?? '').trim() || email.split('@')[0]?.trim() || 'Clothesly User';
        const resolvedEmail = session?.user?.email ?? 'Unknown user';

        if (nextProfile?.avatar_path) {
          const signed = await getCachedSignedImageUrl('avatars', nextProfile.avatar_path).catch(() => null);
          if (active) setAvatarUri(signed);
        } else if (active) {
          setAvatarUri(null);
        }

        setCachedName(resolvedName);
        setCachedEmail(resolvedEmail);
        await setCachedProfile(userId, {
          displayName: resolvedName,
          email: resolvedEmail,
          avatarPath: nextProfile?.avatar_path ?? null,
          cachedAt: Date.now()
        });
      } catch {
        if (active) {
          setProfile(null);
          setAvatarUri(null);
        }
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [email, metadataFullName, session?.user?.email, userId]);

  const handleManualRefresh = async () => {
    if (!userId || refreshingProfile) return;
    setRefreshingProfile(true);
    try {
      const nextProfile = await getMyProfile();
      setProfile(nextProfile);

      const resolvedName =
        nextProfile?.full_name?.trim() || String(metadataFullName ?? '').trim() || email.split('@')[0]?.trim() || 'Clothesly User';
      const resolvedEmail = session?.user?.email ?? 'Unknown user';

      if (nextProfile?.avatar_path) {
        const signed = await getCachedSignedImageUrl('avatars', nextProfile.avatar_path).catch(() => null);
        setAvatarUri(signed);
      } else {
        setAvatarUri(null);
      }

      setCachedName(resolvedName);
      setCachedEmail(resolvedEmail);
      await setCachedProfile(userId, {
        displayName: resolvedName,
        email: resolvedEmail,
        avatarPath: nextProfile?.avatar_path ?? null,
        cachedAt: Date.now()
      });
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshingProfile(false);
    }
  };

  const displayName = useMemo(() => {
    const fullName = profile?.full_name?.trim() || cachedName?.trim() || String(metadataFullName ?? '').trim();
    if (fullName) return fullName;

    const local = email.split('@')[0]?.trim();
    if (local) return local;
    return 'Clothesly User';
  }, [cachedName, email, metadataFullName, profile?.full_name]);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'CU';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [displayName]);

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    if (!userId || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const image = source === 'camera' ? await pickImageFromCamera() : await pickImageFromLibrary();
      if (!image) return;

      const path = buildAvatarPath(userId, image.extension);
      await uploadImage('avatars', path, image);
      await updateMyAvatarPath(path);

      const signed = await getCachedSignedImageUrl('avatars', path).catch(() => null);
      setAvatarUri(signed);
      setProfile((current) => (current ? { ...current, avatar_path: path } : current));
      await setCachedProfile(userId, {
        displayName,
        email,
        avatarPath: path,
        cachedAt: Date.now()
      });
    } catch (error) {
      Alert.alert('Could not update photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarPress = () => {
    if (!userId || uploadingAvatar || !hasSupabaseEnv) return;

    Alert.alert('Change profile photo', 'Choose a source', [
      {
        text: 'Take Photo',
        onPress: () => {
          void pickAndUploadAvatar('camera');
        }
      },
      {
        text: 'Choose Photo',
        onPress: () => {
          void pickAndUploadAvatar('library');
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const openPlaceholder = (label: string) => {
    Alert.alert('Coming soon', `${label} settings are coming soon.`);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={handleManualRefresh} refreshing={refreshingProfile} />}
      style={styles.container}
    >
      <Text style={styles.pageTitle}>Profile</Text>

      <View style={styles.identityCard}>
        <View style={styles.identityRow}>
          <Pressable
            disabled={!hasSupabaseEnv || !userId || uploadingAvatar}
            onPress={handleAvatarPress}
            style={[styles.avatarTap, (!hasSupabaseEnv || !userId || uploadingAvatar) && styles.disabled]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons color="#FAFAFA" name="camera-outline" size={18} />
            </View>
          </Pressable>

          <View style={styles.identityText}>
            <Text style={styles.nameText}>{loadingProfile ? 'Loading...' : displayName}</Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>
        </View>
      </View>

      {!hasSupabaseEnv ? <Text style={styles.warning}>Supabase env vars are missing. Set `.env` first.</Text> : null}

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.groupCard}>
        <SettingRow
          icon="person-outline"
          onPress={() => openPlaceholder('Account')}
          subtitle="Name, email, password"
          title="Account Settings"
        />
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.groupCard}>
        <SettingRow icon="notifications-outline" onPress={() => openPlaceholder('Notifications')} subtitle="Enabled" title="Notifications" />
        <SettingRow icon="thermometer-outline" onPress={() => openPlaceholder('Temperature')} subtitle="°F" title="Temperature Unit" />
        <SettingRow icon="logo-usd" onPress={() => openPlaceholder('Currency')} subtitle="USD" title="Currency" />
        <SettingRow hideBorder icon="globe-outline" onPress={() => openPlaceholder('Language')} subtitle="English" title="App Language" />
      </View>

      <Pressable
        onPress={() =>
          Alert.alert('Sign out?', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: async () => {
                const { error } = await signOut().then(() => ({ error: null })).catch((e: Error) => ({ error: e }));
                if (error) {
                  Alert.alert('Sign out failed', error.message);
                }
              }
            }
          ])
        }
        style={styles.signOut}
      >
        <Ionicons color="#DC2626" name="log-out-outline" size={28} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.version}>Clothesly v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  content: {
    padding: 20,
    paddingBottom: 140
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: '#0A0A0A'
  },
  identityCard: {
    marginTop: 22,
    borderRadius: 26,
    backgroundColor: '#FAFAFA',
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 10
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarTap: {
    width: 94,
    height: 94,
    marginRight: 16
  },
  avatar: {
    width: 94,
    height: 94,
    borderRadius: 47
  },
  avatarFallback: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.7
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A'
  },
  identityText: {
    flex: 1
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#0A0A0A'
  },
  emailText: {
    marginTop: 4,
    fontSize: 16,
    color: '#0A0A0A'
  },
  warning: {
    marginTop: 10,
    marginBottom: 2,
    color: '#DC2626'
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  groupCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA'
  },
  row: {
    minHeight: 92,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowNoBorder: {
    borderBottomWidth: 0
  },
  rowIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 6
  },
  rowTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: '#0A0A0A',
    fontWeight: '500'
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: '#0A0A0A'
  },
  signOut: {
    marginTop: 26,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    minHeight: 58,
    alignSelf: 'center',
    width: '68%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  signOutText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#DC2626'
  },
  version: {
    marginTop: 38,
    marginBottom: 8,
    textAlign: 'center',
    color: '#0A0A0A',
    fontSize: 14
  },
  disabled: {
    opacity: 0.55
  }
});
