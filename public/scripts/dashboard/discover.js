/**
 * Agency Dashboard - Discover Module
 * Handles Talent Discovery, Filtering, and Invites
 */

(function(window) {
  'use strict';

  const Discover = {
    init() {
      this.initScoutFilters();
      this.initScoutInvite();
      this.initDiscoverPage();
    },

    initScoutFilters() {
      const form = document.getElementById('scout-filters-form');
      if (!form) return;

      // Debounce helper
      const debounce = (func, delay) => {
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => func.apply(this, args), delay);
        };
      };

      const applyFilters = async () => {
        const formData = new FormData(form);
        const params = new URLSearchParams(formData);
        const url = `/dashboard/agency/discover?${params.toString()}`;
        
        const grid = document.querySelector('.agency-dashboard__scout-grid');
        if (grid) grid.style.opacity = '0.5';
        
        try {
          const response = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          if (!response.ok) throw new Error('Filter failed');
          
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newGrid = doc.querySelector('.agency-dashboard__scout-grid');
          
          if (grid && newGrid) {
            grid.innerHTML = newGrid.innerHTML;
            this.initScoutInvite(); // Re-bind events
            window.history.pushState({}, '', url);
          }
        } catch (err) {
          console.error(err);
          window.Toast.error('Failed to filter results');
        } finally {
          if (grid) grid.style.opacity = '1';
        }
      };

      const debouncedFilter = debounce(applyFilters, 500);

      form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', debouncedFilter);
        input.addEventListener('change', debouncedFilter);
      });
      
      // Reset Button
      const resetBtn = document.getElementById('scout-reset-filters-btn');
      if (resetBtn) {
          resetBtn.addEventListener('click', () => {
              form.reset();
              window.location.href = '/dashboard/agency/discover';
          });
      }
    },

    initScoutInvite() {
      document.querySelectorAll('.agency-dashboard__scout-invite-btn').forEach(btn => {
        // Avoid double binding if re-initialized
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const profileId = btn.dataset.profileId;
          const name = btn.dataset.profileName || 'Talent';

          const confirmed = await window.Toast.confirm(`Invite ${name} to apply to your agency?`, 'Send Invitation');
          if (!confirmed) return;

          btn.disabled = true;
          const originalText = btn.textContent;
          btn.textContent = 'Inviting...';

          try {
            const response = await fetch(`/dashboard/agency/discover/${profileId}/invite`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            if (response.ok) {
              window.Toast.success(`Invitation sent to ${name}`);
              btn.textContent = 'Invited';
            } else {
              throw new Error('Invite failed');
            }
          } catch (err) {
            window.Toast.error('Failed to send invitation');
            btn.disabled = false;
            btn.textContent = originalText;
          }
        });
      });
    },

    initDiscoverPage() {
      const sortSelect = document.getElementById('discover-sort');
      if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
          const url = new URL(window.location.href);
          url.searchParams.set('sort', e.target.value);
          window.location.href = url.toString();
        });
      }
      
      // Quick View Handlers for Scout Cards
      document.querySelectorAll('.agency-dashboard__scout-preview-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const profileId = btn.dataset.profileId;
              if (profileId && window.openApplicationDetail) {
                  window.openApplicationDetail(profileId);
              }
          });
      });
    }
  };

  window.AgencyDashboard = window.AgencyDashboard || {};
  window.AgencyDashboard.Discover = Discover;

})(window);
