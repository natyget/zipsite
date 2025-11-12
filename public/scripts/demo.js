(function() {
  'use strict';

  // Get theme data from server
  const themeData = window.DEMO_THEME_DATA || {};
  const allThemes = themeData.allThemes || {};
  const freeThemes = themeData.freeThemes || [];
  const proThemes = themeData.proThemes || [];
  const demoSlug = themeData.demoSlug || 'elara-k';
  const baseUrl = themeData.baseUrl || '';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initPortfolioPreview();
    initPdfThemeGallery(); // Initialize first so themeGalleryInstance is set
    initThemeFilter(); // Initialize after theme gallery
    initCopyUrl();
    initScrollAnimations();
  });

  // Portfolio Preview - Responsive View Toggle
  function initPortfolioPreview() {
    const frame = document.getElementById('portfolio-preview-frame');
    const controlBtns = document.querySelectorAll('.demo-portfolio-preview__control-btn');
    const iframe = document.querySelector('.demo-portfolio-preview__iframe');
    const errorDiv = document.getElementById('portfolio-iframe-error');

    if (!frame || !controlBtns.length) return;

    // Set default view to desktop
    frame.setAttribute('data-view', 'desktop');
    controlBtns[0]?.classList.add('is-active');

    // Handle iframe load errors
    if (iframe) {
      iframe.addEventListener('error', () => {
        console.warn('[Demo] Portfolio iframe failed to load');
        if (iframe) iframe.style.display = 'none';
        if (errorDiv) errorDiv.style.display = 'block';
      });

      // Check if iframe loaded successfully after a timeout
      iframe.addEventListener('load', () => {
        // Iframe loaded successfully
        if (errorDiv) errorDiv.style.display = 'none';
      });

      // Fallback: check after 5 seconds if iframe is still loading
      setTimeout(() => {
        try {
          // Try to access iframe content - if it fails, show error
          if (iframe.contentWindow && iframe.contentWindow.document) {
            // Iframe loaded successfully
            if (errorDiv) errorDiv.style.display = 'none';
          }
        } catch (e) {
          // Cross-origin or error - this is expected for external content
          // But if we get here and the iframe is blank, it might be an error
          if (iframe.src && iframe.src !== 'about:blank') {
            // Iframe might have failed - check if it's showing an error page
            // We can't check content due to CORS, so we'll assume it's working
            // unless we get an explicit error event
          }
        }
      }, 5000);
    }

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

  // Theme Filter Tabs
  let currentThemeFilter = 'all';
  let themeGalleryInstance = null;

  function initThemeFilter() {
    const tabs = document.querySelectorAll('.demo-pdf-themes__tab');
    const gallery = document.getElementById('pdf-themes-gallery');
    
    if (!tabs.length || !gallery) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.themeFilter;
        currentThemeFilter = filter;
        
        // Update active state
        tabs.forEach(t => t.classList.remove('demo-pdf-themes__tab--active'));
        tab.classList.add('demo-pdf-themes__tab--active');
        
        // Reset preview when switching filters
        if (themeGalleryInstance && themeGalleryInstance.resetPdfPreview) {
          themeGalleryInstance.resetPdfPreview();
        }
        
        // Re-render themes with filter
        if (themeGalleryInstance && themeGalleryInstance.renderThemeCards) {
          themeGalleryInstance.renderThemeCards(filter);
        }
      });
    });
  }

  // PDF Theme Gallery
  function initPdfThemeGallery() {
    const gallery = document.getElementById('pdf-themes-gallery');
    const previewContent = document.getElementById('pdf-preview-content');
    const previewTitle = document.getElementById('preview-theme-name');
    const previewDescription = document.getElementById('preview-theme-description');
    const previewActions = document.getElementById('pdf-preview-actions');
    const previewBadge = document.getElementById('preview-theme-badge');
    const downloadBtn = document.getElementById('download-pdf-btn');
    const closeBtn = document.getElementById('close-pdf-preview');

    if (!gallery) return;

    // Render theme cards initially
    renderThemeCards('all');

    // Theme card click handler
    gallery.addEventListener('click', (e) => {
      const card = e.target.closest('.demo-pdf-theme-card');
      if (!card) return;

      const themeKey = card.dataset.theme;
      const theme = allThemes[themeKey];
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

    function renderThemeCards(filter = 'all') {
      if (!gallery) return;
      
      // Clear gallery
      gallery.innerHTML = '';
      
      // Reset preview when re-rendering (only if preview is shown)
      if (previewActions && !previewActions.hidden) {
        resetPdfPreview();
      }
      
      // Get themes to render based on filter
      let themesToRender = [];
      if (filter === 'free') {
        themesToRender = freeThemes;
      } else if (filter === 'pro') {
        themesToRender = proThemes;
      } else {
        themesToRender = Object.values(allThemes);
      }

      // Sort: Free themes first, then Pro themes
      themesToRender.sort((a, b) => {
        if (a.isPro === b.isPro) return 0;
        return a.isPro ? 1 : -1;
      });

      // Render theme cards
      themesToRender.forEach((theme, index) => {
        if (!theme || !theme.key) return;
        const card = createThemeCard(theme, index);
        if (card) {
          gallery.appendChild(card);
        }
      });
    }

    function createThemeCard(theme, index) {
      const card = document.createElement('div');
      card.className = `demo-pdf-theme-card ${theme.isPro ? 'demo-pdf-theme-card--pro' : 'demo-pdf-theme-card--free'}`;
      card.dataset.theme = theme.key;
      
      // Create preview with theme colors
      const previewBg = theme.colors.background;
      const previewText = theme.colors.text;
      const previewAccent = theme.colors.accent;
      
      // Get font family for preview (use name font)
      const nameFont = theme.fonts.name || 'serif';
      
      card.innerHTML = `
        <div class="demo-pdf-theme-card__preview" style="background: ${previewBg}; color: ${previewText};">
          <div class="demo-pdf-theme-card__preview-content">
            <div class="demo-pdf-theme-card__preview-name" style="font-family: '${nameFont}', ${nameFont.includes('Sans') || nameFont === 'Inter' ? 'sans-serif' : 'serif'}; color: ${previewText};">
              ELARA KEATS
            </div>
            <div class="demo-pdf-theme-card__preview-stats" style="color: ${previewAccent};">
              5'11" • 32-25-35
            </div>
            <div class="demo-pdf-theme-card__preview-colors">
              <div class="demo-pdf-theme-card__swatch" style="background: ${previewBg}; border: 1px solid ${previewText}20;"></div>
              <div class="demo-pdf-theme-card__swatch" style="background: ${previewText};"></div>
              <div class="demo-pdf-theme-card__swatch" style="background: ${previewAccent};"></div>
            </div>
          </div>
          ${theme.isPro ? '<div class="demo-pdf-theme-card__pro-badge">Pro</div>' : ''}
        </div>
        <div class="demo-pdf-theme-card__info">
          <div class="demo-pdf-theme-card__name">
            ${theme.name}
            <span class="demo-pdf-theme-card__badge ${theme.isPro ? 'demo-pdf-theme-card__badge--pro' : 'demo-pdf-theme-card__badge--free'}">
              ${theme.isPro ? 'Pro' : 'Free'}
            </span>
          </div>
          <div class="demo-pdf-theme-card__personality">${theme.personality || theme.description || ''}</div>
          ${theme.isPro ? '<div class="demo-pdf-theme-card__features">Full customization</div>' : '<div class="demo-pdf-theme-card__features">ZipSite watermark</div>'}
        </div>
      `;

      // Stagger animation
      setTimeout(() => {
        card.classList.add('is-visible');
      }, index * 100);

      return card;
    }

    function updatePdfPreview(themeKey, theme) {
      if (!previewContent || !previewTitle) return;

      // Update title and description
      previewTitle.textContent = `${theme.name} Theme`;
      if (previewDescription) {
        previewDescription.textContent = theme.description || theme.personality || '';
      }

      // Update badge
      if (previewBadge) {
        previewBadge.textContent = theme.isPro ? 'Pro Theme' : 'Free Theme';
        previewBadge.className = `demo-pdf-themes__preview-badge ${theme.isPro ? 'demo-pdf-themes__preview-badge--pro' : 'demo-pdf-themes__preview-badge--free'}`;
      }

      // Show preview actions
      if (previewActions) {
        previewActions.hidden = false;
      }

      if (closeBtn) {
        closeBtn.hidden = false;
      }

      // Create iframe preview with error handling
      const previewUrl = `${baseUrl}/pdf/view/${demoSlug}?theme=${themeKey}&_=${Date.now()}`;
      
      previewContent.innerHTML = `
        <div class="demo-pdf-themes__preview-loading" style="padding: 2rem; text-align: center; color: #666;">
          <p>Loading preview...</p>
        </div>
        <iframe 
          src="${previewUrl}" 
          class="demo-pdf-themes__preview-iframe"
          title="PDF ${theme.name} Theme Preview"
          loading="lazy"
          style="display: none;">
        </iframe>
        <div class="demo-pdf-themes__preview-error" style="display: none; padding: 2rem; text-align: center; color: #666;">
          <p>PDF preview unavailable</p>
          <p style="font-size: 0.9rem; margin-top: 0.5rem;">The demo PDF is not available at this time.</p>
        </div>
      `;

      const iframe = previewContent.querySelector('.demo-pdf-themes__preview-iframe');
      const loadingDiv = previewContent.querySelector('.demo-pdf-themes__preview-loading');
      const errorDiv = previewContent.querySelector('.demo-pdf-themes__preview-error');

      if (iframe) {
        let hasLoaded = false;
        let loadTimeout = null;

        // Check if iframe content loaded successfully
        const checkIframeContent = () => {
          try {
            // Try to access iframe content to check if it loaded
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && iframeDoc.body) {
              // Check if it's an error page (simple check - if body has very little content or error text)
              const bodyText = iframeDoc.body.textContent || '';
              const bodyHTML = iframeDoc.body.innerHTML || '';
              
              // If it's an error page, it will have minimal content
              // If it's the PDF view, it should have the comp-card class
              if (bodyHTML.includes('comp-card') || bodyHTML.includes('comp-card__') || bodyHTML.length > 500) {
                // Successfully loaded PDF view
                hasLoaded = true;
                if (loadingDiv) loadingDiv.style.display = 'none';
                if (errorDiv) errorDiv.style.display = 'none';
                iframe.style.display = 'block';
                if (loadTimeout) clearTimeout(loadTimeout);
                return true;
              } else if (bodyText.includes('Error') || bodyText.includes('unavailable') || bodyText.includes('not found')) {
                // Error page detected
                if (loadingDiv) loadingDiv.style.display = 'none';
                if (iframe) iframe.style.display = 'none';
                if (errorDiv) errorDiv.style.display = 'block';
                if (loadTimeout) clearTimeout(loadTimeout);
                return false;
              }
            }
          } catch (e) {
            // Cross-origin or other error - can't check content
            // This is expected for same-origin, so we'll rely on load event
          }
          return null;
        };

        // Handle iframe load event
        iframe.addEventListener('load', () => {
          console.log('[Demo] PDF iframe load event fired for:', previewUrl);
          
          // Wait a bit for content to render, then check
          setTimeout(() => {
            const contentCheck = checkIframeContent();
            if (contentCheck === null) {
              // Can't check content (same-origin or other issue)
              // Assume it loaded successfully if load event fired
              hasLoaded = true;
              if (loadingDiv) loadingDiv.style.display = 'none';
              if (errorDiv) errorDiv.style.display = 'none';
              iframe.style.display = 'block';
              if (loadTimeout) clearTimeout(loadTimeout);
            }
          }, 500);
        });

        // Handle iframe error event
        iframe.addEventListener('error', () => {
          console.error('[Demo] PDF iframe error event fired for:', previewUrl);
          if (loadingDiv) loadingDiv.style.display = 'none';
          if (iframe) iframe.style.display = 'none';
          if (errorDiv) errorDiv.style.display = 'block';
          if (loadTimeout) clearTimeout(loadTimeout);
        });

        // Fallback: if iframe doesn't load within 10 seconds, check content or show error
        loadTimeout = setTimeout(() => {
          if (!hasLoaded) {
            console.warn('[Demo] PDF iframe load timeout for:', previewUrl);
            const contentCheck = checkIframeContent();
            if (contentCheck === false || contentCheck === null) {
              // Still loading or error detected
              if (loadingDiv) loadingDiv.style.display = 'none';
              if (iframe && iframe.style.display === 'none') {
                if (errorDiv) errorDiv.style.display = 'block';
              } else {
                // Iframe is displayed but we're not sure if it's valid
                // Give it a bit more time
                setTimeout(() => {
                  if (!hasLoaded) {
                    const finalCheck = checkIframeContent();
                    if (finalCheck === false || finalCheck === null) {
                      if (iframe) iframe.style.display = 'none';
                      if (errorDiv) errorDiv.style.display = 'block';
                    }
                  }
                }, 2000);
              }
            }
          }
        }, 10000);
      }

      // Update download button
      if (downloadBtn) {
        downloadBtn.href = `${baseUrl}/pdf/${demoSlug}?theme=${themeKey}&download=1`;
        downloadBtn.textContent = `Download ${theme.name} PDF`;
      }
    }

    function resetPdfPreview() {
      if (!previewContent || !previewTitle) return;

      previewTitle.textContent = 'Select a theme';
      if (previewDescription) {
        previewDescription.textContent = '';
      }
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

      if (previewBadge) {
        previewBadge.textContent = '';
      }

      // Remove selected state
      document.querySelectorAll('.demo-pdf-theme-card').forEach(c => {
        c.classList.remove('is-selected');
      });
    }

    // Store instance for filter tabs
    themeGalleryInstance = {
      renderThemeCards: renderThemeCards,
      updatePdfPreview: updatePdfPreview,
      resetPdfPreview: resetPdfPreview
    };
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

    // Theme cards are already handled in createThemeCard with staggered animation
  }
})();
