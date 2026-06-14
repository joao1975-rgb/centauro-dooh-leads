const tokens = [
  "EAAMTSb17yPQBQfw1LrsVhN7rs7FfL0Bn6nvJB1QSR4ZCgii1ZBrvlBtZBJ3pkYV0KaFulPtZBUpxeOpiCOdQP9LiS0FIQJPeL7rG70YkIr3LzoFemSbXziYmFxjMzD2yw7rje3dIyqlvEUL5TSZCZCP9gCgUZBbqYFunBrrzBBuPjDkYKxGZADdMkggPg6lB",
  "EAAMTSb17yPQBQQH4RPQp4bWVHKFPHd6n0NS3iIS2M3kkBiy26wUpt8ZAuWfBIgZClHXYByznKiBzhzVnsE6UtGsuONvXDZC5dhU6ujZBQre9E7CLgrfEGX2L68jHBygQYPlOHo5zK5NLEYIPZA3IFWlCtxWIsOP9skeDczVXp1vwszOcbJZCNGZBa7xq9pa87gW"
];

async function verify() {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    console.log(`\n--- Testing Token ${i + 1} (${token.substring(0, 15)}...) ---`);
    
    try {
      // 1. Get User Info
      let res = await fetch("https://graph.facebook.com/v21.0/me?fields=id,name", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      let data = await res.json();
      console.log("User Info:", JSON.stringify(data, null, 2));

      if (res.ok) {
        // 2. Get WhatsApp Business Accounts
        res = await fetch("https://graph.facebook.com/v21.0/me/whatsapp_business_accounts", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        data = await res.json();
        console.log("WhatsApp Business Accounts:", JSON.stringify(data, null, 2));
        
        // If there are business accounts, let's query their phone numbers
        if (data.data && data.data.length > 0) {
          for (const waba of data.data) {
            console.log(`\nQuerying phone numbers for WABA: ${waba.id} (${waba.name})...`);
            res = await fetch(`https://graph.facebook.com/v21.0/${waba.id}/phone_numbers`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            const phoneData = await res.json();
            console.log("Phone Numbers:", JSON.stringify(phoneData, null, 2));
          }
        }
      }
    } catch (e) {
      console.error("Fetch error:", e.message);
    }
  }
}

verify();
