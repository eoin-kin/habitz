import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSocialStore } from '../../store/socialStore';
import { FriendWithProfile } from '../../types';
import { colors } from '../../lib/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const { friends, loading, fetchFriends, respondToFriendRequest, unfriend } = useSocialStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
  }, []);

  const incomingRequests = useMemo(
    () => friends.filter((friend) => friend.status === 'pending' && friend.direction === 'incoming'),
    [friends]
  );

  const outgoingRequests = useMemo(
    () => friends.filter((friend) => friend.status === 'pending' && friend.direction === 'outgoing'),
    [friends]
  );

  const acceptedFriends = useMemo(
    () => friends.filter((friend) => friend.status === 'accepted'),
    [friends]
  );

  const handleAccept = async (friend: FriendWithProfile) => {
    setStatusMessage(null);
    setActionLoading(friend.friendship_id);
    const error = await respondToFriendRequest(friend.friendship_id, 'accepted');
    setActionLoading(null);
    if (error) {
      setStatusMessage(error);
      return;
    }
    setStatusMessage(`Accepted ${friend.profile.display_name || friend.profile.username}.`);
  };

  const handleDecline = async (friend: FriendWithProfile) => {
    setStatusMessage(null);
    setActionLoading(friend.friendship_id);
    await unfriend(friend.friendship_id);
    setActionLoading(null);
    setStatusMessage(`Declined ${friend.profile.display_name || friend.profile.username}.`);
  };

  const handleWithdraw = async (friend: FriendWithProfile) => {
    setStatusMessage(null);
    setActionLoading(friend.friendship_id);
    await unfriend(friend.friendship_id);
    setActionLoading(null);
    setStatusMessage(`Withdrawn request to ${friend.profile.display_name || friend.profile.username}.`);
  };

  const handleUnfriend = async (friend: FriendWithProfile) => {
    setStatusMessage(null);
    setActionLoading(friend.friendship_id);
    await unfriend(friend.friendship_id);
    setActionLoading(null);
    setStatusMessage(`Removed ${friend.profile.display_name || friend.profile.username} from friends.`);
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
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Keep your social circle close and manage requests.</Text>
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={() => router.push('/social/search')}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Incoming requests</Text>
          <Text style={styles.sectionCount}>{incomingRequests.length} pending</Text>
          {incomingRequests.length ? (
            incomingRequests.map((friend) => {
              const displayName = friend.profile.display_name || friend.profile.username;
              const isLoading = actionLoading === friend.friendship_id;
              return (
                <View key={friend.friendship_id} style={styles.friendRow}>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{displayName}</Text>
                    <Text style={styles.friendHandle}>@{friend.profile.username}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.primaryButton, isLoading && styles.disabledButton]}
                      onPress={() => handleAccept(friend)}
                      disabled={isLoading}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Accept</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, isLoading && styles.disabledButton]}
                      onPress={() => handleDecline(friend)}
                      disabled={isLoading}
                    >
                      <Text style={styles.secondaryButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No incoming requests right now.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Outgoing requests</Text>
          <Text style={styles.sectionCount}>{outgoingRequests.length} pending</Text>
          {outgoingRequests.length ? (
            outgoingRequests.map((friend) => {
              const displayName = friend.profile.display_name || friend.profile.username;
              const isLoading = actionLoading === friend.friendship_id;
              return (
                <View key={friend.friendship_id} style={styles.friendRow}>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{displayName}</Text>
                    <Text style={styles.friendHandle}>@{friend.profile.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.secondaryButton, isLoading && styles.disabledButton]}
                    onPress={() => handleWithdraw(friend)}
                    disabled={isLoading}
                  >
                    {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Withdraw</Text>}
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No outgoing requests yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Friends</Text>
          <Text style={styles.sectionCount}>{acceptedFriends.length} connected</Text>
          {acceptedFriends.length ? (
            acceptedFriends.map((friend) => {
              const displayName = friend.profile.display_name || friend.profile.username;
              const isLoading = actionLoading === friend.friendship_id;
              return (
                <View key={friend.friendship_id} style={styles.friendRow}>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{displayName}</Text>
                    <Text style={styles.friendHandle}>@{friend.profile.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.secondaryButton, isLoading && styles.disabledButton]}
                    onPress={() => handleUnfriend(friend)}
                    disabled={isLoading}
                  >
                    {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Unfriend</Text>}
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>You have no friends yet. Use search to add someone new.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark.text.primary },
  subtitle: { fontSize: 14, color: colors.dark.text.secondary, marginTop: 4, maxWidth: '70%' },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  statusMessage: { marginTop: 12, color: colors.primaryLight, fontSize: 13 },
  section: {
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dark.border,
    padding: 16,
    gap: 12,
  },
  sectionHeading: { fontSize: 17, fontWeight: '700', color: colors.dark.text.primary },
  sectionCount: { fontSize: 13, color: colors.dark.text.secondary },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', color: colors.dark.text.primary },
  friendHandle: { fontSize: 13, color: colors.dark.text.secondary, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.dark.bg.primary,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  secondaryButtonText: { color: colors.dark.text.primary, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  emptyText: { fontSize: 13, color: colors.dark.text.secondary, marginTop: 4 },
});
