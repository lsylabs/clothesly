import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { hasSupabaseEnv } from '../../config/env';
import { useAuth } from '../../services/AuthContext';
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
        <Ionicons color="#111214" name={icon} size={28} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons color="#6a6c73" name="chevron-forward" size={28} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? 'Unknown user';
  const metadataFullName = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? null;

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoadingProfile(true);
      try {
        const nextProfile = await getMyProfile();
        if (!active) return;
        setProfile(nextProfile);

        if (nextProfile?.avatar_path) {
          const signed = await getCachedSignedImageUrl('avatars', nextProfile.avatar_path).catch(() => null);
          if (active) {
            setAvatarUri(signed);
          }
        } else {
          setAvatarUri(null);
        }
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

    void run();

    return () => {
      active = false;
    };
  }, [userId]);

  const displayName = useMemo(() => {
    const fullName = profile?.full_name?.trim() || String(metadataFullName ?? '').trim();
    if (fullName) return fullName;

    const local = email.split('@')[0]?.trim();
    if (local) return local;
    return 'Clothesly User';
  }, [email, metadataFullName, profile?.full_name]);

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
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
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
              <Ionicons color="#ffffff" name="camera-outline" size={18} />
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
        onPress={async () => {
          const { error } = await signOut().then(() => ({ error: null })).catch((e: Error) => ({ error: e }));
          if (error) {
            Alert.alert('Sign out failed', error.message);
          }
        }}
        style={styles.signOut}
      >
        <Ionicons color="#dc2626" name="log-out-outline" size={28} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.version}>Clothesly v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa'
  },
  content: {
    padding: 20,
    paddingBottom: 140
  },
  pageTitle: {
    fontSize: 58,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: '#0a0a0a'
  },
  identityCard: {
    marginTop: 22,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#ebecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarTap: {
    width: 106,
    height: 106,
    marginRight: 16
  },
  avatar: {
    width: 106,
    height: 106,
    borderRadius: 53
  },
  avatarFallback: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#75777f',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitials: {
    fontSize: 44,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.7
  },
  cameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a'
  },
  identityText: {
    flex: 1
  },
  nameText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#0a0a0a'
  },
  emailText: {
    marginTop: 4,
    fontSize: 18,
    color: '#66666d'
  },
  warning: {
    marginTop: 10,
    marginBottom: 2,
    color: '#9e4c4c'
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#63646a'
  },
  groupCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dadce2',
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  row: {
    minHeight: 112,
    borderBottomWidth: 1,
    borderBottomColor: '#dadce2',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowNoBorder: {
    borderBottomWidth: 0
  },
  rowIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#f4f5f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 6
  },
  rowTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: '#63646a',
    fontWeight: '500'
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 22,
    color: '#63646a'
  },
  signOut: {
    marginTop: 26,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#f1b9bf',
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  signOutText: {
    fontSize: 23,
    fontWeight: '500',
    color: '#dc2626'
  },
  version: {
    marginTop: 38,
    marginBottom: 8,
    textAlign: 'center',
    color: '#6d6f75',
    fontSize: 16
  },
  disabled: {
    opacity: 0.55
  }
});
