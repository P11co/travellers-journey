import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import { getTheme } from '../../src/theme';
import articles from '../../src/data/waypointArticles.json';
import waypoints from '../../src/data/waypoints.json';
import { getWaypointImage } from '../../src/data/waypointImages';

export default function WaypointArticleScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const themeMode = useAppStore((s) => s.themeMode);
  const setChatWaypointContext = useAppStore((s) => s.setChatWaypointContext);
  const logTraceEvent = useAppStore((s) => s.logTraceEvent);
  const theme = getTheme(themeMode);
  const waypointId = route?.params?.waypointId;
  const waypoint = waypoints.find((item) => item.id === waypointId);
  const article = articles[waypointId] || {
    title: waypoint?.name || 'Waypoint Story',
    subtitle: waypoint?.knowledgeSummary || 'A short SeoulWalk field note.',
    readingTime: '1 min read',
    sections: [
      {
        heading: 'Overview',
        body: waypoint?.knowledgeSummary || 'No article content is available for this waypoint yet.',
      },
    ],
  };
  const contentWidth = Math.min(width - 56, 360);
  const heroHeight = Math.min(Math.round(contentWidth * 0.56), 210);

  const handleAskBuddy = () => {
    if (waypoint) {
      setChatWaypointContext(waypoint);
      logTraceEvent('waypoint_article_ask_buddy_pressed', {
        waypoint_id: waypoint.id,
        waypoint_name: waypoint.name,
      });
    }
    navigation.navigate('TourMap');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ height: insets.top }} />
      <View style={[styles.header, { borderColor: theme.border }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={() => navigation.goBack()}>
          <Svg width="20" height="20" fill="none" stroke={theme.text} strokeWidth="2.5" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: theme.mutedText }]}>Waypoint Story</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.inner, { width: contentWidth }]}>
          <Image
            source={getWaypointImage(waypointId)}
            style={[styles.heroImage, { width: contentWidth, height: heroHeight }]}
            resizeMode="cover"
          />

          <View style={[styles.hero, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.readingTime, { color: theme.accent }]}>{article.readingTime}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{article.title}</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>{article.subtitle}</Text>
          </View>
        </View>

        {(article.sections || []).map((section) => (
          <View key={section.heading} style={[styles.section, styles.inner, { width: contentWidth }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.heading}</Text>
            <Text style={[styles.body, { color: theme.mutedText }]}>{section.body}</Text>
          </View>
        ))}

        <TouchableOpacity style={[styles.askButton, styles.inner, { width: contentWidth, backgroundColor: theme.accent }]} onPress={handleAskBuddy}>
          <Text style={styles.askButtonText}>Ask Buddy</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  inner: {
    alignSelf: 'center',
  },
  heroImage: {
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#111827',
  },
  hero: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  readingTime: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 25,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
  },
  askButton: {
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  askButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
