import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSocialStore } from '../../store/socialStore';
import { Profile } from '../../types';
import { colors } from '../../lib/theme';

export default function FriendSearchScreen() {
  const router = useRouter();
  const { friends, fetchFriends, searchUsers, sendFriendRequest, loading } = useSocialStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      const searchResults = await searchUsers(trimmed);
      setResults(searchResults);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, searchUsers]);

  const getFriendRelation = (profileId: string) =>
    friends.find((friend) => friend.friend_id === profileId);

  const handleSendRequest = async (profile: Profile) => {
    setMessage(null);
    setRequestingId(profile.id);
    const error = await sendFriendRequest(profile.id);
    setRequestingId(null);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage(`Friend request sent to ${profile.username}.`);
  };

  const renderActionLabel = (profile: Profile) => {
    const relation = getFriendRelation(profile.id);
    if (relation?.status === 'accepted') return 'Friends';
    if (relation?.status === 'pending' && relation.direction === 'outgoing') return 'Request sent';
    if (relation?.status === 'pending' && relation.direction === 'incoming') return 'Incoming request';
    if (relation?.status === 'blocked') return 'Blocked';
    return 'Add';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchFriends}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Find friends</Text>
          <Text style={styles.subtitle}>Search by username and send a request instantly.</Text>
        </View>

        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username"
          placeholderTextColor={colors.dark.text.tertiary}
          returnKeyType="search"
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.resultsContainer}>
          {searching ? (
            <Text style={styles.statusText}>Searching...</Text>
          ) : results.length ? (
            results.map((profile) => {
              const relation = getFriendRelation(profile.id);
              const label = renderActionLabel(profile);
              const disabled = relation?.status !== undefined || requestingId === profile.id;
              return (
                <View key={profile.id} style={styles.resultRow}>
                  <View>
                    <Text style={styles.resultName}>{profile.display_name || profile.username}</Text>
                    <Text style={styles.resultHandle}>@{profile.username}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionButton, disabled && styles.disabledButton]}
                    onPress={() => handleSendRequest(profile)}
                    disabled={disabled}
                  >
                    {requestingId === profile.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>{label}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.statusText}>Type at least 2 characters to search.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark.text.primary },
  subtitle: { fontSize: 14, color: colors.dark.text.secondary },
  searchInput: {
    backgroundColor: colors.dark.input,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.dark.text.primary,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  message: { color: colors.primaryLight, fontSize: 13 },
  resultsContainer: {
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dark.border,
    padding: 12,
    gap: 10,
  },
  statusText: { color: colors.dark.text.secondary, fontSize: 13, paddingVertical: 16 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  resultName: { fontSize: 15, fontWeight: '700', color: colors.dark.text.primary },
  resultHandle: { fontSize: 12, color: colors.dark.text.secondary, marginTop: 2 },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 90,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabledButton: { opacity: 0.5 },
});
