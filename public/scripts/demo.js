(function() {
  'use strict';

  // Theme definitions (matching src/lib/themes.js)
  const themes = {
    ink: { name: 'Ink', bg: '#F8F8F8', text: '#111111', accent: '#1C1C1C', isPro: false },
    noir: { name: 'Noir', bg: '#1C1C1C', text: '#FFFFFF', accent: '#E5E5E5', isPro: true },
    studio: { name: 'Studio', bg: '#F4F2F0', text: '#2D2D2D', accent: '#C9A55A', isPro: true },
    paper: { name: 'Paper', bg: '#FAF9F7', text: '#3A3A3A', accent: '#8B7355', isPro: false },
    slate: { name: 'Slate', bg: '#2C3E50', text: '#ECF0F1', accent: '#95A5A6', isPro: true },
    archive: { name: 'Archive', bg: '#F5E6D3', text: '#3D2817', accent: '#8B6F47', isPro: true }
  };

  // Demo profile slug
  const demoSlug = 'elara-k';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initPortfolioPreview();
    initPdfThemeGallery();
    initCopyUrl();
    initScrollAnimations();
  });

  // Portfolio Preview - Responsive View Toggle
  function initPortfolioPreview() {
    const frame = document.getElementById('portfolio-preview-frame');
    const controlBtns = document.querySelectorAll('.demo-portfolio-preview__control-btn');
    const iframe = document.querySelector('.demo-portfolio-preview__iframe');

    if (!frame || !controlBtns.length) return;

    // Set default view to desktop
    frame.setAttribute('data-view', 'desktop');
    controlBtns[0]?.classList.add('is-active');

    controlBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        // Update active state
        controlBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        
        // Update frame view
        frame.setAttribute('data-view', view);
        
        // Reload iframe to ensure proper sizing
        if (iframe && iframe.src) {
          const currentSrc = iframe.src;
          iframe.src = '';
          setTimeout(() => {
            iframe.src = currentSrc;
          }, 100);
        }
      });
    });
  }

  // PDF Theme Gallery
  function initPdfThemeGallery() {
    const gallery = document.getElementById('pdf-themes-gallery');
    const previewContent = document.getElementById('pdf-preview-content');
    const previewTitle = document.getElementById('preview-theme-name');
    const previewActions = document.getElementById('pdf-preview-actions');
    const downloadBtn = document.getElementById('download-pdf-btn');
    const closeBtn = document.getElementById('close-pdf-preview');

    if (!gallery) return;

    // Render theme cards
    renderThemeCards();

    // Theme card click handler
    gallery.addEventListener('click', (e) => {
      const card = e.target.closest('.demo-pdf-theme-card');
      if (!card) return;

      const themeKey = card.dataset.theme;
      const theme = themes[themeKey];
      if (!theme) return;

      // Update selected state
      document.querySelectorAll('.demo-pdf-theme-card').forEach(c => {
        c.classList.remove('is-selected');
      });
      card.classList.add('is-selected');

      // Update preview
      updatePdfPreview(themeKey, theme);
    });

    // Close preview handler
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        resetPdfPreview();
      });
    }

    function renderThemeCards() {
      gallery.innerHTML = '';
      
      Object.entries(themes).forEach(([key, theme], index) => {
        const card = document.createElement('div');
        card.className = 'demo-pdf-theme-card';
        card.dataset.theme = key;
        
        card.innerHTML = `
          <div class="demo-pdf-theme-card__preview">
            <div class="demo-pdf-theme-card__preview-bg" style="background: ${theme.bg}; color: ${theme.text};">
              ELARA KEATS
            </div>
          </div>
          <div class="demo-pdf-theme-card__name">${theme.name}</div>
          <div class="demo-pdf-theme-card__badge ${theme.isPro ? 'demo-pdf-theme-card__badge--pro' : 'demo-pdf-theme-card__badge--free'}">
            ${theme.isPro ? 'Pro' : 'Free'}
          </div>
          ${theme.isPro ? '<div class="demo-pdf-theme-card__lock">🔒</div>' : ''}
        `;

        // Stagger animation
        setTimeout(() => {
          card.classList.add('is-visible');
        }, index * 100);

        gallery.appendChild(card);
      });
    }

    function updatePdfPreview(themeKey, theme) {
      if (!previewContent || !previewTitle) return;

      // Update title
      previewTitle.textContent = `${theme.name} Theme`;

      // Show preview actions
      if (previewActions) {
        previewActions.hidden = false;
      }

      if (closeBtn) {
        closeBtn.hidden = false;
      }

      // Create iframe preview
      const previewUrl = `/pdf/view/${demoSlug}?theme=${themeKey}`;
      
      previewContent.innerHTML = `
        <iframe 
          src="${previewUrl}" 
          class="demo-pdf-themes__preview-iframe"
          title="PDF ${theme.name} Theme Preview"
          loading="lazy">
        </iframe>
      `;

      // Update download button
      if (downloadBtn) {
        downloadBtn.href = `/pdf/${demoSlug}?theme=${themeKey}`;
        downloadBtn.textContent = `Download ${theme.name} PDF`;
      }
    }

    function resetPdfPreview() {
      if (!previewContent || !previewTitle) return;

      previewTitle.textContent = 'Select a theme';
      previewContent.innerHTML = `
        <div class="demo-pdf-themes__preview-placeholder">
          <div class="demo-pdf-themes__preview-placeholder-icon">📄</div>
          <p class="demo-pdf-themes__preview-placeholder-text">Click a theme above to preview</p>
        </div>
      `;

      if (previewActions) {
        previewActions.hidden = true;
      }

      if (closeBtn) {
        closeBtn.hidden = true;
      }

      // Remove selected state
      document.querySelectorAll('.demo-pdf-theme-card').forEach(c => {
        c.classList.remove('is-selected');
      });
    }
  }

  // Copy Portfolio URL
  function initCopyUrl() {
    const copyBtn = document.getElementById('copy-portfolio-url');
    const urlElement = document.getElementById('portfolio-url');

    if (!copyBtn || !urlElement) return;

    copyBtn.addEventListener('click', async () => {
      const url = urlElement.textContent;
      const fullUrl = `${window.location.origin}/portfolio/${demoSlug}`;

      try {
        await navigator.clipboard.writeText(fullUrl);
        
        // Visual feedback
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        copyBtn.style.color = 'rgba(201, 165, 90, 1)';

        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy URL:', err);
        // Fallback: select text
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    });
  }

  // Scroll Animations
  function initScrollAnimations() {
    const comparisonCards = document.querySelectorAll('.comparison-card');
    const themeCards = document.querySelectorAll('.demo-pdf-theme-card');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animation
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, index * 100);
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    });

    comparisonCards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(card);
    });

    // Theme cards are already handled in renderThemeCards with staggered animation
  }
})();

