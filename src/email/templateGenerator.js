const OpenAI = require('openai');
const config = require('../config');
const { formatPrice } = require('../excel/productReader');

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/**
 * Genereer een gepersonaliseerde sales email met AI
 */
async function generateSalesEmail(contact, products, options = {}) {
  const {
    campaign = 'introductie',
    tone = 'professioneel maar vriendelijk',
    language = contact.language || 'nl',
  } = options;

  const productList = products
    .map((p) => `- ${p.name} (${formatPrice(p.price)}): ${p.description}`)
    .join('\n');

  const prompt = `Je bent een ervaren sales professional voor ${config.company.name}.
${config.company.description}

Schrijf een gepersonaliseerde sales email naar de volgende persoon:
- Naam: ${contact.name}
- Bedrijf: ${contact.company}
- Functie: ${contact.title}
- Branche: ${contact.industry}
${contact.notes ? `- Extra info: ${contact.notes}` : ''}

De email moet de volgende producten/diensten promoten:
${productList}

Vereisten:
- Taal: ${language === 'nl' ? 'Nederlands' : 'Engels'}
- Toon: ${tone}
- Campagne type: ${campaign}
- Afzender: ${config.company.salesPerson}, ${config.company.salesTitle}
- Houd de email kort en krachtig (max 200 woorden)
- Maak het persoonlijk en relevant voor hun branche/functie
- Eindig met een duidelijke call-to-action
- Geen overdreven verkooppraatjes
- Wees specifiek over ten minste 1-2 producten die relevant zijn voor deze persoon

Geef het resultaat in dit exacte JSON formaat:
{
  "subject": "het email onderwerp",
  "body": "de volledige email tekst in plain text",
  "bodyHtml": "de email in HTML formaat met nette opmaak"
}

Geef ALLEEN de JSON terug, geen andere tekst.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = response.choices[0].message.content.trim();

  // Parse JSON uit response (strip eventuele markdown code blocks)
  let jsonStr = content;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error('Kon AI response niet parsen als JSON:', content);
    // Fallback template
    return generateFallbackEmail(contact, products, language);
  }
}

/**
 * Genereer een reminder email met AI
 */
async function generateReminderEmail(contact, products, originalSubject, reminderNumber, options = {}) {
  const language = options.language || contact.language || 'nl';

  const prompt = `Je bent een ervaren sales professional voor ${config.company.name}.

Schrijf een korte follow-up/reminder email. Dit is reminder #${reminderNumber}.
Het originele onderwerp was: "${originalSubject}"

Ontvanger:
- Naam: ${contact.name}
- Bedrijf: ${contact.company}
- Functie: ${contact.title}

Vereisten:
- Taal: ${language === 'nl' ? 'Nederlands' : 'Engels'}
- Houd het kort (max 100 woorden)
- Refereer kort naar de eerdere email
- ${reminderNumber === 1 ? 'Wees vriendelijk en begripvol dat ze druk zijn' : 'Laatste follow-up, bied aan om te helpen of te stoppen met mailen'}
- Afzender: ${config.company.salesPerson}, ${config.company.salesTitle}

Geef het resultaat in dit exacte JSON formaat:
{
  "subject": "Re: het email onderwerp",
  "body": "de email tekst in plain text",
  "bodyHtml": "de email in HTML formaat"
}

Geef ALLEEN de JSON terug.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
  });

  const content = response.choices[0].message.content.trim();
  let jsonStr = content;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      subject: `Re: ${originalSubject}`,
      body: `Beste ${contact.name},\n\nIk wilde even opvolgen op mijn eerdere email. Heeft u interesse om hierover te praten?\n\nMet vriendelijke groet,\n${config.company.salesPerson}`,
      bodyHtml: `<p>Beste ${contact.name},</p><p>Ik wilde even opvolgen op mijn eerdere email. Heeft u interesse om hierover te praten?</p><p>Met vriendelijke groet,<br>${config.company.salesPerson}</p>`,
    };
  }
}

/**
 * Fallback template als AI niet beschikbaar is
 */
function generateFallbackEmail(contact, products, language) {
  const productLines = products
    .slice(0, 3)
    .map((p) => `<li><strong>${p.name}</strong> - ${formatPrice(p.price)}: ${p.description}</li>`)
    .join('');

  const name = contact.name || 'heer/mevrouw';

  if (language === 'nl') {
    return {
      subject: `${config.company.name} - Interessante oplossingen voor ${contact.company || 'uw bedrijf'}`,
      body: `Beste ${name},\n\nGraag stel ik u voor aan ${config.company.name}. ${config.company.description}\n\nWij bieden onder andere:\n${products.slice(0, 3).map((p) => `- ${p.name} (${formatPrice(p.price)})`).join('\n')}\n\nZou u openstaan voor een kort gesprek?\n\nMet vriendelijke groet,\n${config.company.salesPerson}\n${config.company.salesTitle}`,
      bodyHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Beste ${name},</p>
          <p>Graag stel ik u voor aan <strong>${config.company.name}</strong>. ${config.company.description}</p>
          <p>Wij bieden onder andere:</p>
          <ul>${productLines}</ul>
          <p>Zou u openstaan voor een kort gesprek om te bespreken hoe wij ${contact.company || 'uw bedrijf'} kunnen helpen?</p>
          <p>Met vriendelijke groet,<br>
          <strong>${config.company.salesPerson}</strong><br>
          ${config.company.salesTitle}<br>
          ${config.company.name}</p>
        </div>`,
    };
  }

  return {
    subject: `${config.company.name} - Solutions for ${contact.company || 'your business'}`,
    body: `Dear ${name},\n\nI'd like to introduce ${config.company.name}. ${config.company.description}\n\nWe offer:\n${products.slice(0, 3).map((p) => `- ${p.name} (${formatPrice(p.price)})`).join('\n')}\n\nWould you be open to a brief conversation?\n\nBest regards,\n${config.company.salesPerson}\n${config.company.salesTitle}`,
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Dear ${name},</p>
        <p>I'd like to introduce <strong>${config.company.name}</strong>. ${config.company.description}</p>
        <p>We offer:</p>
        <ul>${productLines}</ul>
        <p>Would you be open to a brief conversation about how we can help ${contact.company || 'your business'}?</p>
        <p>Best regards,<br>
        <strong>${config.company.salesPerson}</strong><br>
        ${config.company.salesTitle}<br>
        ${config.company.name}</p>
      </div>`,
  };
}

module.exports = { generateSalesEmail, generateReminderEmail, generateFallbackEmail };
