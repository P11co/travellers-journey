import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';

const FAKE_CAMERA_ASSET = require('../../screens/ar_map_navigation_animated/screen.png');
const FAKE_CAMERA_MIME_TYPE = 'image/png';

const isFakeCameraEnabled =
  __DEV__ &&
  process.env.EXPO_PUBLIC_FAKE_CAMERA === '1' &&
  Platform.OS === 'ios' &&
  !Device.isDevice;

const readAssetAsBase64 = async (assetModule) => {
  const source = Image.resolveAssetSource(assetModule);
  if (!source?.uri) {
    throw new Error('Fake camera asset URI unavailable');
  }

  const response = await fetch(source.uri);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Fake camera asset read failed'));
    reader.readAsDataURL(blob);
  });
  const [, base64] = String(dataUrl).split(',');
  if (!base64) {
    throw new Error('Fake camera asset base64 unavailable');
  }

  return { base64, uri: source.uri };
};

export default function VisionCameraPanel({
  style,
  onCapture,
  onClose,
  disabled = false,
}) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (isCapturing || disabled) return;
    if (!isFakeCameraEnabled && !cameraRef.current) return;

    setIsCapturing(true);
    try {
      if (isFakeCameraEnabled) {
        const photo = await readAssetAsBase64(FAKE_CAMERA_ASSET);
        await onCapture?.(photo.base64, photo.uri, FAKE_CAMERA_MIME_TYPE);
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.55,
        skipProcessing: true,
      });
      if (photo?.base64) {
        await onCapture?.(photo.base64, photo.uri, 'image/jpeg');
      }
    } catch (error) {
      console.warn('[VisionCameraPanel] Image could not be captured', error);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isFakeCameraEnabled && !permission?.granted) {
    return (
      <View style={[styles.panel, styles.permissionPanel, style]}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>Allow camera access to ask Buddy about what you see.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.panel, style]}>
      {isFakeCameraEnabled ? (
        <Image source={FAKE_CAMERA_ASSET} style={styles.camera} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      )}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>{isFakeCameraEnabled ? 'SIM' : 'LIVE'}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
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
  controls: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    gap: 6,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
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
});
