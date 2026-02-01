const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

// In-memory tracking store
const trackingStore = new Map();

/**
 * Initialiseer de tracking log - laad bestaande data uit Excel
 */
async function initTrackingLog(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.tracking);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolvedPath);

    const ws = workbook.getWorksheet('Tracking') || workbook.worksheets[0];
    if (!ws) return;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const trackingId = String(row.getCell(1).value || '');
      if (!trackingId) return;

      trackingStore.set(trackingId, {
        trackingId,
        email: String(row.getCell(2).value || ''),
        contactName: String(row.getCell(3).value || ''),
        company: String(row.getCell(4).value || ''),
        campaign: String(row.getCell(5).value || ''),
        subject: String(row.getCell(6).value || ''),
        sentAt: String(row.getCell(7).value || ''),
        opens: parseInt(row.getCell(8).value) || 0,
        firstOpenAt: String(row.getCell(9).value || ''),
        lastOpenAt: String(row.getCell(10).value || ''),
        remindersSent: parseInt(row.getCell(11).value) || 0,
        lastReminderAt: String(row.getCell(12).value || ''),
        status: String(row.getCell(13).value || 'verzonden'),
      });
    });

    console.log(`${trackingStore.size} tracking records geladen uit Excel.`);
  } catch {
    console.log('Geen bestaand tracking bestand gevonden. Start met leeg logboek.');
  }
}

/**
 * Sla een nieuw verzonden email op in tracking
 */
function logEmailSent(data) {
  const record = {
    trackingId: data.trackingId,
    email: data.email,
    contactName: data.contactName || '',
    company: data.company || '',
    campaign: data.campaign || 'default',
    subject: data.subject || '',
    sentAt: new Date().toISOString(),
    opens: 0,
    firstOpenAt: '',
    lastOpenAt: '',
    remindersSent: 0,
    lastReminderAt: '',
    status: 'verzonden',
  };

  trackingStore.set(data.trackingId, record);
  console.log(`Email gelogd: ${data.email} [${data.trackingId}]`);
  return record;
}

/**
 * Registreer een email open event
 */
function logEmailOpen(trackingId) {
  const record = trackingStore.get(trackingId);
  if (!record) {
    console.log(`Onbekend tracking ID: ${trackingId}`);
    return null;
  }

  const now = new Date().toISOString();
  record.opens += 1;
  if (!record.firstOpenAt) {
    record.firstOpenAt = now;
  }
  record.lastOpenAt = now;
  record.status = 'geopend';

  trackingStore.set(trackingId, record);
  console.log(`Email geopend: ${record.email} (${record.opens}x) [${trackingId}]`);
  return record;
}

/**
 * Registreer dat een reminder verstuurd is
 */
function logReminderSent(trackingId) {
  const record = trackingStore.get(trackingId);
  if (!record) return null;

  record.remindersSent += 1;
  record.lastReminderAt = new Date().toISOString();
  record.status = `reminder_${record.remindersSent}`;

  trackingStore.set(trackingId, record);
  return record;
}

/**
 * Haal alle records op
 */
function getAllRecords() {
  return Array.from(trackingStore.values());
}

/**
 * Haal record op per tracking ID
 */
function getRecord(trackingId) {
  return trackingStore.get(trackingId) || null;
}

/**
 * Haal ongeopende emails op die ouder zijn dan X uur
 */
function getUnopenedEmails(afterHours) {
  const hours = afterHours || config.reminders.afterHours;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const maxReminders = config.reminders.maxReminders;

  return getAllRecords().filter((record) => {
    return (
      record.opens === 0 &&
      record.sentAt < cutoff &&
      record.remindersSent < maxReminders
    );
  });
}

/**
 * Sla alle tracking data op naar Excel
 */
async function saveToExcel(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.tracking);
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Tracking');

  // Headers
  ws.columns = [
    { header: 'Tracking ID', key: 'trackingId', width: 40 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Contact', key: 'contactName', width: 20 },
    { header: 'Bedrijf', key: 'company', width: 20 },
    { header: 'Campagne', key: 'campaign', width: 20 },
    { header: 'Onderwerp', key: 'subject', width: 35 },
    { header: 'Verzonden', key: 'sentAt', width: 22 },
    { header: 'Opens', key: 'opens', width: 8 },
    { header: 'Eerste Open', key: 'firstOpenAt', width: 22 },
    { header: 'Laatste Open', key: 'lastOpenAt', width: 22 },
    { header: 'Reminders', key: 'remindersSent', width: 10 },
    { header: 'Laatste Reminder', key: 'lastReminderAt', width: 22 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  // Style header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Data
  const records = getAllRecords();
  records.forEach((record) => {
    const row = ws.addRow(record);
    // Kleur op basis van status
    if (record.opens > 0) {
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' }, // groen
      };
    } else if (record.remindersSent > 0) {
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }, // oranje
      };
    }
  });

  // Samenvatting sheet
  const summary = workbook.addWorksheet('Samenvatting');
  const total = records.length;
  const opened = records.filter((r) => r.opens > 0).length;
  const unopened = records.filter((r) => r.opens === 0).length;
  const totalOpens = records.reduce((sum, r) => sum + r.opens, 0);

  summary.columns = [
    { header: 'Metriek', key: 'metric', width: 25 },
    { header: 'Waarde', key: 'value', width: 15 },
  ];
  summary.getRow(1).font = { bold: true };

  summary.addRow({ metric: 'Totaal verzonden', value: total });
  summary.addRow({ metric: 'Geopend', value: opened });
  summary.addRow({ metric: 'Niet geopend', value: unopened });
  summary.addRow({ metric: 'Open rate', value: total > 0 ? `${((opened / total) * 100).toFixed(1)}%` : '0%' });
  summary.addRow({ metric: 'Totaal opens', value: totalOpens });
  summary.addRow({ metric: 'Gem. opens per email', value: opened > 0 ? (totalOpens / opened).toFixed(1) : '0' });

  await workbook.xlsx.writeFile(resolvedPath);
  console.log(`Tracking log opgeslagen: ${resolvedPath} (${records.length} records)`);
}

/**
 * Print een dashboard naar console
 */
function printDashboard() {
  const records = getAllRecords();
  const total = records.length;
  const opened = records.filter((r) => r.opens > 0).length;
  const unopened = records.filter((r) => r.opens === 0).length;
  const totalOpens = records.reduce((sum, r) => sum + r.opens, 0);

  console.log('\n====================================');
  console.log('   EMAIL TRACKING DASHBOARD');
  console.log('====================================');
  console.log(`Totaal verzonden:    ${total}`);
  console.log(`Geopend:             ${opened}`);
  console.log(`Niet geopend:        ${unopened}`);
  console.log(`Open rate:           ${total > 0 ? ((opened / total) * 100).toFixed(1) : 0}%`);
  console.log(`Totaal opens:        ${totalOpens}`);
  console.log('------------------------------------');

  if (records.length > 0) {
    console.log('\nDetail per email:');
    console.log('-'.repeat(90));
    console.log(
      'Email'.padEnd(30) +
      'Contact'.padEnd(15) +
      'Opens'.padEnd(8) +
      'Status'.padEnd(15) +
      'Verzonden'
    );
    console.log('-'.repeat(90));

    records.forEach((r) => {
      console.log(
        r.email.padEnd(30) +
        r.contactName.substring(0, 14).padEnd(15) +
        String(r.opens).padEnd(8) +
        r.status.padEnd(15) +
        (r.sentAt ? r.sentAt.substring(0, 16) : '')
      );
    });
  }

  console.log('====================================\n');
}

module.exports = {
  initTrackingLog,
  logEmailSent,
  logEmailOpen,
  logReminderSent,
  getAllRecords,
  getRecord,
  getUnopenedEmails,
  saveToExcel,
  printDashboard,
  trackingStore,
};
