/**
 * Create a full placeholder profile for you@agency.com
 * This script populates all profile fields with realistic placeholder data
 */

require('dotenv').config();
const knex = require('knex')(require('../knexfile'));
const { v4: uuidv4 } = require('uuid');

async function createPlaceholderProfile() {
  try {
    console.log('Creating placeholder profile for you@agency.com...');

    // Find or create user
    let user = await knex('users')
      .where({ email: 'you@agency.com' })
      .first();

    if (!user) {
      console.log('User not found, creating user...');
      const userId = uuidv4();
      await knex('users').insert({
        id: userId,
        email: 'you@agency.com',
        password_hash: '$2b$10$placeholder', // Placeholder hash
        role: 'TALENT',
        created_at: knex.fn.now()
      });
      user = await knex('users').where({ id: userId }).first();
      console.log('User created:', user.id);
    } else {
      console.log('User found:', user.id);
    }

    // Check if profile already exists
    let profile = await knex('profiles')
      .where({ user_id: user.id })
      .first();

    if (profile) {
      console.log('Profile already exists, updating with placeholder data...');
      
      // Update existing profile with all placeholder data
      const placeholderData = getPlaceholderProfileData(user.id);
      await knex('profiles')
        .where({ id: profile.id })
        .update({
          ...placeholderData,
          updated_at: knex.fn.now()
        });
      
      profile = await knex('profiles').where({ id: profile.id }).first();
      console.log('Profile updated:', profile.id);
    } else {
      console.log('Creating new profile...');
      
      // Create new profile
      const placeholderData = getPlaceholderProfileData(user.id);
      const profileId = uuidv4();
      await knex('profiles').insert({
        id: profileId,
        ...placeholderData,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
      
      profile = await knex('profiles').where({ id: profileId }).first();
      console.log('Profile created:', profile.id);
    }

    // Add placeholder images
    console.log('Adding placeholder images...');
    const existingImages = await knex('images')
      .where({ profile_id: profile.id })
      .select('id');

    if (existingImages.length === 0) {
      // Add hero image
      await knex('images').insert({
        id: uuidv4(),
        profile_id: profile.id,
        path: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
        label: 'Hero Image',
        sort: 0,
        created_at: knex.fn.now()
      });

      // Add additional portfolio images
      const portfolioImages = [
        { label: 'Portfolio 1', sort: 1, url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80' },
        { label: 'Portfolio 2', sort: 2, url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80' },
        { label: 'Portfolio 3', sort: 3, url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80' },
        { label: 'Portfolio 4', sort: 4, url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' },
        { label: 'Portfolio 5', sort: 5, url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' },
        { label: 'Portfolio 6', sort: 6, url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' }
      ];

      for (const img of portfolioImages) {
        await knex('images').insert({
          id: uuidv4(),
          profile_id: profile.id,
          path: img.url,
          label: img.label,
          sort: img.sort,
          created_at: knex.fn.now()
        });
      }

      // Update profile hero_image_path
      await knex('profiles')
        .where({ id: profile.id })
        .update({
          hero_image_path: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80'
        });

      console.log('Added', portfolioImages.length + 1, 'placeholder images');
    } else {
      console.log('Images already exist, skipping...');
    }

    console.log('\n✅ Placeholder profile created successfully!');
    console.log('Profile ID:', profile.id);
    console.log('Profile Slug:', profile.slug);
    console.log('View at: /portfolio/' + profile.slug);
    
    return profile;
  } catch (error) {
    console.error('Error creating placeholder profile:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

function getPlaceholderProfileData(userId) {
  // Generate unique slug
  const slug = `elara-keats-${Date.now()}`;
  
  // Calculate age from date of birth
  const dateOfBirth = new Date('1998-05-15');
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  return {
    user_id: userId,
    slug: slug,
    first_name: 'Elara',
    last_name: 'Keats',
    city: 'New York',
    city_secondary: 'Los Angeles',
    height_cm: 178,
    phone: '+1 (555) 123-4567',
    bust: 34,
    waist: 24,
    hips: 36,
    shoe_size: 9,
    eye_color: 'Hazel',
    hair_color: 'Brown',
    
    // Bio
    bio_raw: 'Elara Keats is a versatile model with a passion for editorial and commercial work. With over 5 years of experience in the industry, she has worked with top photographers and brands across fashion, beauty, and lifestyle sectors. Her unique look and professional demeanor make her a sought-after talent for both print and digital campaigns.',
    bio_curated: 'Elara Keats is a versatile model with a passion for editorial and commercial work. With over 5 years of experience in the industry, she has worked with top photographers and brands across fashion, beauty, and lifestyle sectors. Her unique look and professional demeanor make her a sought-after talent for both print and digital campaigns.',
    
    // Personal information
    gender: 'Female',
    date_of_birth: dateOfBirth.toISOString().split('T')[0],
    age: age,
    weight_kg: 58.5,
    weight_lbs: 129,
    weight_unit: 'lbs',
    dress_size: '4',
    hair_length: 'Long',
    skin_tone: 'Medium',
    
    // Professional information
    languages: JSON.stringify(['English', 'French', 'Spanish']),
    availability_travel: true,
    availability_schedule: 'Full-time',
    experience_level: 'Professional',
    training: 'Fashion Institute of Technology - Modeling Certificate Program, 2018-2019',
    portfolio_url: 'https://www.elarakeats.com',
    specialties: JSON.stringify(['Editorial', 'Commercial', 'Runway', 'Beauty']),
    experience_details: JSON.stringify({
      years_experience: 5,
      editorial_shoots: 45,
      commercial_campaigns: 28,
      runway_shows: 12,
      notable_clients: ['Vogue', 'Elle', 'Harper\'s Bazaar', 'Sephora', 'L\'Oréal']
    }),
    
    // Social media
    instagram_handle: '@elarakeats',
    instagram_url: 'https://instagram.com/elarakeats',
    twitter_handle: '@elarakeats',
    twitter_url: 'https://twitter.com/elarakeats',
    tiktok_handle: '@elarakeats',
    tiktok_url: 'https://tiktok.com/@elarakeats',
    
    // References
    reference_name: 'Sarah Mitchell',
    reference_email: 'sarah.mitchell@talentagency.com',
    reference_phone: '+1 (555) 987-6543',
    
    // Emergency contact
    emergency_contact_name: 'James Keats',
    emergency_contact_phone: '+1 (555) 234-5678',
    emergency_contact_relationship: 'Brother',
    
    // Work eligibility
    work_eligibility: true,
    work_status: 'Citizen',
    union_membership: 'SAG-AFTRA',
    ethnicity: 'Mixed',
    tattoos: false,
    piercings: true,
    
    // Comfort levels
    comfort_levels: JSON.stringify(['Swimwear', 'Lingerie', 'Editorial Nudity']),
    
    // Previous representations
    previous_representations: JSON.stringify([
      { agency: 'Elite Model Management', location: 'New York', years: '2019-2021' },
      { agency: 'IMG Models', location: 'Los Angeles', years: '2021-2023' }
    ]),
    
    // Profile settings
    is_pro: true,
    is_discoverable: true,
    pdf_theme: 'editorial',
    pdf_customizations: JSON.stringify({
      primary_color: '#C9A55A',
      secondary_color: '#0F172A',
      font_family: 'serif',
      layout: 'modern'
    })
  };
}

// Run the script
if (require.main === module) {
  createPlaceholderProfile()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { createPlaceholderProfile };

