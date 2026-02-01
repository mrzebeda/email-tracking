const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function setup() {
  console.log('\n  === AI Sales Email Tracker - Setup ===\n');

  const dataDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('  Map "data/" aangemaakt.');
  }

  await createPriceTemplate(dataDir);
  await createContactTemplate(dataDir);
  await createTrackingTemplate(dataDir);

  console.log('\n  === Setup voltooid! ===');
  console.log('\n  Volgende stappen:');
  console.log('  1. Vul data/producten.xlsx met je prijsmatrix (CONTINENT | COUNTRY | POD | productprijzen)');
  console.log('  2. Vul data/contacten.xlsx met je klanten (No | Company | Name | Country | POD | ...)');
  console.log('  3. Kopieer .env.example naar .env en vul je Outlook gegevens in');
  console.log('  4. Start de agent met: npm start\n');
}

async function createPriceTemplate(dataDir) {
  const filePath = path.join(dataDir, 'producten.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('  producten.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Prices');

  ws.columns = [
    { header: 'CONTINENT', key: 'continent', width: 16 },
    { header: 'COUNTRY', key: 'country', width: 16 },
    { header: 'POD', key: 'pod', width: 20 },
    { header: 'LLDPE BUTENE\n(Q118N, Q118A)', key: 'lldpe_butene', width: 18 },
    { header: 'LLDPE HEXENE\n(Q6118N)', key: 'lldpe_hex1', width: 18 },
    { header: 'LLDPE HEXENE\n(Q6318)', key: 'lldpe_hex2', width: 18 },
    { header: 'LDPE FRAC MELT\n(QFL007, QFL007A)', key: 'ldpe_frac', width: 20 },
    { header: 'LDPE GENERAL\n(QFL020, QFL020A)', key: 'ldpe_gen', width: 20 },
    { header: 'HDPE BLOW\n(Q5502)', key: 'hdpe_blow', width: 16 },
  ];

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  headerRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  headerRow.height = 35;

  // Voorbeeld data
  const rows = [
    { continent: 'Europe', country: 'Netherlands', pod: 'Rotterdam', lldpe_butene: 957, lldpe_hex1: 979, lldpe_hex2: 1012, ldpe_frac: 1160, ldpe_gen: 1090, hdpe_blow: 1017 },
    { continent: 'Europe', country: 'Spain', pod: 'Barcelona', lldpe_butene: 957, lldpe_hex1: 979, lldpe_hex2: 1012, ldpe_frac: 1160, ldpe_gen: 1090, hdpe_blow: 1017 },
    { continent: 'Asia', country: 'UAE', pod: 'Jebel Ali', lldpe_butene: 1043, lldpe_hex1: 1066, lldpe_hex2: 1099, ldpe_frac: 1246, ldpe_gen: 1176, hdpe_blow: 1103 },
    { continent: 'Asia', country: 'China', pod: 'Hongkong', lldpe_butene: 949, lldpe_hex1: 971, lldpe_hex2: 1004, ldpe_frac: 1151, ldpe_gen: 1081, hdpe_blow: 1009 },
    { continent: 'Africa', country: 'Mozambique', pod: 'Beira', lldpe_butene: 1052, lldpe_hex1: 1074, lldpe_hex2: 1107, ldpe_frac: 1254, ldpe_gen: 1184, hdpe_blow: 1112 },
  ];

  rows.forEach((r) => {
    const row = ws.addRow(r);
    // Formatteer prijzen als valuta
    for (let col = 4; col <= 9; col++) {
      row.getCell(col).numFmt = '$#,##0';
    }
  });

  await workbook.xlsx.writeFile(filePath);
  console.log('  producten.xlsx aangemaakt met voorbeelddata (prijsmatrix).');
}

async function createContactTemplate(dataDir) {
  const filePath = path.join(dataDir, 'contacten.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('  contacten.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Contacts');

  ws.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Company', key: 'company', width: 22 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Country', key: 'country', width: 16 },
    { header: 'POD', key: 'pod', width: 16 },
    { header: 'Continent', key: 'continent', width: 14 },
    { header: 'Incoterms', key: 'incoterms', width: 12 },
    { header: 'E-mail adress', key: 'email', width: 35 },
    { header: 'Email_Sent', key: 'emailSent', width: 12 },
    { header: 'Email_Sent_Date', key: 'emailSentDate', width: 16 },
    { header: 'Email_Status', key: 'emailStatus', width: 14 },
  ];

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };

  // Voorbeeld data
  ws.addRow({ no: 1, company: 'HillPark', name: 'Marvin Zebeda', country: 'Netherlands', pod: 'Rotterdam', continent: 'Europe', incoterms: '80/20', email: 'voorbeeld@bedrijf.nl' });
  ws.addRow({ no: 2, company: 'BigMak Groep', name: 'Nick Saleem', country: 'Spain', pod: 'Barcelona', continent: 'Europe', incoterms: 'CAD', email: 'voorbeeld@bedrijf.nl' });
  ws.addRow({ no: 3, company: 'RF DMCC', name: 'Nick Saleem', country: 'UAE', pod: 'Jebel Ali', continent: 'Asia', incoterms: '80/20', email: 'voorbeeld@bedrijf.nl' });

  await workbook.xlsx.writeFile(filePath);
  console.log('  contacten.xlsx aangemaakt met voorbeelddata.');
}

async function createTrackingTemplate(dataDir) {
  const filePath = path.join(dataDir, 'tracking-log.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('  tracking-log.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Tracking');

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

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  await workbook.xlsx.writeFile(filePath);
  console.log('  tracking-log.xlsx aangemaakt.');
}

setup().catch(console.error);
