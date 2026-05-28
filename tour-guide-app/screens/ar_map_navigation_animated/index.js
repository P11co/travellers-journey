import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import waypointsData from '../../src/data/waypoints.json';
import TrioDock from '../../src/components/TrioDock';

const PALACE_CENTER = {
  latitude: 37.5796,
  longitude: 126.977,
};

const getDistanceInMeters = (a, b) => {
  const earthRadius = 6371000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * Math.PI / 180;
  const deltaLng = (b.longitude - a.longitude) * Math.PI / 180;

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getCurrentCoords = (currentLocation) => {
  if (!currentLocation?.lat || !currentLocation?.lng) {
    return null;
  }

  return {
    latitude: currentLocation.lat,
    longitude: currentLocation.lng,
  };
};

const buildLeafletMapHtml = ({ center, waypoints, currentCoords }) => {
  const payload = JSON.stringify({ center, waypoints, currentCoords });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #0f0f13;
        overflow: hidden;
      }
      .leaflet-container {
        width: 100%;
        height: 100%;
        background: #0f0f13;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .leaflet-tile {
        filter: saturate(0.9) brightness(0.92) contrast(1.04);
      }
      .leaflet-control-attribution {
        font-size: 10px;
        opacity: 0.7;
      }
      .pin {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #ef4444;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
      }
      .pin.active {
        width: 22px;
        height: 22px;
        background: #5c77ff;
        box-shadow: 0 0 0 8px rgba(92, 119, 255, 0.18), 0 4px 16px rgba(0, 0, 0, 0.4);
      }
      .leaflet-popup-content-wrapper {
        border-radius: 12px;
      }
      .popup-title {
        font-weight: 700;
        margin-bottom: 4px;
      }
      .popup-summary {
        color: #52525b;
        line-height: 1.35;
      }
      #fallback {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        background: #0f0f13;
        color: #e4e4e7;
        text-align: center;
        font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="fallback">Map tiles could not load. Check the device internet connection.</div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        var data = ${payload};
        var fallback = document.getElementById('fallback');

        function showFallback(message) {
          fallback.textContent = message;
          fallback.style.display = 'flex';
        }

        function escapeHtml(value) {
          return String(value || '').replace(/[&<>"']/g, function (character) {
            return ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;'
            })[character];
          });
        }

        if (!window.L) {
          showFallback('Map library could not load. Check the device internet connection.');
          return;
        }

        var center = data.currentCoords || data.center;
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true
        }).setView([center.latitude, center.longitude], data.currentCoords ? 18 : 17);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        data.waypoints.forEach(function (point) {
          var latLng = [point.latitude, point.longitude];
          var color = point.active ? '#5c77ff' : '#ef4444';
          var fill = point.active ? 'rgba(92, 119, 255, 0.16)' : 'rgba(239, 68, 68, 0.08)';
          var pinClass = point.active ? 'pin active' : 'pin';

          L.circle(latLng, {
            radius: point.radius,
            color: color,
            fillColor: fill,
            fillOpacity: 1,
            weight: point.active ? 2 : 1
          }).addTo(map);

          L.marker(latLng, {
            icon: L.divIcon({
              className: '',
              html: '<div class="' + pinClass + '"></div>',
              iconSize: point.active ? [22, 22] : [18, 18],
              iconAnchor: point.active ? [11, 11] : [9, 9]
            })
          }).addTo(map).bindPopup(
            '<div class="popup-title">' + escapeHtml(point.name) + '</div>' +
            '<div class="popup-summary">' + escapeHtml(point.summary) + '</div>'
          );
        });

        if (data.currentCoords) {
          L.circleMarker([data.currentCoords.latitude, data.currentCoords.longitude], {
            radius: 9,
            color: '#ffffff',
            fillColor: '#2563eb',
            fillOpacity: 1,
            weight: 3
          }).addTo(map).bindTooltip('Current location');
        }

        setTimeout(function () {
          map.invalidateSize();
        }, 200);
      })();
    </script>
  </body>
</html>`;
};

export default function ARMapNavigationView({ navigation, showBottomNav = true }) {
  const insets = useSafeAreaInsets();
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const currentLocation = useAppStore((s) => s.currentLocation);
  const currentCoords = getCurrentCoords(currentLocation);
  const notificationTop = Math.max(92, insets.top + 42);

  const activeWaypoint = useMemo(() => {
    if (currentLocation?.waypointId) {
      return waypointsData.find((wp) => wp.id === currentLocation.waypointId) || null;
    }

    if (!currentCoords) {
      return null;
    }

    return waypointsData.find((wp) => (
      getDistanceInMeters(currentCoords, wp.coordinates) <= wp.radius
    )) || null;
  }, [currentCoords, currentLocation?.waypointId]);

  const mapCenter = currentCoords || PALACE_CENTER;
  const activeWaypointId = activeWaypoint?.id || null;
  const mapWaypoints = useMemo(() => (
    waypointsData.map((wp) => ({
      id: wp.id,
      name: wp.name,
      summary: wp.knowledgeSummary,
      latitude: wp.coordinates.latitude,
      longitude: wp.coordinates.longitude,
      radius: wp.radius,
      active: wp.id === activeWaypointId,
    }))
  ), [activeWaypointId]);

  const mapHtml = useMemo(() => buildLeafletMapHtml({
    center: mapCenter,
    waypoints: mapWaypoints,
    currentCoords,
  }), [
    currentCoords?.latitude,
    currentCoords?.longitude,
    mapCenter.latitude,
    mapCenter.longitude,
    mapWaypoints,
  ]);

  const handleMapReady = () => {
    setIsMapReady(true);
    setMapError(null);
    console.log('[ARMap] Web map is ready');
  };

  const handleMapError = (event) => {
    const message =
      event?.nativeEvent?.error ||
      event?.nativeEvent?.message ||
      'Map failed to load';

    setMapError(message);
    console.warn('[ARMap] Web map error:', message);
  };

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        source={{ html: mapHtml, baseUrl: 'https://seoulwalk.local' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        startInLoadingState
        onLoadStart={() => setIsMapReady(false)}
        onLoadEnd={handleMapReady}
        onError={handleMapError}
        onHttpError={handleMapError}
        renderLoading={() => (
          <View style={styles.webMapLoading}>
            <ActivityIndicator size="large" color="#8ca1ff" />
          </View>
        )}
      />

      {!isMapReady && (
        <View style={styles.mapLoadingBadge} pointerEvents="none">
          <ActivityIndicator size="small" color="#8ca1ff" />
          <Text style={styles.mapLoadingText}>Loading map</Text>
        </View>
      )}

      {mapError && (
        <View style={styles.mapErrorBadge} pointerEvents="none">
          <Text style={styles.mapErrorText}>{mapError}</Text>
        </View>
      )}

      <View style={[styles.topNotificationContainer, { top: notificationTop }]}>
        <View style={styles.notificationPanel}>
          <View style={styles.iconContainer}>
            <Svg width="24" height="24" fill="none" stroke="#8ca1ff" strokeWidth="1.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </Svg>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.notificationTitle}>
              {activeWaypoint ? activeWaypoint.name : 'Palace map ready'}
            </Text>
            <Text style={styles.notificationSubtitle} numberOfLines={1}>
              {activeWaypoint ? activeWaypoint.knowledgeSummary : 'Move around to detect nearby waypoints.'}
            </Text>
          </View>
        </View>
      </View>

      {showBottomNav && (
        <TrioDock navigation={navigation} activeKey="chat" bottomOffset={32} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f0f13',
  },
  webMapLoading: {
    flex: 1,
    backgroundColor: '#0f0f13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNotificationContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
    alignItems: 'center',
  },
  notificationPanel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(24, 24, 27, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(92, 119, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.28)',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  mapLoadingBadge: {
    position: 'absolute',
    left: 16,
    bottom: 232,
    zIndex: 15,
    backgroundColor: 'rgba(15, 15, 19, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLoadingText: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  mapErrorBadge: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 232,
    zIndex: 16,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mapErrorText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '700',
  },
});
