const config = require('../config');
const { getUnopenedEmails, logReminderSent, getAllRecords } = require('../excel/trackingLog');
const { generateReminderEmail } = require('../email/templateGenerator');
const { sendTrackedEmail } = require('../email/sender');

/**
 * Controleer en verstuur reminders voor ongeopende emails
 */
async function processReminders(contacts, products) {
  const unopened = getUnopenedEmails();

  if (unopened.length === 0) {
    console.log('Geen ongeopende emails gevonden die een reminder nodig hebben.');
    return { sent: 0, failed: 0, skipped: 0 };
  }

  console.log(`\n${unopened.length} ongeopende email(s) gevonden voor reminder.`);

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const record of unopened) {
    // Zoek het originele contact
    const contact = contacts.find((c) => c.email === record.email);
    if (!contact) {
      console.log(`Contact niet gevonden voor ${record.email}, overslaan.`);
      results.skipped++;
      continue;
    }

    const reminderNumber = record.remindersSent + 1;
    console.log(`\nReminder #${reminderNumber} voorbereiden voor ${contact.name} (${contact.email})...`);

    try {
      // Genereer reminder email
      const emailContent = await generateReminderEmail(
        contact,
        products,
        record.subject,
        reminderNumber
      );

      // Verstuur
      const result = await sendTrackedEmail(contact, emailContent, {
        campaign: `${record.campaign}_reminder${reminderNumber}`,
        trackingId: `${record.trackingId}_r${reminderNumber}`,
      });

      if (result.success) {
        logReminderSent(record.trackingId);
        console.log(`Reminder verstuurd naar ${contact.email}`);
        results.sent++;
      } else {
        console.error(`Reminder mislukt voor ${contact.email}: ${result.error}`);
        results.failed++;
      }
    } catch (error) {
      console.error(`Fout bij reminder voor ${contact.email}:`, error.message);
      results.failed++;
    }

    // Korte pauze tussen emails (rate limiting)
    await sleep(2000);
  }

  console.log(`\nReminder resultaten: ${results.sent} verstuurd, ${results.failed} mislukt, ${results.skipped} overgeslagen.`);
  return results;
}

/**
 * Toon overzicht van emails die een reminder nodig hebben
 */
function showReminderCandidates() {
  const unopened = getUnopenedEmails();

  if (unopened.length === 0) {
    console.log('\nGeen emails die een reminder nodig hebben.');
    return [];
  }

  console.log(`\n${unopened.length} email(s) die een reminder nodig hebben:`);
  console.log('-'.repeat(80));

  unopened.forEach((r) => {
    const hoursSince = Math.round(
      (Date.now() - new Date(r.sentAt).getTime()) / (1000 * 60 * 60)
    );
    console.log(
      `  ${r.email.padEnd(30)} | ${r.contactName.padEnd(15)} | ` +
      `${hoursSince}u geleden | Reminders: ${r.remindersSent}/${config.reminders.maxReminders}`
    );
  });

  return unopened;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { processReminders, showReminderCandidates };
