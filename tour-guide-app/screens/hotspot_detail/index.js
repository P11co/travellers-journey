import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import hotspotsData from '../../src/data/hotspots.json';
import hotspotImages from '../../src/data/hotspotImages';
import useAppStore from '../../src/store';

export default function HotspotDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const hotspotId = route?.params?.hotspotId;
  const hotspot = hotspotsData.find((item) => item.id === hotspotId);
  const activities = useAppStore((s) => s.draft.activities);
  const toggleDraftActivity = useAppStore((s) => s.toggleDraftActivity);
  const generatedItinerary = useAppStore((s) => s.generatedItinerary);
  const isLoadingItinerary = useAppStore((s) => s.isLoadingItinerary);
  const isPlanLocked = Boolean(generatedItinerary) || isLoadingItinerary;

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('PlanJourney');
  };

  if (!hotspot) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={goBack}>
            <Text style={styles.closeText}>{'<'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Activity not found</Text>
          <Text style={styles.emptyBody}>Go back and choose another nearby activity.</Text>
        </View>
      </View>
    );
  }

  const imageSource = hotspotImages[hotspot.id];
  const selected = Boolean(activities[hotspot.id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={goBack}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={styles.closeText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerHint}>Swipe from left edge</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {imageSource && (
          <View style={styles.imageFrame}>
            <Image source={imageSource} style={styles.image} resizeMode="cover" />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.category}>
            {hotspot.category} • {hotspot.est_duration_mins} min
          </Text>
          <Text style={styles.title}>{hotspot.name}</Text>
          <Text style={styles.description}>{hotspot.short_desc}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Lat {hotspot.lat.toFixed(4)}</Text>
            <Text style={styles.metaText}>Lng {hotspot.lng.toFixed(4)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.selectButton,
              selected && styles.selectButtonActive,
              isPlanLocked && styles.selectButtonLocked,
            ]}
            onPress={() => toggleDraftActivity(hotspot.id)}
            disabled={isPlanLocked}
            activeOpacity={0.86}
          >
            <Text style={styles.selectButtonText}>
              {isPlanLocked ? 'Route Locked' : selected ? 'Included in Route' : 'Add to Route'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1014',
  },
  header: {
    minHeight: 44,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  headerHint: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: 24,
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: '#161618',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 20,
  },
  category: {
    color: '#5c77ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  description: {
    color: '#d4d4d8',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  metaText: {
    color: '#a1a1aa',
    fontSize: 12,
    backgroundColor: '#202126',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  selectButton: {
    marginTop: 22,
    backgroundColor: '#5c77ff',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  selectButtonActive: {
    backgroundColor: '#334155',
  },
  selectButtonLocked: {
    backgroundColor: '#27272a',
    opacity: 0.7,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyBody: {
    color: '#a1a1aa',
    fontSize: 15,
    lineHeight: 22,
  },
});
