/**
 * Volledige test suite voor de AI Sales Email Agent
 * Test alle onderdelen zonder daadwerkelijk emails te versturen
 */
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   AI SALES EMAIL AGENT - VOLLEDIGE TEST      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── TEST 1: Modules laden ──────────────────────────
  console.log('── Test 1: Alle modules laden ──');
  let config, productReader, contactReader, trackingLog, templateGenerator, sender, replyMonitor, autoResponder, reminderService;

  try {
    config = require('./src/config');
    assert('config.js laden', true);
  } catch (e) { assert('config.js laden: ' + e.message, false); }

  try {
    productReader = require('./src/excel/productReader');
    assert('productReader.js laden', true);
  } catch (e) { assert('productReader.js laden: ' + e.message, false); }

  try {
    contactReader = require('./src/excel/contactReader');
    assert('contactReader.js laden', true);
  } catch (e) { assert('contactReader.js laden: ' + e.message, false); }

  try {
    trackingLog = require('./src/excel/trackingLog');
    assert('trackingLog.js laden', true);
  } catch (e) { assert('trackingLog.js laden: ' + e.message, false); }

  try {
    templateGenerator = require('./src/email/templateGenerator');
    assert('templateGenerator.js laden', true);
  } catch (e) { assert('templateGenerator.js laden: ' + e.message, false); }

  try {
    sender = require('./src/email/sender');
    assert('sender.js laden', true);
  } catch (e) { assert('sender.js laden: ' + e.message, false); }

  try {
    replyMonitor = require('./src/email/replyMonitor');
    assert('replyMonitor.js laden', true);
  } catch (e) { assert('replyMonitor.js laden: ' + e.message, false); }

  try {
    autoResponder = require('./src/email/autoResponder');
    assert('autoResponder.js laden', true);
  } catch (e) { assert('autoResponder.js laden: ' + e.message, false); }

  try {
    reminderService = require('./src/reminder/reminderService');
    assert('reminderService.js laden', true);
  } catch (e) { assert('reminderService.js laden: ' + e.message, false); }

  // ── TEST 2: Config ──────────────────────────────────
  console.log('\n── Test 2: Configuratie ──');
  assert('IMAP host ingesteld', config.imap.host === 'outlook.office365.com');
  assert('IMAP port = 993', config.imap.port === 993);
  assert('SMTP host ingesteld', config.smtp.host === 'smtp.office365.com');
  assert('Reminder ongeopend = 48u', config.reminders.unopenedAfterHours === 48);
  assert('Reminder geopend-geen-reply = 72u', config.reminders.openedNoReplyAfterHours === 72);
  assert('Max reminders = 2', config.reminders.maxReminders === 2);
  assert('canMonitorInbox() functie bestaat', typeof require('./src/config').canMonitorInbox === 'function');

  // ── TEST 3: Prijsmatrix ──────────────────────────────
  console.log('\n── Test 3: Prijsmatrix laden en lookup ──');
  let priceMatrix;
  try {
    priceMatrix = await productReader.readPriceMatrix('./data/producten.xlsx');
    assert('Prijsmatrix geladen', true);
    assert('6 producten', priceMatrix.productNames.length === 6);
    assert('5 POD regels', priceMatrix.rows.length === 5);

    // Exact POD match
    const p1 = productReader.lookupPricesForContact(priceMatrix, { country: 'Netherlands', pod: 'Rotterdam', continent: 'Europe' });
    assert('Exact POD match (Rotterdam)', p1 !== null && p1.pod === 'Rotterdam');

    // Country fallback
    const p2 = productReader.lookupPricesForContact(priceMatrix, { country: 'Netherlands', pod: 'Amsterdam', continent: 'Europe' });
    assert('Country fallback (Amsterdam→Rotterdam)', p2 !== null && p2.pod === 'Rotterdam');

    // Geen match
    const p3 = productReader.lookupPricesForContact(priceMatrix, { country: 'Brazil', pod: 'Santos', continent: 'South America' });
    assert('Geen match retourneert null', p3 === null);

    // Prijs formatting
    assert('formatPrice(1035) = $1,035', productReader.formatPrice(1035) === '$1,035');
    assert('formatPrice(0) = -', productReader.formatPrice(0) === '-');

    // Summary
    const s = productReader.summarizePriceMatrix(priceMatrix);
    assert('Summary correct', s.products === 6 && s.pods === 5);
  } catch (e) {
    assert('Prijsmatrix laden: ' + e.message, false);
  }

  // ── TEST 4: Contacten ──────────────────────────────
  console.log('\n── Test 4: Contacten laden ──');
  let contacts;
  try {
    contacts = await contactReader.readContacts('./data/contacten.xlsx');
    assert('Contacten geladen', true);
    assert('3 contacten', contacts.length === 3);

    const c = contacts[0];
    assert('Veld: no', c.no !== undefined);
    assert('Veld: company', c.company !== undefined);
    assert('Veld: name', c.name !== undefined);
    assert('Veld: country', c.country !== undefined);
    assert('Veld: pod', c.pod !== undefined);
    assert('Veld: email', c.email && c.email.includes('@'));
    assert('Veld: emailOpened (nieuw)', c.emailOpened !== undefined);
    assert('Veld: emailOpenedDate (nieuw)', c.emailOpenedDate !== undefined);
    assert('Veld: emailReplied (nieuw)', c.emailReplied !== undefined);
    assert('Veld: emailRepliedDate (nieuw)', c.emailRepliedDate !== undefined);
    assert('_row voor writeback', typeof c._row === 'number');
    assert('_headers voor writeback', typeof c._headers === 'object');
  } catch (e) {
    assert('Contacten laden: ' + e.message, false);
  }

  // ── TEST 5: Email generatie ──────────────────────────
  console.log('\n── Test 5: Email generatie (fallback template) ──');
  try {
    const contact = contacts[0];
    const pricing = productReader.lookupPricesForContact(priceMatrix, contact);

    const email = templateGenerator.generateFallbackEmail(contact, pricing);
    assert('Onderwerp gegenereerd', email.subject && email.subject.length > 5);
    assert('Body gegenereerd', email.body && email.body.length > 50);
    assert('HTML body gegenereerd', email.bodyHtml && email.bodyHtml.includes('<'));
    assert('Bedrijfsnaam in email', email.body.includes(contact.name) || email.bodyHtml.includes(contact.name));
    assert('POD in email', email.body.includes(contact.pod) || email.subject.includes(contact.pod));
    assert('Prijzen in email', email.body.includes('$'));

    console.log('    Onderwerp: ' + email.subject);
  } catch (e) {
    assert('Email generatie: ' + e.message, false);
  }

  // ── TEST 6: Tracking pixel ──────────────────────────
  console.log('\n── Test 6: Tracking pixel injectie ──');
  try {
    const html = '<html><body><p>Test</p></body></html>';
    const result = sender.injectTrackingPixel(html, 'track-123', contacts[0], 'test');
    assert('Pixel ingevoegd', result.includes('width="1"') && result.includes('height="1"'));
    assert('Tracking ID in URL', result.includes('track-123'));
    assert('Voor </body> tag', result.indexOf('width="1"') < result.indexOf('</body>'));
  } catch (e) {
    assert('Tracking pixel: ' + e.message, false);
  }

  // ── TEST 7: Tracking log ──────────────────────────
  console.log('\n── Test 7: Tracking log (send → open → reply flow) ──');
  try {
    await trackingLog.initTrackingLog();

    // Stuur 4 simulatie-emails
    trackingLog.logEmailSent({ trackingId: 'sim-1', email: 'alice@test.com', contactName: 'Alice', company: 'AliceCo', subject: 'Offer 1', campaign: 'test' });
    trackingLog.logEmailSent({ trackingId: 'sim-2', email: 'bob@test.com', contactName: 'Bob', company: 'BobCo', subject: 'Offer 2', campaign: 'test' });
    trackingLog.logEmailSent({ trackingId: 'sim-3', email: 'charlie@test.com', contactName: 'Charlie', company: 'CharlieCo', subject: 'Offer 3', campaign: 'test' });
    trackingLog.logEmailSent({ trackingId: 'sim-4', email: 'diana@test.com', contactName: 'Diana', company: 'DianaCo', subject: 'Offer 4', campaign: 'test' });

    assert('4 emails gelogd', trackingLog.getAllRecords().length === 4);

    // Open sim-2 en sim-3
    const openResult = trackingLog.logEmailOpen('sim-2');
    assert('Open event gelogd', openResult && openResult.opens === 1);
    assert('Status → geopend', openResult.status === 'geopend');

    trackingLog.logEmailOpen('sim-3');
    trackingLog.logEmailOpen('sim-3'); // 2e keer openen
    const r3 = trackingLog.getRecord('sim-3');
    assert('Meerdere opens geteld', r3.opens === 2);
    assert('firstOpenAt ingesteld', r3.firstOpenAt !== '');
    assert('lastOpenAt ingesteld', r3.lastOpenAt !== '');

    // Reply op sim-3
    const replyResult = trackingLog.logReply('charlie@test.com', { preview: 'Interested in LLDPE pricing' });
    assert('Reply gelogd', replyResult && replyResult.replied === true);
    assert('Status → beantwoord', replyResult.status === 'beantwoord');
    assert('Reply preview opgeslagen', replyResult.replyPreview.includes('Interested'));

    // Auto-reply loggen
    trackingLog.logAutoReply('sim-3');
    const r3b = trackingLog.getRecord('sim-3');
    assert('Auto-reply gelogd', r3b.autoReplied === true);

    // Reminder loggen
    trackingLog.logReminderSent('sim-1');
    const r1 = trackingLog.getRecord('sim-1');
    assert('Reminder gelogd', r1.remindersSent === 1);
    assert('Reminder datum ingesteld', r1.lastReminderAt !== '');

    // Onbekend tracking ID
    const unknown = trackingLog.logEmailOpen('onbekend-id');
    assert('Onbekend ID retourneert null', unknown === null);
  } catch (e) {
    assert('Tracking log: ' + e.message, false);
  }

  // ── TEST 8: Reminder filtering ──────────────────────
  console.log('\n── Test 8: Reminder filtering (ongeopend + geopend-niet-beantwoord) ──');
  try {
    // Maak alle records oud genoeg
    const records = trackingLog.getAllRecords();
    const oldDate = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(); // 96u geleden
    records.forEach(r => {
      r.sentAt = oldDate;
      if (r.firstOpenAt) r.firstOpenAt = oldDate;
    });

    const unopened = trackingLog.getUnopenedEmails();
    // sim-1 heeft 1 reminder gehad, maxReminders=2, dus mag nog 1 krijgen
    // sim-4 (diana) heeft 0 reminders, beide staan in de lijst
    assert('Ongeopende emails: sim-1 (Alice) + sim-4 (Diana)',
      unopened.length === 2 && unopened.some(r => r.email === 'alice@test.com') && unopened.some(r => r.email === 'diana@test.com'));

    const openedNotReplied = trackingLog.getOpenedNotRepliedEmails();
    assert('Geopend niet beantwoord: sim-2 (Bob)',
      openedNotReplied.length === 1 && openedNotReplied[0].email === 'bob@test.com');

    // sim-3 (Charlie) is beantwoord, moet NIET in de lijst staan
    assert('Beantwoord (Charlie) niet in reminder lijst',
      !openedNotReplied.find(r => r.email === 'charlie@test.com'));

    console.log('    Ongeopend:          ' + unopened.map(r => r.email).join(', '));
    console.log('    Geopend, no reply:  ' + openedNotReplied.map(r => r.email).join(', '));
  } catch (e) {
    assert('Reminder filtering: ' + e.message, false);
  }

  // ── TEST 9: Excel opslaan en teruglezen ──────────────
  console.log('\n── Test 9: Tracking log Excel opslaan en teruglezen ──');
  try {
    await trackingLog.saveToExcel('./data/tracking-log.xlsx');
    assert('Excel opgeslagen', true);

    // Maak een nieuwe store en lees terug
    trackingLog.trackingStore.clear();
    assert('Store geleegd', trackingLog.getAllRecords().length === 0);

    await trackingLog.initTrackingLog('./data/tracking-log.xlsx');
    const reloaded = trackingLog.getAllRecords();
    assert('Records teruggelezen uit Excel', reloaded.length === 4);

    const charlie = reloaded.find(r => r.email === 'charlie@test.com');
    assert('Reply status bewaard in Excel', charlie && charlie.replied === true);
    assert('Reply preview bewaard', charlie && charlie.replyPreview.includes('Interested'));
    assert('Opens bewaard', charlie && charlie.opens === 2);
  } catch (e) {
    assert('Excel opslaan/lezen: ' + e.message, false);
  }

  // ── TEST 10: Contact Excel writeback ──────────────────
  console.log('\n── Test 10: Contact status writeback naar Excel ──');
  try {
    // Herlaad contacten
    const freshContacts = await contactReader.readContacts('./data/contacten.xlsx');
    const contact = freshContacts[0];

    // Markeer als verstuurd
    await contactReader.updateContactStatus(contact, 'Sent');

    // Lees terug
    const afterSent = await contactReader.readContacts('./data/contacten.xlsx');
    const updated = afterSent[0];
    assert('Email_Sent = Yes', updated.emailSent === 'Yes');
    assert('Email_Sent_Date ingevuld', updated.emailSentDate !== '');
    assert('Email_Status = Sent', updated.emailStatus === 'Sent');

    // Markeer als geopend
    await contactReader.updateContactOpened(afterSent[0]);
    const afterOpen = await contactReader.readContacts('./data/contacten.xlsx');
    assert('Email_Opened = Yes', afterOpen[0].emailOpened === 'Yes');
    assert('Email_Opened_Date ingevuld', afterOpen[0].emailOpenedDate !== '');
    assert('Email_Status = Opened', afterOpen[0].emailStatus === 'Opened');

    // Markeer als beantwoord
    await contactReader.updateContactReplied(afterOpen[0]);
    const afterReply = await contactReader.readContacts('./data/contacten.xlsx');
    assert('Email_Replied = Yes', afterReply[0].emailReplied === 'Yes');
    assert('Email_Replied_Date ingevuld', afterReply[0].emailRepliedDate !== '');
    assert('Email_Status = Replied', afterReply[0].emailStatus === 'Replied');

    console.log('    Excel flow: Sent → Opened → Replied');
  } catch (e) {
    assert('Contact writeback: ' + e.message, false);
  }

  // ── TEST 11: Auto-responder (fallback) ──────────────
  console.log('\n── Test 11: Auto-responder (fallback template) ──');
  try {
    const reply = {
      from: 'customer@example.com',
      fromName: 'John Smith',
      subject: 'Re: PE Resin Price Offer C&F Rotterdam',
      textContent: 'We are interested in the LLDPE pricing. What are your payment terms?',
      contact: contacts[0],
    };

    const autoReply = autoResponder.generateFallbackAutoReply(reply);
    assert('Auto-reply subject gegenereerd', autoReply.subject.includes('Re:'));
    assert('Auto-reply body gegenereerd', autoReply.body.length > 30);
    assert('HTML body gegenereerd', autoReply.bodyHtml.includes('<'));
    // Fallback template gebruikt contact.name (uit contacts Excel) boven fromName
    const expectedName = contacts[0].name || 'John Smith';
    assert('Naam in reply', autoReply.body.includes(expectedName));

    console.log('    Subject: ' + autoReply.subject);
  } catch (e) {
    assert('Auto-responder: ' + e.message, false);
  }

  // ── TEST 12: Tracking server ──────────────────────────
  console.log('\n── Test 12: Tracking server (Express) ──');
  try {
    const { app } = require('./src/tracking/server');

    // Simuleer een tracking pixel request
    const http = require('http');
    const server = app.listen(0); // random port
    const port = server.address().port;

    const result = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/track?id=sim-2&email=bob@test.com&campaign=test`, (res) => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'] });
      }).on('error', reject);
    });

    assert('Tracking pixel HTTP 200', result.status === 200);
    assert('Content-Type = image/png', result.contentType === 'image/png');

    // Health check
    const health = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
    assert('Health endpoint OK', health.status === 200);

    server.close();
  } catch (e) {
    assert('Tracking server: ' + e.message, false);
  }

  // ── TEST 13: Dashboard ──────────────────────────────
  console.log('\n── Test 13: Dashboard output ──');
  try {
    console.log('');
    trackingLog.printDashboard();
    assert('Dashboard draait zonder errors', true);
  } catch (e) {
    assert('Dashboard: ' + e.message, false);
  }

  // ── RESULTATEN ──────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║   RESULTAAT: ${passed} PASSED / ${failed} FAILED` + ' '.repeat(Math.max(0, 26 - String(passed).length - String(failed).length)) + '║');
  console.log('╚══════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n  Er zijn ' + failed + ' test(s) gefaald.');
    process.exit(1);
  } else {
    console.log('\n  Alle tests geslaagd! Het systeem werkt correct.\n');
  }
}

runTests().catch(err => {
  console.error('\nFatale fout bij tests:', err);
  process.exit(1);
});
