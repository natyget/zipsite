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
    dragState: null,
    shortcutsOpen: false
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('agency-dashboard')) return;
    
    initViewSwitcher();
    initKanbanDragDrop();
    initPreviewModal();
    initBatchOperations();
    initKeyboardShortcuts();
    initSearch();
    initFilters();
    initQuickActions();
    
    // Load data from window if available
    if (window.AGENCY_DASHBOARD_DATA) {
      state.profiles = window.AGENCY_DASHBOARD_DATA.profiles || [];
      state.stats = window.AGENCY_DASHBOARD_DATA.stats || {};
    }
  });

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
    const profileId = card.dataset.profileId;

    // Move card to new column
    const cardsContainer = targetColumn.querySelector('.agency-dashboard__kanban-cards');
    cardsContainer.appendChild(card);

    // Update status via API
    updateApplicationStatus(profileId, targetStatus).then(() => {
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
   * Preview Modal (Lightbox)
   */
  function initPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('preview-close');
    const backdrop = modal?.querySelector('.agency-dashboard__preview-backdrop');
    const previewButtons = document.querySelectorAll('[data-profile-id]');

    if (!modal) return;

    previewButtons.forEach(btn => {
      if (btn.classList.contains('agency-dashboard__card-preview') || 
          btn.classList.contains('agency-dashboard__gallery-preview') ||
          btn.classList.contains('agency-dashboard__list-preview') ||
          btn.classList.contains('agency-dashboard__table-preview')) {
        btn.addEventListener('click', () => {
          const profileId = btn.dataset.profileId;
          openPreview(profileId);
        });
      }
    });

    closeBtn?.addEventListener('click', closePreview);
    backdrop?.addEventListener('click', closePreview);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) {
        closePreview();
      }
      if (e.key === 'ArrowLeft' && !modal.hidden) {
        navigatePreview('prev');
      }
      if (e.key === 'ArrowRight' && !modal.hidden) {
        navigatePreview('next');
      }
    });
  }

  function openPreview(profileId) {
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-body');
    if (!modal || !body) return;

    const profile = state.profiles?.find(p => p.id === profileId);
    if (!profile) {
      // Fallback: redirect to portfolio
      window.open(`/portfolio/${profileId}`, '_blank');
      return;
    }

    // Build preview HTML
    body.innerHTML = buildPreviewHTML(profile);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    const modal = document.getElementById('preview-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function navigatePreview(direction) {
    const currentProfileId = document.querySelector('.agency-dashboard__preview-body')?.dataset.profileId;
    if (!currentProfileId || !state.profiles) return;

    const currentIndex = state.profiles.findIndex(p => p.id === currentProfileId);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' 
      ? (currentIndex + 1) % state.profiles.length
      : (currentIndex - 1 + state.profiles.length) % state.profiles.length;

    openPreview(state.profiles[nextIndex].id);
  }

  function buildPreviewHTML(profile) {
    const images = profile.images || [];
    const mainImage = profile.hero_image_path || (images[0]?.path || '');
    
    return `
      <div class="agency-dashboard__preview-header" data-profile-id="${profile.id}">
        <div class="agency-dashboard__preview-image-section">
          ${mainImage ? `<img src="${mainImage}" alt="${profile.first_name} ${profile.last_name}" class="agency-dashboard__preview-main-image">` : ''}
          ${images.length > 1 ? `
            <div class="agency-dashboard__preview-thumbnails">
              ${images.slice(1, 5).map(img => `
                <img src="${img.path}" alt="${img.label || ''}" class="agency-dashboard__preview-thumbnail">
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="agency-dashboard__preview-info">
          <h2 class="agency-dashboard__preview-name">${profile.first_name} ${profile.last_name}</h2>
          <div class="agency-dashboard__preview-meta">
            <span>${profile.city || 'Location TBD'}</span>
            ${profile.height_cm ? `<span>${profile.height_cm} cm</span>` : ''}
            ${profile.measurements ? `<span>${profile.measurements}</span>` : ''}
          </div>
          ${profile.bio_curated ? `<p class="agency-dashboard__preview-bio">${profile.bio_curated}</p>` : ''}
          <div class="agency-dashboard__preview-actions">
            <a href="/portfolio/${profile.slug}" target="_blank" class="button-primary">View Full Portfolio</a>
            <form method="post" action="/dashboard/agency/application/accept" class="agency-dashboard__quick-form">
              <input type="hidden" name="profile_id" value="${profile.id}">
              <button type="submit" class="button-accent">Accept</button>
            </form>
            <form method="post" action="/dashboard/agency/application/decline" class="agency-dashboard__quick-form">
              <input type="hidden" name="profile_id" value="${profile.id}">
              <button type="submit" class="button-secondary">Decline</button>
            </form>
          </div>
        </div>
      </div>
    `;
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

    const profileIds = Array.from(state.selectedProfiles);
    const confirmed = confirm(`Are you sure you want to ${action} ${profileIds.length} application(s)?`);

    if (!confirmed) return;

    try {
      const promises = profileIds.map(id => updateApplicationStatus(id, action));
      await Promise.all(promises);
      
      // Reload page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Batch action failed:', error);
      alert('Failed to perform batch action. Please try again.');
    }
  }

  /**
   * Keyboard Shortcuts
   */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key !== 'Escape' && e.key !== '?') return;
      }

      // Show/hide shortcuts overlay
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        toggleShortcuts();
        return;
      }


      // Quick actions (only when not in input)
      if (!state.isBatchMode) {
        if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          // Accept first selected or focused card
          const focusedCard = document.querySelector('.agency-dashboard__card:focus-within');
          if (focusedCard) {
            const profileId = focusedCard.dataset.profileId;
            updateApplicationStatus(profileId, 'accept').then(() => window.location.reload());
          }
        }
        if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          // Decline first selected or focused card
          const focusedCard = document.querySelector('.agency-dashboard__card:focus-within');
          if (focusedCard) {
            const profileId = focusedCard.dataset.profileId;
            updateApplicationStatus(profileId, 'decline').then(() => window.location.reload());
          }
        }
        if (e.key === ' ' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          // Preview focused card
          const focusedCard = document.querySelector('.agency-dashboard__card:focus-within');
          if (focusedCard) {
            const profileId = focusedCard.dataset.profileId;
            openPreview(profileId);
          }
        }
      }
    });
  }

  function toggleShortcuts() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    
    state.shortcutsOpen = !state.shortcutsOpen;
    overlay.hidden = !state.shortcutsOpen;
    
    if (state.shortcutsOpen) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          toggleShortcuts();
        }
      });
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
    // Make quick action forms submit via AJAX
    document.querySelectorAll('.agency-dashboard__quick-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const action = form.action;
        const profileId = formData.get('profile_id');

        try {
          const response = await fetch(action, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(formData)
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Reload to show updated status
              window.location.reload();
            }
          }
        } catch (error) {
          console.error('Quick action failed:', error);
          // Fallback to normal form submission
          form.submit();
        }
      });
    });
  }

  /**
   * API Helpers
   */
  async function updateApplicationStatus(profileId, status) {
    const statusMap = {
      'pending': 'pending',
      'under-review': 'pending',
      'accepted': 'accept',
      'declined': 'decline',
      'archived': 'archive'
    };

    const action = statusMap[status] || status;
    const formData = new URLSearchParams({ profile_id: profileId });

    const response = await fetch(`/dashboard/agency/application/${action}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.statusText}`);
    }

    return response.json();
  }

})();

