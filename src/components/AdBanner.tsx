import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing } from '../constants/Design';

const { width: screenWidth } = Dimensions.get('window');
const BANNER_WIDTH = screenWidth - (Spacing.md * 2);
const CAROUSEL_INTERVAL = 5000; // 5 seconds per slide

interface AdBannerProps {
  placement: 'dashboard_top' | 'dashboard_bottom' | 'usage' | 'billing';
  style?: object;
}

interface AdImage {
  id: number;
  image_url: string;
  display_order: number;
}

interface AdData {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  placement: string;
  images: AdImage[];
}

export default function AdBanner({ placement, style }: AdBannerProps) {
  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadAd();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [placement]);

  // Auto-rotate carousel
  useEffect(() => {
    if (ad && ad.images && ad.images.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % ad.images.length;
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          return nextIndex;
        });
      }, CAROUSEL_INTERVAL);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [ad]);

  const loadAd = async () => {
    try {
      setLoading(true);
      const response = await apiService.getActiveAd(placement);
      
      if (response.success && response.data) {
        setAd(response.data);
        // Track ad view
        if (response.data.id) {
          apiService.trackAdView(response.data.id).catch(console.error);
        }
      } else {
        setAd(null);
      }
    } catch (error) {
      console.error('Failed to load ad:', error);
      setAd(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAdPress = async () => {
    if (!ad) return;
    
    // Track click
    try {
      await apiService.trackAdClick(ad.id);
    } catch (error) {
      console.error('Failed to track ad click:', error);
    }
    
    // Open link
    if (ad.link_url) {
      try {
        await Linking.openURL(ad.link_url);
      } catch (error) {
        console.error('Failed to open ad link:', error);
      }
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderImage = ({ item }: { item: AdImage }) => (
    <Image
      source={{ uri: item.image_url }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setImageError(true)}
    />
  );

  // Don't render anything while loading or if no ad
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!ad || imageError) {
    return null;
  }

  // Get images array - fallback to single image_url if no images array
  const images: AdImage[] = ad.images && ad.images.length > 0 
    ? ad.images 
    : [{ id: 0, image_url: ad.image_url, display_order: 0 }];

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleAdPress}
      activeOpacity={0.9}
    >
      {images.length > 1 ? (
        <>
          <FlatList
            ref={flatListRef}
            data={images}
            renderItem={renderImage}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: BANNER_WIDTH,
              offset: BANNER_WIDTH * index,
              index,
            })}
          />
        </>
      ) : (
        <Image
          source={{ uri: images[0].image_url }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: BANNER_WIDTH,
    height: BANNER_WIDTH * 0.25, // 4:1 ratio
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: BANNER_WIDTH,
    height: BANNER_WIDTH * 0.25,
  },
});
