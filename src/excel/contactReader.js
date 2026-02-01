const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

/**
 * Leest contacten/leads uit de Excel sheet.
 * Verwacht kolommen: Naam | Email | Bedrijf | Functie | Notities
 */
async function readContacts(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.contacts);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch (err) {
    console.error(`Kan contacten bestand niet lezen: ${resolvedPath}`);
    console.error('Tip: Voer eerst "npm run setup" uit om template bestanden aan te maken.');
    throw err;
  }

  const worksheet = workbook.getWorksheet('Contacten') || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Geen worksheet gevonden in contacten bestand.');
  }

  const contacts = [];
  const headerRow = worksheet.getRow(1);
  const headers = {};

  headerRow.eachCell((cell, colNumber) => {
    const val = (cell.value || '').toString().toLowerCase().trim();
    if (val.includes('naam') || val.includes('name')) headers.name = colNumber;
    if (val.includes('email') || val.includes('e-mail')) headers.email = colNumber;
    if (val.includes('bedrijf') || val.includes('company')) headers.company = colNumber;
    if (val.includes('functie') || val.includes('title') || val.includes('rol')) headers.title = colNumber;
    if (val.includes('branche') || val.includes('industry') || val.includes('sector')) headers.industry = colNumber;
    if (val.includes('notitie') || val.includes('notes') || val.includes('opmerking')) headers.notes = colNumber;
    if (val.includes('land') || val.includes('country')) headers.country = colNumber;
    if (val.includes('taal') || val.includes('language')) headers.language = colNumber;
  });

  // Fallback
  if (!headers.name) headers.name = 1;
  if (!headers.email) headers.email = 2;
  if (!headers.company) headers.company = 3;
  if (!headers.title) headers.title = 4;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const email = row.getCell(headers.email).value;
    if (!email) return;

    contacts.push({
      name: String(row.getCell(headers.name).value || '').trim(),
      email: String(email).toString().trim().toLowerCase(),
      company: String(row.getCell(headers.company || 3).value || '').trim(),
      title: String(row.getCell(headers.title || 4).value || '').trim(),
      industry: String(row.getCell(headers.industry || 5).value || '').trim(),
      notes: String(row.getCell(headers.notes || 6).value || '').trim(),
      country: String(row.getCell(headers.country || 7).value || 'NL').trim(),
      language: String(row.getCell(headers.language || 8).value || 'nl').trim(),
    });
  });

  console.log(`${contacts.length} contacten geladen uit ${resolvedPath}`);
  return contacts;
}

module.exports = { readContacts };
