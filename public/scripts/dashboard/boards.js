/**
 * Agency Dashboard - Boards Module
 * Handles Board Management and Board Editor
 */

(function(window) {
  'use strict';

  const Boards = {
    init() {
      this.initBoardsManagement();
      this.initBoardEditor();
    },

    initBoardsManagement() {
      const createBtn = document.getElementById('create-board-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => this.openBoardEditor());
      }
      
      const emptyStateCreateBtn = document.getElementById('create-board-btn-empty');
      if (emptyStateCreateBtn) {
        emptyStateCreateBtn.addEventListener('click', () => this.openBoardEditor());
      }
      
      // Quick Action on Overview
      const quickActionCreate = document.getElementById('quick-action-create-board');
      if (quickActionCreate) {
        quickActionCreate.addEventListener('click', () => this.openBoardEditor());
      }

      // Event delegation for board actions
      const boardsGrid = document.getElementById('boards-grid');
      if (boardsGrid) {
        boardsGrid.addEventListener('click', async (e) => {
          // Open Board
          const openBtn = e.target.closest('.agency-dashboard__scout-preview-btn');
          if (openBtn) {
             window.location.href = `/dashboard/agency/applicants?board_id=${openBtn.dataset.boardId}`;
             return;
          }
          
          // Menu / Edit / Delete Actions
          const actionBtn = e.target.closest('[data-action]');
          if (actionBtn) {
              const action = actionBtn.dataset.action;
              const boardId = actionBtn.dataset.boardId;
              if (action === 'edit') this.openBoardEditor(boardId);
              if (action === 'delete') this.deleteBoard(boardId);
          }
          
          // If clicking the card itself (not a button)
          const card = e.target.closest('.agency-boards-page__card');
          if (card && !e.target.closest('button') && !e.target.closest('a')) {
             window.location.href = `/dashboard/agency/applicants?board_id=${card.dataset.boardId}`;
          }
        });
      }
    },

    initBoardEditor() {
      const modal = document.getElementById('board-editor-modal');
      if (!modal) return;

      const closeBtn = document.getElementById('board-editor-close');
      const cancelBtn = document.getElementById('board-editor-cancel');
      const form = document.getElementById('board-editor-form');
      
      const closeEditor = () => {
          modal.style.display = 'none';
          document.body.style.overflow = '';
      };

      closeBtn?.addEventListener('click', closeEditor);
      cancelBtn?.addEventListener('click', closeEditor);
      
      if (form) {
          form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const formData = new FormData(form);
              const boardId = document.getElementById('board-editor-id').value;
              
              // Simplified payload construction
              const payload = {
                  name: formData.get('name'),
                  description: formData.get('description'),
                  is_active: formData.get('is_active') === 'on',
                  // ... Add other fields (requirements, weights) as needed
              };

              try {
                  const url = boardId ? `/api/agency/boards/${boardId}` : '/api/agency/boards';
                  const method = boardId ? 'PUT' : 'POST';
                  
                  const res = await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                  });
                  
                  if (res.ok) {
                      window.Toast.success(`Board ${boardId ? 'updated' : 'created'} successfully`);
                      window.location.reload();
                  } else {
                      throw new Error('Failed to save');
                  }
              } catch(err) {
                  window.Toast.error('Failed to save board');
              }
          });
      }
    },

    openBoardEditor(boardId = null) {
      const modal = document.getElementById('board-editor-modal');
      if (!modal) {
          // Fallback if modal partial not included
          if (boardId) window.location.href = `/dashboard/agency/boards/${boardId}/edit`;
          else window.location.href = '/dashboard/agency/boards/new'; 
          return;
      }
      
      const title = document.getElementById('board-editor-title');
      const idInput = document.getElementById('board-editor-id');
      const form = document.getElementById('board-editor-form');
      
      form.reset();
      idInput.value = boardId || '';
      title.textContent = boardId ? 'Edit Board' : 'Create New Board';
      
      if (boardId) {
          // Fetch board data and populate
          fetch(`/api/agency/boards/${boardId}`)
            .then(r => r.json())
            .then(data => {
                document.getElementById('board-name').value = data.name;
                document.getElementById('board-description').value = data.description || '';
                // Populate other fields...
            });
      }
      
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    },

    async deleteBoard(boardId) {
        const confirmed = await window.Toast.confirm('Are you sure you want to delete this board? This action cannot be undone.', 'Delete Board');
        if (!confirmed) return;
        
        try {
            await fetch(`/api/agency/boards/${boardId}`, { method: 'DELETE' });
            window.Toast.success('Board deleted');
            window.location.reload();
        } catch(e) {
            window.Toast.error('Failed to delete board');
        }
    }
  };

  window.AgencyDashboard = window.AgencyDashboard || {};
  window.AgencyDashboard.Boards = Boards;

  // Expose for global calls (e.g. Quick Actions)
  window.openBoardEditor = Boards.openBoardEditor.bind(Boards);

})(window);
