const token = "EAAQAAAYEAx3tEjvxQjnW6JNmFV79eratKbw5ELSGWj3E10ysLmD8HZdanc2CD";

async function verify() {
  console.log(`\n--- Testing Token 3 (${token.substring(0, 15)}...) ---`);
  
  try {
    let res = await fetch("https://graph.facebook.com/v21.0/me?fields=id,name", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    let data = await res.json();
    console.log("User Info:", JSON.stringify(data, null, 2));

    if (res.ok) {
      res = await fetch("https://graph.facebook.com/v21.0/me/whatsapp_business_accounts", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      data = await res.json();
      console.log("WhatsApp Business Accounts:", JSON.stringify(data, null, 2));
      
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

verify();
