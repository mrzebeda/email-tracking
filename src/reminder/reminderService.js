const config = require('../config');
const { getUnopenedEmails, getOpenedNotRepliedEmails, logReminderSent, getAllRecords } = require('../excel/trackingLog');
const { generateReminderEmail } = require('../email/templateGenerator');
const { sendTrackedEmail } = require('../email/sender');
const { lookupPricesForContact } = require('../excel/productReader');

/**
 * Verwerk alle reminders:
 * 1. Ongeopende emails (na X uur)
 * 2. Geopende maar niet beantwoorde emails (na X uur na eerste open)
 */
async function processReminders(contacts, priceMatrix) {
  const unopened = getUnopenedEmails();
  const openedNotReplied = getOpenedNotRepliedEmails();

  if (unopened.length === 0 && openedNotReplied.length === 0) {
    console.log('  Geen emails gevonden die een reminder nodig hebben.');
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const results = { sent: 0, failed: 0, skipped: 0 };

  // Verwerk ongeopende emails
  if (unopened.length > 0) {
    console.log(`\n  ${unopened.length} ongeopende email(s) - reminder na ${config.reminders.unopenedAfterHours}u:`);
    await sendRemindersForRecords(unopened, contacts, priceMatrix, results, 'niet geopend');
  }

  // Verwerk geopende maar niet beantwoorde emails
  if (openedNotReplied.length > 0) {
    console.log(`\n  ${openedNotReplied.length} geopend maar niet beantwoord - reminder na ${config.reminders.openedNoReplyAfterHours}u:`);
    await sendRemindersForRecords(openedNotReplied, contacts, priceMatrix, results, 'geopend, geen reply');
  }

  console.log(`\n  Reminder resultaten: ${results.sent} verstuurd, ${results.failed} mislukt, ${results.skipped} overgeslagen.`);
  return results;
}

/**
 * Verstuur reminders voor een lijst tracking records
 */
async function sendRemindersForRecords(records, contacts, priceMatrix, results, reason) {
  for (const record of records) {
    const contact = contacts.find((c) => c.email === record.email);
    if (!contact) {
      console.log(`    Contact niet gevonden voor ${record.email}, overslaan.`);
      results.skipped++;
      continue;
    }

    const reminderNumber = record.remindersSent + 1;
    console.log(`    Reminder #${reminderNumber} voor ${contact.name} (${reason})...`);

    try {
      const pricing = priceMatrix ? lookupPricesForContact(priceMatrix, contact) : null;

      const emailContent = await generateReminderEmail(
        contact,
        pricing,
        record.subject,
        reminderNumber
      );

      const result = await sendTrackedEmail(contact, emailContent, {
        campaign: `${record.campaign}_reminder${reminderNumber}`,
        trackingId: `${record.trackingId}_r${reminderNumber}`,
      });

      if (result.success) {
        logReminderSent(record.trackingId);
        console.log(`    -> Verstuurd naar ${contact.email}`);
        results.sent++;
      } else {
        console.error(`    -> Mislukt: ${result.error}`);
        results.failed++;
      }
    } catch (error) {
      console.error(`    -> Fout: ${error.message}`);
      results.failed++;
    }

    await sleep(2000);
  }
}

/**
 * Toon overzicht van emails die een reminder nodig hebben
 */
function showReminderCandidates() {
  const unopened = getUnopenedEmails();
  const openedNotReplied = getOpenedNotRepliedEmails();

  if (unopened.length === 0 && openedNotReplied.length === 0) {
    console.log('\n  Geen emails die een reminder nodig hebben.');
    return [];
  }

  const all = [];

  if (unopened.length > 0) {
    console.log(`\n  ONGEOPEND (reminder na ${config.reminders.unopenedAfterHours}u):`);
    console.log('  ' + '-'.repeat(85));

    unopened.forEach((r) => {
      const hoursSince = Math.round(
        (Date.now() - new Date(r.sentAt).getTime()) / (1000 * 60 * 60)
      );
      console.log(
        `    ${r.email.padEnd(28)} | ${r.contactName.padEnd(14)} | ` +
        `${hoursSince}u geleden | Reminders: ${r.remindersSent}/${config.reminders.maxReminders}`
      );
      all.push({ ...r, reason: 'ongeopend' });
    });
  }

  if (openedNotReplied.length > 0) {
    console.log(`\n  GEOPEND MAAR NIET BEANTWOORD (reminder na ${config.reminders.openedNoReplyAfterHours}u):`);
    console.log('  ' + '-'.repeat(85));

    openedNotReplied.forEach((r) => {
      const hoursSinceOpen = Math.round(
        (Date.now() - new Date(r.firstOpenAt).getTime()) / (1000 * 60 * 60)
      );
      console.log(
        `    ${r.email.padEnd(28)} | ${r.contactName.padEnd(14)} | ` +
        `${r.opens}x geopend | ${hoursSinceOpen}u sinds open | Reminders: ${r.remindersSent}/${config.reminders.maxReminders}`
      );
      all.push({ ...r, reason: 'geopend, geen reply' });
    });
  }

  return all;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { processReminders, showReminderCandidates };
