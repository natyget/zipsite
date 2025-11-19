/**
 * Toast Notification System
 * Replaces native browser alerts with non-blocking UI notifications
 */

class Toast {
  static container = null;

  static init() {
    if (!document.querySelector('.toast-container')) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector('.toast-container');
    }
  }

  static show(message, type = 'info', title = '') {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    // Determine icon based on type
    let iconSvg = '';
    switch (type) {
      case 'success':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        title = title || 'Success';
        break;
      case 'error':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        title = title || 'Error';
        break;
      case 'warning':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        title = title || 'Warning';
        break;
      default: // info
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        title = title || 'Info';
    }

    toast.innerHTML = `
      <div class="toast__icon">${iconSvg}</div>
      <div class="toast__content">
        <div class="toast__title">${title}</div>
        <div class="toast__message">${message}</div>
      </div>
      <button class="toast__close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.toast__close');
    closeBtn.addEventListener('click', () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    // Auto dismiss
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      this.dismiss(toast);
    }, duration);
  }

  static dismiss(toast) {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => {
      if (toast.parentElement) {
        toast.remove();
      }
    });
  }

  static success(message, title) {
    this.show(message, 'success', title);
  }

  static error(message, title) {
    this.show(message, 'error', title);
  }

  static info(message, title) {
    this.show(message, 'info', title);
  }

  static warning(message, title) {
    this.show(message, 'warning', title);
  }

  /**
   * Show a confirmation dialog (returns a Promise)
   * @param {string} message - The confirmation message
   * @param {string} title - Optional title
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  static confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      // Create confirmation modal
      const modal = document.createElement('div');
      modal.className = 'toast-confirm-modal';
      modal.innerHTML = `
        <div class="toast-confirm-modal__overlay"></div>
        <div class="toast-confirm-modal__content">
          <div class="toast-confirm-modal__header">
            <h3 class="toast-confirm-modal__title">${title}</h3>
          </div>
          <div class="toast-confirm-modal__body">
            <p class="toast-confirm-modal__message">${message}</p>
          </div>
          <div class="toast-confirm-modal__actions">
            <button class="toast-confirm-modal__btn toast-confirm-modal__btn--cancel" data-action="cancel">Cancel</button>
            <button class="toast-confirm-modal__btn toast-confirm-modal__btn--confirm" data-action="confirm">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.style.display = 'flex';

      const handleAction = (confirmed) => {
        modal.style.display = 'none';
        setTimeout(() => modal.remove(), 300);
        resolve(confirmed);
      };

      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => handleAction(true));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => handleAction(false));
      modal.querySelector('.toast-confirm-modal__overlay').addEventListener('click', () => handleAction(false));

      // ESC key to cancel
      const handleEscape = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          handleAction(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }
}

// Expose globally
window.Toast = Toast;

