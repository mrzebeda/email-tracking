const OpenAI = require('openai');
const config = require('../config');
const { sendTrackedEmail } = require('./sender');

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/**
 * Genereer een AI-antwoord op een klant reply.
 * Analyseert de inhoud van de klant-reply en genereert een passend antwoord.
 */
async function generateAutoReply(reply, pricing) {
  if (!config.openai.apiKey) {
    return generateFallbackAutoReply(reply);
  }

  const priceContext = pricing
    ? pricing.productNames.map((n) => `${n}: $${pricing.prices[n]}/MT`).join(', ')
    : 'prijzen op aanvraag';

  const prompt = `You are a sales professional for ${config.company.name}, a polyethylene resin distribution company.
${config.company.description}

A customer has replied to your sales email. Generate an appropriate response.

Customer info:
- Name: ${reply.contact?.name || reply.fromName || 'Customer'}
- Company: ${reply.contact?.company || ''}
- Country: ${reply.contact?.country || ''}
- Port: ${reply.contact?.pod || ''}

Our original email subject: ${reply.trackingRecord?.subject || reply.subject}
Customer's reply:
---
${reply.textContent.substring(0, 1500)}
---

Current pricing: ${priceContext}

Requirements:
- Write in English (professional B2B tone)
- Respond directly to what the customer is asking or saying
- If they ask about prices, confirm or provide updated prices
- If they want to order, explain next steps (proforma invoice, payment terms, delivery schedule)
- If they ask a question you can't answer, say you'll check and get back to them
- Sender: ${config.company.salesPerson}, ${config.company.salesTitle} at ${config.company.name}
- Keep it concise (max 150 words)
- Be helpful and professional

Return ONLY valid JSON:
{
  "subject": "Re: subject",
  "body": "plain text reply",
  "bodyHtml": "HTML reply"
}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 800,
  });

  const content = response.choices[0].message.content.trim();
  let jsonStr = content;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return generateFallbackAutoReply(reply);
  }
}

/**
 * Fallback reply wanneer OpenAI niet beschikbaar is
 */
function generateFallbackAutoReply(reply) {
  const name = reply.contact?.name || reply.fromName || 'Sir/Madam';
  const subject = `Re: ${reply.subject}`;

  const body = `Dear ${name},

Thank you for your reply. I appreciate your interest.

I have received your message and will review it carefully. I will get back to you shortly with a detailed response.

If you have any urgent questions, please don't hesitate to reach out.

Best regards,
${config.company.salesPerson}
${config.company.salesTitle}
${config.company.name}`;

  const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;">
  <p>Dear ${name},</p>
  <p>Thank you for your reply. I appreciate your interest.</p>
  <p>I have received your message and will review it carefully. I will get back to you shortly with a detailed response.</p>
  <p>If you have any urgent questions, please don't hesitate to reach out.</p>
  <p>Best regards,<br>
  <strong>${config.company.salesPerson}</strong><br>
  ${config.company.salesTitle}<br>
  ${config.company.name}</p>
</div>`;

  return { subject, body, bodyHtml };
}

/**
 * Verwerk een reply: genereer antwoord en verstuur.
 */
async function processAutoReply(reply, pricing) {
  const contact = reply.contact || {
    email: reply.from,
    name: reply.fromName || reply.from,
    company: '',
    country: '',
    pod: '',
  };

  console.log(`  Auto-reply genereren voor ${contact.name} (${contact.email})...`);

  const emailContent = await generateAutoReply(reply, pricing);

  const result = await sendTrackedEmail(contact, emailContent, {
    campaign: 'auto-reply',
  });

  return result;
}

module.exports = { generateAutoReply, generateFallbackAutoReply, processAutoReply };
