/**
 * Update agency profile for you@agency.com with complete placeholder data
 */

require('dotenv').config();
const knex = require('knex')(require('../knexfile'));

async function updateAgencyProfile() {
  try {
    console.log('Updating agency profile for you@agency.com...');

    // Find user
    const user = await knex('users')
      .where({ email: 'you@agency.com' })
      .first();

    if (!user) {
      console.error('User not found!');
      return;
    }

    if (user.role !== 'AGENCY') {
      console.error('User is not an agency! Current role:', user.role);
      return;
    }

    console.log('User found:', user.id);

    // Update with complete placeholder agency data
    const agencyData = {
      agency_name: 'True Modeling Agency',
      agency_location: 'New York, NY',
      agency_website: 'https://www.truemodeling.com',
      agency_description: 'True Modeling Agency is a premier talent representation firm specializing in fashion, commercial, and editorial modeling. With over 15 years of industry experience, we represent top-tier talent and work with leading brands, photographers, and creative directors worldwide. Our agency is known for discovering and developing exceptional models who excel in both print and digital campaigns.',
      agency_logo_path: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=400&q=80',
      agency_brand_color: '#C9A55A',
      agency_slug: 'true-modeling-agency',
      notify_new_applications: true,
      notify_status_changes: true,
      default_view: 'pipeline'
    };

    await knex('users')
      .where({ id: user.id })
      .update(agencyData);

    console.log('\n✅ Agency profile updated successfully!');
    console.log('Agency Name:', agencyData.agency_name);
    console.log('Location:', agencyData.agency_location);
    console.log('Website:', agencyData.agency_website);
    console.log('Slug:', agencyData.agency_slug);
    
    return agencyData;
  } catch (error) {
    console.error('Error updating agency profile:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

// Run the script
if (require.main === module) {
  updateAgencyProfile()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { updateAgencyProfile };

