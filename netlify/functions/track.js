exports.handler = async (event) => {
  const { email, campaign, customer, country, pod } = event.queryStringParameters || {};
  const timestamp = new Date().toISOString();
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('nl-NL');

  const values = [[email || 'unknown', campaign || 'unknown', customer || 'unknown', country || 'unknown', pod || 'unknown', timestamp, date, time]];

  try {
    // Haal token op
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
      })
    });
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Voeg rij toe in Excel
    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/EmailTracking.xlsx:/workbook/tables/TrackingTable/rows/add`;
    await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    console.log('Data sent to Excel via Graph API');
  } catch (error) {
    console.error('Graph API error:', error);
  }

  // Return tracking pixel
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
