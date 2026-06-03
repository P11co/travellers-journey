import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';

// Zoom presets: label shown on button, and value passed to CameraView (0–1 scale).
// Keeping values conservative — 0.08 ≈ 2× optical on most iPhones, 0.25 ≈ 5×.
const ZOOM_PRESETS = [
  { label: '1×', value: 0 },
  { label: '2×', value: 0.08 },
  { label: '5×', value: 0.25 },
];

const formatLayout = ({ width, height }) => `${Math.round(width)}x${Math.round(height)}`;

export default function VisionCameraPanel({
  style,
  onCapture,
  onClose,
  disabled = false,
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [facing, setFacing] = useState('back');
  const [zoomIndex, setZoomIndex] = useState(0); // index into ZOOM_PRESETS
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState(null);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [captureStatus, setCaptureStatus] = useState('idle');

  const zoom = ZOOM_PRESETS[zoomIndex].value;
  const cameraMode = isFullscreen ? 'fullscreen' : 'compact';

  useEffect(() => {
    setCameraReady(false);
    setCameraMountError(null);
  }, [cameraMode, facing]);

  const handleCameraLayout = ({ nativeEvent }) => {
    const { width, height } = nativeEvent.layout;
    setCameraLayout({ width, height });
  };

  const handleCameraReady = () => {
    setCameraReady(true);
    setCameraMountError(null);
    console.log('[VisionCameraPanel] camera ready', {
      mode: cameraMode,
      facing,
      zoom,
      layout: formatLayout(cameraLayout),
      permissionStatus: permission?.status,
      permissionGranted: permission?.granted,
    });
  };

  const handleCameraMountError = (error) => {
    const message = error?.message || error?.nativeEvent?.message || 'Unknown camera mount error';
    setCameraMountError(message);
    setCameraReady(false);
    console.warn('[VisionCameraPanel] camera mount error', {
      message,
      mode: cameraMode,
      facing,
      zoom,
      layout: formatLayout(cameraLayout),
      permissionStatus: permission?.status,
      permissionGranted: permission?.granted,
    });
  };

  // --- Capture -----------------------------------------------------------
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || disabled) return;
    setIsCapturing(true);
    setCaptureStatus('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.55,
        skipProcessing: true,
      });
      setCaptureStatus(photo?.base64 ? `ok ${photo.width || '?'}x${photo.height || '?'}` : 'no base64');
      if (photo?.base64) {
        // Reset camera UI state before calling back so the next open starts clean.
        setIsFullscreen(false);
        setFacing('back');
        setZoomIndex(0);
        await onCapture?.(photo.base64, photo.uri);
      }
    } catch (error) {
      setCaptureStatus(`error: ${error?.message || 'unknown'}`);
    } finally {
      setIsCapturing(false);
    }
  };

  // --- Close --------------------------------------------------------------
  const handleClose = () => {
    setIsFullscreen(false);
    setFacing('back');
    setZoomIndex(0);
    setCameraReady(false);
    setCameraMountError(null);
    setCaptureStatus('idle');
    onClose?.();
  };

  const diagnosticLines = [
    `mode=${cameraMode}`,
    `perm=${permission?.status || 'unknown'}:${permission?.granted ? 'yes' : 'no'}`,
    `ready=${cameraReady ? 'yes' : 'no'}`,
    `layout=${formatLayout(cameraLayout)}`,
    `facing=${facing}`,
    `zoom=${zoom}`,
    `capture=${captureStatus}`,
    cameraMountError ? `error=${cameraMountError}` : null,
  ].filter(Boolean);

  // --- Permission screen (shared by both modes) --------------------------
  if (!permission?.granted) {
    return (
      <View style={[styles.panel, styles.permissionPanel, style]}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>Allow camera access to ask Buddy about what you see.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleClose}>
          <Text style={styles.secondaryText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ========================================================================
  // FULLSCREEN MODAL — covers the whole app temporarily
  // ========================================================================
  const fullscreenCamera = (
    <Modal
      visible={isFullscreen}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => setIsFullscreen(false)}
    >
      <View style={styles.fsContainer}>
        {/* Live camera view */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          onLayout={handleCameraLayout}
          onCameraReady={handleCameraReady}
          onMountError={handleCameraMountError}
          facing={facing}
          zoom={zoom}
          mirror={facing === 'front'}
          mode="picture"
        />
        <View style={[styles.debugBadge, styles.fsDebugBadge]}>
          <Text style={styles.debugText}>{diagnosticLines.join('\n')}</Text>
        </View>

        {/* Top bar: close + zoom presets */}
        <View style={[styles.fsTopBar, { paddingTop: insets.top + 12 }]}>
          {/* Close fullscreen (return to compact, no capture) */}
          <TouchableOpacity style={styles.fsIconBtn} onPress={() => setIsFullscreen(false)}>
            <Svg width="22" height="22" fill="none" stroke="#ffffff" strokeWidth="2.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </Svg>
          </TouchableOpacity>

          {/* Zoom preset pills */}
          <View style={styles.fsZoomRow}>
            {ZOOM_PRESETS.map((preset, idx) => (
              <TouchableOpacity
                key={preset.label}
                style={[styles.fsZoomPill, idx === zoomIndex && styles.fsZoomPillActive]}
                onPress={() => setZoomIndex(idx)}
              >
                <Text style={[styles.fsZoomText, idx === zoomIndex && styles.fsZoomTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Spacer to balance the close button */}
          <View style={styles.fsIconBtn} />
        </View>

        {/* Bottom bar: flip + capture + (spacer) */}
        <View style={[styles.fsBottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {/* Camera flip */}
          <TouchableOpacity
            style={styles.fsFlipBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Svg width="26" height="26" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </Svg>
          </TouchableOpacity>

          {/* Shutter button */}
          <TouchableOpacity
            style={[styles.fsShutterOuter, (isCapturing || disabled) && styles.fsShutterDisabled]}
            onPress={handleCapture}
            disabled={isCapturing || disabled}
          >
            <View style={styles.fsShutterInner}>
              {isCapturing && <ActivityIndicator color="#ffffff" size="small" />}
            </View>
          </TouchableOpacity>

          {/* Spacer mirror for flip button */}
          <View style={styles.fsFlipBtn} />
        </View>
      </View>
    </Modal>
  );

  // ========================================================================
  // COMPACT FLOATING PANEL
  // ========================================================================
  return (
    <>
      {isFullscreen && fullscreenCamera}
      <View style={[styles.panel, style]} onLayout={handleCameraLayout}>
        {/* Unmount the compact camera entirely when fullscreen is open.
            This ensures only one camera session is live and cameraRef
            points exclusively to the active CameraView. */}
        {!isFullscreen && (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            onLayout={handleCameraLayout}
            onCameraReady={handleCameraReady}
            onMountError={handleCameraMountError}
            facing={facing}
            zoom={zoom}
            mirror={facing === 'front'}
            mode="picture"
          />
        )}

        <View style={styles.debugBadge}>
          <Text style={styles.debugText}>{diagnosticLines.join('\n')}</Text>
        </View>

        {/* LIVE badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {/* Fullscreen expand button (top-right) */}
        <TouchableOpacity style={styles.expandBtn} onPress={() => setIsFullscreen(true)}>
          <Svg width="14" height="14" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </Svg>
        </TouchableOpacity>

        {/* Bottom controls: close + capture */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureButton, (isCapturing || disabled) && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing || disabled}
          >
            {isCapturing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.captureText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // ---- Compact panel ----
  panel: {
    position: 'absolute',
    top: 190,
    right: 16,
    width: 160,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#5c77ff',
    overflow: 'hidden',
    zIndex: 210,
  },
  permissionPanel: {
    padding: 12,
    justifyContent: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.64)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  debugBadge: {
    position: 'absolute',
    top: 38,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.74)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
    zIndex: 12,
  },
  fsDebugBadge: {
    top: 96,
    left: 20,
    right: 20,
  },
  debugText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    gap: 6,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 999,
    paddingVertical: 7,
    alignItems: 'center',
  },
  closeText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '800',
  },
  captureButton: {
    backgroundColor: '#5c77ff',
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.65,
  },
  captureText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  body: {
    color: '#a1a1aa',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#5c77ff',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '800',
  },

  // ---- Fullscreen modal ----
  fsContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fsTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  fsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsZoomRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  fsZoomPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  fsZoomPillActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  fsZoomText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
  },
  fsZoomTextActive: {
    color: '#ffffff',
  },
  fsBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  fsFlipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsShutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fsShutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsShutterDisabled: {
    opacity: 0.5,
  },
});
