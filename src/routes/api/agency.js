const express = require('express');
const router = express.Router();
const knex = require('../../db/knex');
const { requireRole } = require('../../middleware/auth');
const { upload, processImage } = require('../../lib/uploader');
const { v4: uuidv4 } = require('uuid');
const { calculateMatchScore } = require('../../lib/match-scoring');

// Helper function to recalculate match scores for all applications in a board
async function recalculateBoardScores(boardId, agencyId) {
  // Get board with requirements and weights
  const board = await knex('boards')
    .where({ id: boardId, agency_id: agencyId })
    .first();
  
  if (!board) return;
  
  const requirements = await knex('board_requirements')
    .where({ board_id: boardId })
    .first();
  
  const scoring_weights = await knex('board_scoring_weights')
    .where({ board_id: boardId })
    .first();
  
  if (!requirements || !scoring_weights) return;
  
  // Parse JSON fields
  const parsedRequirements = {
    ...requirements,
    genders: requirements.genders ? JSON.parse(requirements.genders) : null,
    body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
    comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
    experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
    skills: requirements.skills ? JSON.parse(requirements.skills) : null,
    locations: requirements.locations ? JSON.parse(requirements.locations) : null
  };
  
  // Get all applications in this board
  const boardApplications = await knex('board_applications')
    .where({ board_id: boardId })
    .select('application_id');
  
  // Calculate scores for each application
  for (const ba of boardApplications) {
    const application = await knex('applications')
      .where({ id: ba.application_id, agency_id: agencyId })
      .first();
    
    if (!application) continue;
    
    const profile = await knex('profiles')
      .where({ id: application.profile_id })
      .first();
    
    if (!profile) continue;
    
    // Calculate match score
    const matchResult = calculateMatchScore(profile, {
      requirements: parsedRequirements,
      scoring_weights
    });
    
    // Update board_applications table
    await knex('board_applications')
      .where({ board_id: boardId, application_id: application.id })
      .update({
        match_score: matchResult.score,
        match_details: JSON.stringify(matchResult.details),
        updated_at: knex.fn.now()
      });
    
    // Update applications table (cache)
    await knex('applications')
      .where({ id: application.id })
      .update({
        match_score: matchResult.score,
        match_calculated_at: knex.fn.now()
      });
  }
}

// GET /api/agency/boards - List all boards for agency
router.get('/api/agency/boards', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    
    const boards = await knex('boards')
      .where({ agency_id: agencyId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
    
    // Get application counts for each board
    const boardsWithCounts = await Promise.all(boards.map(async (board) => {
      const count = await knex('board_applications')
        .where({ board_id: board.id })
        .count('* as count')
        .first();
      return {
        ...board,
        application_count: parseInt(count?.count || 0)
      };
    }));
    
    return res.json(boardsWithCounts);
  } catch (error) {
    console.error('[Boards API] Error fetching boards:', error);
    return res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// GET /api/agency/boards/:boardId - Get board details with requirements and weights
router.get('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get requirements
    const requirements = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    // Get scoring weights
    const scoring_weights = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    // Parse JSON fields
    const parsedRequirements = requirements ? {
      ...requirements,
      genders: requirements.genders ? JSON.parse(requirements.genders) : null,
      body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
      comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
      experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
      skills: requirements.skills ? JSON.parse(requirements.skills) : null,
      locations: requirements.locations ? JSON.parse(requirements.locations) : null
    } : null;
    
    return res.json({
      ...board,
      requirements: parsedRequirements,
      scoring_weights
    });
  } catch (error) {
    console.error('[Boards API] Error fetching board:', error);
    return res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// POST /api/agency/boards - Create new board
router.post('/api/agency/boards', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { name, description, is_active = true, sort_order = 0, requirements, scoring_weights } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Board name is required' });
    }
    
    // Create board
    const [board] = await knex('boards')
      .insert({
        id: require('crypto').randomUUID(),
        agency_id: agencyId,
        name: name.trim(),
        description: description || null,
        is_active: !!is_active,
        sort_order: parseInt(sort_order) || 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');
    
    // Create default requirements if provided
    if (requirements) {
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: board.id,
        min_age: requirements.min_age || null,
        max_age: requirements.max_age || null,
        min_height_cm: requirements.min_height_cm || null,
        max_height_cm: requirements.max_height_cm || null,
        genders: requirements.genders ? JSON.stringify(requirements.genders) : null,
        min_bust: requirements.min_bust || null,
        max_bust: requirements.max_bust || null,
        min_waist: requirements.min_waist || null,
        max_waist: requirements.max_waist || null,
        min_hips: requirements.min_hips || null,
        max_hips: requirements.max_hips || null,
        body_types: requirements.body_types ? JSON.stringify(requirements.body_types) : null,
        comfort_levels: requirements.comfort_levels ? JSON.stringify(requirements.comfort_levels) : null,
        experience_levels: requirements.experience_levels ? JSON.stringify(requirements.experience_levels) : null,
        skills: requirements.skills ? JSON.stringify(requirements.skills) : null,
        locations: requirements.locations ? JSON.stringify(requirements.locations) : null,
        min_social_reach: requirements.min_social_reach || null,
        social_reach_importance: requirements.social_reach_importance || null,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Create default scoring weights
    const defaultWeights = scoring_weights || {
      age_weight: 0,
      height_weight: 0,
      measurements_weight: 0,
      body_type_weight: 0,
      comfort_weight: 0,
      experience_weight: 0,
      skills_weight: 0,
      location_weight: 0,
      social_reach_weight: 0
    };
    
    await knex('board_scoring_weights').insert({
      id: require('crypto').randomUUID(),
      board_id: board.id,
      ...defaultWeights,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    
    return res.json(board);
  } catch (error) {
    console.error('[Boards API] Error creating board:', error);
    return res.status(500).json({ error: 'Failed to create board' });
  }
});

// PUT /api/agency/boards/:boardId - Update board
router.put('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const { name, description, is_active, sort_order } = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Update board
    const updates = {
      updated_at: knex.fn.now()
    };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
    
    await knex('boards')
      .where({ id: boardId })
      .update(updates);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating board:', error);
    return res.status(500).json({ error: 'Failed to update board' });
  }
});

// PUT /api/agency/boards/:boardId/requirements - Update board requirements
router.put('/api/agency/boards/:boardId/requirements', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const requirements = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Check if requirements exist
    const existing = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    const requirementsData = {
      min_age: requirements.min_age || null,
      max_age: requirements.max_age || null,
      min_height_cm: requirements.min_height_cm || null,
      max_height_cm: requirements.max_height_cm || null,
      genders: requirements.genders ? JSON.stringify(requirements.genders) : null,
      min_bust: requirements.min_bust || null,
      max_bust: requirements.max_bust || null,
      min_waist: requirements.min_waist || null,
      max_waist: requirements.max_waist || null,
      min_hips: requirements.min_hips || null,
      max_hips: requirements.max_hips || null,
      body_types: requirements.body_types ? JSON.stringify(requirements.body_types) : null,
      comfort_levels: requirements.comfort_levels ? JSON.stringify(requirements.comfort_levels) : null,
      experience_levels: requirements.experience_levels ? JSON.stringify(requirements.experience_levels) : null,
      skills: requirements.skills ? JSON.stringify(requirements.skills) : null,
      locations: requirements.locations ? JSON.stringify(requirements.locations) : null,
      min_social_reach: requirements.min_social_reach || null,
      social_reach_importance: requirements.social_reach_importance || null,
      updated_at: knex.fn.now()
    };
    
    if (existing) {
      await knex('board_requirements')
        .where({ board_id: boardId })
        .update(requirementsData);
    } else {
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: boardId,
        ...requirementsData,
        created_at: knex.fn.now()
      });
    }
    
    // Recalculate match scores for all applications in this board
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating requirements:', error);
    return res.status(500).json({ error: 'Failed to update requirements' });
  }
});

// PUT /api/agency/boards/:boardId/weights - Update scoring weights
router.put('/api/agency/boards/:boardId/weights', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const weights = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Validate weights (0-5)
    const weightFields = ['age_weight', 'height_weight', 'measurements_weight', 'body_type_weight', 
                          'comfort_weight', 'experience_weight', 'skills_weight', 'location_weight', 'social_reach_weight'];
    const weightsData = {};
    weightFields.forEach(field => {
      if (weights[field] !== undefined) {
        const val = parseFloat(weights[field]);
        weightsData[field] = Math.max(0, Math.min(5, val));
      }
    });
    
    // Check if weights exist
    const existing = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    if (existing) {
      await knex('board_scoring_weights')
        .where({ board_id: boardId })
        .update({
          ...weightsData,
          updated_at: knex.fn.now()
        });
    } else {
      await knex('board_scoring_weights').insert({
        id: require('crypto').randomUUID(),
        board_id: boardId,
        age_weight: 0,
        height_weight: 0,
        measurements_weight: 0,
        body_type_weight: 0,
        comfort_weight: 0,
        experience_weight: 0,
        skills_weight: 0,
        location_weight: 0,
        social_reach_weight: 0,
        ...weightsData,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Recalculate match scores
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating weights:', error);
    return res.status(500).json({ error: 'Failed to update weights' });
  }
});

// DELETE /api/agency/boards/:boardId - Delete board
router.delete('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Delete board (cascade will handle requirements, weights, and board_applications)
    await knex('boards')
      .where({ id: boardId })
      .delete();
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error deleting board:', error);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
});

// POST /api/agency/boards/:boardId/duplicate - Duplicate board
router.post('/api/agency/boards/:boardId/duplicate', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Get original board
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get requirements and weights
    const requirements = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    const weights = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    // Create new board
    const newBoardId = require('crypto').randomUUID();
    await knex('boards').insert({
      id: newBoardId,
      agency_id: agencyId,
      name: `${board.name} (Copy)`,
      description: board.description,
      is_active: false, // Inactive by default
      sort_order: board.sort_order,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    
    // Copy requirements
    if (requirements) {
      const newReq = { ...requirements };
      delete newReq.id;
      delete newReq.board_id;
      delete newReq.created_at;
      delete newReq.updated_at;
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: newBoardId,
        ...newReq,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Copy weights
    if (weights) {
      const newWeights = { ...weights };
      delete newWeights.id;
      delete newWeights.board_id;
      delete newWeights.created_at;
      delete newWeights.updated_at;
      await knex('board_scoring_weights').insert({
        id: require('crypto').randomUUID(),
        board_id: newBoardId,
        ...newWeights,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    return res.json({ id: newBoardId, success: true });
  } catch (error) {
    console.error('[Boards API] Error duplicating board:', error);
    return res.status(500).json({ error: 'Failed to duplicate board' });
  }
});

// POST /api/agency/boards/:boardId/calculate-scores - Recalculate all match scores for a board
router.post('/api/agency/boards/:boardId/calculate-scores', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error calculating scores:', error);
    return res.status(500).json({ error: 'Failed to calculate scores' });
  }
});

// POST /api/agency/applications/:applicationId/assign-board - Assign application to board
router.post('/api/agency/applications/:applicationId/assign-board', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { board_id } = req.body;
    const agencyId = req.session.userId;

    // Verify application belongs to agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify board belongs to agency
    if (board_id) {
      const board = await knex('boards')
        .where({ id: board_id, agency_id: agencyId })
        .first();

      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }
    }

    // Remove from all boards first
    await knex('board_applications')
      .where({ application_id: applicationId })
      .delete();

    // Assign to new board if provided
    if (board_id) {
      // Check if already exists
      const existing = await knex('board_applications')
        .where({ board_id, application_id: applicationId })
        .first();

      if (!existing) {
        // Get board requirements and weights
        const board = await knex('boards')
          .where({ id: board_id, agency_id: agencyId })
          .first();

        const requirements = await knex('board_requirements')
          .where({ board_id })
          .first();

        const scoring_weights = await knex('board_scoring_weights')
          .where({ board_id })
          .first();

        // Get profile
        const profile = await knex('profiles')
          .where({ id: application.profile_id })
          .first();

        let matchScore = 0;
        let matchDetails = null;

        // Calculate match score if requirements and weights exist
        if (requirements && scoring_weights && profile) {
          const { calculateMatchScore } = require('../../lib/match-scoring');
          
          const parsedRequirements = {
            ...requirements,
            genders: requirements.genders ? JSON.parse(requirements.genders) : null,
            body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
            comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
            experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
            skills: requirements.skills ? JSON.parse(requirements.skills) : null,
            locations: requirements.locations ? JSON.parse(requirements.locations) : null
          };

          const matchResult = calculateMatchScore(profile, {
            requirements: parsedRequirements,
            scoring_weights
          });

          matchScore = matchResult.score;
          matchDetails = JSON.stringify(matchResult.details);
        }

        // Create board_applications entry
        await knex('board_applications').insert({
          id: require('crypto').randomUUID(),
          board_id,
          application_id: applicationId,
          match_score: matchScore,
          match_details: matchDetails,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });

        // Update applications table cache
        await knex('applications')
          .where({ id: applicationId })
          .update({
            board_id,
            match_score: matchScore,
            match_calculated_at: knex.fn.now()
          });
      }
    } else {
      // Remove board_id from application if unassigning
      await knex('applications')
        .where({ id: applicationId })
        .update({
          board_id: null,
          match_score: null,
          match_calculated_at: null
        });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error assigning application to board:', error);
    return res.status(500).json({ error: 'Failed to assign application to board' });
  }
});

// GET /api/agency/applications - Get filtered applications as JSON
router.get('/api/agency/applications', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const {
      sort = 'az',
      city = '',
      letter = '',
      search = '',
      min_height = '',
      max_height = '',
      status = ''
    } = req.query;

    let query = knex('profiles')
      .select(
        'profiles.*',
        'users.email as owner_email',
        'applications.status as application_status',
        'applications.id as application_id',
        'applications.created_at as application_created_at'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
      .leftJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
          .andOn('applications.agency_id', '=', knex.raw('?', [req.session.userId]));
      })
      .whereNotNull('profiles.bio_curated');

    // Apply filters (same logic as main route)
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
    const minHeightNumber = parseInt(min_height, 10);
    const maxHeightNumber = parseInt(max_height, 10);
    if (!Number.isNaN(minHeightNumber)) {
      query = query.where('profiles.height_cm', '>=', minHeightNumber);
    }
    if (!Number.isNaN(maxHeightNumber)) {
      query = query.where('profiles.height_cm', '<=', maxHeightNumber);
    }
    if (sort === 'city') {
      query = query.orderBy(['profiles.city', 'profiles.last_name']);
    } else {
      query = query.orderBy(['profiles.last_name', 'profiles.first_name']);
    }

    const profiles = await query;

    // Fetch images
    const profileIds = profiles.map(p => p.id);
    const allImages = profileIds.length > 0 
      ? await knex('images')
          .whereIn('profile_id', profileIds)
          .orderBy(['profile_id', 'sort', 'created_at'])
      : [];
    
    const imagesByProfile = {};
    allImages.forEach(img => {
      if (!imagesByProfile[img.profile_id]) {
        imagesByProfile[img.profile_id] = [];
      }
      imagesByProfile[img.profile_id].push(img);
    });

    profiles.forEach(profile => {
      profile.images = imagesByProfile[profile.id] || [];
    });

    return res.json({ profiles, count: profiles.length });
  } catch (error) {
    console.error('[API/Agency/Applications] Error:', error);
    return next(error);
  }
});

// GET /api/agency/stats - Get dashboard statistics
router.get('/api/agency/stats', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const allApplications = await knex('applications')
      .where({ agency_id: req.session.userId })
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

    const commissions = await knex('commissions')
      .where({ agency_id: req.session.userId })
      .sum({ total: 'amount_cents' })
      .first();

    return res.json({
      stats,
      commissionsTotal: ((commissions?.total || 0) / 100).toFixed(2)
    });
  } catch (error) {
    console.error('[API/Agency/Stats] Error:', error);
    return next(error);
  }
});

// PUT /api/agency/profile - Update agency profile
router.put('/api/agency/profile', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { agency_name, agency_location, agency_website, agency_description } = req.body;

    const updateData = {};
    if (agency_name !== undefined) updateData.agency_name = agency_name || null;
    if (agency_location !== undefined) updateData.agency_location = agency_location || null;
    if (agency_website !== undefined) updateData.agency_website = agency_website || null;
    if (agency_description !== undefined) updateData.agency_description = agency_description || null;

    await knex('users')
      .where({ id: agencyId })
      .update(updateData);

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('[Agency Profile API] Error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/agency/branding - Update agency branding (logo and color)
router.post('/api/agency/branding', requireRole('AGENCY'), upload.single('agency_logo'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { agency_brand_color, remove_logo } = req.body;

    const updateData = {};
    
    if (remove_logo === 'true') {
      // Remove existing logo
      const user = await knex('users').where({ id: agencyId }).first();
      if (user && user.agency_logo_path) {
        // Delete file from storage if needed
        updateData.agency_logo_path = null;
      }
    } else if (req.file) {
      // Process and save new logo
      const processedImage = await processImage(req.file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 90
      });
      updateData.agency_logo_path = processedImage.path;
    }

    if (agency_brand_color !== undefined) {
      updateData.agency_brand_color = agency_brand_color || null;
    }

    if (Object.keys(updateData).length > 0) {
      await knex('users')
        .where({ id: agencyId })
        .update(updateData);
    }

    return res.json({ 
      success: true, 
      message: 'Branding updated successfully',
      logo_path: updateData.agency_logo_path || null
    });
  } catch (error) {
    console.error('[Agency Branding API] Error:', error);
    return res.status(500).json({ error: 'Failed to update branding' });
  }
});

// PUT /api/agency/settings - Update agency settings
router.put('/api/agency/settings', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { notify_new_applications, notify_status_changes, default_view } = req.body;

    const updateData = {};
    if (notify_new_applications !== undefined) updateData.notify_new_applications = !!notify_new_applications;
    if (notify_status_changes !== undefined) updateData.notify_status_changes = !!notify_status_changes;
    if (default_view !== undefined) updateData.default_view = default_view || null;

    await knex('users')
      .where({ id: agencyId })
      .update(updateData);

    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[Agency Settings API] Error:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/agency/export - Export applications as CSV or JSON
router.get('/api/agency/export', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { format = 'csv', status = '', city = '', search = '' } = req.query;

    // Build query similar to main dashboard route
    let query = knex('profiles')
      .select(
        'profiles.first_name',
        'profiles.last_name',
        'profiles.city',
        'profiles.height_cm',
        'profiles.bust',
        'profiles.waist',
        'profiles.hips',
        'profiles.age',
        'profiles.bio_curated',
        'applications.id as application_id',
        'applications.status as application_status',
        'applications.created_at as application_created_at',
        'applications.accepted_at',
        'applications.declined_at',
        'users.email as owner_email'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
      .innerJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
          .andOn('applications.agency_id', '=', knex.raw('?', [agencyId]));
      })
      .whereNotNull('profiles.bio_curated');

    // Apply filters
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

    if (city) {
      query = query.whereILike('profiles.city', `%${city}%`);
    }

    if (search) {
      query = query.andWhere((qb) => {
        qb.whereILike('profiles.first_name', `%${search}%`)
          .orWhereILike('profiles.last_name', `%${search}%`);
      });
    }

    const applications = await query.orderBy(['profiles.last_name', 'profiles.first_name']);

    // Get notes and tags for each application
    const applicationIds = applications.map(app => app.application_id).filter(Boolean);
    
    let notesMap = {};
    let tagsMap = {};

    if (applicationIds.length > 0) {
      // Fetch aggregated notes
      const notes = await knex('application_notes')
        .select('application_id')
        .select(knex.raw('string_agg(note, \' | \' ORDER BY created_at) as notes'))
        .whereIn('application_id', applicationIds)
        .groupBy('application_id');

      notes.forEach(note => {
        notesMap[note.application_id] = note.notes || '';
      });

      // Fetch tags
      const tags = await knex('application_tags')
        .select('application_id')
        .select(knex.raw('string_agg(tag, \', \' ORDER BY created_at) as tags'))
        .whereIn('application_id', applicationIds)
        .groupBy('application_id');

      tags.forEach(tag => {
        tagsMap[tag.application_id] = tag.tags || '';
      });
    }

    // Format data for export
    const exportData = applications.map(app => {
      // Format measurements from individual fields
      const measurements = [];
      if (app.bust) measurements.push(`Bust: ${app.bust}`);
      if (app.waist) measurements.push(`Waist: ${app.waist}`);
      if (app.hips) measurements.push(`Hips: ${app.hips}`);
      const measurementsStr = measurements.length > 0 ? measurements.join(', ') : '';
      
      return {
        name: `${app.first_name} ${app.last_name}`,
        email: app.owner_email || '',
        city: app.city || '',
        height_cm: app.height_cm || '',
        measurements: measurementsStr,
        age: app.age || '',
        bio: app.bio_curated || '',
        notes: notesMap[app.application_id] || '',
        tags: tagsMap[app.application_id] || '',
        application_status: app.application_status || 'pending',
        applied_date: app.application_created_at ? new Date(app.application_created_at).toISOString() : '',
        accepted_date: app.accepted_at ? new Date(app.accepted_at).toISOString() : '',
        declined_date: app.declined_at ? new Date(app.declined_at).toISOString() : ''
      };
    });

    if (format === 'json') {
      return res.json({
        exported_at: new Date().toISOString(),
        total: exportData.length,
        applications: exportData
      });
    } else {
      // CSV format
      const csvHeaders = [
        'Name',
        'Email',
        'City',
        'Height (cm)',
        'Measurements',
        'Age',
        'Bio',
        'Notes',
        'Tags',
        'Application Status',
        'Applied Date',
        'Accepted Date',
        'Declined Date'
      ];

      const csvRows = exportData.map(app => {
        const escapeCSV = (str) => {
          if (!str) return '';
          const string = String(str);
          if (string.includes(',') || string.includes('"') || string.includes('\n')) {
            return `"${string.replace(/"/g, '""')}"`;
          }
          return string;
        };

        return [
          escapeCSV(app.name),
          escapeCSV(app.email),
          escapeCSV(app.city),
          escapeCSV(app.height_cm),
          escapeCSV(app.measurements),
          escapeCSV(app.age),
          escapeCSV(app.bio),
          escapeCSV(app.notes),
          escapeCSV(app.tags),
          escapeCSV(app.application_status),
          escapeCSV(app.applied_date ? new Date(app.applied_date).toLocaleDateString() : ''),
          escapeCSV(app.accepted_date ? new Date(app.accepted_date).toLocaleDateString() : ''),
          escapeCSV(app.declined_date ? new Date(app.declined_date).toLocaleDateString() : '')
        ].join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const filename = `pholio-applications-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }
  } catch (error) {
    console.error('[Export API] Error:', error);
    return res.status(500).json({ error: 'Failed to export applications' });
  }
});

// GET /api/agency/applications/:applicationId/notes - Get all notes for an application
router.get('/api/agency/applications/:applicationId/notes', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const notes = await knex('application_notes')
      .where({ application_id: applicationId })
      .orderBy('created_at', 'desc');

    return res.json(notes);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/agency/applications/:applicationId/notes - Create a new note
router.post('/api/agency/applications/:applicationId/notes', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { note } = req.body;
    const agencyId = req.session.userId;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const noteId = uuidv4();
    const [newNote] = await knex('application_notes')
      .insert({
        id: noteId,
        application_id: applicationId,
        note: note.trim(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return res.json(newNote);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/agency/applications/:applicationId/notes/:noteId - Update a note
router.put('/api/agency/applications/:applicationId/notes/:noteId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, noteId } = req.params;
    const { note } = req.body;
    const agencyId = req.session.userId;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify note exists and belongs to this application
    const existingNote = await knex('application_notes')
      .where({ id: noteId, application_id: applicationId })
      .first();

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const [updatedNote] = await knex('application_notes')
      .where({ id: noteId })
      .update({
        note: note.trim(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return res.json(updatedNote);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/agency/applications/:applicationId/notes/:noteId - Delete a note
router.delete('/api/agency/applications/:applicationId/notes/:noteId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, noteId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify note exists and belongs to this application
    const existingNote = await knex('application_notes')
      .where({ id: noteId, application_id: applicationId })
      .first();

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await knex('application_notes')
      .where({ id: noteId })
      .delete();

    return res.json({ success: true });
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

// GET /api/agency/applications/:applicationId/tags - Get all tags for an application
router.get('/api/agency/applications/:applicationId/tags', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const tags = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId })
      .orderBy('created_at', 'desc');

    return res.json(tags);
  } catch (error) {
    console.error('[Tags API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/agency/applications/:applicationId/tags - Add a tag
router.post('/api/agency/applications/:applicationId/tags', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { tag, color } = req.body;
    const agencyId = req.session.userId;

    if (!tag || !tag.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if tag already exists (unique constraint)
    const existingTag = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId, tag: tag.trim() })
      .first();

    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists' });
    }

    const tagId = uuidv4();
    const [newTag] = await knex('application_tags')
      .insert({
        id: tagId,
        application_id: applicationId,
        agency_id: agencyId,
        tag: tag.trim(),
        color: color || null,
        created_at: knex.fn.now()
      })
      .returning('*');

    return res.json(newTag);
  } catch (error) {
    console.error('[Tags API] Error:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Tag already exists' });
    }
    return res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/agency/applications/:applicationId/tags/:tagId - Remove a tag
router.delete('/api/agency/applications/:applicationId/tags/:tagId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, tagId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify tag exists and belongs to this application and agency
    const existingTag = await knex('application_tags')
      .where({ id: tagId, application_id: applicationId, agency_id: agencyId })
      .first();

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await knex('application_tags')
      .where({ id: tagId })
      .delete();

    return res.json({ success: true });
  } catch (error) {
    console.error('[Tags API] Error:', error);
    return res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// GET /api/agency/applications/:applicationId/details - Get full application details
router.get('/api/agency/applications/:applicationId/details', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get full profile with all details
    const profile = await knex('profiles')
      .where({ id: application.profile_id })
      .first();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get all images
    const images = await knex('images')
      .where({ profile_id: profile.id })
      .orderBy(['sort', 'created_at']);

    // Get user info
    const user = await knex('users')
      .where({ id: profile.user_id })
      .first();

    // Get notes
    const notes = await knex('application_notes')
      .where({ application_id: applicationId })
      .orderBy('created_at', 'desc');

    // Get tags
    const tags = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId })
      .orderBy('created_at', 'desc');

    // Update viewed_at timestamp
    await knex('applications')
      .where({ id: applicationId })
      .update({ viewed_at: knex.fn.now() });

    return res.json({
      application: {
        id: application.id,
        status: application.status,
        created_at: application.created_at,
        accepted_at: application.accepted_at,
        declined_at: application.declined_at,
        viewed_at: application.viewed_at,
        invited_by_agency_id: application.invited_by_agency_id
      },
      profile: {
        ...profile,
        images,
        user_email: user?.email || null
      },
      notes,
      tags
    });
  } catch (error) {
    console.error('[Application Details API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch application details' });
  }
});

// GET /api/agency/analytics - Get detailed analytics
router.get('/api/agency/analytics', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;

    // Get all applications for this agency
    const allApplications = await knex('applications')
      .where({ agency_id: agencyId })
      .select('status', 'created_at', 'accepted_at', 'declined_at');

    // Calculate time ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Applications by status
    const byStatus = {
      total: allApplications.length,
      pending: allApplications.filter(a => !a.status || a.status === 'pending').length,
      accepted: allApplications.filter(a => a.status === 'accepted').length,
      declined: allApplications.filter(a => a.status === 'declined').length,
      archived: allApplications.filter(a => a.status === 'archived').length
    };

    // Applications over time
    const overTime = {
      today: allApplications.filter(a => new Date(a.created_at) >= today).length,
      thisWeek: allApplications.filter(a => new Date(a.created_at) >= weekAgo).length,
      thisMonth: allApplications.filter(a => new Date(a.created_at) >= monthAgo).length,
      last3Months: allApplications.filter(a => new Date(a.created_at) >= threeMonthsAgo).length
    };

    // Applications by board
    const applicationsByBoard = await knex('board_applications')
      .select('boards.name as board_name', 'boards.id as board_id')
      .count('board_applications.id as count')
      .join('boards', 'board_applications.board_id', 'boards.id')
      .join('applications', 'board_applications.application_id', 'applications.id')
      .where('applications.agency_id', agencyId)
      .groupBy('boards.id', 'boards.name')
      .orderBy('count', 'desc');

    // Match score distribution
    const matchScores = await knex('board_applications')
      .select('board_applications.match_score')
      .join('applications', 'board_applications.application_id', 'applications.id')
      .where('applications.agency_id', agencyId)
      .whereNotNull('board_applications.match_score')
      .pluck('board_applications.match_score');

    const scoreDistribution = {
      excellent: matchScores.filter(s => s >= 80).length,
      good: matchScores.filter(s => s >= 60 && s < 80).length,
      fair: matchScores.filter(s => s >= 40 && s < 60).length,
      poor: matchScores.filter(s => s < 40).length
    };

    // Average match score
    const avgMatchScore = matchScores.length > 0
      ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
      : 0;

    // Applications timeline (last 30 days)
    const timeline = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = allApplications.filter(a => {
        const created = new Date(a.created_at);
        return created >= dayStart && created < dayEnd;
      }).length;

      timeline.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    // Acceptance rate
    const acceptedCount = byStatus.accepted;
    const processedCount = acceptedCount + byStatus.declined;
    const acceptanceRate = processedCount > 0
      ? Math.round((acceptedCount / processedCount) * 100)
      : 0;

    return res.json({
      success: true,
      analytics: {
        byStatus,
        overTime,
        byBoard: applicationsByBoard.map(b => ({
          board_id: b.board_id,
          board_name: b.board_name,
          count: parseInt(b.count || 0)
        })),
        matchScores: {
          distribution: scoreDistribution,
          average: avgMatchScore,
          total: matchScores.length
        },
        timeline,
        acceptanceRate
      }
    });
  } catch (error) {
    console.error('[Dashboard/Agency Analytics] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to load analytics',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET /api/agency/overview/recent-applicants - Get recent applicants for overview dashboard
router.get('/api/agency/overview/recent-applicants', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const limit = parseInt(req.query.limit) || 5;

    // Get recent applications with profile data
    const recentApplications = await knex('applications')
      .where({ agency_id: agencyId })
      .join('profiles', 'applications.profile_id', 'profiles.id')
      .join('users', 'profiles.user_id', 'users.id')
      .leftJoin('board_applications', function() {
        this.on('applications.id', '=', 'board_applications.application_id')
          .andOn('board_applications.is_primary', '=', knex.raw('?', [true]));
      })
      .leftJoin('boards', 'board_applications.board_id', 'boards.id')
      .select(
        'applications.id as application_id',
        'applications.status as application_status',
        'applications.created_at as application_created_at',
        'profiles.id as profile_id',
        'profiles.first_name',
        'profiles.last_name',
        'profiles.profile_image',
        'profiles.city',
        'profiles.country',
        'profiles.height',
        'profiles.age',
        'profiles.slug',
        'users.email as user_email',
        'board_applications.match_score'
      )
      .orderBy('applications.created_at', 'desc')
      .limit(limit);

    // Format the response
    const formatted = recentApplications.map(app => {
      const isNew = new Date(app.application_created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fullName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Unknown';
      const location = [app.city, app.country].filter(Boolean).join(', ') || 'Location not specified';
      
      return {
        applicationId: app.application_id,
        profileId: app.profile_id,
        name: fullName,
        location: location,
        height: app.height || 'N/A',
        age: app.age || 'N/A',
        profileImage: app.profile_image || '/images/default-avatar.png',
        matchScore: app.match_score ? Math.round(app.match_score) : null,
        isNew: isNew,
        slug: app.slug,
        createdAt: app.application_created_at
      };
    });

    return res.json({
      success: true,
      applicants: formatted
    });
  } catch (error) {
    console.error('[Dashboard/Agency/Recent Applicants] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to load recent applicants',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET /api/agency/overview/stats - Get overview stats (talent pool, board growth)
router.get('/api/agency/overview/stats', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;

    // Calculate total talent pool (accepted applications + all public talent)
    const acceptedCount = await knex('applications')
      .where({ agency_id: agencyId, status: 'accepted' })
      .count('id as count')
      .first();

    // Get all public talent profiles (not just applications)
    const publicTalentCount = await knex('profiles')
      .where({ is_public: true })
      .count('id as count')
      .first();

    const totalTalentPool = parseInt(acceptedCount?.count || 0) + parseInt(publicTalentCount?.count || 0);

    // Calculate board growth (compare current month vs previous month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonthBoards = await knex('boards')
      .where({ agency_id: agencyId })
      .where('created_at', '>=', currentMonthStart)
      .count('id as count')
      .first();

    const previousMonthBoards = await knex('boards')
      .where({ agency_id: agencyId })
      .where('created_at', '>=', previousMonthStart)
      .where('created_at', '<', currentMonthStart)
      .count('id as count')
      .first();

    const currentCount = parseInt(currentMonthBoards?.count || 0);
    const previousCount = parseInt(previousMonthBoards?.count || 0);
    
    let growthPercentage = 0;
    if (previousCount > 0) {
      growthPercentage = Math.round(((currentCount - previousCount) / previousCount) * 100);
    } else if (currentCount > 0) {
      growthPercentage = 100; // New boards this month
    }

    return res.json({
      success: true,
      stats: {
        totalTalentPool: totalTalentPool,
        boardGrowth: growthPercentage
      }
    });
  } catch (error) {
    console.error('[Dashboard/Agency/Overview Stats] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to load overview stats',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;
