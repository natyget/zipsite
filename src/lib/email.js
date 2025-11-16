/**
 * Email service for sending notifications to users
 * Currently uses console.log for development, can be extended with actual email service
 */

/**
 * Send email to rejected applicant promoting Pro upgrade
 * @param {Object} options
 * @param {string} options.talentEmail - Email address of the talent
 * @param {string} options.talentName - Name of the talent
 * @param {string} options.agencyName - Name of the agency that declined
 * @param {string} options.agencyEmail - Email of the agency (optional)
 * @returns {Promise<void>}
 */
async function sendRejectedApplicantEmail({ talentEmail, talentName, agencyName, agencyEmail }) {
  // TODO: Implement actual email sending service (e.g., SendGrid, AWS SES, etc.)
  
  const subject = `While ${agencyName} isn't the right fit...`;
  const upgradeUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/pro/upgrade?source=rejected&agency=${encodeURIComponent(agencyName)}`;
  
  const emailBody = `
Hi ${talentName || 'there'},

While ${agencyName} isn't the right fit at this time, there's good news: you can upgrade to ZipSite Pro ($9.99/mo) to apply to all partner agencies with one click.

With ZipSite Pro, you get:
- Apply to all partner agencies instantly
- Video embeds in your portfolio
- Enhanced presentation
- No watermarks
- Advanced AI curation

Upgrade now: ${upgradeUrl}

Best,
The ZipSite Team
  `.trim();

  // For now, log the email (in production, this would send via email service)
  console.log('='.repeat(60));
  console.log('[EMAIL] Rejected Applicant Notification');
  console.log('='.repeat(60));
  console.log(`To: ${talentEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${emailBody}`);
  console.log('='.repeat(60));

  // In production, uncomment and configure:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: talentEmail,
  //   from: process.env.FROM_EMAIL || 'noreply@zipsite.me',
  //   subject: subject,
  //   text: emailBody,
  //   html: emailBody.replace(/\n/g, '<br>')
  // });

  return Promise.resolve();
}

module.exports = {
  sendRejectedApplicantEmail
};

