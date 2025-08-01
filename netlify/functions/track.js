// netlify/functions/track.js
// STAP 1: Vervang ALLES in je huidige track.js met deze code

exports.handler = async (event, context) => {
  const { email, campaign, source } = event.queryStringParameters || {};
  const userAgent = event.headers['user-agent'] || '';
  const timestamp = new Date().toISOString();
  
  // STAP 2: Log lokaal (backup - blijft werken)
  console.log(`Email opened: ${email}, Campaign: ${campaign}, Time: ${timestamp}`);
  
  // STAP 3: Verstuur tracking data naar n8n webhook
  if (email && campaign) {
    try {
      // STAP 4: VERVANG DEZE URL MET JE ECHTE N8N WEBHOOK URL
      const n8nWebhookUrl = 'https://mrzebeda.app.n8n.cloud/webhook-test/email-tracking';
      
      const trackingData = {
        email: email,
        campaign: campaign,
        source: source || 'email',
        timestamp: timestamp,
        userAgent: userAgent,
        action: 'email_opened',
        // Extra data
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('nl-NL')
      };
      
      // STAP 5: Verstuur data naar n8n
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trackingData)
      });
      
      if (response.ok) {
        console.log('Data successfully sent to n8n');
      } else {
        console.error('n8n webhook failed with status:', response.status);
      }
      
    } catch (error) {
      console.error('n8n webhook error:', error);
      // Tracking pixel blijft werken ook als webhook faalt
    }
  }
  
  // STAP 6: Return tracking pixel (ongewijzigd)
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    },
    body: pixel.toString('base64'),
    isBase64Encoded: true
  };
};
