const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const config = require('../config');
const { getAllRecords } = require('../excel/trackingLog');

/**
 * Verbind met IMAP inbox en zoek replies van klanten.
 * Matcht op basis van email-adres en onderwerp (Re: ...).
 */
async function checkForReplies(contacts) {
  if (!config.imap.user || !config.imap.pass) {
    console.log('  IMAP niet geconfigureerd. Vul IMAP_HOST, IMAP_USER en IMAP_PASS in .env');
    return [];
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: true,
    auth: {
      user: config.imap.user,
      pass: config.imap.pass,
    },
    logger: false,
  });

  const replies = [];

  try {
    await client.connect();
    console.log('  Verbonden met inbox...');

    // Open INBOX
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Haal alle tracking records op om te weten welke emails we gestuurd hebben
      const trackingRecords = getAllRecords();
      if (trackingRecords.length === 0) {
        console.log('  Geen verstuurde emails om te matchen.');
        return [];
      }

      // Verzamel alle email-adressen van contacten die we gemaild hebben
      const sentEmails = new Set(trackingRecords.map((r) => r.email.toLowerCase()));

      // Zoek recente emails (afgelopen 7 dagen)
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const messages = client.fetch(
        { since, answered: false },
        {
          envelope: true,
          source: true,
          uid: true,
        }
      );

      for await (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source);
          const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase();

          if (!fromAddress || !sentEmails.has(fromAddress)) continue;

          // Check of dit een reply is op een van onze emails
          const subject = (parsed.subject || '').toLowerCase();
          const isReply = subject.startsWith('re:') || subject.startsWith('fw:') || subject.startsWith('fwd:');

          // Zoek het bijbehorende tracking record
          const matchedRecord = trackingRecords.find(
            (r) => r.email.toLowerCase() === fromAddress
          );

          // Zoek het bijbehorende contact
          const matchedContact = contacts.find(
            (c) => c.email.toLowerCase() === fromAddress
          );

          if (matchedRecord || matchedContact) {
            replies.push({
              uid: msg.uid,
              from: fromAddress,
              fromName: parsed.from?.value?.[0]?.name || '',
              subject: parsed.subject || '',
              date: parsed.date || new Date(),
              textContent: (parsed.text || '').substring(0, 2000),
              htmlContent: parsed.html || '',
              isReply,
              trackingRecord: matchedRecord || null,
              contact: matchedContact || null,
              messageId: parsed.messageId || '',
              inReplyTo: parsed.inReplyTo || '',
            });
          }
        } catch {
          // Skip berichten die niet geparsed kunnen worden
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error) {
    console.error(`  IMAP fout: ${error.message}`);
    try { await client.logout(); } catch { /* ignore */ }
    throw error;
  }

  return replies;
}

/**
 * Test de IMAP verbinding
 */
async function testImapConnection() {
  if (!config.imap.user || !config.imap.pass) {
    console.log('  IMAP niet geconfigureerd.');
    return false;
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: true,
    auth: {
      user: config.imap.user,
      pass: config.imap.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log('  IMAP verbinding succesvol!');

    // Toon inbox info
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, unseen: true });
      console.log(`  Inbox: ${status.messages} berichten, ${status.unseen} ongelezen`);
    } finally {
      lock.release();
    }

    await client.logout();
    return true;
  } catch (error) {
    console.error(`  IMAP verbinding mislukt: ${error.message}`);
    try { await client.logout(); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Toon gevonden replies overzichtelijk
 */
function printReplies(replies) {
  if (replies.length === 0) {
    console.log('\n  Geen nieuwe replies gevonden.');
    return;
  }

  console.log(`\n  ${replies.length} reply(s) gevonden:`);
  console.log('  ' + '-'.repeat(80));

  replies.forEach((r, i) => {
    const date = r.date instanceof Date ? r.date.toISOString().substring(0, 16) : '';
    const company = r.contact?.company || '';
    console.log(`  ${i + 1}. ${r.fromName || r.from}`);
    console.log(`     Bedrijf:  ${company}`);
    console.log(`     Onderwerp: ${r.subject}`);
    console.log(`     Datum:    ${date}`);

    // Toon begin van het bericht
    const preview = r.textContent.split('\n')
      .filter((line) => line.trim())
      .slice(0, 3)
      .map((line) => `     > ${line.substring(0, 70)}`)
      .join('\n');
    if (preview) console.log(preview);
    console.log('  ' + '-'.repeat(80));
  });
}

module.exports = { checkForReplies, testImapConnection, printReplies };
