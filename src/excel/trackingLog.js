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
        replied: String(row.getCell(11).value || '') === 'true',
        repliedAt: String(row.getCell(12).value || ''),
        replyPreview: String(row.getCell(13).value || ''),
        autoReplied: String(row.getCell(14).value || '') === 'true',
        remindersSent: parseInt(row.getCell(15).value) || 0,
        lastReminderAt: String(row.getCell(16).value || ''),
        status: String(row.getCell(17).value || 'verzonden'),
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
    replied: false,
    repliedAt: '',
    replyPreview: '',
    autoReplied: false,
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

  // Status update: geopend, tenzij al beantwoord
  if (!record.replied) {
    record.status = 'geopend';
  }

  trackingStore.set(trackingId, record);
  console.log(`Email geopend: ${record.email} (${record.opens}x) [${trackingId}]`);
  return record;
}

/**
 * Registreer dat een klant geantwoord heeft
 */
function logReply(email, replyData) {
  // Zoek het tracking record voor dit email adres
  const records = getAllRecords();
  const record = records.find(
    (r) => r.email.toLowerCase() === email.toLowerCase() && !r.replied
  );

  if (!record) {
    // Probeer een record te vinden dat al beantwoord is (meerdere replies)
    const anyRecord = records.find(
      (r) => r.email.toLowerCase() === email.toLowerCase()
    );
    if (anyRecord) {
      anyRecord.repliedAt = new Date().toISOString();
      anyRecord.replyPreview = (replyData.preview || '').substring(0, 200);
      trackingStore.set(anyRecord.trackingId, anyRecord);
      return anyRecord;
    }
    return null;
  }

  record.replied = true;
  record.repliedAt = new Date().toISOString();
  record.replyPreview = (replyData.preview || '').substring(0, 200);
  record.status = 'beantwoord';

  trackingStore.set(record.trackingId, record);
  console.log(`Reply gelogd: ${email} [${record.trackingId}]`);
  return record;
}

/**
 * Registreer dat er automatisch is gereageerd op een reply
 */
function logAutoReply(trackingId) {
  const record = trackingStore.get(trackingId);
  if (!record) return null;

  record.autoReplied = true;
  record.status = 'auto-beantwoord';
  trackingStore.set(trackingId, record);
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
  const hours = afterHours || config.reminders.unopenedAfterHours;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const maxReminders = config.reminders.maxReminders;

  return getAllRecords().filter((record) => {
    return (
      record.opens === 0 &&
      !record.replied &&
      record.sentAt < cutoff &&
      record.remindersSent < maxReminders
    );
  });
}

/**
 * Haal emails op die geopend zijn maar niet beantwoord, ouder dan X uur na eerste open
 */
function getOpenedNotRepliedEmails(afterHours) {
  const hours = afterHours || config.reminders.openedNoReplyAfterHours;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const maxReminders = config.reminders.maxReminders;

  return getAllRecords().filter((record) => {
    return (
      record.opens > 0 &&
      !record.replied &&
      record.firstOpenAt &&
      record.firstOpenAt < cutoff &&
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
    { header: 'Beantwoord', key: 'replied', width: 12 },
    { header: 'Beantwoord Op', key: 'repliedAt', width: 22 },
    { header: 'Reply Preview', key: 'replyPreview', width: 40 },
    { header: 'Auto-Reply', key: 'autoReplied', width: 12 },
    { header: 'Reminders', key: 'remindersSent', width: 10 },
    { header: 'Laatste Reminder', key: 'lastReminderAt', width: 22 },
    { header: 'Status', key: 'status', width: 18 },
  ];

  // Style header row
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };

  // Data
  const records = getAllRecords();
  records.forEach((record) => {
    const row = ws.addRow(record);
    // Kleur op basis van status
    if (record.replied) {
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }, // blauw - beantwoord
      };
    } else if (record.opens > 0) {
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' }, // groen - geopend
      };
    } else if (record.remindersSent > 0) {
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }, // oranje - reminder
      };
    }
  });

  // Samenvatting sheet
  const summary = workbook.addWorksheet('Samenvatting');
  const total = records.length;
  const opened = records.filter((r) => r.opens > 0).length;
  const unopened = records.filter((r) => r.opens === 0).length;
  const replied = records.filter((r) => r.replied).length;
  const openedNotReplied = records.filter((r) => r.opens > 0 && !r.replied).length;
  const totalOpens = records.reduce((sum, r) => sum + r.opens, 0);

  summary.columns = [
    { header: 'Metriek', key: 'metric', width: 30 },
    { header: 'Waarde', key: 'value', width: 15 },
  ];
  summary.getRow(1).font = { bold: true };

  summary.addRow({ metric: 'Totaal verzonden', value: total });
  summary.addRow({ metric: 'Geopend', value: opened });
  summary.addRow({ metric: 'Niet geopend', value: unopened });
  summary.addRow({ metric: 'Open rate', value: total > 0 ? `${((opened / total) * 100).toFixed(1)}%` : '0%' });
  summary.addRow({ metric: 'Beantwoord', value: replied });
  summary.addRow({ metric: 'Reply rate', value: total > 0 ? `${((replied / total) * 100).toFixed(1)}%` : '0%' });
  summary.addRow({ metric: 'Geopend, niet beantwoord', value: openedNotReplied });
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
  const replied = records.filter((r) => r.replied).length;
  const openedNotReplied = records.filter((r) => r.opens > 0 && !r.replied).length;
  const totalOpens = records.reduce((sum, r) => sum + r.opens, 0);

  console.log('\n====================================');
  console.log('   EMAIL TRACKING DASHBOARD');
  console.log('====================================');
  console.log(`Totaal verzonden:        ${total}`);
  console.log(`Geopend:                 ${opened}`);
  console.log(`Niet geopend:            ${unopened}`);
  console.log(`Open rate:               ${total > 0 ? ((opened / total) * 100).toFixed(1) : 0}%`);
  console.log(`Beantwoord:              ${replied}`);
  console.log(`Reply rate:              ${total > 0 ? ((replied / total) * 100).toFixed(1) : 0}%`);
  console.log(`Geopend, niet beantw.:   ${openedNotReplied}`);
  console.log(`Totaal opens:            ${totalOpens}`);
  console.log('------------------------------------');

  if (records.length > 0) {
    console.log('\nDetail per email:');
    console.log('-'.repeat(105));
    console.log(
      'Email'.padEnd(28) +
      'Contact'.padEnd(14) +
      'Opens'.padEnd(7) +
      'Reply'.padEnd(7) +
      'Status'.padEnd(18) +
      'Verzonden'
    );
    console.log('-'.repeat(105));

    records.forEach((r) => {
      console.log(
        r.email.substring(0, 27).padEnd(28) +
        r.contactName.substring(0, 13).padEnd(14) +
        String(r.opens).padEnd(7) +
        (r.replied ? 'Ja' : '-').padEnd(7) +
        r.status.substring(0, 17).padEnd(18) +
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
  logReply,
  logAutoReply,
  logReminderSent,
  getAllRecords,
  getRecord,
  getUnopenedEmails,
  getOpenedNotRepliedEmails,
  saveToExcel,
  printDashboard,
  trackingStore,
};
