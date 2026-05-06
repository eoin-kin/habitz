import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useHabitStore } from '../../store/habitStore';
import { useSocialStore } from '../../store/socialStore';
import { useAuthStore } from '../../store/authStore';
import { HabitCard } from '../../components/HabitCard';
import { HabitWithStats, Profile, FriendWithProfile } from '../../types';
import { colors } from '../../lib/theme';

export default function TodayScreen() {
  const router = useRouter();
  const { habits, loading, fetchHabits, toggleCompletion } = useHabitStore();
  const { session } = useAuthStore();
  const { friends, loading: friendsLoading, fetchFriends, searchUsers, sendFriendRequest } = useSocialStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const currentUserId = session?.user?.id;

  useEffect(() => {
    fetchHabits();
    fetchFriends();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const query = searchQuery.trim();
      if (!query || query.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const results = await searchUsers(query);
      setSearchResults(results);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, searchUsers]);

  const getFriendRelation = (profileId: string) =>
    friends.find((friend) => friend.friend_id === profileId);

  const handleSendFriendRequest = async (profile: Profile) => {
    setRequestMessage(null);
    if (!profile.id) return;
    setRequestingId(profile.id);
    const error = await sendFriendRequest(profile.id);
    setRequestingId(null);
    if (error) {
      setRequestMessage(error);
      return;
    }
    setRequestMessage(`Friend request sent to ${profile.username}.`);
  };

  const todayHabits = useMemo(
    () =>
      habits.filter((h) => {
        if (h.frequency === 'daily') return true;
        if (h.frequency === 'weekly' || h.frequency === 'custom') {
          const dayOfWeek = new Date().getDay() || 7; // 1=Mon, 7=Sun
          return h.frequency_days.includes(dayOfWeek);
        }
        return true;
      }),
    [habits]
  );

  const selectedHabits = useMemo(
    () =>
      [...habits]
        .sort((a, b) => b.current_streak - a.current_streak)
        .slice(0, 5),
    [habits]
  );

  const topStreakHabit = useMemo(() => {
    return [...habits].sort((a, b) => b.current_streak - a.current_streak)[0] ?? null;
  }, [habits]);

  const completed = todayHabits.filter((h) => h.completed_today).length;
  const progress = todayHabits.length > 0 ? completed / todayHabits.length : 0;

  const recentNotification = useMemo(() => {
    if (!friends?.length) return null;

    const sorted = [...friends].sort((a, b) => {
      const aDate = a.responded_at || a.requested_at;
      const bDate = b.responded_at || b.requested_at;
      return bDate.localeCompare(aDate);
    });

    return sorted[0];
  }, [friends]);

  const recentNotificationText = useMemo(() => {
    if (!recentNotification) return 'No friend notifications yet.';

    const name = recentNotification.profile.display_name || recentNotification.profile.username;
    if (recentNotification.status === 'pending' && recentNotification.direction === 'incoming') {
      return `New request from ${name}`;
    }
    if (recentNotification.status === 'pending' && recentNotification.direction === 'outgoing') {
      return `Request sent to ${name}`;
    }
    if (recentNotification.status === 'accepted') {
      return `You are now friends with ${name}`;
    }
    return `Friend activity with ${name}`;
  }, [recentNotification]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading || friendsLoading} onRefresh={() => { fetchHabits(); fetchFriends(); }} tintColor={colors.primary} />
        }
      >
        <View style={styles.topSection}>
          <Text style={styles.heading}>Search friends</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Find friends by username"
            placeholderTextColor={colors.dark.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {requestMessage ? <Text style={styles.requestMessage}>{requestMessage}</Text> : null}
          {searchQuery.length >= 2 && (
            <View style={styles.searchResults}>
              {searching ? (
                <Text style={styles.searchStatus}>Searching...</Text>
              ) : searchResults.length ? (
                searchResults.map((profile) => {
                  const relation = getFriendRelation(profile.id);
                  const isCurrentUser = profile.id === currentUserId;
                  const isSending = requestingId === profile.id;
                  const isFriend = relation?.status === 'accepted';
                  const isPendingOutgoing = relation?.status === 'pending' && relation.direction === 'outgoing';
                  const isPendingIncoming = relation?.status === 'pending' && relation.direction === 'incoming';
                  const buttonLabel = isCurrentUser
                    ? 'This is you'
                    : isFriend
                    ? 'Friends'
                    : isPendingOutgoing
                    ? 'Request sent'
                    : isPendingIncoming
                    ? 'Incoming request'
                    : 'Add friend';

                  return (
                    <View key={profile.id} style={styles.searchResultItem}>
                      <TouchableOpacity
                        style={styles.searchResultInfo}
                        onPress={() => {
                          setSearchQuery(profile.username);
                          setSearchResults([]);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.searchResultName}>{profile.display_name || profile.username}</Text>
                        <Text style={styles.searchResultHandle}>@{profile.username}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.addFriendBtn,
                          (isFriend || isCurrentUser || isPendingIncoming || isPendingOutgoing) && styles.addFriendBtnDisabled,
                        ]}
                        onPress={() => handleSendFriendRequest(profile)}
                        disabled={isFriend || isCurrentUser || isPendingIncoming || isPendingOutgoing || isSending}
                      >
                        {isSending ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.addFriendBtnText}>{buttonLabel}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.searchStatus}>No matches yet.</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Your spotlight</Text>
            <Text style={styles.heroSubtitle}>Up to 5 habits worth celebrating today</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.habitRow} contentContainerStyle={styles.habitRowContent}>
            {selectedHabits.length ? (
              selectedHabits.map((habit) => (
                <View key={habit.id} style={styles.smallHabitCard}>
                  <Text style={styles.smallHabitIcon}>{habit.icon}</Text>
                  <Text style={styles.smallHabitName} numberOfLines={1}>{habit.name}</Text>
                  <Text style={styles.smallHabitStreak}>🔥 {habit.current_streak}d</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyHeroBox}>
                <Text style={styles.emptyHeroText}>Create habits to see your top picks here.</Text>
              </View>
            )}
          </ScrollView>

          {topStreakHabit ? (
            <View style={styles.selectedStreakCard}>
              <Text style={styles.selectedStreakLabel}>Chosen streak</Text>
              <View style={styles.selectedStreakBody}>
                <Text style={styles.selectedStreakIcon}>{topStreakHabit.icon}</Text>
                <View style={styles.selectedStreakInfo}>
                  <Text style={styles.selectedStreakName}>{topStreakHabit.name}</Text>
                  <Text style={styles.selectedStreakCount}>{topStreakHabit.current_streak} day streak</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.selectedStreakCard}>
              <Text style={styles.selectedStreakLabel}>Chosen streak</Text>
              <Text style={styles.selectedStreakEmpty}>Complete a habit to reveal your streak.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today</Text>
          <Text style={styles.sectionSubtitle}>{completed}/{todayHabits.length} done</Text>
        </View>

        {loading && !habits.length ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} size="large" />
        ) : todayHabits.length ? (
          todayHabits.map((item) => (
            <HabitCard
              key={item.id}
              habit={item}
              onToggle={() => toggleCompletion(item.id)}
              onPress={() => router.push(`/habit/${item.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No habits scheduled today</Text>
            <Text style={styles.emptyText}>Add a habit and it will appear here.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/habit/new')}>
              <Text style={styles.emptyButtonText}>Add Habit</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.notificationBar}>
        <Text style={styles.notificationText}>{recentNotificationText}</Text>
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/habit/new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  scrollContent: { padding: 16, paddingBottom: 180, gap: 16 },
  topSection: { gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.dark.text.primary },
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
  searchResults: {
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  searchResultInfo: { flex: 1, marginRight: 12 },
  addFriendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    minWidth: 98,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendBtnDisabled: {
    backgroundColor: colors.dark.bg.tertiary,
  },
  addFriendBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  requestMessage: {
    marginTop: 12,
    marginBottom: 4,
    color: colors.primaryLight,
    fontSize: 13,
  },
  searchResultName: { fontSize: 15, fontWeight: '600', color: colors.dark.text.primary },
  searchResultHandle: { fontSize: 12, color: colors.dark.text.secondary, marginTop: 2 },
  searchStatus: { padding: 16, color: colors.dark.text.secondary, fontSize: 13 },
  heroCard: {
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  heroHeader: { marginBottom: 16 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: colors.dark.text.primary },
  heroSubtitle: { fontSize: 13, color: colors.dark.text.secondary, marginTop: 6 },
  habitRow: { marginBottom: 16 },
  habitRowContent: { gap: 12 },
  smallHabitCard: {
    minWidth: 130,
    backgroundColor: colors.dark.bg.tertiary,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  smallHabitIcon: { fontSize: 24, marginBottom: 10 },
  smallHabitName: { fontSize: 14, fontWeight: '700', color: colors.dark.text.primary },
  smallHabitStreak: { fontSize: 12, color: colors.accent.green, marginTop: 6 },
  emptyHeroBox: {
    minHeight: 100,
    borderRadius: 18,
    backgroundColor: colors.dark.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyHeroText: { color: colors.dark.text.secondary, textAlign: 'center', fontSize: 13 },
  selectedStreakCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    padding: 18,
  },
  selectedStreakLabel: { fontSize: 12, fontWeight: '700', color: colors.primaryLight, marginBottom: 10 },
  selectedStreakBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  selectedStreakIcon: { fontSize: 30 },
  selectedStreakInfo: { flex: 1 },
  selectedStreakName: { fontSize: 16, fontWeight: '700', color: colors.dark.text.primary },
  selectedStreakCount: { color: colors.dark.text.secondary, marginTop: 4 },
  selectedStreakEmpty: { fontSize: 14, color: colors.dark.text.secondary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.dark.text.primary },
  sectionSubtitle: { fontSize: 13, color: colors.dark.text.secondary },
  loader: { marginTop: 24 },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.dark.text.primary, marginBottom: 6 },
  emptyText: { fontSize: 14, color: colors.dark.text.secondary, textAlign: 'center', marginBottom: 24 },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  notificationBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 72,
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  notificationText: { color: colors.dark.text.primary, fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
