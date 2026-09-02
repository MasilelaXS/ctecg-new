import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

interface StevieMascotProps {
  width?: number;
  decorative?: boolean;
  style?: StyleProp<ImageStyle>;
}

const STEVIE_ASPECT_RATIO = 2 / 3;

export default function StevieMascot({
  width = 88,
  decorative = false,
  style,
}: StevieMascotProps) {
  return (
    <Image
      source={require('../../assets/Stevie-Mascot.png')}
      style={[
        {
          width,
          height: width / STEVIE_ASPECT_RATIO,
        },
        style,
      ]}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : 'Stevie, the CTECG mascot'}
    />
  );
}
