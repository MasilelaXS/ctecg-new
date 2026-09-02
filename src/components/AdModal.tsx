import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { Colors } from '../constants/Design';

const MODAL_AD_KEY = 'last_modal_ad_shown';
const MODAL_AD_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CAROUSEL_INTERVAL = 4000; // 4 seconds per slide

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

interface AdModalProps {
  onClose?: () => void;
}

export default function AdModal({ onClose }: AdModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const modalWidth = Math.min(screenWidth * 0.85, 720);
  const modalHeight = Math.min(modalWidth * (4 / 3), screenHeight * 0.75);
  const [ad, setAd] = useState<AdData | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    checkAndShowAd();
  }, []);

  const checkAndShowAd = async () => {
    try {
      // Check if we should show the ad (cooldown)
      const lastShown = await AsyncStorage.getItem(MODAL_AD_KEY);
      if (lastShown) {
        const timeSince = Date.now() - parseInt(lastShown, 10);
        if (timeSince < MODAL_AD_COOLDOWN) {
          setLoading(false);
          return; // Don't show ad yet
        }
      }

      // Load ad
      const response = await apiService.getActiveAd('modal');
      
      if (response.success && response.data) {
        setAd(response.data);
        setVisible(true);
        
        // Track view and update last shown time
        await AsyncStorage.setItem(MODAL_AD_KEY, Date.now().toString());
        if (response.data.id) {
          apiService.trackAdView(response.data.id).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Failed to load modal ad:', error);
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
    
    handleClose();
  };

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-rotate carousel
  useEffect(() => {
    if (visible && ad && ad.images && ad.images.length > 1) {
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
  }, [visible, ad]);

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
      style={[styles.image, { width: modalWidth, height: modalHeight }]}
      resizeMode="contain"
      onError={() => setImageError(true)}
    />
  );

  if (!ad || !visible || imageError) {
    return null;
  }

  // Get images array - fallback to single image_url if no images array
  const images: AdImage[] = ad.images && ad.images.length > 0 
    ? ad.images 
    : [{ id: 0, image_url: ad.image_url, display_order: 0 }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={[styles.container, { width: modalWidth, height: modalHeight }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close-circle" size={32} color={Colors.textInverse} />
          </TouchableOpacity>
          
          {/* Ad Image(s) */}
          <TouchableOpacity
            style={[styles.imageContainer, { height: modalHeight }]}
            onPress={handleAdPress}
            activeOpacity={0.95}
          >
            {loading ? (
              <ActivityIndicator size="large" color={Colors.primary} />
            ) : images.length > 1 ? (
              <FlatList
                key={`ad-modal-${modalWidth}`}
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
                  length: modalWidth,
                  offset: modalWidth * index,
                  index,
                })}
              />
            ) : (
              <Image
                source={{ uri: images[0].image_url }}
                style={[styles.image, { width: modalWidth, height: modalHeight }]}
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            )}
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 10,
    padding: 4,
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  image: {
    backgroundColor: Colors.surface,
  },
});
