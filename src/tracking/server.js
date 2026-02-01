const express = require('express');
const config = require('../config');
const { logEmailOpen, saveToExcel, printDashboard, initTrackingLog } = require('../excel/trackingLog');

const app = express();
const PORT = process.env.PORT || 3001;

// 1x1 transparante PNG pixel
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Tracking pixel endpoint
 * Wordt aangeroepen wanneer een email geopend wordt
 */
app.get('/track', (req, res) => {
  const { id, email, campaign, customer, company } = req.query;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Open gedetecteerd: ${email || 'onbekend'} | Campagne: ${campaign || '-'} | ID: ${id || '-'}`);

  // Registreer open event
  if (id) {
    const record = logEmailOpen(id);
    if (record) {
      console.log(`  -> ${record.contactName} (${record.company}) - ${record.opens}x geopend`);
    }

    // Async opslaan naar Excel (niet wachten op response)
    saveToExcel().catch((err) => console.error('Fout bij opslaan Excel:', err.message));
  }

  // Return tracking pixel
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(PIXEL);
});

/**
 * Dashboard API endpoint
 */
app.get('/dashboard', (req, res) => {
  const { getAllRecords } = require('../excel/trackingLog');
  const records = getAllRecords();

  const total = records.length;
  const opened = records.filter((r) => r.opens > 0).length;
  const unopened = records.filter((r) => r.opens === 0).length;
  const totalOpens = records.reduce((sum, r) => sum + r.opens, 0);

  res.json({
    summary: {
      total,
      opened,
      unopened,
      openRate: total > 0 ? ((opened / total) * 100).toFixed(1) + '%' : '0%',
      totalOpens,
    },
    records: records.map((r) => ({
      email: r.email,
      contact: r.contactName,
      company: r.company,
      campaign: r.campaign,
      subject: r.subject,
      sentAt: r.sentAt,
      opens: r.opens,
      firstOpenAt: r.firstOpenAt,
      lastOpenAt: r.lastOpenAt,
      status: r.status,
      remindersSent: r.remindersSent,
    })),
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start de tracking server
 */
async function startServer() {
  await initTrackingLog();

  app.listen(PORT, () => {
    console.log(`\nTracking server draait op http://localhost:${PORT}`);
    console.log(`Tracking pixel URL: http://localhost:${PORT}/track`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
    console.log('');
    printDashboard();
  });
}

// Start als direct uitgevoerd
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
