// Test script for the updated dashboard email handling
const testEmailFormatting = () => {
  console.log('Testing email formatting...');
  
  // Test cases based on the API response
  const testCases = [
    // New API structure
    {
      input: {
        primary_email: "maseko2812@gmail.com",
        email_count: 2,
        all_emails: ["maseko2812@gmail.com", "maseko965@gmail.com"],
        display_text: "maseko2812@gmail.com (+1 more)",
        has_email: true
      },
      expected: "New API format with multiple emails"
    },
    // Legacy string format
    {
      input: "maseko2812@gmail.com,maseko965@gmail.com",
      expected: "Legacy comma-separated format"
    },
    // Single email string
    {
      input: "single@example.com",
      expected: "Single email string"
    },
    // Empty/null cases
    {
      input: null,
      expected: "Null email"
    },
    {
      input: "",
      expected: "Empty string"
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.expected}`);
    console.log('Input:', testCase.input);
    
    // Here you would call: apiService.formatEmailForDisplay(testCase.input)
    // For now, just log the input structure
  });
};

testEmailFormatting();
