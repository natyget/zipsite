/**
 * Agency Dashboard - Premium AI Studio
 * Comprehensive JavaScript for all interactive features
 */

(function() {
  'use strict';

  // Global state
  const state = {
    currentView: 'pipeline',
    selectedProfiles: new Set(),
    isBatchMode: false,
    dragState: null
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('agency-dashboard')) return;
    
    initCommandPalette();
    initViewSwitcher();
    initKanbanDragDrop();
    initPreviewModal();
    initBatchOperations();
    initSearch();
    initFilters();
    initQuickActions();
    initScoutFilters();
    initScoutInvite();
    initNotesAndTags();
    initAgencyProfileAccordion();
    initExportData();
    initSettingsButton();
    initBoardsManagement();
    initBoardEditor();
    initAnalytics();
    initOverviewDashboard();
    initDiscoverPage();
    initInboxPage();
    initBoardsPage();
    
    // Load data from window if available
    if (window.AGENCY_DASHBOARD_DATA) {
      state.profiles = window.AGENCY_DASHBOARD_DATA.profiles || [];
      state.stats = window.AGENCY_DASHBOARD_DATA.stats || {};
      state.boards = window.AGENCY_DASHBOARD_DATA.boards || [];
    }
  });

  /**
   * Command Palette
   */
  function initCommandPalette() {
    const commandPalette = document.getElementById('command-palette');
    const commandPaletteTrigger = document.getElementById('command-palette-trigger');
    const commandPaletteInput = document.getElementById('command-palette-input');
    const commandPaletteOverlay = commandPalette?.querySelector('.agency-command-palette__overlay');
    const talentSection = document.getElementById('command-palette-talent');
    const navSection = document.getElementById('command-palette-nav');
    const talentItems = document.getElementById('command-palette-talent-items');
    const navItems = document.getElementById('command-palette-nav-items');
    const emptyState = document.getElementById('command-palette-empty');
    
    if (!commandPalette || !commandPaletteInput) return;

    let selectedIndex = -1;
    let currentItems = [];

    const navigationItems = [
      { label: 'Go to Dashboard', view: 'overview', href: '/dashboard/agency', icon: 'dashboard' },
      { label: 'Go to Inbox', view: 'inbox', href: '/dashboard/agency/applicants', icon: 'inbox' },
      { label: 'Go to Discover', view: 'discover', href: '/dashboard/agency/discover', icon: 'scout' },
      { label: 'Go to Boards', view: 'boards', href: '/dashboard/agency/boards', icon: 'boards' },
      { label: 'Go to Analytics', view: 'analytics', href: '/dashboard/agency/analytics', icon: 'analytics' },
      { label: 'Go to Settings', view: 'settings', href: '/dashboard/settings', icon: 'settings' }
    ];

    function openCommandPalette() {
      commandPalette.style.display = 'flex';
      setTimeout(() => {
        commandPaletteInput.focus();
      }, 50);
      updateResults('');
    }

    function closeCommandPalette() {
      commandPalette.style.display = 'none';
      commandPaletteInput.value = '';
      selectedIndex = -1;
      currentItems = [];
    }

    function updateResults(query) {
      const searchQuery = query.toLowerCase().trim();
      let hasResults = false;

      // Clear previous results
      if (talentItems) talentItems.innerHTML = '';
      if (navItems) navItems.innerHTML = '';
      if (talentSection) talentSection.style.display = 'none';
      if (navSection) navSection.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';

      currentItems = [];

      // Search talent
      if (state.profiles && state.profiles.length > 0) {
        const filteredProfiles = state.profiles.filter(profile => {
          const name = `${profile.first_name || ''} ${profile.last_name || ''}`.toLowerCase();
          const location = (profile.city || '').toLowerCase();
          return name.includes(searchQuery) || location.includes(searchQuery);
        }).slice(0, 5);

        if (filteredProfiles.length > 0 && searchQuery) {
          hasResults = true;
          if (talentSection) talentSection.style.display = 'block';
          
          filteredProfiles.forEach(profile => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'agency-command-palette__item';
            item.dataset.profileId = profile.id;
            
            const avatar = document.createElement('div');
            avatar.className = 'agency-command-palette__item-avatar';
            if (profile.hero_image_path) {
              const img = document.createElement('img');
              img.src = profile.hero_image_path.startsWith('http') ? profile.hero_image_path : '/' + profile.hero_image_path;
              img.alt = `${profile.first_name} ${profile.last_name}`;
              avatar.appendChild(img);
            } else {
              avatar.textContent = (profile.first_name?.[0] || '') + (profile.last_name?.[0] || '');
            }
            
            const info = document.createElement('div');
            info.className = 'agency-command-palette__item-info';
            const name = document.createElement('div');
            name.className = 'agency-command-palette__item-name';
            name.textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            const meta = document.createElement('div');
            meta.className = 'agency-command-palette__item-meta';
            meta.textContent = profile.city || 'Location TBD';
            info.appendChild(name);
            info.appendChild(meta);
            
            const icon = document.createElement('svg');
            icon.className = 'agency-command-palette__item-icon';
            icon.width = '16';
            icon.height = '16';
            icon.viewBox = '0 0 24 24';
            icon.innerHTML = '<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            
            item.appendChild(avatar);
            item.appendChild(info);
            item.appendChild(icon);
            
            item.addEventListener('click', (e) => {
              e.preventDefault();
              // Open application detail modal/drawer
              if (window.openApplicationDetail) {
                window.openApplicationDetail(profile.id);
              }
              closeCommandPalette();
            });
            
            if (talentItems) talentItems.appendChild(item);
            currentItems.push(item);
          });
        }
      }

      // Search navigation
      const filteredNav = navigationItems.filter(nav => 
        nav.label.toLowerCase().includes(searchQuery)
      );

      if (filteredNav.length > 0) {
        hasResults = true;
        if (navSection) navSection.style.display = 'block';
        
        filteredNav.forEach(nav => {
          const item = document.createElement('a');
          item.href = nav.href;
          item.className = 'agency-command-palette__item';
          
          const icon = document.createElement('svg');
          icon.width = '18';
          icon.height = '18';
          icon.viewBox = '0 0 24 24';
          icon.innerHTML = getNavIcon(nav.icon);
          icon.style.color = 'var(--agency-text-tertiary)';
          
          const label = document.createElement('span');
          label.textContent = nav.label;
          label.style.fontSize = '0.875rem';
          label.style.color = 'var(--agency-text-primary)';
          
          item.appendChild(icon);
          item.appendChild(label);
          
          item.addEventListener('click', () => {
            closeCommandPalette();
          });
          
          if (navItems) navItems.appendChild(item);
          currentItems.push(item);
        });
      }

      if (!hasResults && searchQuery && emptyState) {
        emptyState.style.display = 'block';
      }

      selectedIndex = -1;
      updateSelectedItem();
    }

    function getNavIcon(type) {
      const icons = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        inbox: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        scout: '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        boards: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        settings: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 1v6m0 6v6m9-9h-6m-6 0H3" stroke="currentColor" stroke-width="1.5" fill="none"/>'
      };
      return icons[type] || icons.dashboard;
    }

    function updateSelectedItem() {
      currentItems.forEach((item, index) => {
        item.classList.toggle('agency-command-palette__item--active', index === selectedIndex);
      });
    }

    function navigateItems(direction) {
      if (currentItems.length === 0) return;
      
      if (direction === 'down') {
        selectedIndex = (selectedIndex + 1) % currentItems.length;
      } else if (direction === 'up') {
        selectedIndex = selectedIndex <= 0 ? currentItems.length - 1 : selectedIndex - 1;
      }
      
      updateSelectedItem();
      currentItems[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function selectCurrentItem() {
      if (selectedIndex >= 0 && currentItems[selectedIndex]) {
        currentItems[selectedIndex].click();
      }
    }

    // Event listeners
    if (commandPaletteTrigger) {
      commandPaletteTrigger.addEventListener('click', openCommandPalette);
    }

    if (commandPaletteOverlay) {
      commandPaletteOverlay.addEventListener('click', closeCommandPalette);
    }

    if (commandPaletteInput) {
      commandPaletteInput.addEventListener('input', (e) => {
        updateResults(e.target.value);
      });

      commandPaletteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeCommandPalette();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateItems('down');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateItems('up');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          selectCurrentItem();
        }
      });
    }

    // Keyboard shortcut: Cmd/Ctrl + K
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (commandPalette.style.display === 'none' || !commandPalette.style.display) {
          openCommandPalette();
        } else {
          closeCommandPalette();
        }
      }
    });
  }

  /**
   * View Mode Switcher
   */
  function initViewSwitcher() {
    const viewButtons = document.querySelectorAll('.agency-dashboard__view-btn');
    const views = document.querySelectorAll('.agency-dashboard__view');

    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        // Update active button
        viewButtons.forEach(b => b.classList.remove('agency-dashboard__view-btn--active'));
        btn.classList.add('agency-dashboard__view-btn--active');
        
        // Show/hide views
        views.forEach(v => {
          if (v.id === `view-${view}`) {
            v.style.display = '';
          } else {
            v.style.display = 'none';
          }
        });
        
        state.currentView = view;
        saveViewPreference(view);
      });
    });

    // Load saved view preference
    const savedView = localStorage.getItem('agency-dashboard-view');
    if (savedView) {
      const btn = document.querySelector(`[data-view="${savedView}"]`);
      if (btn) btn.click();
    }
  }

  function saveViewPreference(view) {
    localStorage.setItem('agency-dashboard-view', view);
  }

  /**
   * Kanban Drag and Drop
   */
  function initKanbanDragDrop() {
    const cards = document.querySelectorAll('.agency-dashboard__card');
    const columns = document.querySelectorAll('.agency-dashboard__kanban-column');

    cards.forEach(card => {
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragend', handleDragEnd);
    });

    columns.forEach(column => {
      column.addEventListener('dragover', handleDragOver);
      column.addEventListener('drop', handleDrop);
      column.addEventListener('dragenter', handleDragEnter);
      column.addEventListener('dragleave', handleDragLeave);
    });
  }

  function handleDragStart(e) {
    state.dragState = {
      card: e.target,
      sourceColumn: e.target.closest('.agency-dashboard__kanban-column'),
      offsetX: e.offsetX,
      offsetY: e.offsetY
    };
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.agency-dashboard__kanban-column').forEach(col => {
      col.classList.remove('agency-dashboard__kanban-column--drag-over');
    });
    state.dragState = null;
  }

  function handleDragOver(e) {
    if (state.dragState) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragEnter(e) {
    if (state.dragState) {
      e.currentTarget.classList.add('agency-dashboard__kanban-column--drag-over');
    }
  }

  function handleDragLeave(e) {
    if (state.dragState) {
      e.currentTarget.classList.remove('agency-dashboard__kanban-column--drag-over');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    if (!state.dragState) return;

    const targetColumn = e.currentTarget;
    const targetStatus = targetColumn.dataset.status;
    const card = state.dragState.card;
    const applicationId = card.dataset.applicationId;

    if (!applicationId) {
      console.error('No application ID found on card');
      return;
    }

    // Map status to action
    const statusToAction = {
      'accepted': 'accept',
      'declined': 'decline',
      'archived': 'archive',
      'pending': 'pending' // This might not need an action, just status update
    };

    const action = statusToAction[targetStatus];
    if (!action || action === 'pending') {
      // For pending, we might need a different approach or just update status directly
      console.warn('Cannot update to pending status via drag-drop');
      return;
    }

    // Move card to new column
    const cardsContainer = targetColumn.querySelector('.agency-dashboard__kanban-cards');
    cardsContainer.appendChild(card);

    // Update status via API
    updateApplicationStatus(applicationId, action).then(() => {
      // Update card data attribute
      card.dataset.status = targetStatus;
      
      // Update badge
      const badge = card.querySelector('.agency-dashboard__badge--status');
      if (badge) {
        badge.className = `agency-dashboard__badge agency-dashboard__badge--status agency-dashboard__badge--${targetStatus}`;
        badge.textContent = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
      }

      // Update column counts
      updateColumnCounts();
    }).catch(err => {
      console.error('Failed to update status:', err);
      // Revert card position
      state.dragState.sourceColumn.querySelector('.agency-dashboard__kanban-cards').appendChild(card);
    });

    targetColumn.classList.remove('agency-dashboard__kanban-column--drag-over');
    state.dragState = null;
  }

  function updateColumnCounts() {
    document.querySelectorAll('.agency-dashboard__kanban-column').forEach(column => {
      const count = column.querySelectorAll('.agency-dashboard__card').length;
      const countEl = column.querySelector('.agency-dashboard__kanban-count');
      if (countEl) countEl.textContent = count;
    });
  }

  /**
   * Application Detail Drawer
   */
  function initPreviewModal() {
    const drawer = document.getElementById('application-detail-drawer');
    const overlay = drawer?.querySelector('.agency-detail-drawer__overlay');
    const closeBtn = document.getElementById('detail-drawer-close');
    const previewButtons = document.querySelectorAll('.agency-dashboard__card-preview, .agency-dashboard__gallery-preview, .agency-dashboard__list-preview, .agency-dashboard__table-preview');
    const body = document.getElementById('detail-drawer-body');
    const nameEl = document.getElementById('detail-drawer-name');
    const subtitleEl = document.getElementById('detail-drawer-subtitle');
    const portfolioLink = document.getElementById('detail-drawer-portfolio-link');
    const acceptBtn = document.getElementById('detail-drawer-accept');
    const declineBtn = document.getElementById('detail-drawer-decline');
    const boardBtn = document.getElementById('detail-drawer-board');
    const archiveBtn = document.getElementById('detail-drawer-archive');
    const footerInfo = document.getElementById('detail-drawer-footer-info');

    let currentApplicationId = null;
    let currentProfileSlug = null;

    // Function to open detail view (exposed globally for command palette)
    async function openApplicationDetail(profileIdOrApplicationId) {
      // Try to find application ID from profile ID
      let applicationId = profileIdOrApplicationId;
      const profile = state.profiles?.find(p => p.id === profileIdOrApplicationId);
      
      if (profile && profile.application_id) {
        applicationId = profile.application_id;
      }
      
      if (!applicationId) {
        // Fallback: open portfolio if no application ID
        if (profile && profile.slug) {
          window.open(`/portfolio/${profile.slug}`, '_blank');
        }
        return;
      }

      currentApplicationId = applicationId;
      drawer.style.display = 'flex';
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      // Show loading state
      body.innerHTML = `
        <div class="agency-detail-drawer__loading">
          <div class="agency-detail-drawer__spinner"></div>
          <p>Loading application details...</p>
        </div>
      `;

        // Load application details
        try {
          const response = await fetch(`/api/agency/applications/${applicationId}/details`);
          if (response.ok) {
            const data = await response.json();
            renderApplicationDetails(data);
            currentProfileSlug = data.profile.slug;
            if (portfolioLink) {
              portfolioLink.href = `/portfolio/${data.profile.slug}`;
            }
          } else {
          const error = await response.json();
          body.innerHTML = `
            <div class="agency-detail-drawer__error">
              <p>Failed to load application details: ${error.error || 'Unknown error'}</p>
              <button class="agency-detail-drawer__action-btn" onclick="document.getElementById('application-detail-drawer').style.display='none'">Close</button>
            </div>
          `;
        }
      } catch (error) {
        console.error('Load application details error:', error);
        body.innerHTML = `
          <div class="agency-detail-drawer__error">
            <p>Failed to load application details. Please try again.</p>
            <button class="agency-detail-drawer__action-btn" onclick="document.getElementById('application-detail-drawer').style.display='none'">Close</button>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading application details:', error);
      body.innerHTML = '<div class="agency-detail-drawer__error"><p>Error loading details</p></div>';
    }
  }

    // Expose function globally for command palette
    window.openApplicationDetail = openApplicationDetail;
    window.openBoardEditor = openBoardEditor;

    // Open modal from preview buttons
    previewButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const applicationId = btn.dataset.applicationId;
        const profileId = btn.dataset.profileId;
        
        if (!applicationId) {
          // Fallback: open portfolio if no application ID
          const profile = state.profiles?.find(p => p.id === profileId);
          if (profile && profile.slug) {
            window.open(`/portfolio/${profile.slug}`, '_blank');
          }
          return;
        }

        await openApplicationDetail(applicationId);
      });
    });

    // Close drawer
    function closeDrawer() {
      drawer.classList.remove('is-open');
      setTimeout(() => {
        drawer.style.display = 'none';
      }, 300);
      document.body.style.overflow = '';
      currentApplicationId = null;
      currentProfileSlug = null;
    }

    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.style.display === 'flex') {
        closeDrawer();
      }
    });

    function renderApplicationDetails(data) {
      const { application, profile, notes, tags } = data;
      
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
      if (nameEl) nameEl.textContent = fullName;
      if (subtitleEl) subtitleEl.textContent = `Application ${application.status.charAt(0).toUpperCase() + application.status.slice(1)} • Applied ${formatDate(application.created_at)}`;

      // Update header action buttons visibility
      if (acceptBtn) acceptBtn.style.display = application.status !== 'accepted' ? 'flex' : 'none';
      if (declineBtn) declineBtn.style.display = application.status !== 'declined' ? 'flex' : 'none';
      if (archiveBtn) archiveBtn.style.display = application.status !== 'archived' ? 'flex' : 'none';
      if (portfolioLink) portfolioLink.style.display = profile.slug ? 'flex' : 'none';
      if (boardBtn) boardBtn.style.display = 'flex';

      // Update footer info
      if (footerInfo) {
        footerInfo.innerHTML = `Applied ${formatDate(application.created_at)}`;
      }

      // Format timeline events (include notes as timeline items)
      const timelineEvents = [];
      if (application.created_at) {
        timelineEvents.push({ type: 'status', date: application.created_at, label: 'Application submitted', author: 'System' });
      }
      if (application.viewed_at) {
        timelineEvents.push({ type: 'status', date: application.viewed_at, label: 'Viewed by agency', author: 'System' });
      }
      if (application.accepted_at) {
        timelineEvents.push({ type: 'status', date: application.accepted_at, label: 'Application accepted', author: 'System' });
      }
      if (application.declined_at) {
        timelineEvents.push({ type: 'status', date: application.declined_at, label: 'Application declined', author: 'System' });
      }
      // Add notes as timeline events
      notes.forEach(note => {
        timelineEvents.push({ 
          type: 'comment', 
          date: note.created_at, 
          label: note.note, 
          author: 'Agency Team' 
        });
      });
      timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first

      // Prepare images for viewer
      const images = profile.images || [];
      const portfolioImages = images.filter(img => !img.label || !img.label.toLowerCase().includes('digital'));
      const digitalImages = images.filter(img => img.label && img.label.toLowerCase().includes('digital'));
      const allImages = portfolioImages.length > 0 ? portfolioImages : images;
      const currentImage = allImages[0] || null;

      // Render image viewer with Portfolio/Digitals toggle
      const imageViewerHtml = currentImage
        ? `
          <div class="agency-detail-drawer__image-viewer">
            <div class="agency-detail-drawer__image-viewer-group">
              ${portfolioImages.length > 0 && digitalImages.length > 0 ? `
                <div class="agency-detail-drawer__image-mode-toggle">
                  <button class="agency-detail-drawer__image-mode-btn agency-detail-drawer__image-mode-btn--active" data-mode="portfolio">Portfolio</button>
                  <button class="agency-detail-drawer__image-mode-btn" data-mode="digitals">Digitals</button>
                </div>
              ` : ''}
              <img 
                src="${normalizeImagePath(currentImage.path)}" 
                alt="${currentImage.label || 'Portfolio image'}" 
                class="agency-detail-drawer__main-image agency-detail-drawer__main-image--portfolio"
                id="drawer-main-image"
                loading="eager"
              >
              ${allImages.length > 1 ? `
                <div class="agency-detail-drawer__image-thumbnails">
                  ${allImages.slice(0, 6).map((img, idx) => `
                    <img 
                      src="${normalizeImagePath(img.path)}" 
                      alt="${img.label || 'Thumbnail'}"
                      class="agency-detail-drawer__image-thumbnail ${idx === 0 ? 'agency-detail-drawer__image-thumbnail--active' : ''}"
                      data-image-index="${idx}"
                      data-image-path="${normalizeImagePath(img.path)}"
                    >
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `
        : '';

      // Calculate match score (use board match score if available, otherwise AI score)
      const matchScore = profile.board_match_score !== null && profile.board_match_score !== undefined
        ? profile.board_match_score
        : (profile.ai_score || 0);

      // Format measurements
      const measurements = [];
      if (profile.bust) measurements.push(`Bust: ${profile.bust}`);
      if (profile.waist) measurements.push(`Waist: ${profile.waist}`);
      if (profile.hips) measurements.push(`Hips: ${profile.hips}`);
      const measurementsStr = measurements.length > 0 ? measurements.join(', ') : '';

      body.innerHTML = `
        <div class="agency-detail-drawer__content-section">
          ${imageViewerHtml}
          
          <div class="agency-detail-drawer__info-header">
            <div>
              <h1 class="agency-detail-drawer__info-name">${escapeHtml(fullName)}</h1>
              <div class="agency-detail-drawer__info-meta">
                ${profile.city ? `<span>📍 ${escapeHtml(profile.city)}</span>` : ''}
                ${profile.height_cm ? `<span>📏 ${profile.height_cm} cm</span>` : ''}
                ${profile.age ? `<span>🎂 ${profile.age} years</span>` : ''}
              </div>
            </div>
            <div class="agency-detail-drawer__match-score">
              <div class="agency-detail-drawer__match-score-value">${matchScore}</div>
              <div class="agency-detail-drawer__match-score-label">Match Score</div>
            </div>
          </div>

          <div class="agency-detail-drawer__stats-grid">
            ${profile.height_cm ? `
              <div class="agency-detail-drawer__stat-item">
                <div class="agency-detail-drawer__stat-label">Height</div>
                <div class="agency-detail-drawer__stat-value">${profile.height_cm} cm</div>
              </div>
            ` : ''}
            ${measurementsStr ? `
              <div class="agency-detail-drawer__stat-item">
                <div class="agency-detail-drawer__stat-label">Measurements</div>
                <div class="agency-detail-drawer__stat-value" style="font-size: 1.25rem;">${escapeHtml(measurementsStr)}</div>
              </div>
            ` : ''}
            ${profile.age ? `
              <div class="agency-detail-drawer__stat-item">
                <div class="agency-detail-drawer__stat-label">Age</div>
                <div class="agency-detail-drawer__stat-value">${profile.age}</div>
              </div>
            ` : ''}
          </div>

          ${tags.length > 0 ? `
            <div class="agency-detail-drawer__tags">
              <div class="agency-detail-drawer__tags-title">Tags</div>
              <div class="agency-detail-drawer__tags-list">
                ${tags.map(tag => {
                  const colorStyle = tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;` : '';
                  return `<span class="agency-detail-drawer__tag" style="${colorStyle}">${escapeHtml(tag.tag)}</span>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${profile.bio_curated ? `
            <div style="margin-bottom: 3rem;">
              <div class="agency-detail-drawer__tags-title" style="margin-bottom: 1rem;">Bio</div>
              <p style="font-size: 0.9375rem; line-height: 1.6; color: var(--agency-text-secondary);">${escapeHtml(profile.bio_curated)}</p>
            </div>
          ` : ''}

          ${profile.user_email ? `
            <div style="margin-bottom: 3rem;">
              <div class="agency-detail-drawer__tags-title" style="margin-bottom: 1rem;">Contact</div>
              <a href="mailto:${escapeHtml(profile.user_email)}" style="font-size: 0.9375rem; color: var(--agency-brand-color, var(--agency-accent-gold)); text-decoration: none;">${escapeHtml(profile.user_email)}</a>
            </div>
          ` : ''}

          <div class="agency-detail-drawer__timeline">
            <div class="agency-detail-drawer__timeline-title">Activity Timeline</div>
            ${timelineEvents.length > 0 ? `
              <div class="agency-detail-drawer__timeline-list">
                ${timelineEvents.map(event => `
                  <div class="agency-detail-drawer__timeline-item">
                    <div class="agency-detail-drawer__timeline-dot agency-detail-drawer__timeline-dot--${event.type}"></div>
                    <div class="agency-detail-drawer__timeline-content">
                      <div class="agency-detail-drawer__timeline-header">
                        <span class="agency-detail-drawer__timeline-author">${escapeHtml(event.author || 'System')}</span>
                        <span class="agency-detail-drawer__timeline-date">${formatDate(event.date)}</span>
                      </div>
                      <div class="agency-detail-drawer__timeline-text">${escapeHtml(event.label)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p style="color: var(--agency-text-tertiary); font-size: 0.875rem;">No activity yet.</p>'}
            
            <div class="agency-detail-drawer__note-input-wrapper" style="margin-top: 1.5rem;">
              <textarea 
                class="agency-detail-drawer__note-input" 
                id="drawer-note-input"
                placeholder="Add a note..."
                rows="3"
              ></textarea>
              <button class="agency-detail-drawer__note-send" id="drawer-note-send" data-application-id="${application.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Initialize image viewer
      initDrawerImageViewer(portfolioImages, digitalImages);
      
      // Initialize action buttons
      if (acceptBtn) {
        acceptBtn.onclick = async () => {
          if (!confirm('Are you sure you want to accept this application?')) return;
          try {
            await updateApplicationStatus(application.id, 'accept');
            alert('Application accepted successfully!');
            closeDrawer();
            window.location.reload();
          } catch (error) {
            console.error('Action failed:', error);
            alert('Failed to accept application. Please try again.');
          }
        };
      }

      if (declineBtn) {
        declineBtn.onclick = async () => {
          if (!confirm('Are you sure you want to decline this application?')) return;
          try {
            await updateApplicationStatus(application.id, 'decline');
            alert('Application declined successfully!');
            closeDrawer();
            window.location.reload();
          } catch (error) {
            console.error('Action failed:', error);
            alert('Failed to decline application. Please try again.');
          }
        };
      }

      if (archiveBtn) {
        archiveBtn.onclick = async () => {
          if (!confirm('Are you sure you want to archive this application?')) return;
          try {
            await updateApplicationStatus(application.id, 'archive');
            alert('Application archived successfully!');
            closeDrawer();
            window.location.reload();
          } catch (error) {
            console.error('Action failed:', error);
            alert('Failed to archive application. Please try again.');
          }
        };
      }

      // Initialize note input
      const noteInput = document.getElementById('drawer-note-input');
      const noteSend = document.getElementById('drawer-note-send');
      if (noteInput && noteSend) {
        noteSend.onclick = async () => {
          const noteText = noteInput.value.trim();
          if (!noteText) return;

          try {
            const response = await fetch(`/api/agency/applications/${application.id}/notes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ note: noteText })
            });

            if (response.ok) {
              noteInput.value = '';
              // Reload drawer to show new note
              await openApplicationDetail(application.id);
            } else {
              alert('Failed to add note. Please try again.');
            }
          } catch (error) {
            console.error('Error adding note:', error);
            alert('Failed to add note. Please try again.');
          }
        };
      }
    }

    function initDrawerImageViewer(portfolioImages, digitalImages) {
      const modeToggle = document.querySelector('.agency-detail-drawer__image-mode-toggle');
      const mainImage = document.getElementById('drawer-main-image');
      const thumbnails = document.querySelectorAll('.agency-detail-drawer__image-thumbnail');
      let currentMode = 'portfolio';
      let currentImages = portfolioImages.length > 0 ? portfolioImages : (digitalImages.length > 0 ? digitalImages : []);

      // Mode toggle
      if (modeToggle && portfolioImages.length > 0 && digitalImages.length > 0) {
        const portfolioBtn = modeToggle.querySelector('[data-mode="portfolio"]');
        const digitalsBtn = modeToggle.querySelector('[data-mode="digitals"]');

        portfolioBtn?.addEventListener('click', () => {
          currentMode = 'portfolio';
          currentImages = portfolioImages;
          portfolioBtn.classList.add('agency-detail-drawer__image-mode-btn--active');
          digitalsBtn?.classList.remove('agency-detail-drawer__image-mode-btn--active');
          if (mainImage && currentImages[0]) {
            mainImage.src = normalizeImagePath(currentImages[0].path);
            mainImage.classList.remove('agency-detail-drawer__main-image--digitals');
          }
          updateThumbnails();
        });

        digitalsBtn?.addEventListener('click', () => {
          currentMode = 'digitals';
          currentImages = digitalImages;
          digitalsBtn.classList.add('agency-detail-drawer__image-mode-btn--active');
          portfolioBtn?.classList.remove('agency-detail-drawer__image-mode-btn--active');
          if (mainImage && currentImages[0]) {
            mainImage.src = normalizeImagePath(currentImages[0].path);
            mainImage.classList.add('agency-detail-drawer__main-image--digitals');
          }
          updateThumbnails();
        });
      }

      // Thumbnail click
      thumbnails.forEach((thumb, idx) => {
        thumb.addEventListener('click', () => {
          const imagePath = thumb.dataset.imagePath;
          if (mainImage && imagePath) {
            mainImage.src = imagePath;
            if (currentMode === 'digitals') {
              mainImage.classList.add('agency-detail-drawer__main-image--digitals');
            } else {
              mainImage.classList.remove('agency-detail-drawer__main-image--digitals');
            }
          }
          thumbnails.forEach(t => t.classList.remove('agency-detail-drawer__image-thumbnail--active'));
          thumb.classList.add('agency-detail-drawer__image-thumbnail--active');
        });
      });

      function updateThumbnails() {
        // Update thumbnail display based on current mode
        const thumbnailContainer = document.querySelector('.agency-detail-drawer__image-thumbnails');
        if (thumbnailContainer) {
          thumbnailContainer.innerHTML = currentImages.slice(0, 6).map((img, idx) => `
            <img 
              src="${normalizeImagePath(img.path)}" 
              alt="${img.label || 'Thumbnail'}"
              class="agency-detail-drawer__image-thumbnail ${idx === 0 ? 'agency-detail-drawer__image-thumbnail--active' : ''} ${currentMode === 'digitals' ? 'agency-detail-drawer__image-thumbnail--digitals' : ''}"
              data-image-index="${idx}"
              data-image-path="${normalizeImagePath(img.path)}"
            >
          `).join('');
          
          // Re-attach event listeners
          const newThumbnails = thumbnailContainer.querySelectorAll('.agency-detail-drawer__image-thumbnail');
          newThumbnails.forEach((thumb, idx) => {
            thumb.addEventListener('click', () => {
              const imagePath = thumb.dataset.imagePath;
              if (mainImage && imagePath) {
                mainImage.src = imagePath;
                if (currentMode === 'digitals') {
                  mainImage.classList.add('agency-detail-drawer__main-image--digitals');
                } else {
                  mainImage.classList.remove('agency-detail-drawer__main-image--digitals');
                }
              }
              newThumbnails.forEach(t => t.classList.remove('agency-detail-drawer__image-thumbnail--active'));
              thumb.classList.add('agency-detail-drawer__image-thumbnail--active');
            });
          });
        }
      }
    }

    function normalizeImagePath(path) {
      if (!path) return '';
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      if (path.startsWith('/')) return path;
      return '/' + path;
    }

    function formatDate(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  /**
   * Batch Operations
   */
  function initBatchOperations() {
    const checkboxes = document.querySelectorAll('.agency-dashboard__select-checkbox');
    const selectAll = document.getElementById('select-all');
    const batchActions = document.getElementById('batch-actions');
    const batchCancel = document.getElementById('batch-cancel');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateBatchMode);
    });

    selectAll?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
          state.selectedProfiles.add(cb.dataset.profileId);
        } else {
          state.selectedProfiles.delete(cb.dataset.profileId);
        }
      });
      updateBatchMode();
    });

    batchCancel?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = false;
        state.selectedProfiles.delete(cb.dataset.profileId);
      });
      updateBatchMode();
    });

    // Batch action buttons
    ['accept', 'decline', 'archive'].forEach(action => {
      const btn = document.getElementById(`batch-${action}`);
      btn?.addEventListener('click', () => {
        performBatchAction(action);
      });
    });
  }

  function updateBatchMode() {
    const checkboxes = document.querySelectorAll('.agency-dashboard__select-checkbox:checked');
    state.selectedProfiles.clear();
    checkboxes.forEach(cb => {
      state.selectedProfiles.add(cb.dataset.profileId);
    });

    const batchActions = document.getElementById('batch-actions');
    const batchCount = document.getElementById('batch-count');
    
    if (state.selectedProfiles.size > 0) {
      state.isBatchMode = true;
      batchActions.style.display = 'flex';
      if (batchCount) batchCount.textContent = state.selectedProfiles.size;
    } else {
      state.isBatchMode = false;
      batchActions.style.display = 'none';
    }
  }

  async function performBatchAction(action) {
    if (state.selectedProfiles.size === 0) return;

    // Get application IDs from selected profile cards
    const selectedCards = Array.from(document.querySelectorAll('.agency-dashboard__select-checkbox:checked'))
      .map(cb => {
        const card = cb.closest('.agency-dashboard__card');
        return card ? card.dataset.applicationId : null;
      })
      .filter(id => id);

    if (selectedCards.length === 0) {
      alert('No applications selected');
      return;
    }

    const confirmed = confirm(`Are you sure you want to ${action} ${selectedCards.length} application(s)?`);

    if (!confirmed) return;

    try {
      const promises = selectedCards.map(id => updateApplicationStatus(id, action));
      await Promise.all(promises);
      
      // Reload page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Batch action failed:', error);
      alert('Failed to perform batch action. Please try again.');
    }
  }




  /**
   * Search Functionality
   */
  function initSearch() {
    const searchInput = document.getElementById('agency-search');
    const clearBtn = document.getElementById('clear-search');

    if (!searchInput) return;

    // Debounce search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 300);

      if (clearBtn) {
        clearBtn.style.display = e.target.value ? 'flex' : 'none';
      }
    });

    clearBtn?.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      performSearch('');
    });
  }

  function performSearch(query) {
    // Simple client-side filtering for now
    // Can be enhanced with server-side search
    const cards = document.querySelectorAll('.agency-dashboard__card, .agency-dashboard__gallery-card, .agency-dashboard__list-item, .agency-dashboard__table-row');
    
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const matches = !query || text.includes(query.toLowerCase());
      card.style.display = matches ? '' : 'none';
    });
  }

  /**
   * Filter Interactions
   */
  function initFilters() {
    const filterChips = document.querySelectorAll('.agency-dashboard__filter-chip-remove');
    const toggleBtn = document.getElementById('toggle-advanced-filters');
    const filtersPanel = document.getElementById('advanced-filters-panel');

    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const chipEl = chip.closest('.agency-dashboard__filter-chip');
        const filter = chipEl.dataset.filter;
        removeFilter(filter);
      });
    });

    toggleBtn?.addEventListener('click', () => {
      if (filtersPanel) {
        const isHidden = filtersPanel.style.display === 'none';
        filtersPanel.style.display = isHidden ? 'block' : 'none';
      }
    });
  }

  function removeFilter(filter) {
    // Remove filter from URL and reload
    const url = new URL(window.location);
    url.searchParams.delete(filter);
    window.location.href = url.toString();
  }

  /**
   * Quick Actions
   */
  function initQuickActions() {
    // Handle Accept/Decline/Archive buttons (using application_id)
    // This handles buttons in kanban, list, table, and gallery views
    const actionButtons = document.querySelectorAll(
      '.agency-dashboard__quick-btn[data-action], ' +
      '.agency-dashboard__table-btn[data-action], ' +
      '.agency-dashboard__card-action-btn[data-action]'
    );
    
    actionButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;
        const applicationId = btn.dataset.applicationId;

        if (!applicationId) {
          console.error('No application ID found');
          alert('Unable to find application ID. Please refresh the page.');
          return;
        }

        const confirmed = confirm(`Are you sure you want to ${action} this application?`);
        if (!confirmed) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
          const response = await fetch(`/dashboard/agency/applications/${applicationId}/${action}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Reload to show updated status
              window.location.reload();
            } else {
              throw new Error(data.error || 'Action failed');
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        } catch (error) {
          console.error('Quick action failed:', error);
          alert(`Failed to ${action} application: ${error.message}`);
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
  }

  /**
   * Scout Filters with Real-time Filtering and Debounce
   */
  function initScoutFilters() {
    const scoutFiltersForm = document.getElementById('scout-filters-form');
    const scoutFiltersReset = document.getElementById('scout-filters-reset');
    const scoutGrid = document.querySelector('.agency-dashboard__scout-grid');
    
    if (!scoutFiltersForm || !scoutGrid) return;

    let debounceTimer = null;
    const DEBOUNCE_DELAY = 500; // 500ms debounce

    // Debounce helper function
    function debounce(func, delay) {
      return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
      };
    }

    // Build query string from form data
    function buildQueryString(formData) {
      const params = new URLSearchParams();
      
      const formEntries = new FormData(scoutFiltersForm);
      for (const [key, value] of formEntries.entries()) {
        if (value && value.trim()) {
          params.set(key, value.trim());
        }
      }
      
      return params.toString();
    }

    // Apply filters (with loading state)
    async function applyFilters() {
      const queryString = buildQueryString();
      const url = `/dashboard/agency/discover${queryString ? '?' + queryString : ''}`;
      
      // Show loading state
      scoutGrid.style.opacity = '0.5';
      scoutGrid.style.pointerEvents = 'none';
      
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'text/html',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch filtered results');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract scout grid content
        const newScoutGrid = doc.querySelector('.agency-dashboard__scout-grid');
        if (newScoutGrid) {
          scoutGrid.innerHTML = newScoutGrid.innerHTML;
          
          // Re-initialize invite buttons
          initScoutInvite();
          
          // Update URL without page reload
          window.history.pushState({}, '', url);
        }
      } catch (error) {
        console.error('Error applying filters:', error);
        alert('Failed to apply filters. Please try again.');
      } finally {
        scoutGrid.style.opacity = '1';
        scoutGrid.style.pointerEvents = '';
      }
    }

    // Debounced filter application
    const debouncedApplyFilters = debounce(applyFilters, DEBOUNCE_DELAY);

    // Handle input changes (with debounce)
    const filterInputs = scoutFiltersForm.querySelectorAll('input, select');
    filterInputs.forEach(input => {
      input.addEventListener('input', () => {
        debouncedApplyFilters();
      });
      
      input.addEventListener('change', () => {
        debouncedApplyFilters();
      });
    });

    // Handle form submission (immediate, no debounce)
    scoutFiltersForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(debounceTimer);
      applyFilters();
    });

    // Handle reset button
    if (scoutFiltersReset) {
      scoutFiltersReset.addEventListener('click', () => {
        scoutFiltersForm.reset();
        clearTimeout(debounceTimer);
        window.location.href = '/dashboard/agency/discover';
      });
    }

    // Handle active filter removal (delegated event listener for dynamically added buttons)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.scout-filters__active-remove')) {
        const btn = e.target.closest('.scout-filters__active-remove');
        const filterKey = btn.dataset.filter;
        
        // Map filter keys to form field names
        const filterMap = {
          'height': ['min_height', 'max_height'],
          'age': ['min_age', 'max_age'],
          'city': 'city',
          'gender': 'gender',
          'eye_color': 'eye_color',
          'hair_color': 'hair_color'
        };
        
        const fieldNames = filterMap[filterKey];
        if (Array.isArray(fieldNames)) {
          fieldNames.forEach(name => {
            const input = scoutFiltersForm.querySelector(`[name="${name}"]`);
            if (input) input.value = '';
          });
        } else if (fieldNames) {
          const input = scoutFiltersForm.querySelector(`[name="${fieldNames}"]`);
          if (input) input.value = '';
        }
        
        debouncedApplyFilters();
      }
    });
  }

  /**
   * Scout Talent Invite Handler
   */
  function initScoutInvite() {
    document.querySelectorAll('.agency-dashboard__scout-invite-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const profileId = btn.dataset.profileId;
        const profileName = btn.dataset.profileName;

        if (!profileId) {
          console.error('No profile ID found');
          return;
        }

        const confirmed = confirm(`Invite ${profileName} to apply to your agency?`);
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = 'Inviting...';

        try {
          const response = await fetch(`/dashboard/agency/discover/${profileId}/invite`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              alert(`Invitation sent to ${profileName}! They've been added to your applicants queue.`);
              // Redirect to My Applicants view
              window.location.href = '/dashboard/agency/applicants';
            } else {
              throw new Error(data.error || 'Invite failed');
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        } catch (error) {
          console.error('Scout invite failed:', error);
          alert(`Failed to send invitation: ${error.message}`);
          btn.disabled = false;
          btn.textContent = 'Invite to Apply';
        }
      });
    });
  }

  /**
   * Notes & Tags Modal
   */
  function initNotesAndTags() {
    const modal = document.getElementById('notes-tags-modal');
    const overlay = modal?.querySelector('.agency-notes-modal__overlay');
    const closeBtn = document.getElementById('notes-modal-close');
    const notesBtns = document.querySelectorAll('.agency-dashboard__card-notes-btn, .agency-dashboard__card-notes-indicator');
    const addNoteBtn = document.getElementById('add-note-btn');
    const addTagBtn = document.getElementById('add-tag-btn');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const cancelNoteBtn = document.getElementById('cancel-note-btn');
    const saveTagBtn = document.getElementById('save-tag-btn');
    const cancelTagBtn = document.getElementById('cancel-tag-btn');
    const noteInput = document.getElementById('note-input');
    const noteInputWrapper = document.getElementById('note-input-wrapper');
    const tagInput = document.getElementById('tag-input');
    const tagInputWrapper = document.getElementById('tag-input-wrapper');
    const tagsContainer = document.getElementById('tags-container');
    const notesContainer = document.getElementById('notes-container');
    const colorOptions = document.querySelectorAll('.agency-notes-modal__color-option');

    let currentApplicationId = null;
    let currentProfileId = null;
    let selectedTagColor = '#C9A55A';

    // Open modal
    notesBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const applicationId = btn.dataset.applicationId;
        const profileId = btn.dataset.profileId || btn.closest('.agency-dashboard__card')?.dataset.profileId;
        
        if (!applicationId) {
          console.error('No application ID found');
          return;
        }

        currentApplicationId = applicationId;
        currentProfileId = profileId;

        // Get profile name from card
        const card = btn.closest('.agency-dashboard__card');
        const nameEl = card?.querySelector('.agency-dashboard__card-name');
        const profileName = nameEl?.textContent?.trim() || 'Unknown';

        document.getElementById('notes-modal-name').textContent = profileName;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Focus first focusable element
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          setTimeout(() => firstFocusable.focus(), 100);
        }

        // Load notes and tags
        loadNotes(applicationId);
        loadTags(applicationId);
      });
    });

    // Close modal
    function closeModal() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      currentApplicationId = null;
      currentProfileId = null;
      hideNoteInput();
      hideTagInput();
    }

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    // Add Note
    addNoteBtn?.addEventListener('click', () => {
      hideTagInput();
      showNoteInput();
    });

    cancelNoteBtn?.addEventListener('click', hideNoteInput);

    saveNoteBtn?.addEventListener('click', async () => {
      const noteText = noteInput?.value.trim();
      if (!noteText || !currentApplicationId) return;

      try {
        const response = await fetch(`/api/agency/applications/${currentApplicationId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ note: noteText })
        });

        if (response.ok) {
          noteInput.value = '';
          hideNoteInput();
          loadNotes(currentApplicationId);
          // Update notes count on card
          updateNotesCountOnCard(currentApplicationId);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to save note');
        }
      } catch (error) {
        console.error('Save note error:', error);
        alert('Failed to save note. Please try again.');
      }
    });

    // Add Tag
    addTagBtn?.addEventListener('click', () => {
      hideNoteInput();
      showTagInput();
    });

    cancelTagBtn?.addEventListener('click', hideTagInput);

    // Color picker
    colorOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        colorOptions.forEach(b => b.classList.remove('agency-notes-modal__color-option--selected'));
        btn.classList.add('agency-notes-modal__color-option--selected');
        selectedTagColor = btn.dataset.color;
      });
    });

    // Select first color by default
    if (colorOptions.length > 0) {
      colorOptions[0].classList.add('agency-notes-modal__color-option--selected');
    }

    saveTagBtn?.addEventListener('click', async () => {
      const tagText = tagInput?.value.trim();
      if (!tagText || !currentApplicationId) return;

      try {
        const response = await fetch(`/api/agency/applications/${currentApplicationId}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tag: tagText, color: selectedTagColor })
        });

        if (response.ok) {
          tagInput.value = '';
          hideTagInput();
          loadTags(currentApplicationId);
          // Reload page to update tags on cards
          window.location.reload();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to save tag');
        }
      } catch (error) {
        console.error('Save tag error:', error);
        alert('Failed to save tag. Please try again.');
      }
    });

    // Enter key to save
    noteInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        saveNoteBtn?.click();
      }
    });

    tagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveTagBtn?.click();
      }
    });

    function showNoteInput() {
      noteInputWrapper.style.display = 'block';
      noteInput?.focus();
    }

    function hideNoteInput() {
      noteInputWrapper.style.display = 'none';
      noteInput.value = '';
    }

    function showTagInput() {
      tagInputWrapper.style.display = 'block';
      tagInput?.focus();
    }

    function hideTagInput() {
      tagInputWrapper.style.display = 'none';
      tagInput.value = '';
    }

    async function loadNotes(applicationId) {
      try {
        const response = await fetch(`/api/agency/applications/${applicationId}/notes`);
        if (response.ok) {
          const notes = await response.json();
          renderNotes(notes);
        }
      } catch (error) {
        console.error('Load notes error:', error);
      }
    }

    async function loadTags(applicationId) {
      try {
        const response = await fetch(`/api/agency/applications/${applicationId}/tags`);
        if (response.ok) {
          const tags = await response.json();
          renderTags(tags);
        }
      } catch (error) {
        console.error('Load tags error:', error);
      }
    }

    function renderNotes(notes) {
      if (!notesContainer) return;

      if (notes.length === 0) {
        notesContainer.innerHTML = '<p class="agency-notes-modal__empty">No notes yet. Click "Add Note" to create one.</p>';
        return;
      }

      notesContainer.innerHTML = notes.map(note => {
        const date = new Date(note.created_at);
        const formattedDate = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return `
          <div class="agency-notes-modal__note" data-note-id="${note.id}">
            <div class="agency-notes-modal__note-content">${escapeHtml(note.note)}</div>
            <div class="agency-notes-modal__note-meta">
              <span class="agency-notes-modal__note-date">${formattedDate}</span>
              <button class="agency-notes-modal__note-delete" data-note-id="${note.id}" title="Delete note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Add delete handlers
      notesContainer.querySelectorAll('.agency-notes-modal__note-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const noteId = btn.dataset.noteId;
          if (!confirm('Delete this note?')) return;

          try {
            const response = await fetch(`/api/agency/applications/${currentApplicationId}/notes/${noteId}`, {
              method: 'DELETE'
            });

            if (response.ok) {
              loadNotes(currentApplicationId);
              updateNotesCountOnCard(currentApplicationId);
            } else {
              alert('Failed to delete note');
            }
          } catch (error) {
            console.error('Delete note error:', error);
            alert('Failed to delete note. Please try again.');
          }
        });
      });
    }

    function renderTags(tags) {
      if (!tagsContainer) return;

      if (tags.length === 0) {
        tagsContainer.innerHTML = '<p class="agency-notes-modal__empty">No tags yet. Click "Add Tag" to create one.</p>';
        return;
      }

      tagsContainer.innerHTML = tags.map(tag => {
        const colorStyle = tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;` : '';
        return `
          <div class="agency-notes-modal__tag-item" data-tag-id="${tag.id}">
            <span class="agency-notes-modal__tag-label" style="${colorStyle}">${escapeHtml(tag.tag)}</span>
            <button class="agency-notes-modal__tag-delete" data-tag-id="${tag.id}" title="Remove tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;
      }).join('');

      // Add delete handlers
      tagsContainer.querySelectorAll('.agency-notes-modal__tag-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tagId = btn.dataset.tagId;
          if (!confirm('Remove this tag?')) return;

          try {
            const response = await fetch(`/api/agency/applications/${currentApplicationId}/tags/${tagId}`, {
              method: 'DELETE'
            });

            if (response.ok) {
              loadTags(currentApplicationId);
              // Reload page to update tags on cards
              window.location.reload();
            } else {
              alert('Failed to remove tag');
            }
          } catch (error) {
            console.error('Delete tag error:', error);
            alert('Failed to remove tag. Please try again.');
          }
        });
      });
    }

    function updateNotesCountOnCard(applicationId) {
      const card = document.querySelector(`[data-application-id="${applicationId}"]`);
      if (!card) return;

      // Reload notes to get updated count
      loadNotes(applicationId).then(() => {
        // Update count display on card if it exists
        const notesIndicator = card.querySelector('.agency-dashboard__card-notes-indicator');
        if (notesIndicator) {
          // Count will be updated on next page load, but we can update the text
          fetch(`/api/agency/applications/${applicationId}/notes`)
            .then(r => r.json())
            .then(notes => {
              const count = notes.length;
              const countText = notesIndicator.querySelector('span');
              if (countText) {
                countText.textContent = `${count} note${count !== 1 ? 's' : ''}`;
              }
            })
            .catch(() => {});
        }
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  /**
   * Agency Profile Accordion
   */
  function initAgencyProfileAccordion() {
    const accordionHeaders = document.querySelectorAll('.agency-profile-accordion__header');
    const profileForm = document.getElementById('agency-profile-form');
    const brandingForm = document.getElementById('agency-branding-form');
    const settingsForm = document.getElementById('agency-settings-form');
    const logoInput = document.getElementById('agency-logo');
    const logoPreview = document.getElementById('logo-preview-img');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    const brandColorInput = document.getElementById('agency-brand-color');
    const brandColorText = document.getElementById('agency-brand-color-text');

    // Accordion toggle
    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const target = header.dataset.accordion;
        const content = document.querySelector(`[data-content="${target}"]`);
        const isOpen = content.style.display === 'block';

        // Close all
        document.querySelectorAll('.agency-profile-accordion__content').forEach(c => {
          c.style.display = 'none';
        });
        document.querySelectorAll('.agency-profile-accordion__header').forEach(h => {
          h.classList.remove('agency-profile-accordion__header--active');
          const chevron = h.querySelector('.agency-profile-accordion__chevron');
          if (chevron) chevron.style.transform = 'rotate(0deg)';
        });

        // Toggle target
        if (!isOpen) {
          content.style.display = 'block';
          header.classList.add('agency-profile-accordion__header--active');
          const chevron = header.querySelector('.agency-profile-accordion__chevron');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
      });
    });

    // Profile form
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(profileForm);
      const data = Object.fromEntries(formData);
      const messageEl = document.getElementById('agency-profile-message');
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      const btnSpan = submitBtn?.querySelector('span');
      const spinner = submitBtn?.querySelector('.agency-profile-form__btn-spinner');

      submitBtn.disabled = true;
      if (btnSpan) btnSpan.textContent = 'Saving...';
      if (spinner) spinner.style.display = 'block';
      messageEl.textContent = '';
      messageEl.className = 'agency-profile-form__message';

      try {
        const response = await fetch('/api/agency/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          messageEl.textContent = result.message || 'Profile updated successfully!';
          messageEl.classList.add('agency-profile-form__message--success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          messageEl.textContent = result.error || 'Failed to update profile';
          messageEl.classList.add('agency-profile-form__message--error');
        }
      } catch (error) {
        console.error('Profile update error:', error);
        messageEl.textContent = 'Failed to update profile. Please try again.';
        messageEl.classList.add('agency-profile-form__message--error');
      } finally {
        submitBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Save Changes';
        if (spinner) spinner.style.display = 'none';
      }
    });

    // Branding form
    brandingForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(brandingForm);
      const messageEl = document.getElementById('agency-branding-message');
      const submitBtn = brandingForm.querySelector('button[type="submit"]');
      const btnSpan = submitBtn?.querySelector('span');
      const spinner = submitBtn?.querySelector('.agency-profile-form__btn-spinner');

      submitBtn.disabled = true;
      if (btnSpan) btnSpan.textContent = 'Saving...';
      if (spinner) spinner.style.display = 'block';
      messageEl.textContent = '';
      messageEl.className = 'agency-profile-form__message';

      try {
        const response = await fetch('/api/agency/branding', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok) {
          messageEl.textContent = result.message || 'Branding updated successfully!';
          messageEl.classList.add('agency-profile-form__message--success');
          if (result.logo_path) {
            // Update logo preview
            if (logoPreview) {
              logoPreview.src = result.logo_path.startsWith('http') ? result.logo_path : '/' + result.logo_path;
              logoPreview.closest('.agency-profile-form__logo-preview').style.display = 'block';
              if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            }
          }
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          messageEl.textContent = result.error || 'Failed to update branding';
          messageEl.classList.add('agency-profile-form__message--error');
        }
      } catch (error) {
        console.error('Branding update error:', error);
        messageEl.textContent = 'Failed to update branding. Please try again.';
        messageEl.classList.add('agency-profile-form__message--error');
      } finally {
        submitBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Save Branding';
        if (spinner) spinner.style.display = 'none';
      }
    });

    // Logo preview
    logoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (logoPreview) {
            logoPreview.src = event.target.result;
            logoPreview.closest('.agency-profile-form__logo-preview').style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
          } else {
            // Create preview if it doesn't exist
            const preview = document.createElement('div');
            preview.className = 'agency-profile-form__logo-preview';
            preview.innerHTML = `
              <img src="${event.target.result}" alt="Agency Logo" id="logo-preview-img">
              <button type="button" class="agency-profile-form__logo-remove" id="remove-logo-btn">Remove</button>
            `;
            logoInput.parentElement.insertBefore(preview, logoInput);
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Remove logo
    removeLogoBtn?.addEventListener('click', async () => {
      if (!confirm('Remove agency logo?')) return;

      try {
        const formData = new FormData();
        formData.append('remove_logo', 'true');

        const response = await fetch('/api/agency/branding', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          if (logoPreview) logoPreview.closest('.agency-profile-form__logo-preview').style.display = 'none';
          if (logoPlaceholder) logoPlaceholder.style.display = 'block';
          logoInput.value = '';
          window.location.reload();
        }
      } catch (error) {
        console.error('Remove logo error:', error);
        alert('Failed to remove logo. Please try again.');
      }
    });

    // Color picker sync
    if (brandColorInput && brandColorText) {
      brandColorInput.addEventListener('input', (e) => {
        brandColorText.value = e.target.value.toUpperCase();
      });

      brandColorText.addEventListener('input', (e) => {
        const value = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(value)) {
          brandColorInput.value = value;
        }
      });
    }

    // Settings form
    settingsForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(settingsForm);
      const data = {
        notify_new_applications: formData.has('notify_new_applications'),
        notify_status_changes: formData.has('notify_status_changes'),
        default_view: formData.get('default_view')
      };
      const messageEl = document.getElementById('agency-settings-message');
      const submitBtn = settingsForm.querySelector('button[type="submit"]');
      const btnSpan = submitBtn?.querySelector('span');
      const spinner = submitBtn?.querySelector('.agency-profile-form__btn-spinner');

      submitBtn.disabled = true;
      if (btnSpan) btnSpan.textContent = 'Saving...';
      if (spinner) spinner.style.display = 'block';
      messageEl.textContent = '';
      messageEl.className = 'agency-profile-form__message';

      try {
        const response = await fetch('/api/agency/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          messageEl.textContent = result.message || 'Settings updated successfully!';
          messageEl.classList.add('agency-profile-form__message--success');
          setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'agency-profile-form__message';
          }, 3000);
        } else {
          messageEl.textContent = result.error || 'Failed to update settings';
          messageEl.classList.add('agency-profile-form__message--error');
        }
      } catch (error) {
        console.error('Settings update error:', error);
        messageEl.textContent = 'Failed to update settings. Please try again.';
        messageEl.classList.add('agency-profile-form__message--error');
      } finally {
        submitBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Save Settings';
        if (spinner) spinner.style.display = 'none';
      }
    });
  }

  /**
   * Export Data
   */
  function initExportData() {
    const exportBtn = document.getElementById('export-data-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
      // Get current filters from URL or state
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get('status') || '';
      const city = urlParams.get('city') || '';
      const search = urlParams.get('search') || '';

      // Show export options modal
      showExportModal({ status, city, search });
    });
  }

  /**
   * Settings Button
   */
  function initSettingsButton() {
    const settingsBtn = document.getElementById('settings-btn');
    if (!settingsBtn) return;

    settingsBtn.addEventListener('click', () => {
      window.location.href = '/dashboard/settings';
    });
  }

  function showExportModal(filters) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'agency-export-modal';
    modal.innerHTML = `
      <div class="agency-export-modal__overlay"></div>
      <div class="agency-export-modal__content">
        <div class="agency-export-modal__header">
          <h2 class="agency-export-modal__title">Export Applications</h2>
          <button class="agency-export-modal__close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="agency-export-modal__body">
          <div class="agency-export-modal__field">
            <label>Export Format</label>
            <div class="agency-export-modal__radio-group">
              <label class="agency-export-modal__radio-label">
                <input type="radio" name="export-format" value="csv" checked>
                <span>CSV (Excel compatible)</span>
              </label>
              <label class="agency-export-modal__radio-label">
                <input type="radio" name="export-format" value="json">
                <span>JSON (Developer format)</span>
              </label>
            </div>
          </div>
          <div class="agency-export-modal__info">
            <p>Exporting <strong>${getFilteredCount(filters)}</strong> application(s) based on current filters.</p>
          </div>
        </div>
        <div class="agency-export-modal__actions">
          <button class="agency-export-modal__btn agency-export-modal__btn--secondary" id="export-cancel-btn">Cancel</button>
          <button class="agency-export-modal__btn agency-export-modal__btn--primary" id="export-download-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Export
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const overlay = modal.querySelector('.agency-export-modal__overlay');
    const closeBtn = modal.querySelector('.agency-export-modal__close');
    const cancelBtn = document.getElementById('export-cancel-btn');
    const downloadBtn = document.getElementById('export-download-btn');

    function closeModal() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      setTimeout(() => modal.remove(), 300);
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // ESC key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus first focusable element
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 100);
    }

    downloadBtn.addEventListener('click', async () => {
      const format = modal.querySelector('input[name="export-format"]:checked').value;
      const urlParams = new URLSearchParams({
        format,
        ...filters
      });

      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `
        <svg class="agency-export-modal__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Exporting...
      `;

      try {
        const response = await fetch(`/api/agency/export?${urlParams.toString()}`);
        
        if (response.ok) {
          if (format === 'json') {
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pholio-applications-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pholio-applications-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }
          closeModal();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to export data');
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Export
          `;
        }
      } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data. Please try again.');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Export
        `;
      }
    });

    // ESC key to close
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  function getFilteredCount(filters) {
    // Estimate based on current view or use stats
    if (state.stats) {
      if (filters.status === 'pending') return state.stats.pending || 0;
      if (filters.status === 'accepted') return state.stats.accepted || 0;
      if (filters.status === 'declined') return state.stats.declined || 0;
      if (filters.status === 'archived') return state.stats.archived || 0;
      return state.stats.total || 0;
    }
    return 'all';
  }

  /**
   * API Helpers
   */
  async function updateApplicationStatus(applicationId, action) {
    const response = await fetch(`/dashboard/agency/applications/${applicationId}/${action}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Boards Management
   */
  function initBoardsManagement() {
    const createBtn = document.getElementById('create-board-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => openBoardEditor());
    }

    // Handle board card actions
    document.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]');
      if (!action || !action.dataset.boardId) return;

      const boardId = action.dataset.boardId;
      const actionType = action.dataset.action;

      switch (actionType) {
        case 'edit':
          await openBoardEditor(boardId);
          break;
        case 'duplicate':
          await duplicateBoard(boardId);
          break;
        case 'toggle':
          await toggleBoard(boardId);
          break;
        case 'delete':
          await deleteBoard(boardId);
          break;
      }
    });
  }

  async function openBoardEditor(boardId = null) {
    const modal = document.getElementById('board-editor-modal');
    const form = document.getElementById('board-editor-form');
    const title = document.getElementById('board-editor-title');
    
    if (!modal || !form) {
      // Fallback: Navigate to boards page or show alert
      if (boardId) {
        // For editing, navigate to applicants filtered by board
        window.location.href = `/dashboard/agency/applicants?board_id=${boardId}`;
      } else {
        // For creating, navigate to boards page
        window.location.href = '/dashboard/agency/boards';
        // Try to trigger create button after navigation
        setTimeout(() => {
          const createBtn = document.getElementById('create-board-btn');
          if (createBtn) {
            createBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            createBtn.focus();
          }
        }, 100);
      }
      return;
    }

    // Reset form
    form.reset();
    document.getElementById('board-editor-id').value = boardId || '';
    title.textContent = boardId ? 'Edit Board' : 'Create New Board';

    // Load board data if editing
    if (boardId) {
      try {
        const response = await fetch(`/api/agency/boards/${boardId}`);
        if (!response.ok) throw new Error('Failed to load board');
        const board = await response.json();

        // Populate form
        document.getElementById('board-name').value = board.name || '';
        document.getElementById('board-description').value = board.description || '';
        document.getElementById('board-is-active').checked = board.is_active !== false;

        // Populate requirements
        if (board.requirements) {
          const req = board.requirements;
          if (req.min_age) document.getElementById('req-min-age').value = req.min_age;
          if (req.max_age) document.getElementById('req-max-age').value = req.max_age;
          if (req.min_height_cm) document.getElementById('req-min-height').value = req.min_height_cm;
          if (req.max_height_cm) document.getElementById('req-max-height').value = req.max_height_cm;
          if (req.genders && Array.isArray(req.genders)) {
            req.genders.forEach(gender => {
              const checkbox = document.querySelector(`input[name="genders"][value="${gender}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
          if (req.min_bust) document.getElementById('req-min-bust').value = req.min_bust;
          if (req.max_bust) document.getElementById('req-max-bust').value = req.max_bust;
          if (req.min_waist) document.getElementById('req-min-waist').value = req.min_waist;
          if (req.max_waist) document.getElementById('req-max-waist').value = req.max_waist;
          if (req.min_hips) document.getElementById('req-min-hips').value = req.min_hips;
          if (req.max_hips) document.getElementById('req-max-hips').value = req.max_hips;
          if (req.min_social_reach) document.getElementById('req-min-social-reach').value = req.min_social_reach;
          if (req.social_reach_importance) document.getElementById('req-social-importance').value = req.social_reach_importance;
        }

        // Populate weights
        if (board.scoring_weights) {
          const weights = board.scoring_weights;
          Object.keys(weights).forEach(key => {
            if (key.endsWith('_weight')) {
              const input = document.getElementById(`weight-${key.replace('_weight', '')}`);
              if (input) {
                input.value = weights[key] || 0;
                updateWeightValue(input);
              }
            }
          });
          updateTotalWeight();
        }
      } catch (error) {
        console.error('Error loading board:', error);
        alert('Failed to load board data');
        return;
      }
    }

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function initBoardEditor() {
    const modal = document.getElementById('board-editor-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('board-editor-close');
    const cancelBtn = document.getElementById('board-editor-cancel');
    const form = document.getElementById('board-editor-form');
    const tabs = document.querySelectorAll('.board-editor-modal__tab');

    // Close modal
    const closeHandlers = [closeBtn, cancelBtn, modal.querySelector('.board-editor-modal__overlay')];
    closeHandlers.forEach(el => {
      if (el) el.addEventListener('click', () => closeBoardEditor());
    });

    // ESC key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        closeBoardEditor();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus trap: focus first focusable element when modal opens
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 100);
    }

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('board-editor-modal__tab--active'));
        tab.classList.add('board-editor-modal__tab--active');

        document.querySelectorAll('.board-editor-modal__tab-content').forEach(content => {
          content.classList.remove('board-editor-modal__tab-content--active');
        });
        const content = document.querySelector(`[data-content="${tabName}"]`);
        if (content) content.classList.add('board-editor-modal__tab-content--active');
      });
    });

    // Weight sliders
    document.querySelectorAll('input[type="range"][name$="_weight"]').forEach(slider => {
      slider.addEventListener('input', () => updateWeightValue(slider));
      updateWeightValue(slider);
    });
    updateTotalWeight();

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBoard();
      });
    }
  }

  function updateWeightValue(slider) {
    const valueSpan = document.getElementById(`${slider.id}-value`);
    if (valueSpan) valueSpan.textContent = slider.value;
    updateTotalWeight();
  }

  function updateTotalWeight() {
    const sliders = document.querySelectorAll('input[type="range"][name$="_weight"]');
    let total = 0;
    sliders.forEach(slider => {
      total += parseFloat(slider.value) || 0;
    });
    const totalSpan = document.getElementById('total-weight-value');
    if (totalSpan) totalSpan.textContent = total.toFixed(1);
  }

  function closeBoardEditor() {
    const modal = document.getElementById('board-editor-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  async function saveBoard() {
    const form = document.getElementById('board-editor-form');
    const boardId = document.getElementById('board-editor-id').value;
    const saveBtn = document.getElementById('board-editor-save');
    const spinner = saveBtn.querySelector('.board-editor-modal__spinner');
    const saveText = saveBtn.querySelector('span');

    try {
      saveBtn.disabled = true;
      spinner.style.display = 'block';
      saveText.textContent = 'Saving...';

      // Collect form data
      const formData = new FormData(form);
      const name = formData.get('name');
      const description = formData.get('description');
      const is_active = formData.get('is_active') === 'on';

      // Collect requirements
      const requirements = {
        min_age: formData.get('min_age') || null,
        max_age: formData.get('max_age') || null,
        min_height_cm: formData.get('min_height_cm') || null,
        max_height_cm: formData.get('max_height_cm') || null,
        genders: formData.getAll('genders'),
        min_bust: formData.get('min_bust') || null,
        max_bust: formData.get('max_bust') || null,
        min_waist: formData.get('min_waist') || null,
        max_waist: formData.get('max_waist') || null,
        min_hips: formData.get('min_hips') || null,
        max_hips: formData.get('max_hips') || null,
        min_social_reach: formData.get('min_social_reach') || null,
        social_reach_importance: formData.get('social_reach_importance') || null
      };

      // Collect weights
      const weights = {};
      document.querySelectorAll('input[type="range"][name$="_weight"]').forEach(slider => {
        weights[slider.name] = parseFloat(slider.value) || 0;
      });

      if (boardId) {
        // Update existing board
        await fetch(`/api/agency/boards/${boardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, is_active })
        });

        await fetch(`/api/agency/boards/${boardId}/requirements`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requirements)
        });

        await fetch(`/api/agency/boards/${boardId}/weights`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(weights)
        });
      } else {
        // Create new board
        await fetch('/api/agency/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, is_active, requirements, scoring_weights: weights })
        });
      }

      // Reload page to show updated boards
      window.location.reload();
    } catch (error) {
      console.error('Error saving board:', error);
      alert('Failed to save board. Please try again.');
    } finally {
      saveBtn.disabled = false;
      spinner.style.display = 'none';
      saveText.textContent = 'Save Board';
    }
  }

  async function duplicateBoard(boardId) {
    if (!confirm('Duplicate this board?')) return;

    try {
      const response = await fetch(`/api/agency/boards/${boardId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to duplicate board');
      
      window.location.reload();
    } catch (error) {
      console.error('Error duplicating board:', error);
      alert('Failed to duplicate board');
    }
  }

  async function toggleBoard(boardId) {
    try {
      // Get current board state
      const response = await fetch(`/api/agency/boards/${boardId}`);
      if (!response.ok) throw new Error('Failed to load board');
      const board = await response.json();

      await fetch(`/api/agency/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !board.is_active })
      });

      window.location.reload();
    } catch (error) {
      console.error('Error toggling board:', error);
      alert('Failed to update board');
    }
  }

  async function deleteBoard(boardId) {
    if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/agency/boards/${boardId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to delete board');
      
      window.location.reload();
    } catch (error) {
      console.error('Error deleting board:', error);
      alert('Failed to delete board');
    }
  }

  /**
   * Analytics Section
   */
  function initAnalytics() {
    const analyticsSection = document.getElementById('analytics');
    if (!analyticsSection) return;

    // Only load if analytics section is visible or in viewport
    const loadAnalytics = async () => {
      const loadingEl = document.getElementById('analytics-loading');
      const errorEl = document.getElementById('analytics-error');
      const contentEl = document.getElementById('analytics-content');

      if (!loadingEl || !errorEl || !contentEl) {
        console.warn('Analytics elements not found, skipping load');
        return;
      }

      try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        contentEl.style.display = 'none';

        const response = await fetch('/api/agency/analytics');
        if (!response.ok) {
          let errorMessage = `Failed to load analytics: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (e) {
            // If JSON parsing fails, use default message
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data || !data.success || !data.analytics) {
          throw new Error(data?.error || 'Invalid analytics data received');
        }

        const analytics = data.analytics;

        // Update key metrics
        const totalEl = document.getElementById('analytics-total');
        if (totalEl) {
          totalEl.textContent = analytics.byStatus.total || 0;
        }
        
        const acceptanceRateEl = document.getElementById('analytics-acceptance-rate');
        if (acceptanceRateEl) {
          acceptanceRateEl.textContent = 
            analytics.acceptanceRate !== undefined ? `${analytics.acceptanceRate}%` : '—';
        }
        
        // Note: analytics-this-month and analytics-avg-score were replaced with
        // analytics-profile-views and analytics-response-time in the new design
        // These are static values for now

        // Update status breakdown
        const statusGrid = document.getElementById('analytics-status-grid');
        if (statusGrid) {
          const statuses = [
            { label: 'Pending', value: analytics.byStatus.pending, key: 'pending' },
            { label: 'Accepted', value: analytics.byStatus.accepted, key: 'accepted' },
            { label: 'Declined', value: analytics.byStatus.declined, key: 'declined' },
            { label: 'Archived', value: analytics.byStatus.archived, key: 'archived' }
          ];

          statusGrid.innerHTML = statuses.map(status => `
            <div class="agency-dashboard__analytics-status-item">
              <span class="agency-dashboard__analytics-status-label">${status.label}</span>
              <span class="agency-dashboard__analytics-status-value">${status.value || 0}</span>
            </div>
          `).join('');
        }

        // Update match score distribution
        const scoresEl = document.getElementById('analytics-scores');
        if (scoresEl && analytics.matchScores.distribution) {
          const dist = analytics.matchScores.distribution;
          scoresEl.innerHTML = `
            <div class="agency-dashboard__analytics-score-item agency-dashboard__analytics-score-item--excellent">
              <span class="agency-dashboard__analytics-score-label">Excellent (80-100)</span>
              <span class="agency-dashboard__analytics-score-value">${dist.excellent || 0}</span>
            </div>
            <div class="agency-dashboard__analytics-score-item agency-dashboard__analytics-score-item--good">
              <span class="agency-dashboard__analytics-score-label">Good (60-79)</span>
              <span class="agency-dashboard__analytics-score-value">${dist.good || 0}</span>
            </div>
            <div class="agency-dashboard__analytics-score-item agency-dashboard__analytics-score-item--fair">
              <span class="agency-dashboard__analytics-score-label">Fair (40-59)</span>
              <span class="agency-dashboard__analytics-score-value">${dist.fair || 0}</span>
            </div>
            <div class="agency-dashboard__analytics-score-item agency-dashboard__analytics-score-item--poor">
              <span class="agency-dashboard__analytics-score-label">Poor (0-39)</span>
              <span class="agency-dashboard__analytics-score-value">${dist.poor || 0}</span>
            </div>
          `;
        }

        // Update applications by board
        const boardsEl = document.getElementById('analytics-boards');
        if (boardsEl && analytics.byBoard && analytics.byBoard.length > 0) {
          boardsEl.innerHTML = analytics.byBoard.map(board => `
            <div class="agency-dashboard__analytics-board-item">
              <span class="agency-dashboard__analytics-board-name">${board.board_name}</span>
              <span class="agency-dashboard__analytics-board-count">${board.count}</span>
            </div>
          `).join('');
        } else if (boardsEl) {
          boardsEl.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: var(--agency-text-tertiary); font-size: 0.875rem;">
              No applications assigned to boards yet
            </div>
          `;
        }

        // Render charts
        const trafficChartEl = document.getElementById('analytics-traffic-chart');
        if (trafficChartEl && analytics.timeline) {
          renderTrafficChart(trafficChartEl, analytics.timeline);
        }

        const distributionChartEl = document.getElementById('analytics-distribution-chart');
        if (distributionChartEl) {
          // For now, use placeholder data - can be enhanced with actual experience level data
          renderDistributionChart(distributionChartEl, {
            'New Faces': 45,
            'Developing': 30,
            'Professional': 20,
            'Top Talent': 5
          });
        }

        // Show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
      } catch (error) {
        console.error('Error loading analytics:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
          errorEl.style.display = 'block';
          // Show error message
          const errorMessage = errorEl.querySelector('div > div:last-child');
          if (errorMessage) {
            errorMessage.textContent = error.message || 'Unable to load analytics data at this time';
          }
        }
      }
    };

    // Load analytics immediately if section is visible
    if (analyticsSection.offsetParent !== null) {
      loadAnalytics();
    } else {
      // Use Intersection Observer to load when section comes into view
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loadAnalytics();
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '100px' });

      observer.observe(analyticsSection);
    }
  }

  /**
   * Render Traffic Chart (Weekly Overview)
   */
  function renderTrafficChart(container, timelineData) {
    if (!timelineData || timelineData.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--agency-text-tertiary);">No traffic data available</div>';
      return;
    }

    // Get last 7 days of data
    const last7Days = timelineData.slice(-7);
    const maxCount = Math.max(...last7Days.map(d => d.count), 1);
    const chartHeight = 200;
    const chartWidth = container.offsetWidth || 600;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', chartWidth);
    svg.setAttribute('height', chartHeight);
    svg.style.overflow = 'visible';

    // Create line path
    const points = last7Days.map((d, i) => {
      const x = padding.left + (i / (last7Days.length - 1 || 1)) * graphWidth;
      const y = padding.top + graphHeight - (d.count / maxCount) * graphHeight;
      return { x, y, count: d.count, date: d.date };
    });

    // Draw grid lines
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * graphHeight;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('x2', padding.left + graphWidth);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(0, 0, 0, 0.05)');
      line.setAttribute('stroke-width', '1');
      gridGroup.appendChild(line);
    }
    svg.appendChild(gridGroup);

    // Draw line
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--agency-text-primary)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    // Draw points
    points.forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', 'var(--agency-text-primary)');
      svg.appendChild(circle);
    });

    // Draw X-axis labels (day names)
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    points.forEach((point, i) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', point.x);
      text.setAttribute('y', chartHeight - padding.bottom + 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', 'var(--agency-text-tertiary)');
      text.textContent = dayNames[i] || '';
      svg.appendChild(text);
    });

    // Draw Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const value = Math.round((maxCount / 4) * (4 - i));
      const y = padding.top + (i / 4) * graphHeight;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', padding.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', 'var(--agency-text-tertiary)');
      text.textContent = value;
      svg.appendChild(text);
    }

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /**
   * Render Distribution Chart (Donut Chart)
   */
  function renderDistributionChart(container, data) {
    if (!data || Object.keys(data).length === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--agency-text-tertiary);">No distribution data available</div>';
      return;
    }

    const chartSize = 200;
    const centerX = chartSize / 2;
    const centerY = chartSize / 2;
    const radius = 70;
    const innerRadius = 40;

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    if (total === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--agency-text-tertiary);">No data available</div>';
      return;
    }

    const colors = {
      'New Faces': '#1a1a1a',
      'Developing': '#666',
      'Professional': '#999',
      'Top Talent': '#ccc'
    };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', chartSize);
    svg.setAttribute('height', chartSize);
    svg.setAttribute('viewBox', `0 0 ${chartSize} ${chartSize}`);

    let currentAngle = -Math.PI / 2; // Start at top

    Object.entries(data).forEach(([label, value]) => {
      const percentage = value / total;
      const angle = percentage * 2 * Math.PI;

      // Create arc path
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArcFlag = angle > Math.PI ? 1 : 0;

      const outerArc = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      const innerArc = `M ${x2} ${y2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1} Z`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', outerArc + innerArc);
      path.setAttribute('fill', colors[label] || '#999');
      svg.appendChild(path);

      currentAngle = endAngle;
    });

    // Add center text
    const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerText.setAttribute('x', centerX);
    centerText.setAttribute('y', centerY);
    centerText.setAttribute('text-anchor', 'middle');
    centerText.setAttribute('dominant-baseline', 'middle');
    centerText.setAttribute('font-size', '24');
    centerText.setAttribute('font-weight', 'bold');
    centerText.setAttribute('fill', 'var(--agency-text-primary)');
    centerText.textContent = total;
    svg.appendChild(centerText);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /**
   * Overview Dashboard
   */
  function initOverviewDashboard() {
    const overviewSection = document.getElementById('overview-dashboard');
    if (!overviewSection) return;

    const activityChart = document.getElementById('overview-activity-chart');
    const thisMonthEl = document.getElementById('overview-this-month');
    const avgScoreEl = document.getElementById('overview-avg-score');

    // Load recent applicants
    const loadRecentApplicants = async () => {
      const container = document.getElementById('overview-recent-applicants');
      if (!container) return;

      try {
        const response = await fetch('/api/agency/overview/recent-applicants?limit=5');
        if (!response.ok) throw new Error('Failed to load recent applicants');

        const data = await response.json();
        if (!data.success || !data.applicants) {
          container.innerHTML = '<div class="agency-overview__empty">No recent applicants</div>';
          return;
        }

        if (data.applicants.length === 0) {
          container.innerHTML = '<div class="agency-overview__empty">No recent applicants</div>';
          return;
        }

        const applicantsHtml = data.applicants.map(applicant => {
          const imageSrc = applicant.profileImage && applicant.profileImage.startsWith('http') 
            ? applicant.profileImage 
            : (applicant.profileImage || '/images/default-avatar.png');
          
          // Make items clickable to view applicant
          return `
            <div class="agency-overview__recent-item" style="cursor: pointer;" data-profile-id="${applicant.profileId}" data-application-id="${applicant.applicationId || ''}">
              <div class="agency-overview__recent-avatar">
                <img src="${imageSrc}" alt="${applicant.name}">
              </div>
              <div class="agency-overview__recent-info">
                <div class="agency-overview__recent-name">${escapeHtml(applicant.name)}</div>
                <div class="agency-overview__recent-meta">${escapeHtml(applicant.location)} • ${applicant.height} • Age ${applicant.age}</div>
              </div>
              <div class="agency-overview__recent-badges">
                ${applicant.isNew ? '<span class="agency-overview__recent-badge">New Face</span>' : ''}
                ${applicant.matchScore ? `<span class="agency-overview__recent-badge agency-overview__recent-badge--match">${applicant.matchScore}% Match</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
        
        container.innerHTML = applicantsHtml;
        
        // Add click handlers to recent applicant items
        container.querySelectorAll('.agency-overview__recent-item').forEach(item => {
          item.addEventListener('click', () => {
            const profileId = item.dataset.profileId;
            const applicationId = item.dataset.applicationId;
            if (window.openApplicationDetail) {
              window.openApplicationDetail(applicationId || profileId);
            } else {
              // Fallback: navigate to applicants page
              window.location.href = '/dashboard/agency/applicants';
            }
          });
        });
        
        return;
          
          return `
            <div class="agency-overview__recent-item" data-profile-id="${applicant.profileId}" data-application-id="${applicant.applicationId}">
              <img src="${imageSrc}" alt="${applicant.name}" class="agency-overview__recent-avatar" onerror="this.src='/images/default-avatar.png'">
              <div class="agency-overview__recent-info">
                <div class="agency-overview__recent-name">${escapeHtml(applicant.name)}</div>
                <div class="agency-overview__recent-meta">
                  <span>${escapeHtml(applicant.location)}</span>
                  <span>•</span>
                  <span>${applicant.height}</span>
                  <span>•</span>
                  <span>${applicant.age} years</span>
                </div>
              </div>
              <div class="agency-overview__recent-badges">
                ${applicant.isNew ? '<span class="agency-overview__recent-badge agency-overview__recent-badge--new">New Face</span>' : ''}
                ${applicant.matchScore ? `<span class="agency-overview__recent-badge agency-overview__recent-badge--match">${applicant.matchScore}% Match</span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Add click handlers to open detail drawer
        container.querySelectorAll('.agency-overview__recent-item').forEach(item => {
          item.style.cursor = 'pointer';
          item.addEventListener('click', () => {
            const profileId = item.dataset.profileId;
            const applicationId = item.dataset.applicationId;
            if (window.openApplicationDetail) {
              // Prefer applicationId if available, fallback to profileId
              window.openApplicationDetail(applicationId || profileId);
            } else {
              // Fallback: navigate to applicants page
              window.location.href = '/dashboard/agency/applicants';
            }
          });
        });
      } catch (error) {
        console.error('Error loading recent applicants:', error);
        container.innerHTML = '<div class="agency-overview__error">Failed to load recent applicants</div>';
      }
    };

    // Load overview stats
    const loadOverviewStats = async () => {
      try {
        const response = await fetch('/api/agency/overview/stats');
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success || !data.stats) return;

        const stats = data.stats;

        // Update talent pool
        const talentPoolEl = document.getElementById('overview-talent-pool');
        if (talentPoolEl) {
          talentPoolEl.textContent = stats.totalTalentPool || 0;
        }

        // Update board growth
        const boardGrowthEl = document.getElementById('overview-boards-growth');
        if (boardGrowthEl) {
          const growth = stats.boardGrowth || 0;
          boardGrowthEl.textContent = growth > 0 ? `+${growth}%` : growth < 0 ? `${growth}%` : '+0%';
        }
      } catch (error) {
        console.error('Error loading overview stats:', error);
      }
    };

    // Load overview data
    const loadOverviewData = async () => {
      try {
        // Fetch analytics data
        const response = await fetch('/api/agency/analytics');
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success || !data.analytics) return;

        const analytics = data.analytics;

        // Update "This Month" value
        if (thisMonthEl) {
          thisMonthEl.textContent = analytics.overTime.thisMonth || 0;
        }

        // Update average match score
        if (avgScoreEl && analytics.matchScores.average !== undefined) {
          avgScoreEl.textContent = analytics.matchScores.average || 0;
        }

        // Render activity chart
        if (activityChart && analytics.timeline) {
          renderActivityChart(activityChart, analytics.timeline);
        }

        // Render pipeline breakdown
        const pipelineContainer = document.getElementById('overview-pipeline-breakdown');
        if (pipelineContainer && analytics.byStatus) {
          renderPipelineBreakdown(pipelineContainer, analytics.byStatus);
        }
      } catch (error) {
        console.error('Error loading overview data:', error);
      }
    };

    // Load all data
    const loadAll = async () => {
      await Promise.all([
        loadOverviewData(),
        loadRecentApplicants(),
        loadOverviewStats()
      ]);
    };

    // Quick action: Create Board
    const createBoardBtn = document.getElementById('quick-action-create-board');
    if (createBoardBtn) {
      createBoardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to boards page and trigger create
        window.location.href = '/dashboard/agency/boards';
        // After navigation, the boards page will handle the create button
      });
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load immediately if section is visible
    if (overviewSection.offsetParent !== null) {
      loadAll();
    } else {
      // Use Intersection Observer to load when section comes into view
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loadAll();
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '100px' });

      observer.observe(overviewSection);
    }
  }

  function renderActivityChart(container, timelineData) {
    if (!timelineData || timelineData.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--agency-text-tertiary);">No activity data available</div>';
      return;
    }

    const maxCount = Math.max(...timelineData.map(d => d.count), 1);
    const chartHeight = 200;
    const chartWidth = container.offsetWidth || 600;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', chartWidth);
    svg.setAttribute('height', chartHeight);
    svg.setAttribute('class', 'agency-overview__activity-chart');
    svg.style.overflow = 'visible';

    // Create area path
    const points = timelineData.map((d, i) => {
      const x = padding.left + (i / (timelineData.length - 1 || 1)) * graphWidth;
      const y = padding.top + graphHeight - (d.count / maxCount) * graphHeight;
      return { x, y, count: d.count };
    });

    // Area path
    let areaPath = `M ${points[0].x} ${padding.top + graphHeight}`;
    points.forEach(p => {
      areaPath += ` L ${p.x} ${p.y}`;
    });
    areaPath += ` L ${points[points.length - 1].x} ${padding.top + graphHeight} Z`;

    // Line path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    points.slice(1).forEach(p => {
      linePath += ` L ${p.x} ${p.y}`;
    });

    // Create gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'areaGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'var(--agency-brand-color, var(--agency-accent-gold))');
    stop1.setAttribute('stop-opacity', '0.4');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'var(--agency-brand-color, var(--agency-accent-gold))');
    stop2.setAttribute('stop-opacity', '0');
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Create area
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', 'url(#areaGradient)');
    area.setAttribute('opacity', '0.3');
    svg.appendChild(area);

    // Create line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'var(--agency-brand-color, var(--agency-accent-gold))');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);

    // Create dots
    points.forEach((p, i) => {
      if (i % 5 === 0 || i === points.length - 1) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', 'var(--agency-brand-color, var(--agency-accent-gold))');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
      }
    });

    // X-axis labels
    const xAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    points.forEach((p, i) => {
      if (i % 5 === 0 || i === points.length - 1) {
        const date = new Date(timelineData[i].date);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', p.x);
        label.setAttribute('y', chartHeight - 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', 'var(--agency-text-tertiary)');
        label.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        xAxisGroup.appendChild(label);
      }
    });
    svg.appendChild(xAxisGroup);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  function renderPipelineBreakdown(container, statusData) {
    const total = statusData.total || 1;
    const items = [
      { label: 'Pending', value: statusData.pending || 0, class: 'pending' },
      { label: 'Accepted', value: statusData.accepted || 0, class: 'accepted' },
      { label: 'Declined', value: statusData.declined || 0, class: 'declined' },
      { label: 'Archived', value: statusData.archived || 0, class: 'archived' }
    ];

    container.innerHTML = items.map(item => `
      <div class="agency-overview__pipeline-item">
        <div class="agency-overview__pipeline-info">
          <span class="agency-overview__pipeline-label">${item.label}</span>
          <span class="agency-overview__pipeline-value">${item.value}</span>
        </div>
        <div class="agency-overview__pipeline-bar">
          <div 
            class="agency-overview__pipeline-fill agency-overview__pipeline-fill--${item.class}"
            style="width: ${(item.value / total) * 100}%"
          ></div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Discover Page Functionality
   */
  function initDiscoverPage() {
    const discoverSearchInput = document.getElementById('discover-search-input');
    const discoverMapViewBtn = document.getElementById('discover-map-view');
    const discoverFiltersToggle = document.getElementById('discover-filters-toggle');
    const scoutFilters = document.getElementById('scout-filters');
    
    // Search input handler with debounce
    if (discoverSearchInput) {
      let searchDebounceTimer = null;
      const SEARCH_DEBOUNCE_DELAY = 300;
      
      discoverSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        const searchQuery = e.target.value.trim();
        
        searchDebounceTimer = setTimeout(() => {
          const url = new URL(window.location.href);
          if (searchQuery) {
            url.searchParams.set('search', searchQuery);
          } else {
            url.searchParams.delete('search');
          }
          
          // Trigger existing filter logic by updating URL and reloading
          window.location.href = url.toString();
        }, SEARCH_DEBOUNCE_DELAY);
      });
      
      // Handle Enter key (immediate search)
      discoverSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchDebounceTimer);
          const searchQuery = e.target.value.trim();
          const url = new URL(window.location.href);
          if (searchQuery) {
            url.searchParams.set('search', searchQuery);
          } else {
            url.searchParams.delete('search');
          }
          window.location.href = url.toString();
        }
      });
    }
    
    // Map view button handler (placeholder - can be enhanced later)
    if (discoverMapViewBtn) {
      discoverMapViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // TODO: Implement map view functionality
        alert('Map view coming soon!');
      });
    }
    
    // Filters toggle button handler
    if (discoverFiltersToggle && scoutFilters) {
      // Check initial state - if filters are visible, mark button as active
      const initialIsVisible = scoutFilters.offsetParent !== null && 
                                window.getComputedStyle(scoutFilters).display !== 'none';
      if (initialIsVisible) {
        discoverFiltersToggle.classList.add('agency-discover-header__btn--active');
      }
      
      discoverFiltersToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isVisible = scoutFilters.offsetParent !== null && 
                         window.getComputedStyle(scoutFilters).display !== 'none';
        
        if (isVisible) {
          scoutFilters.style.display = 'none';
          discoverFiltersToggle.classList.remove('agency-discover-header__btn--active');
        } else {
          scoutFilters.style.display = 'block';
          discoverFiltersToggle.classList.add('agency-discover-header__btn--active');
        }
      });
    }
  }

  /**
   * Inbox Page Functionality
   */
  function initInboxPage() {
    const inboxSearchInput = document.getElementById('inbox-search-input');
    const inboxFiltersBtn = document.getElementById('inbox-filters-btn');
    const filterPills = document.querySelectorAll('.agency-inbox-header__filter-pill');
    const filtersPanel = document.querySelector('.agency-dashboard__filters');
    
    // Search input handler with debounce
    if (inboxSearchInput) {
      let searchDebounceTimer = null;
      const SEARCH_DEBOUNCE_DELAY = 300;
      
      inboxSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        const searchQuery = e.target.value.trim();
        
        searchDebounceTimer = setTimeout(() => {
          const url = new URL(window.location.href);
          if (searchQuery) {
            url.searchParams.set('search', searchQuery);
          } else {
            url.searchParams.delete('search');
          }
          window.location.href = url.toString();
        }, SEARCH_DEBOUNCE_DELAY);
      });
      
      // Handle Enter key (immediate search)
      inboxSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchDebounceTimer);
          const searchQuery = e.target.value.trim();
          const url = new URL(window.location.href);
          if (searchQuery) {
            url.searchParams.set('search', searchQuery);
          } else {
            url.searchParams.delete('search');
          }
          window.location.href = url.toString();
        }
      });
    }
    
    // Filters button handler
    if (inboxFiltersBtn && filtersPanel) {
      inboxFiltersBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isVisible = filtersPanel.style.display !== 'none' && filtersPanel.offsetParent !== null;
        
        if (isVisible) {
          filtersPanel.style.display = 'none';
          inboxFiltersBtn.classList.remove('agency-inbox-header__filters-btn--active');
        } else {
          filtersPanel.style.display = 'block';
          inboxFiltersBtn.classList.add('agency-inbox-header__filters-btn--active');
        }
      });
    }
    
    // Filter pills handler
    filterPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const status = pill.dataset.status || 'all';
        
        // Update active state
        filterPills.forEach(p => p.classList.remove('agency-inbox-header__filter-pill--active'));
        pill.classList.add('agency-inbox-header__filter-pill--active');
        
        // Update URL and reload
        const url = new URL(window.location.href);
        if (status === 'all') {
          url.searchParams.delete('status');
        } else {
          url.searchParams.set('status', status);
        }
        window.location.href = url.toString();
      });
    });
    
    // Set initial active state based on URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentStatus = urlParams.get('status') || 'all';
    filterPills.forEach(pill => {
      const pillStatus = pill.dataset.status || 'all';
      if (pillStatus === currentStatus) {
        pill.classList.add('agency-inbox-header__filter-pill--active');
      } else {
        pill.classList.remove('agency-inbox-header__filter-pill--active');
      }
    });
  }

  /**
   * Boards Page Functionality
   */
  function initBoardsPage() {
    const boardCards = document.querySelectorAll('.agency-boards-page__card');
    const createBoardBtn = document.getElementById('create-board-btn');
    
    // Create board button handler
    if (createBoardBtn) {
      createBoardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to applicants page with a special parameter, or show alert
        // For now, show alert since board editor modal doesn't exist
        alert('Board creation feature is being set up. Please use the boards management section in settings.');
        // Alternative: Navigate to a create board page if it exists
        // window.location.href = '/dashboard/agency/boards/create';
      });
    }
    
    boardCards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't navigate if clicking on action buttons inside the card
        if (e.target.closest('button') || e.target.closest('a')) {
          return;
        }
        
        const boardId = card.dataset.boardId;
        if (boardId) {
          // Navigate to applicants page filtered by this board
          window.location.href = `/dashboard/agency/applicants?board_id=${boardId}`;
        }
      });
      
      // Add hover effect
      card.style.cursor = 'pointer';
    });
  }

})();

