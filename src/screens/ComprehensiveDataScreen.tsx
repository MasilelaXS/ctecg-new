import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Header from '../components/Header';
import { showToast } from '../components/Toast';
import { apiService } from '../services/api';
import { CustomerData, AzotelInvoice, AzotelMaintenance } from '../types';

export default function ComprehensiveDataScreen() {
  const { user } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'maintenance'>('overview');

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async (isRefresh = false) => {
    if (!user?.invoicingid) return;

    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await apiService.getCustomerData();
      
      if (response.success && response.data) {
        setCustomerData(response.data);
      } else {
        showToast.error('Error', response.message || 'Failed to load customer data');
      }
    } catch (error) {
      console.error('Customer data load error:', error);
      showToast.error('Error', 'Failed to load customer data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `R${num.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'active':
      case 'closed':
        return '#4CAF50';
      case 'unpaid':
      case 'overdue':
      case 'open':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  const renderInvoiceItem = ({ item }: { item: AzotelInvoice }) => (
    <View style={styles.listItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>Invoice #{item.invoiceno}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.paymentstatus) }]}>
          <Text style={styles.statusText}>{item.paymentstatus.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.detailText}>Amount: {formatCurrency(item.amount)}</Text>
        <Text style={styles.detailText}>Invoice Date: {formatDate(item.invoicedate)}</Text>
        {item.paymentdate && (
          <Text style={styles.detailText}>Payment Date: {formatDate(item.paymentdate)}</Text>
        )}
        {item.amountpaid && (
          <Text style={styles.detailText}>Amount Paid: {formatCurrency(item.amountpaid)}</Text>
        )}
      </View>
    </View>
  );

  const renderMaintenanceItem = ({ item }: { item: AzotelMaintenance }) => (
    <View style={styles.listItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>Ticket #{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.detailText}>Type: {item.type}</Text>
        <Text style={styles.detailText}>Scheduled: {formatDate(item.datescheduled)}</Text>
        {item.dateclosed && (
          <Text style={styles.detailText}>Closed: {formatDate(item.dateclosed)}</Text>
        )}
        {item.issuedescreption && (
          <Text style={styles.descriptionText}>{item.issuedescreption}</Text>
        )}
      </View>
    </View>
  );

  const renderOverview = () => {
    if (!customerData) return null;

    const invoicesCount = customerData.invoices.length;
    const maintenanceCount = customerData.maintenance.length;

    return (
      <ScrollView 
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentContainer}
      >
        <Card style={styles.overviewCard}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer ID:</Text>
            <Text style={styles.infoValue}>{customerData.customerId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{customerData.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{customerData.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{customerData.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{customerData.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Package:</Text>
            <Text style={styles.infoValue}>{customerData.package}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: getStatusColor(customerData.status) }]}>
              {customerData.status}
            </Text>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{invoicesCount}</Text>
              <Text style={styles.statLabel}>Recent Invoices</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{maintenanceCount}</Text>
              <Text style={styles.statLabel}>Maintenance Records</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    );
  };

  const renderInvoices = () => {
    if (!customerData) return null;

    const invoices = customerData.invoices;

    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabHeader}>Latest 3 Invoices</Text>
        <FlatList
          data={invoices}
          renderItem={renderInvoiceItem}
          keyExtractor={(item) => item.invoiceid}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderMaintenance = () => {
    if (!customerData) return null;

    const maintenance = customerData.maintenance;

    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabHeader}>Latest 3 Maintenance Records</Text>
        <FlatList
          data={maintenance}
          renderItem={renderMaintenanceItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading customer data..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Customer Data" variant="primary" />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons 
            name="person-outline" 
            size={20} 
            color={activeTab === 'overview' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invoices' && styles.activeTab]}
          onPress={() => setActiveTab('invoices')}
        >
          <Ionicons 
            name="receipt-outline" 
            size={20} 
            color={activeTab === 'invoices' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>
            Invoices
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'maintenance' && styles.activeTab]}
          onPress={() => setActiveTab('maintenance')}
        >
          <Ionicons 
            name="build-outline" 
            size={20} 
            color={activeTab === 'maintenance' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'maintenance' && styles.activeTabText]}>
            Maintenance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'invoices' && renderInvoices()}
        {activeTab === 'maintenance' && renderMaintenance()}
      </View>

      {/* Refresh Control */}
      {isRefreshing && (
        <View style={styles.refreshContainer}>
          <LoadingSpinner message="Refreshing..." />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  tabContentContainer: {
    paddingBottom: Spacing.xl * 2,
  },
  tabHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  overviewCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  statsCard: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    padding: 16,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  timestampCard: {
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  list: {
    flex: 1,
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  itemDetails: {
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  refreshContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 20,
  },
});
