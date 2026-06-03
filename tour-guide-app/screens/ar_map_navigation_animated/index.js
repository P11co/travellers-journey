import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import waypointsData from '../../src/data/waypoints.json';
import TrioDock from '../../src/components/TrioDock';
import { getTheme } from '../../src/theme';
import RemoteImage from '../../src/components/RemoteImage';

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

const buildMapLibreMapHtml = ({ center, waypoints, currentCoords, themeMode }) => {
  const payload = JSON.stringify({ center, waypoints, currentCoords, themeMode });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.css" />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #0f0f13;
        overflow: hidden;
      }
      .maplibregl-map {
        width: 100%;
        height: 100%;
        background: #0f0f13;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .maplibregl-ctrl-attrib {
        font-size: 10px;
        opacity: 0.7;
      }
      .maplibregl-ctrl-bottom-right {
        bottom: 18px;
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
      .maplibregl-marker {
        cursor: pointer;
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
    <script src="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js"></script>
    <script>
      (async function () {
        var data = ${payload};
        var fallback = document.getElementById('fallback');
        var styleUrl = data.themeMode === 'dark'
          ? 'https://tiles.openfreemap.org/styles/dark'
          : 'https://tiles.openfreemap.org/styles/liberty';
        var englishLabelExpression = [
          'coalesce',
          ['get', 'name_en'],
          ['get', 'name:en'],
          ['get', 'name:latin']
        ];
        var waypointLabelColor = data.themeMode === 'dark' ? '#f4f4f5' : '#18181b';
        var waypointLabelHalo = data.themeMode === 'dark' ? '#0f0f13' : '#ffffff';
        var lastWaypointSelectionAt = 0;

        function showFallback(message) {
          fallback.textContent = message;
          fallback.style.display = 'flex';
        }

        function postMapDismissal() {
          if (!window.ReactNativeWebView) return;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MAP_DISMISSED'
          }));
        }

        function postWaypointSelection(point) {
          if (!window.ReactNativeWebView) return;
          lastWaypointSelectionAt = Date.now();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'WAYPOINT_SELECTED',
            waypoint: point
          }));
        }

        function expressionReferencesName(expression) {
          if (!Array.isArray(expression)) return false;
          if (expression[0] === 'get' && typeof expression[1] === 'string') {
            return expression[1] === 'name' ||
              expression[1] === 'name_en' ||
              expression[1] === 'name:en' ||
              expression[1] === 'name:latin' ||
              expression[1] === 'name:nonlatin';
          }
          return expression.some(expressionReferencesName);
        }

        function preferEnglishLabels(style) {
          style.layers = (style.layers || []).map(function (layer) {
            if (!layer.layout || !expressionReferencesName(layer.layout['text-field'])) {
              return layer;
            }

            return Object.assign({}, layer, {
              layout: Object.assign({}, layer.layout, {
                'text-field': englishLabelExpression
              })
            });
          });
          return style;
        }

        function createCirclePolygon(centerPoint, radiusMeters, steps) {
          var coordinates = [];
          var lat = centerPoint.latitude * Math.PI / 180;
          var lng = centerPoint.longitude * Math.PI / 180;
          var angularDistance = radiusMeters / 6371000;

          for (var i = 0; i <= steps; i += 1) {
            var bearing = (i / steps) * 2 * Math.PI;
            var pointLat = Math.asin(
              Math.sin(lat) * Math.cos(angularDistance) +
              Math.cos(lat) * Math.sin(angularDistance) * Math.cos(bearing)
            );
            var pointLng = lng + Math.atan2(
              Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat),
              Math.cos(angularDistance) - Math.sin(lat) * Math.sin(pointLat)
            );
            coordinates.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI]);
          }

          return coordinates;
        }

        if (!window.maplibregl) {
          showFallback('Map library could not load. Check the device internet connection.');
          return;
        }

        var style;
        try {
          var response = await fetch(styleUrl);
          if (!response.ok) {
            throw new Error('Style request failed: ' + response.status);
          }
          style = preferEnglishLabels(await response.json());
        } catch (error) {
          showFallback('Vector map style could not load. Check the device internet connection.');
          return;
        }

        var center = data.currentCoords || data.center;
        var map = new maplibregl.Map({
          container: 'map',
          style: style,
          center: [center.longitude, center.latitude],
          zoom: data.currentCoords ? 17.6 : 16.8,
          attributionControl: true
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.touchZoomRotate.disableRotation();
        map.dragRotate.disable();

        map.on('load', function () {
          var waypointFeatures = data.waypoints.map(function (point) {
            return {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [createCirclePolygon(point, point.radius, 64)]
              },
              properties: {
                id: point.id,
                active: point.active
              }
            };
          });

          map.addSource('waypoint-zones', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: waypointFeatures
            }
          });

          map.addLayer({
            id: 'waypoint-zone-fill',
            type: 'fill',
            source: 'waypoint-zones',
            paint: {
              'fill-color': ['case', ['boolean', ['get', 'active'], false], '#5c77ff', '#ef4444'],
              'fill-opacity': ['case', ['boolean', ['get', 'active'], false], 0.16, 0.08]
            }
          });

          map.addLayer({
            id: 'waypoint-zone-line',
            type: 'line',
            source: 'waypoint-zones',
            paint: {
              'line-color': ['case', ['boolean', ['get', 'active'], false], '#5c77ff', '#ef4444'],
              'line-opacity': 0.9,
              'line-width': ['case', ['boolean', ['get', 'active'], false], 2, 1]
            }
          });

          map.addSource('waypoint-labels', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.waypoints.map(function (point) {
                return {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [point.longitude, point.latitude]
                  },
                  properties: {
                    id: point.id,
                    name: point.name,
                    active: point.active
                  }
                };
              })
            }
          });

          map.addLayer({
            id: 'waypoint-english-labels',
            type: 'symbol',
            source: 'waypoint-labels',
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Bold'],
              'text-size': ['case', ['boolean', ['get', 'active'], false], 14, 12],
              'text-anchor': 'top',
              'text-offset': [0, 1.25],
              'text-max-width': 8,
              'text-allow-overlap': true,
              'text-ignore-placement': true
            },
            paint: {
              'text-color': waypointLabelColor,
              'text-halo-color': waypointLabelHalo,
              'text-halo-width': 1.5,
              'text-halo-blur': 0.4
            }
          });

          map.on('click', function (event) {
            if (Date.now() - lastWaypointSelectionAt < 500) {
              return;
            }

            var waypointHits = map.queryRenderedFeatures(event.point, {
              layers: ['waypoint-zone-fill']
            });
            if (waypointHits.length > 0) return;
            postMapDismissal();
          });

          map.on('click', 'waypoint-zone-fill', function (event) {
            if (event.originalEvent && event.originalEvent.stopPropagation) {
              event.originalEvent.stopPropagation();
            }
            var feature = event.features && event.features[0];
            var point = data.waypoints.find(function (waypoint) {
              return feature && waypoint.id === feature.properties.id;
            });
            if (point) postWaypointSelection(point);
          });

          data.waypoints.forEach(function (point) {
            var markerElement = document.createElement('div');
            var lastMarkerSelectionAt = 0;
            markerElement.className = point.active ? 'pin active' : 'pin';

            function stopMarkerEvent(event) {
              event.stopPropagation();
              if (event.cancelable) {
                event.preventDefault();
              }
            }

            function selectMarker(event) {
              stopMarkerEvent(event);
              if (Date.now() - lastMarkerSelectionAt < 250) {
                return;
              }
              lastMarkerSelectionAt = Date.now();
              postWaypointSelection(point);
            }

            ['pointerdown', 'touchstart', 'mousedown'].forEach(function (eventName) {
              markerElement.addEventListener(eventName, stopMarkerEvent, { passive: false });
            });

            ['pointerup', 'touchend', 'mouseup', 'click'].forEach(function (eventName) {
              markerElement.addEventListener(eventName, selectMarker, { passive: false });
            });

            new maplibregl.Marker({
              element: markerElement,
              anchor: 'center'
            })
              .setLngLat([point.longitude, point.latitude])
              .addTo(map);
          });

          if (data.currentCoords) {
            map.addSource('current-location', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [{
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [data.currentCoords.longitude, data.currentCoords.latitude]
                  },
                  properties: {}
                }]
              }
            });

            map.addLayer({
              id: 'current-location-dot',
              type: 'circle',
              source: 'current-location',
              paint: {
                'circle-radius': 9,
                'circle-color': '#2563eb',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 3
              }
            });
          }
        });
      })();
    </script>
  </body>
</html>`;
};

export default function ARMapNavigationView({
  navigation,
  showBottomNav = true,
  onAskWaypoint,
  dismissWaypointSignal = 0,
}) {
  const insets = useSafeAreaInsets();
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [entryWaypoint, setEntryWaypoint] = useState(null);
  const lastActiveWaypointIdRef = useRef(null);
  const lastWaypointSelectedAtRef = useRef(0);
  const currentLocation = useAppStore((s) => s.currentLocation);
  const hotspotSuggestionsEnabled = useAppStore((s) => s.hotspotSuggestionsEnabled);
  const setChatWaypointContext = useAppStore((s) => s.setChatWaypointContext);
  const logTraceEvent = useAppStore((s) => s.logTraceEvent);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);
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

  const mapHtml = useMemo(() => buildMapLibreMapHtml({
    center: mapCenter,
    waypoints: mapWaypoints,
    currentCoords,
    themeMode,
  }), [
    currentCoords?.latitude,
    currentCoords?.longitude,
    mapCenter.latitude,
    mapCenter.longitude,
    mapWaypoints,
    themeMode,
  ]);

  useEffect(() => {
    const nextId = activeWaypoint?.id || null;
    const previousId = lastActiveWaypointIdRef.current;

    if (nextId && nextId !== previousId) {
      logTraceEvent('waypoint_radius_entered', {
        waypoint_id: activeWaypoint.id,
        waypoint_name: activeWaypoint.name,
        latitude: activeWaypoint.coordinates?.latitude,
        longitude: activeWaypoint.coordinates?.longitude,
        suggestions_enabled: hotspotSuggestionsEnabled,
      });
    }

    if (!hotspotSuggestionsEnabled) {
      setSelectedWaypoint(null);
      setEntryWaypoint(null);
      lastActiveWaypointIdRef.current = nextId;
      return;
    }

    if (nextId && nextId !== previousId) {
      setEntryWaypoint(activeWaypoint);
    }

    lastActiveWaypointIdRef.current = nextId;
  }, [activeWaypoint?.id, hotspotSuggestionsEnabled]);

  useEffect(() => {
    if (!dismissWaypointSignal || hotspotSuggestionsEnabled) {
      return;
    }

    setSelectedWaypoint(null);
    setEntryWaypoint(null);
  }, [dismissWaypointSignal, hotspotSuggestionsEnabled]);

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

  const handleMapMessage = (event) => {
    try {
      const payload = JSON.parse(event?.nativeEvent?.data || '{}');
      if (payload.type === 'DEBUG_TOUCH') {
        console.log('[ARMap] TOUCH:', payload.event, JSON.stringify(payload));
        return;
      }
      if (payload.type === 'MAP_DISMISSED') {
        if (Date.now() - lastWaypointSelectedAtRef.current < 500) {
          return;
        }
        if (!hotspotSuggestionsEnabled) {
          setSelectedWaypoint(null);
          setEntryWaypoint(null);
        }
        return;
      }
      if (payload.type !== 'WAYPOINT_SELECTED' || !payload.waypoint?.id) return;
      lastWaypointSelectedAtRef.current = Date.now();
      setSelectedWaypoint(payload.waypoint);
      logTraceEvent('waypoint_marker_tapped', {
        waypoint_id: payload.waypoint.id,
        waypoint_name: payload.waypoint.name,
        latitude: payload.waypoint.latitude,
        longitude: payload.waypoint.longitude,
      });
    } catch {
      // Ignore malformed WebView bridge messages.
    }
  };

  const handleAskBuddyAboutWaypoint = () => {
    const targetWaypoint = selectedWaypoint || entryWaypoint || activeWaypoint;
    if (!targetWaypoint) return;
    setChatWaypointContext(targetWaypoint);
    setSelectedWaypoint(null);
    setEntryWaypoint(null);
    onAskWaypoint?.(targetWaypoint);
  };

  const handleReadStory = () => {
    const targetWaypoint = selectedWaypoint || entryWaypoint || activeWaypoint;
    if (!targetWaypoint) return;
    logTraceEvent('waypoint_article_opened', {
      waypoint_id: targetWaypoint.id,
      waypoint_name: targetWaypoint.name,
      source: selectedWaypoint ? 'marker_card' : 'entry_popup',
    });
    navigation.navigate('WaypointArticle', { waypointId: targetWaypoint.id });
  };

  const displayWaypoint = selectedWaypoint || entryWaypoint || activeWaypoint;
  const isInspectingWaypoint = Boolean(selectedWaypoint);
  const isEntryPrompt = Boolean(entryWaypoint && !selectedWaypoint);

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
        onMessage={handleMapMessage}
        onError={handleMapError}
        onHttpError={handleMapError}
        renderLoading={() => (
          <View style={styles.webMapLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
      />

      {!isMapReady && (
        <View style={styles.mapLoadingBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.mapLoadingText, { color: theme.text }]}>Loading map</Text>
        </View>
      )}

      {mapError && (
        <View style={styles.mapErrorBadge} pointerEvents="none">
          <Text style={styles.mapErrorText}>{mapError}</Text>
        </View>
      )}

      {(hotspotSuggestionsEnabled || selectedWaypoint) && (
        <View style={[styles.topNotificationContainer, { top: notificationTop }]}>
          <View style={[styles.notificationPanel, { backgroundColor: theme.panel, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <RemoteImage
              sourcePath={displayWaypoint?.image_url}
              style={[styles.notificationThumbnail, { backgroundColor: theme.iconSurface, borderColor: theme.accent }]}
              resizeMode="cover"
            />
            <View style={styles.textContainer}>
              <Text style={[styles.notificationTitle, { color: theme.text }]}>
                {displayWaypoint ? displayWaypoint.name : 'Palace map ready'}
              </Text>
              <Text style={[styles.notificationSubtitle, { color: theme.mutedText }]} numberOfLines={isInspectingWaypoint ? 2 : 1}>
                {displayWaypoint ? (displayWaypoint.summary || displayWaypoint.knowledgeSummary) : 'Move around to detect nearby waypoints.'}
              </Text>
              {(isInspectingWaypoint || isEntryPrompt) && (
                <View style={styles.waypointActionRow}>
                  <TouchableOpacity style={[styles.askBuddyButton, { backgroundColor: theme.accent }]} onPress={handleReadStory}>
                    <Text style={styles.askBuddyButtonText}>Read Story</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.askBuddyButton, { backgroundColor: theme.accent }]} onPress={handleAskBuddyAboutWaypoint}>
                    <Text style={styles.askBuddyButtonText}>Ask Buddy about this</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissWaypointButton}
                    onPress={() => {
                      setSelectedWaypoint(null);
                      setEntryWaypoint(null);
                    }}
                  >
                    <Text style={[styles.dismissWaypointText, { color: theme.mutedText }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

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
  notificationThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(140, 161, 255, 0.55)',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
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
    lineHeight: 17,
  },
  waypointActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  askBuddyButton: {
    backgroundColor: '#5c77ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  askBuddyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissWaypointButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dismissWaypointText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
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
