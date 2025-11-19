// Create new file: src/routes/agency.js
// OR add to existing dashboard.js after agency dashboard GET route

const express = require('express');
const knex = require('../db/knex');
const { requireRole } = require('../middleware/auth');
const { addMessage } = require('../middleware/context');
const { sendRejectedApplicantEmail, sendApplicationStatusChangeEmail, sendAgencyInviteEmail } = require('../lib/email');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /agency/claim - Claim a talent for commission tracking
router.post('/agency/claim', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { slug } = req.body;

    if (!slug) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Talent slug is required' });
      }
      addMessage(req, 'error', 'Invalid talent selection');
      return res.redirect('/dashboard/agency');
    }

    // Find the profile
    const profile = await knex('profiles')
      .where({ slug })
      .first();

    if (!profile) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Talent not found' });
      }
      addMessage(req, 'error', 'Talent profile not found');
      return res.redirect('/dashboard/agency');
    }

    // Check if already claimed by someone else
    if (profile.partner_agency_id && profile.partner_agency_id !== req.session.userId) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(409).json({ error: 'Talent already claimed by another agency' });
      }
      addMessage(req, 'error', 'This talent has already been claimed by another agency');
      return res.redirect('/dashboard/agency');
    }

    // Update or refresh claim
    await knex('profiles')
      .where({ id: profile.id })
      .update({
        partner_agency_id: req.session.userId,
        partner_claimed_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

    const talentName = `${profile.first_name} ${profile.last_name}`;

    // JSON response for AJAX requests
    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        talent: talentName,
        message: profile.partner_agency_id === req.session.userId
          ? 'Claim refreshed successfully'
          : 'Talent claimed successfully'
      });
    }

    // Regular form submission
    addMessage(
      req,
      'success',
      profile.partner_agency_id === req.session.userId
        ? `Claim for ${talentName} has been refreshed`
        : `You've successfully claimed ${talentName}`
    );

    return res.redirect('/dashboard/agency');
  } catch (error) {
    console.error('Agency claim error:', error);

    if (req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ error: 'Failed to claim talent' });
    }

    addMessage(req, 'error', 'An error occurred. Please try again.');
    return res.redirect('/dashboard/agency');
  }
});


router.get('/dashboard/agency', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const {
      view = '', // '' for overview, 'applicants', or 'scout'
      sort = 'az',
      city = '',
      letter = '',
      search = '',
      min_height = '',
      max_height = '',
      status = '',
      board_id = '' // Filter by board
    } = req.query;

    const agencyId = req.session.userId;

    // Fetch boards for this agency
    const boards = await knex('boards')
      .where({ agency_id: agencyId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');

    // Get application counts per board
    const boardsWithCounts = await Promise.all(boards.map(async (board) => {
      const applicationCount = await knex('board_applications')
        .where({ board_id: board.id })
        .count('* as count')
        .first();
      return {
        ...board,
        application_count: parseInt(applicationCount?.count || 0)
      };
    }));

    // Calculate dashboard statistics (for both views)
    const allApplications = await knex('applications')
      .where({ agency_id: agencyId })
      .select('status', 'created_at');
    
    const stats = {
      total: allApplications.length,
      pending: allApplications.filter(a => !a.status || a.status === 'pending').length,
      accepted: allApplications.filter(a => a.status === 'accepted').length,
      declined: allApplications.filter(a => a.status === 'declined').length,
      archived: allApplications.filter(a => a.status === 'archived').length,
      newToday: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      }).length,
      newThisWeek: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }).length
    };

    let query;
    let profiles = [];

    if (view === 'scout') {
      // Scout Talent: Only discoverable profiles that don't have an application to this agency
      const existingApplicationProfileIds = await knex('applications')
        .where({ agency_id: agencyId })
        .pluck('profile_id');

      query = knex('profiles')
        .select('profiles.*', 'users.email as owner_email')
        .leftJoin('users', 'profiles.user_id', 'users.id')
        .where({ 'profiles.is_discoverable': true })
        .whereNotNull('profiles.bio_curated');

      // Exclude profiles that already have applications
      if (existingApplicationProfileIds.length > 0) {
        query = query.whereNotIn('profiles.id', existingApplicationProfileIds);
      }
    } else {
      // My Applicants: Only profiles with applications to this agency
      query = knex('profiles')
      .select(
        'profiles.*',
        'users.email as owner_email',
        'applications.status as application_status',
          'applications.id as application_id',
          'applications.created_at as application_created_at',
          'applications.accepted_at',
          'applications.declined_at',
          'applications.invited_by_agency_id',
          'board_applications.match_score as board_match_score',
          'board_applications.match_details as board_match_details'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
        .innerJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
            .andOn('applications.agency_id', '=', knex.raw('?', [agencyId]));
        })
        .leftJoin('board_applications', (join) => {
          join.on('board_applications.application_id', '=', 'applications.id');
          if (board_id) {
            join.on('board_applications.board_id', '=', knex.raw('?', [board_id]));
          }
      })
      .whereNotNull('profiles.bio_curated');

      // Filter by board if specified
      if (board_id) {
        query = query.where('board_applications.board_id', board_id);
      }

      // Filter by application status (only for My Applicants view)
      if (status && status !== 'all') {
        if (status === 'pending') {
          query = query.where(function() {
            this.where('applications.status', 'pending')
              .orWhereNull('applications.status');
          });
        } else {
          query = query.where('applications.status', status);
        }
      }
    }

    // Apply common filters (for both views)
    if (city) {
      query = query.whereILike('profiles.city', `%${city}%`);
    }

    if (letter) {
      query = query.whereILike('profiles.last_name', `${letter}%`);
    }

    if (search) {
      query = query.andWhere((qb) => {
        qb.whereILike('profiles.first_name', `%${search}%`)
        .orWhereILike('profiles.last_name', `%${search}%`);
      });
    }

    const minHeightNumber = parseInt(min_height, 10);
    const maxHeightNumber = parseInt(max_height, 10);
    if (!Number.isNaN(minHeightNumber)) {
      query = query.where('profiles.height_cm', '>=', minHeightNumber);
    }
    if (!Number.isNaN(maxHeightNumber)) {
      query = query.where('profiles.height_cm', '<=', maxHeightNumber);
    }

    // Sort by match score if board is selected, otherwise use default sort
    if (board_id && sort !== 'az' && sort !== 'city') {
      // When board is selected, default to match score sorting
      query = query.orderBy('board_applications.match_score', 'desc');
      query = query.orderBy('profiles.last_name', 'asc');
    } else if (sort === 'city') {
      query = query.orderBy(['profiles.city', 'profiles.last_name']);
    } else if (sort === 'newest') {
      query = query.orderBy('profiles.created_at', 'desc');
    } else if (sort === 'match_score' && board_id) {
      query = query.orderBy('board_applications.match_score', 'desc');
      query = query.orderBy('profiles.last_name', 'asc');
    } else {
      query = query.orderBy(['profiles.last_name', 'profiles.first_name']);
    }

    profiles = await query;

    // Fetch images for each profile
    const profileIds = profiles.map(p => p.id);
    const allImages = profileIds.length > 0 
      ? await knex('images')
          .whereIn('profile_id', profileIds)
          .orderBy(['profile_id', 'sort', 'created_at'])
      : [];
    
    // Group images by profile_id
    const imagesByProfile = {};
    allImages.forEach(img => {
      if (!imagesByProfile[img.profile_id]) {
        imagesByProfile[img.profile_id] = [];
      }
      imagesByProfile[img.profile_id].push(img);
    });

    // Attach images to profiles
    profiles.forEach(profile => {
      profile.images = imagesByProfile[profile.id] || [];
    });

    // Fetch notes and tags counts for applications (My Applicants view only)
    if (view !== 'scout' && profiles.length > 0) {
      const applicationIds = profiles
        .map(p => p.application_id)
        .filter(id => id);

      if (applicationIds.length > 0) {
        // Get notes counts
        const notesCounts = await knex('application_notes')
          .select('application_id')
          .count('id as count')
          .whereIn('application_id', applicationIds)
          .groupBy('application_id');

        const notesCountsMap = {};
        notesCounts.forEach(item => {
          notesCountsMap[item.application_id] = parseInt(item.count, 10);
        });

        // Get tags for each application
        const allTags = await knex('application_tags')
          .whereIn('application_id', applicationIds)
          .where({ agency_id: agencyId })
          .orderBy('created_at', 'desc');

        const tagsByApplication = {};
        allTags.forEach(tag => {
          if (!tagsByApplication[tag.application_id]) {
            tagsByApplication[tag.application_id] = [];
          }
          tagsByApplication[tag.application_id].push(tag);
        });

        // Attach notes counts and tags to profiles
        profiles.forEach(profile => {
          if (profile.application_id) {
            profile.application_notes_count = notesCountsMap[profile.application_id] || 0;
            profile.application_tags = tagsByApplication[profile.application_id] || [];
          }
        });
      }
    }

    // Get current user data with agency branding
    const currentUser = await knex('users')
      .where({ id: agencyId })
      .first();

    return res.render('dashboard/agency', {
      title: 'Agency Dashboard',
      profiles,
      boards: boardsWithCounts,
      view, // 'applicants' or 'scout'
      filters: { sort, city, letter, search, min_height, max_height, status, board_id },
      stats,
      user: currentUser,
      currentUser,
      isDashboard: true,
      layout: 'layouts/dashboard'
    });
  } catch (error) {
    return next(error);
  }
});

// POST /dashboard/agency/applications/:applicationId/accept
// POST /dashboard/agency/applications/:applicationId/decline
// POST /dashboard/agency/applications/:applicationId/archive
router.post('/dashboard/agency/applications/:applicationId/:action', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, action } = req.params; // accept, archive, decline

    if (!['accept', 'archive', 'decline'].includes(action)) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      addMessage(req, 'error', 'Invalid action');
      return res.redirect('/dashboard/agency');
    }

    // Check if application exists and belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: req.session.userId })
      .first();

    if (!application) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Application not found' });
      }
      addMessage(req, 'error', 'Application not found');
      return res.redirect('/dashboard/agency');
    }

    const updateData = {
      status: action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'archived',
      updated_at: knex.fn.now()
    };

    if (action === 'accept') {
      updateData.accepted_at = knex.fn.now();
      updateData.declined_at = null;
    } else if (action === 'decline') {
      updateData.declined_at = knex.fn.now();
      updateData.accepted_at = null;
    } else {
      updateData.declined_at = null;
      updateData.accepted_at = null;
    }

    // Update application
      await knex('applications')
      .where({ id: applicationId })
        .update(updateData);

    // Send email notifications
      try {
        // Get profile and user info for email
        const profile = await knex('profiles')
        .where({ id: application.profile_id })
          .first();
        
        if (profile) {
          const talentUser = await knex('users')
            .where({ id: profile.user_id })
            .first();
          
          const agency = await knex('users')
            .where({ id: req.session.userId })
            .first();

          if (talentUser && agency) {
          if (action === 'decline') {
            // Send decline email with Pro upsell
            await sendRejectedApplicantEmail({
              talentEmail: talentUser.email,
              talentName: `${profile.first_name} ${profile.last_name}`,
              agencyName: agency.agency_name || agency.email,
              agencyEmail: agency.email
            });
          } else if (action === 'accept') {
            // Send acceptance notification
            await sendApplicationStatusChangeEmail({
              talentEmail: talentUser.email,
              talentName: `${profile.first_name} ${profile.last_name}`,
              agencyName: agency.agency_name || agency.email,
              status: 'accepted'
            });
          }
          }
        }
      } catch (emailError) {
        // Log error but don't fail the request
        console.error('[Application] Email send error:', emailError);
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, action });
    }

    addMessage(req, 'success', `Application ${action}ed successfully`);
    return res.redirect('/dashboard/agency');
  } catch (error) {
    console.error('[Application] Error:', error);
    return next(error);
  }
});

// POST /dashboard/agency/scout/:profileId/invite - Invite talent from Scout Talent
router.post('/dashboard/agency/scout/:profileId/invite', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const agencyId = req.session.userId;

    // Check if profile exists and is discoverable
    const profile = await knex('profiles')
      .where({ id: profileId, is_discoverable: true })
      .first();

    if (!profile) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Profile not found or not discoverable' });
      }
      addMessage(req, 'error', 'Profile not found or not discoverable');
      return res.redirect('/dashboard/agency?view=scout');
    }

    // Check if application already exists
    const existingApplication = await knex('applications')
      .where({ profile_id: profileId, agency_id: agencyId })
      .first();

    if (existingApplication) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(409).json({ error: 'Application already exists' });
      }
      addMessage(req, 'error', 'You have already invited this talent');
      return res.redirect('/dashboard/agency?view=scout');
    }

    // Create application with invited_by_agency_id set
    const applicationId = uuidv4();
    await knex('applications').insert({
      id: applicationId,
      profile_id: profileId,
      agency_id: agencyId,
      status: 'pending',
      invited_by_agency_id: agencyId, // Mark as scout invite
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });

    // Send invite notification email
    try {
      const talentUser = await knex('users')
        .where({ id: profile.user_id })
        .first();
      
      const agency = await knex('users')
        .where({ id: agencyId })
        .first();

      if (talentUser && agency) {
        await sendAgencyInviteEmail({
          talentEmail: talentUser.email,
          talentName: `${profile.first_name} ${profile.last_name}`,
          agencyName: agency.agency_name || agency.email
        });
      }
    } catch (emailError) {
      console.error('[Scout Invite] Email send error:', emailError);
      // Don't fail the request if email fails
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true });
    }

    addMessage(req, 'success', `Invitation sent to ${profile.first_name} ${profile.last_name}`);
    return res.redirect('/dashboard/agency?view=scout');
  } catch (error) {
    console.error('[Scout Invite] Error:', error);
    return next(error);
  }
});

module.exports = router;