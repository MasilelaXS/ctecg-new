// Test script to check the dashboard API endpoint
const API_BASE_URL = 'https://app.ctecg.co.za/api';

async function testDashboardAPI() {
  console.log('Testing Dashboard API Endpoint...');
  console.log('URL:', `${API_BASE_URL}/mobile-api.php?endpoint=dashboard`);
  
  try {
    // Test without authentication first
    console.log('\n--- Testing without authentication ---');
    const response = await fetch(`${API_BASE_URL}/mobile-api.php?endpoint=dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Raw Response (first 1000 chars):', responseText.substring(0, 1000));
    
    try {
      const jsonData = JSON.parse(responseText);
      console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
    } catch (parseError) {
      console.log('Response is not valid JSON');
    }

  } catch (error) {
    console.error('Request failed:', error);
  }
}

// For Node.js environment, we need to use node-fetch or similar
// But since this is a web API test, we'll use the browser's fetch
testDashboardAPI();
