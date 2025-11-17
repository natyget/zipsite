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
  
  const subject = `Update on your application to ${agencyName}`;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const upgradeUrl = `${baseUrl}/pro/upgrade?source=rejected&agency=${encodeURIComponent(agencyName)}`;
  
  const emailBody = `
Hi ${talentName || 'there'},

Thank you for your interest in ${agencyName}. After careful consideration, we've decided to move forward with other candidates at this time.

While this particular opportunity isn't the right fit, there's a way to get seen by our entire network of partner agencies:

Upgrade to Studio+ ($9.99/mo) and make your profile discoverable to all partner agencies. With Studio+, you can:

• Get discovered by our entire network of partner agencies
• Make your profile visible in Scout Talent
• Increase your chances of being found by the right agency

Upgrade now: ${upgradeUrl}

Best,
The Pholio Team
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

/**
 * Send email notification when application status changes
 * @param {Object} options
 * @param {string} options.talentEmail - Email address of the talent
 * @param {string} options.talentName - Name of the talent
 * @param {string} options.agencyName - Name of the agency
 * @param {string} options.status - New status (accepted, declined, archived)
 * @returns {Promise<void>}
 */
async function sendApplicationStatusChangeEmail({ talentEmail, talentName, agencyName, status }) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard/talent`;
  
  let subject = '';
  let emailBody = '';

  if (status === 'accepted') {
    subject = `Congratulations! ${agencyName} wants to work with you`;
    emailBody = `
Hi ${talentName || 'there'},

Great news! ${agencyName} has accepted your application and wants to work with you.

Next steps:
1. Check your dashboard for more details: ${dashboardUrl}
2. The agency will be in touch with you soon

Congratulations on this exciting opportunity!

Best,
The Pholio Team
    `.trim();
  } else if (status === 'archived') {
    subject = `Update on your application to ${agencyName}`;
    emailBody = `
Hi ${talentName || 'there'},

Your application to ${agencyName} has been archived.

You can view all your applications in your dashboard: ${dashboardUrl}

Best,
The Pholio Team
    `.trim();
  } else {
    // Declined is handled by sendRejectedApplicantEmail
    return Promise.resolve();
  }

  console.log('='.repeat(60));
  console.log('[EMAIL] Application Status Change Notification');
  console.log('='.repeat(60));
  console.log(`To: ${talentEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${emailBody}`);
  console.log('='.repeat(60));

  return Promise.resolve();
}

/**
 * Send email when agency invites talent from Scout Talent
 * @param {Object} options
 * @param {string} options.talentEmail - Email address of the talent
 * @param {string} options.talentName - Name of the talent
 * @param {string} options.agencyName - Name of the agency
 * @returns {Promise<void>}
 */
async function sendAgencyInviteEmail({ talentEmail, talentName, agencyName }) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard/talent`;
  
  const subject = `You've been invited to apply to ${agencyName}`;
  const emailBody = `
Hi ${talentName || 'there'},

Great news! ${agencyName} has discovered your profile and invited you to apply.

This is an exciting opportunity - the agency has already seen your portfolio and wants to learn more about you.

View your invitation and respond in your dashboard: ${dashboardUrl}

Best,
The Pholio Team
  `.trim();

  console.log('='.repeat(60));
  console.log('[EMAIL] Agency Invite Notification');
  console.log('='.repeat(60));
  console.log(`To: ${talentEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${emailBody}`);
  console.log('='.repeat(60));

  return Promise.resolve();
}

module.exports = {
  sendRejectedApplicantEmail,
  sendApplicationStatusChangeEmail,
  sendAgencyInviteEmail
};

