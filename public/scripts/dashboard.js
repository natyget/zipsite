// Dashboard JavaScript for ZipSite
// Handles copy-to-clipboard, delete actions, and flash message animations

(function () {
  'use strict';

  // Image loading handler - check if images are already loaded
  function initImagePlaceholders() {
    // Handle hero image
    const heroImage = document.querySelector('.dash-hero__image img');
    if (heroImage) {
      if (heroImage.complete && heroImage.naturalHeight !== 0) {
        heroImage.classList.add('is-loaded');
      }
    }

    // Handle media grid images
    const mediaImages = document.querySelectorAll('.media-card img');
    mediaImages.forEach(img => {
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('is-loaded');
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImagePlaceholders);
  } else {
    initImagePlaceholders();
  }

  // Copy to Clipboard Handler
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-copy-target]');
    if (!btn) return;

    const targetSelector = btn.getAttribute('data-copy-target');
    const targetEl = document.querySelector(targetSelector);
    if (!targetEl) return;

    const textToCopy = targetEl.textContent.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.background = 'var(--accent-success)';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('Failed to copy. Please select and copy manually.');
    });
  });

  // Media Card Delete Handler
  document.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('.media-card__delete');
    if (!deleteBtn) return;

    const card = deleteBtn.closest('.media-card');
    const mediaId = card?.getAttribute('data-media-id');

    if (!mediaId) {
      console.error('No media ID found');
      return;
    }

    if (!confirm('Delete this image from your portfolio?')) {
      return;
    }

    // Send DELETE request
    fetch(`/dashboard/talent/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Delete failed');
        return res.json();
      })
      .then(() => {
        // Animate out and remove
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => card.remove(), 300);
      })
      .catch(err => {
        console.error('Delete error:', err);
        alert('Failed to delete image. Please try again.');
      });
  });

  // Flash Message Auto-dismiss
  const flashMessages = document.querySelectorAll('.flash-message');
  flashMessages.forEach(msg => {
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
      setTimeout(() => msg.remove(), 300);
    }, 5000);
  });

  // Form Validation Enhancement
  const forms = document.querySelectorAll('form.form-stacked');
  forms.forEach(form => {
    form.addEventListener('submit', function (e) {
      // Add loading state to submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';

        // Re-enable after 3s as fallback
        setTimeout(() => {
          if (submitBtn.disabled) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText;
          }
        }, 3000);
      }
    });
  });

  // Agency Talent Claim Handler
  document.addEventListener('submit', function (e) {
    const claimForm = e.target.closest('.talent-claim-form');
    if (!claimForm) return;

    e.preventDefault();

    const submitBtn = claimForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    // Loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Claiming...';

    // Get form data
    const formData = new FormData(claimForm);

    // Submit via fetch
    fetch(claimForm.action, {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error('Claim failed');
        return res.json();
      })
      .then(data => {
        // Success feedback
        submitBtn.textContent = '✓ Claimed';
        submitBtn.style.background = 'var(--accent-success)';

        // Update badge if exists
        const card = claimForm.closest('.talent-card');
        const badgesContainer = card?.querySelector('.talent-card__badges');
        if (badgesContainer) {
          const existingBadge = badgesContainer.querySelector('.badge-success, .badge-muted');
          if (!existingBadge) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-success';
            badge.textContent = 'Your Talent';
            badgesContainer.appendChild(badge);
          }
        }

        // Reset after delay
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Refresh Claim';
          submitBtn.style.background = '';
        }, 2000);
      })
      .catch(err => {
        console.error('Claim error:', err);
        submitBtn.textContent = 'Failed - Try Again';
        submitBtn.style.background = 'var(--accent-error)';

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.background = '';
        }, 2000);
      });
  });

  // File Upload Preview Handler
  const fileInput = document.getElementById('media');
  const filePreview = document.getElementById('file-preview');
  const uploadForm = document.getElementById('media-upload-form');
  const uploadButton = document.getElementById('upload-button');

  if (fileInput && filePreview && uploadForm) {
    const selectedFiles = [];

    fileInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      selectedFiles.length = 0;
      selectedFiles.push(...files);

      // Clear preview
      filePreview.innerHTML = '';

      // Show preview for each file
      files.forEach((file, index) => {
        if (!file.type.startsWith('image/')) {
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          const previewItem = document.createElement('div');
          previewItem.className = 'file-upload-preview-item';
          previewItem.dataset.index = index;

          const img = document.createElement('img');
          img.src = e.target.result;
          img.alt = file.name;

          const removeBtn = document.createElement('button');
          removeBtn.className = 'file-upload-preview-item__remove';
          removeBtn.type = 'button';
          removeBtn.innerHTML = '×';
          removeBtn.title = 'Remove';
          removeBtn.addEventListener('click', function() {
            selectedFiles.splice(index, 1);
            updateFileInput();
            previewItem.remove();
          });

          previewItem.appendChild(img);
          previewItem.appendChild(removeBtn);
          filePreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
      });
    });

    function updateFileInput() {
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
    }

    // Drag and drop support
    const uploadLabel = document.querySelector('.file-upload-label');
    if (uploadLabel) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
          uploadLabel.style.borderColor = 'var(--accent-gold)';
          uploadLabel.style.background = 'rgba(201, 165, 90, 0.08)';
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
          uploadLabel.style.borderColor = '';
          uploadLabel.style.background = '';
        }, false);
      });

      uploadLabel.addEventListener('drop', function(e) {
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
          selectedFiles.push(...files);
          updateFileInput();
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, false);
    }

    // Form submission handler
    uploadForm.addEventListener('submit', function(e) {
      if (selectedFiles.length === 0) {
        e.preventDefault();
        alert('Please select at least one image to upload.');
        return;
      }

      if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
      }
    });
  }

  // PDF Theme Selector Modal
  function initPdfThemeModal() {
    const pdfBtn = document.getElementById('pdf-download-btn');
    const modal = document.getElementById('pdf-theme-modal');
    const backdrop = modal?.querySelector('.pdf-theme-modal__backdrop');
    const closeBtn = modal?.querySelector('.pdf-theme-modal__close');
    const cancelBtn = document.getElementById('pdf-theme-cancel');
    const downloadBtn = document.getElementById('pdf-theme-download');
    const themeGrid = document.getElementById('pdf-theme-grid');
    
    if (!pdfBtn) {
      console.warn('[PDF Modal] PDF download button not found');
      return;
    }
    
    if (!modal) {
      console.warn('[PDF Modal] PDF theme modal not found');
      return;
    }

    const themes = {
      ink: { name: 'Ink', bg: '#FAF9F7', text: '#0F172A', accent: '#1C1C1C', isPro: false },
      noir: { name: 'Noir', bg: '#0A0A0A', text: '#FAF9F7', accent: '#E5E5E5', isPro: true },
      studio: { name: 'Studio', bg: '#F4F2F0', text: '#2D2D2D', accent: '#C9A55A', isPro: true },
      paper: { name: 'Paper', bg: '#FAF9F7', text: '#3A3A3A', accent: '#8B7355', isPro: false },
      slate: { name: 'Slate', bg: '#1A1A1A', text: '#ECF0F1', accent: '#95A5A6', isPro: true },
      archive: { name: 'Archive', bg: '#F5E6D3', text: '#3D2817', accent: '#8B6F47', isPro: true }
    };

    const slug = pdfBtn.dataset.slug;
    const savedTheme = pdfBtn.dataset.theme || 'ink';
    const isPro = pdfBtn.dataset.isPro === 'true';
    let selectedTheme = savedTheme;

    // Populate theme grid
    function renderThemes() {
      if (!themeGrid) return;
      themeGrid.innerHTML = '';
      
      Object.entries(themes).forEach(([key, theme]) => {
        const isLocked = theme.isPro && !isPro;
        const isSelected = key === selectedTheme;
        
        const themeCard = document.createElement('button');
        themeCard.type = 'button';
        themeCard.className = `pdf-theme-card ${isSelected ? 'is-selected' : ''} ${isLocked ? 'is-locked' : ''}`;
        themeCard.dataset.theme = key;
        if (isLocked) {
          themeCard.disabled = true;
        }
        
        themeCard.innerHTML = `
          <div class="pdf-theme-card__swatches">
            <div class="pdf-theme-card__swatch" style="background: ${theme.bg};"></div>
            <div class="pdf-theme-card__swatch" style="background: ${theme.text};"></div>
            <div class="pdf-theme-card__swatch" style="background: ${theme.accent};"></div>
          </div>
          <div class="pdf-theme-card__name">
            ${theme.name}
            ${theme.isPro ? '<span class="pdf-theme-card__badge">PRO</span>' : ''}
          </div>
        `;
        
        if (!isLocked) {
          themeCard.addEventListener('click', () => {
            document.querySelectorAll('.pdf-theme-card').forEach(card => card.classList.remove('is-selected'));
            themeCard.classList.add('is-selected');
            selectedTheme = key;
            updateDownloadLink();
          });
        } else {
          // Show upgrade prompt for locked themes
          themeCard.addEventListener('click', () => {
            const upgradeMsg = 'This theme is available for Pro members. Upgrade to unlock all themes.';
            if (confirm(upgradeMsg)) {
              window.location.href = '/pro/upgrade';
            }
          });
        }
        
        themeGrid.appendChild(themeCard);
      });
    }

    function updateDownloadLink() {
      if (downloadBtn) {
        downloadBtn.href = `/pdf/${slug}?theme=${selectedTheme}&download=1`;
        downloadBtn.onclick = function(e) {
          e.preventDefault();
          // Show loading state
          const originalText = downloadBtn.textContent;
          downloadBtn.textContent = 'Generating PDF...';
          downloadBtn.style.pointerEvents = 'none';
          
          // Trigger download
          window.location.href = downloadBtn.href;
          
          // Reset after a delay
          setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.style.pointerEvents = '';
            closeModal();
          }, 2000);
        };
      }
    }

    function openModal() {
      if (!modal) {
        console.error('[PDF Modal] Modal element not found');
        return;
      }
      selectedTheme = savedTheme;
      renderThemes();
      updateDownloadLink();
      modal.hidden = false;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      console.log('[PDF Modal] Modal opened');
    }

    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    pdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[PDF Modal] Button clicked, opening modal');
      openModal();
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) {
        closeModal();
      }
    });

    updateDownloadLink();
  }

  // Initialize PDF modal when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfThemeModal);
  } else {
    // DOM is already ready
    initPdfThemeModal();
  }
})();