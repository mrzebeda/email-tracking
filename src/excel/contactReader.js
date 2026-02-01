const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

/**
 * Leest klanten uit de Excel sheet.
 * Verwacht kolommen: No | Company | Name | Country | POD | Continent | Incoterms | E-mail adress | Email_Sent | Email_Sent_Date | Email_Status
 */
async function readContacts(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.contacts);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch (err) {
    console.error(`  Kan contacten bestand niet lezen: ${resolvedPath}`);
    throw err;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Geen worksheet gevonden in contacten bestand.');
  }

  const contacts = [];
  const headerRow = worksheet.getRow(1);
  const headers = {};

  headerRow.eachCell((cell, colNumber) => {
    const val = (cell.value || '').toString().toLowerCase().trim();
    if (val === 'no' || val === '#') headers.no = colNumber;
    if (val.includes('company') || val.includes('bedrijf')) headers.company = colNumber;
    if (val.includes('name') || val.includes('naam')) headers.name = colNumber;
    if (val.includes('country') || val.includes('land')) headers.country = colNumber;
    if (val === 'pod') headers.pod = colNumber;
    if (val.includes('continent')) headers.continent = colNumber;
    if (val.includes('incoterms') || val.includes('inco')) headers.incoterms = colNumber;
    if (val === 'email_sent') headers.emailSent = colNumber;
    else if (val === 'email_sent_date') headers.emailSentDate = colNumber;
    else if (val === 'email_opened') headers.emailOpened = colNumber;
    else if (val === 'email_opened_date') headers.emailOpenedDate = colNumber;
    else if (val === 'email_replied') headers.emailReplied = colNumber;
    else if (val === 'email_replied_date') headers.emailRepliedDate = colNumber;
    else if (val === 'email_status') headers.emailStatus = colNumber;
    else if (val.includes('e-mail') || val.includes('email')) headers.email = colNumber;
  });

  // Fallback posities
  if (!headers.no) headers.no = 1;
  if (!headers.company) headers.company = 2;
  if (!headers.name) headers.name = 3;
  if (!headers.country) headers.country = 4;
  if (!headers.pod) headers.pod = 5;
  if (!headers.continent) headers.continent = 6;
  if (!headers.incoterms) headers.incoterms = 7;
  if (!headers.email) headers.email = 8;
  if (!headers.emailSent) headers.emailSent = 9;
  if (!headers.emailSentDate) headers.emailSentDate = 10;
  if (!headers.emailOpened) headers.emailOpened = 11;
  if (!headers.emailOpenedDate) headers.emailOpenedDate = 12;
  if (!headers.emailReplied) headers.emailReplied = 13;
  if (!headers.emailRepliedDate) headers.emailRepliedDate = 14;
  if (!headers.emailStatus) headers.emailStatus = 15;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const email = row.getCell(headers.email).value;
    if (!email) return;

    const emailStr = String(
      typeof email === 'object' && email.text ? email.text : email
    ).trim().toLowerCase();
    if (!emailStr || !emailStr.includes('@')) return;

    contacts.push({
      no: parseInt(row.getCell(headers.no).value) || rowNumber - 1,
      company: String(row.getCell(headers.company).value || '').trim(),
      name: String(row.getCell(headers.name).value || '').trim(),
      country: String(row.getCell(headers.country).value || '').trim(),
      pod: String(row.getCell(headers.pod).value || '').trim(),
      continent: String(row.getCell(headers.continent).value || '').trim(),
      incoterms: String(row.getCell(headers.incoterms).value || '').trim(),
      email: emailStr,
      emailSent: String(row.getCell(headers.emailSent).value || '').trim(),
      emailSentDate: String(row.getCell(headers.emailSentDate).value || '').trim(),
      emailOpened: String(row.getCell(headers.emailOpened).value || '').trim(),
      emailOpenedDate: String(row.getCell(headers.emailOpenedDate).value || '').trim(),
      emailReplied: String(row.getCell(headers.emailReplied).value || '').trim(),
      emailRepliedDate: String(row.getCell(headers.emailRepliedDate).value || '').trim(),
      emailStatus: String(row.getCell(headers.emailStatus).value || '').trim(),
      // Bewaar rij en kolom info voor terugschrijven
      _row: rowNumber,
      _headers: headers,
    });
  });

  console.log(`  ${contacts.length} contacten geladen uit ${resolvedPath}`);
  return contacts;
}

/**
 * Werk de Email_Sent, Email_Sent_Date en Email_Status kolommen bij in het contacten Excel
 */
async function updateContactStatus(contact, status) {
  const resolvedPath = path.resolve(config.files.contacts);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch {
    return; // bestand niet leesbaar, skip
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || !contact._row) return;

  const row = worksheet.getRow(contact._row);
  row.getCell(contact._headers.emailSent).value = 'Yes';
  row.getCell(contact._headers.emailSentDate).value = new Date().toISOString().split('T')[0];
  row.getCell(contact._headers.emailStatus).value = status || 'Sent';
  row.commit();

  await workbook.xlsx.writeFile(resolvedPath);
}

/**
 * Markeer dat een email geopend is in het contacten Excel
 */
async function updateContactOpened(contact) {
  const resolvedPath = path.resolve(config.files.contacts);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch {
    return;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || !contact._row) return;

  const row = worksheet.getRow(contact._row);

  // Alleen bijwerken als nog niet gemarkeerd
  const current = String(row.getCell(contact._headers.emailOpened).value || '').trim().toLowerCase();
  if (current === 'yes') return;

  row.getCell(contact._headers.emailOpened).value = 'Yes';
  row.getCell(contact._headers.emailOpenedDate).value = new Date().toISOString().split('T')[0];
  row.getCell(contact._headers.emailStatus).value = 'Opened';
  row.commit();

  await workbook.xlsx.writeFile(resolvedPath);
}

/**
 * Markeer dat een klant geantwoord heeft in het contacten Excel
 */
async function updateContactReplied(contact) {
  const resolvedPath = path.resolve(config.files.contacts);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch {
    return;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || !contact._row) return;

  const row = worksheet.getRow(contact._row);
  row.getCell(contact._headers.emailReplied).value = 'Yes';
  row.getCell(contact._headers.emailRepliedDate).value = new Date().toISOString().split('T')[0];
  row.getCell(contact._headers.emailStatus).value = 'Replied';
  row.commit();

  await workbook.xlsx.writeFile(resolvedPath);
}

module.exports = { readContacts, updateContactStatus, updateContactOpened, updateContactReplied };
