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
    
    initViewSwitcher();
    initKanbanDragDrop();
    initPreviewModal();
    initBatchOperations();
    initSearch();
    initFilters();
    initQuickActions();
    initScoutInvite();
    
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
   * Preview Modal - Simplified to just open portfolio in new tab
   */
  function initPreviewModal() {
    const previewButtons = document.querySelectorAll('[data-profile-id]');

    previewButtons.forEach(btn => {
      if (btn.classList.contains('agency-dashboard__card-preview') || 
          btn.classList.contains('agency-dashboard__gallery-preview') ||
          btn.classList.contains('agency-dashboard__list-preview') ||
          btn.classList.contains('agency-dashboard__table-preview')) {
        btn.addEventListener('click', () => {
          const profileId = btn.dataset.profileId;
          const profile = state.profiles?.find(p => p.id === profileId);
          if (profile && profile.slug) {
            window.open(`/portfolio/${profile.slug}`, '_blank');
          }
        });
      }
    });
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
    document.querySelectorAll('.agency-dashboard__quick-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const applicationId = btn.dataset.applicationId;

        if (!applicationId) {
          console.error('No application ID found');
          return;
        }

        const confirmed = confirm(`Are you sure you want to ${action} this application?`);
        if (!confirmed) return;

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
          btn.textContent = action.charAt(0).toUpperCase() + action.slice(1);
        }
      });
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
          const response = await fetch(`/dashboard/agency/scout/${profileId}/invite`, {
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
              window.location.href = '/dashboard/agency?view=applicants';
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

})();

