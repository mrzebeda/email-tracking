/**
 * Netlify Serverless Function - Email Tracking Pixel
 *
 * Wordt aangeroepen wanneer een email geopend wordt.
 * Registreert de open event en retourneert een onzichtbare 1x1 pixel.
 *
 * Query parameters:
 *   - id:       unieke tracking ID per email
 *   - email:    email adres van de ontvanger
 *   - campaign: campagne naam
 *   - customer: naam van het contact
 *   - company:  bedrijfsnaam
 *   - country:  land
 *   - pod:      team/pod identifier
 *
 * Backends:
 *   1. Microsoft Graph API -> Excel Online (als Azure credentials geconfigureerd)
 *   2. Webhook naar externe service (als WEBHOOK_URL geconfigureerd)
 */
exports.handler = async (event) => {
  const { id, email, campaign, customer, company, country, pod } = event.queryStringParameters || {};

  const timestamp = new Date().toISOString();
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('nl-NL');

  console.log(`[${timestamp}] Email geopend: ${email || 'onbekend'} | Campagne: ${campaign || '-'} | ID: ${id || '-'} | Bedrijf: ${company || '-'}`);

  // --- Backend 1: Microsoft Graph API (Excel Online) ---
  if (process.env.TENANT_ID && process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
    try {
      const values = [[
        id || '',
        email || 'unknown',
        customer || 'unknown',
        company || '',
        campaign || 'unknown',
        country || pod || 'unknown',
        timestamp,
        date,
        time,
      ]];

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: 'https://graph.microsoft.com/.default',
          }),
        }
      );
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const excelFile = process.env.EXCEL_FILE || 'test%20data%20v1.xlsx';
      const tableName = process.env.EXCEL_TABLE || 'TrackingTable';
      const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${excelFile}:/workbook/tables/${tableName}/rows/add`;

      await fetch(graphUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      console.log('Data opgeslagen in Excel via Graph API');
    } catch (error) {
      console.error('Graph API fout:', error.message || error);
    }
  }

  // --- Backend 2: Webhook (n8n, Zapier, Make, etc.) ---
  if (process.env.WEBHOOK_URL) {
    try {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingId: id,
          email,
          campaign,
          customer,
          company,
          country,
          timestamp,
          date,
          time,
          event: 'email_opened',
        }),
      });
      console.log('Webhook notificatie verstuurd');
    } catch (error) {
      console.error('Webhook fout:', error.message || error);
    }
  }

  // Return tracking pixel (1x1 transparante PNG)
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    },
    body: pixel.toString('base64'),
    isBase64Encoded: true,
  };
};
