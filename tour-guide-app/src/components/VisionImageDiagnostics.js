import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';

const DIAG_VERSION = 'v4-file-uri';

/**
 * Dev-only diagnostic overlay for vision image previews.
 * Attach to any user message that has attachmentType === 'image'.
 *
 * Shows:
 *   - preview URI prefix + length
 *   - MIME type
 *   - FileSystem.getInfoAsync result (exists, size)
 *   - Image.getSize result (width x height or error)
 *   - onLoad native dimensions
 *   - onLayout rendered dimensions
 *   - a standalone <Image> render outside the bubble to rule out clipping
 *   - bundle version label to confirm freshness
 */
export default function VisionImageDiagnostics({
  uri,
  mimeType,
  messageId,
}) {
  const [fsInfo, setFsInfo] = useState(null);
  const [fsError, setFsError] = useState(null);
  const [getSizeResult, setGetSizeResult] = useState(null);
  const [getSizeError, setGetSizeError] = useState(null);
  const [onLoadResult, setOnLoadResult] = useState(null);
  const [onLoadError, setOnLoadError] = useState(null);
  const [layoutResult, setLayoutResult] = useState(null);
  const [loadStartFired, setLoadStartFired] = useState(false);
  const [loadEndFired, setLoadEndFired] = useState(false);

  const uriPrefix = uri ? String(uri).slice(0, 90) : '(null)';
  const uriLength = uri ? String(uri).length : 0;
  const isDataUri = uri ? String(uri).startsWith('data:') : false;
  const isFileUri = uri ? String(uri).startsWith('file://') : false;

  // Probe FileSystem for file URIs
  useEffect(() => {
    if (!uri || isDataUri) {
      setFsInfo({ skipped: true, reason: isDataUri ? 'data URI' : 'no URI' });
      return;
    }

    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        setFsInfo(info);
      } catch (error) {
        setFsError(error?.message || String(error));
      }
    })();
  }, [uri]);

  // Probe Image.getSize
  useEffect(() => {
    if (!uri) return;

    Image.getSize(
      uri,
      (width, height) => {
        setGetSizeResult({ width, height });
      },
      (error) => {
        setGetSizeError(error?.message || String(error));
      },
    );
  }, [uri]);

  const handleOnLoadStart = () => {
    setLoadStartFired(true);
  };

  const handleOnLoad = (event) => {
    const source = event?.nativeEvent?.source || event?.nativeEvent || {};
    setOnLoadResult({
      width: source.width,
      height: source.height,
      uri: source.uri ? String(source.uri).slice(0, 60) : undefined,
    });
  };

  const handleOnError = (event) => {
    setOnLoadError(event?.nativeEvent?.error || 'onError fired (no detail)');
  };

  const handleOnLoadEnd = () => {
    setLoadEndFired(true);
  };

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayoutResult({ width: Math.round(width), height: Math.round(height) });
  };

  const line = (label, value) => (
    <Text key={label} style={diagStyles.line}>
      <Text style={diagStyles.label}>{label}: </Text>
      <Text style={diagStyles.value}>{String(value ?? '—')}</Text>
    </Text>
  );

  return (
    <View style={diagStyles.container}>
      <Text style={diagStyles.header}>🔬 Image Diag ({DIAG_VERSION})</Text>

      {line('msg_id', messageId)}
      {line('uri_type', isDataUri ? 'data URI' : isFileUri ? 'file URI' : 'other')}
      {line('uri_prefix', uriPrefix)}
      {line('uri_length', uriLength)}
      {line('mime', mimeType)}

      <Text style={diagStyles.section}>FileSystem</Text>
      {fsError
        ? line('fs_error', fsError)
        : fsInfo?.skipped
          ? line('fs_skipped', fsInfo.reason)
          : fsInfo
            ? (
              <>
                {line('fs_exists', String(fsInfo.exists))}
                {line('fs_size', fsInfo.size != null ? `${fsInfo.size} bytes` : '—')}
                {line('fs_isDir', String(fsInfo.isDirectory ?? '—'))}
                {line('fs_uri', fsInfo.uri ? String(fsInfo.uri).slice(0, 70) : '—')}
              </>
            )
            : line('fs_status', 'probing...')}

      <Text style={diagStyles.section}>Image.getSize</Text>
      {getSizeError
        ? line('getSize_error', getSizeError)
        : getSizeResult
          ? line('getSize', `${getSizeResult.width} x ${getSizeResult.height}`)
          : line('getSize', 'probing...')}

      <Text style={diagStyles.section}>Image callbacks</Text>
      {line('onLoadStart', String(loadStartFired))}
      {onLoadResult
        ? (
          <>
            {line('onLoad', `${onLoadResult.width} x ${onLoadResult.height}`)}
            {onLoadResult.uri && line('onLoad_uri', onLoadResult.uri)}
          </>
        )
        : line('onLoad', '(not yet)')}
      {onLoadError && line('onError', onLoadError)}
      {line('onLoadEnd', String(loadEndFired))}
      {layoutResult
        ? line('onLayout', `${layoutResult.width} x ${layoutResult.height}`)
        : line('onLayout', '(not yet)')}

      {/* Standalone render test — outside any blue bubble */}
      <Text style={diagStyles.section}>Standalone render test</Text>
      {uri ? (
        <View style={diagStyles.standaloneContainer}>
          <Image
            source={{ uri }}
            style={diagStyles.standaloneImage}
            resizeMode="contain"
            onLoadStart={handleOnLoadStart}
            onLoad={handleOnLoad}
            onError={handleOnError}
            onLoadEnd={handleOnLoadEnd}
            onLayout={handleLayout}
          />
        </View>
      ) : (
        <Text style={diagStyles.value}>No URI to render</Text>
      )}
    </View>
  );
}

const diagStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#facc15',
    maxWidth: '100%',
  },
  header: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  section: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  line: {
    marginBottom: 2,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  value: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Courier',
  },
  standaloneContainer: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
  },
  standaloneImage: {
    width: 200,
    height: 150,
    borderRadius: 6,
  },
});
