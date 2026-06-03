import React, { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { backendImageSource } from '../utils/assetUrls';

export default function RemoteImage({
  sourcePath,
  style,
  resizeMode = 'cover',
  placeholderStyle,
  ...props
}) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => backendImageSource(sourcePath), [sourcePath]);

  useEffect(() => {
    setFailed(false);
  }, [sourcePath]);

  if (!source || failed) {
    return (
      <View
        style={[style, { backgroundColor: '#242833' }, placeholderStyle]}
        {...props}
      />
    );
  }

  return (
    <Image
      {...props}
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={(event) => {
        setFailed(true);
        props.onError?.(event);
      }}
    />
  );
}
