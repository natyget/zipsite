(function() {
  'use strict';

  // Initialize all features when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initBioTransformation();
    initThemeGallery();
    initPortfolioToggle();
    initFilterDemo();
  });

  // Scroll-triggered animations for feature spreads
  function initScrollAnimations() {
    const headers = document.querySelectorAll('.feature-spread__header');
    const demos = document.querySelectorAll('.feature-demo');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    });

    headers.forEach(header => observer.observe(header));
    demos.forEach(demo => observer.observe(demo));
  }

  // Feature 1: Bio Transformation Demo
  function initBioTransformation() {
    const input = document.getElementById('bio-input');
    const output = document.getElementById('bio-output-text');
    const heightOutput = document.getElementById('height-output');
    const measurementsOutput = document.getElementById('measurements-output');
    const sparkle = document.getElementById('transformation-sparkle');

    if (!input || !output) return;

    // Sample refined bio
    const refinedBio = "Elara Keats brings a refined editorial sensibility to every project. Based in Los Angeles, she seamlessly transitions between high-fashion editorials and commercial campaigns, delivering versatile performance with consistent professionalism.";

    // Auto-demo on load
    let autoDemoTimeout;
    function startAutoDemo() {
      let index = 0;
      output.textContent = '';
      
      function typeWriter() {
        if (index < refinedBio.length) {
          output.textContent += refinedBio.charAt(index);
          index++;
          autoDemoTimeout = setTimeout(typeWriter, 30);
        } else {
          // Update stats
          if (heightOutput) heightOutput.textContent = "5' 11\" / 180cm";
          if (measurementsOutput) measurementsOutput.textContent = "32-25-35";
          
          // Trigger sparkle animation
          if (sparkle) {
            sparkle.classList.add('is-active');
            setTimeout(() => sparkle.classList.remove('is-active'), 1000);
          }
        }
      }
      
      typeWriter();
    }

    // Start auto-demo after a short delay
    setTimeout(startAutoDemo, 1000);

    // Interactive transformation on input
    let transformTimeout;
    input.addEventListener('input', () => {
      clearTimeout(transformTimeout);
      clearTimeout(autoDemoTimeout);
      
      transformTimeout = setTimeout(() => {
        const rawText = input.value.trim();
        
        if (rawText.length === 0) {
          output.textContent = '';
          return;
        }

        // Simulate AI transformation (simplified)
        let transformed = rawText
          .replace(/i'm/gi, 'She is')
          .replace(/i /gi, 'She ')
          .replace(/i love/gi, 'specializes in')
          .replace(/i'm based/gi, 'Based')
          .replace(/available for bookings/gi, 'available for professional bookings')
          .replace(/\./g, '. ')
          .trim();

        // Capitalize first letter
        transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);

        // Typewriter effect
        output.textContent = '';
        let index = 0;
        function typeWriter() {
          if (index < transformed.length) {
            output.textContent += transformed.charAt(index);
            index++;
            setTimeout(typeWriter, 20);
          } else {
            // Trigger sparkle
            if (sparkle) {
              sparkle.classList.add('is-active');
              setTimeout(() => sparkle.classList.remove('is-active'), 1000);
            }
          }
        }
        typeWriter();
      }, 500);
    });
  }

  // Feature 2: Theme Gallery
  function initThemeGallery() {
    const themeCards = document.querySelectorAll('.theme-card');
    const previewFull = document.getElementById('theme-preview-full');
    const previewContent = document.getElementById('theme-preview-content');
    const closeFull = document.getElementById('theme-close-full');

    if (!themeCards.length) return;

    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const isPro = card.dataset.pro === 'true';
        
        if (isPro) {
          // Show upgrade prompt for Pro themes
          const upgradeMsg = 'This theme is available for Pro members. Upgrade to unlock all themes.';
          if (confirm(upgradeMsg)) {
            window.location.href = '/pro/upgrade';
          }
          return;
        }

        // Remove previous selection
        themeCards.forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');

        // Show full preview (optional - can be enhanced)
        if (previewFull && previewContent) {
          const themeName = card.querySelector('.theme-card__name').textContent;
          previewContent.innerHTML = `
            <h2 style="font-family: var(--font-serif); font-size: 2rem; margin-bottom: 1rem;">${themeName} Theme</h2>
            <p style="font-family: var(--font-sans); color: #475569; line-height: 1.7;">
              The ${themeName} theme features an elegant, editorial layout perfect for professional comp cards.
              ${isPro ? 'Upgrade to Pro to unlock this theme.' : 'This theme is available for free users.'}
            </p>
          `;
          previewFull.hidden = false;
        }
      });
    });

    // Close full preview
    if (closeFull && previewFull) {
      closeFull.addEventListener('click', () => {
        previewFull.hidden = true;
      });

      previewFull.addEventListener('click', (e) => {
        if (e.target === previewFull) {
          previewFull.hidden = true;
        }
      });
    }
  }

  // Feature 3: Portfolio Toggle
  function initPortfolioToggle() {
    const toggleButtons = document.querySelectorAll('.feature-demo__toggle-btn');
    const brandZipsite = document.getElementById('portfolio-brand-zipsite');
    const portfolioFeatures = document.getElementById('portfolio-features');

    if (!toggleButtons.length) return;

    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        toggleButtons.forEach(b => b.classList.remove('feature-demo__toggle-btn--active'));
        btn.classList.add('feature-demo__toggle-btn--active');

        const view = btn.dataset.view;

        // Toggle ZipSite branding
        if (brandZipsite) {
          if (view === 'free') {
            brandZipsite.style.display = 'inline';
            brandZipsite.textContent = '— ZipSite';
          } else {
            brandZipsite.style.display = 'none';
          }
        }

        // Toggle Pro features
        if (portfolioFeatures) {
          if (view === 'pro') {
            portfolioFeatures.style.display = 'flex';
          } else {
            portfolioFeatures.style.display = 'none';
          }
        }
      });
    });
  }

  // Feature 4: Filter Demo
  function initFilterDemo() {
    const locationFilter = document.getElementById('filter-location');
    const heightFilter = document.getElementById('filter-height');
    const heightValue = document.getElementById('height-value');
    const measurementsFilter = document.getElementById('filter-measurements');
    const specializationCheckboxes = document.querySelectorAll('.filter-specialization');
    const resultsGrid = document.getElementById('results-grid');
    const resultsCount = document.getElementById('results-count');
    const resultsEmpty = document.getElementById('results-empty');

    if (!resultsGrid) return;

    // Sample talent data
    const talentData = [
      { name: 'Elara Keats', location: 'LA', height: 71, measurements: '32-25-35', specializations: ['editorial', 'commercial'], image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80' },
      { name: 'Aiko Ren', location: 'NYC', height: 68, measurements: '34-26-36', specializations: ['runway', 'editorial'], image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
      { name: 'Bianca Cole', location: 'LA', height: 70, measurements: '33-24-34', specializations: ['commercial'], image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80' },
      { name: 'Sofia Martinez', location: 'Miami', height: 69, measurements: '32-25-35', specializations: ['editorial', 'runway'], image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80' },
      { name: 'Isabella Chen', location: 'NYC', height: 67, measurements: '31-24-33', specializations: ['commercial', 'editorial'], image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80' },
      { name: 'Maya Patel', location: 'Chicago', height: 72, measurements: '34-26-36', specializations: ['runway'], image: 'https://images.unsplash.com/photo-1503342452485-86b7f54527ef?auto=format&fit=crop&w=400&q=80' },
      { name: 'Luna Rodriguez', location: 'LA', height: 69, measurements: '33-25-35', specializations: ['editorial'], image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80' },
      { name: 'Zoe Kim', location: 'NYC', height: 68, measurements: '32-24-34', specializations: ['commercial', 'runway'], image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
      { name: 'Emma Wilson', location: 'Miami', height: 70, measurements: '33-25-35', specializations: ['editorial', 'commercial'], image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80' },
      { name: 'Olivia Brown', location: 'LA', height: 71, measurements: '34-26-36', specializations: ['runway'], image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80' },
      { name: 'Ava Davis', location: 'NYC', height: 67, measurements: '31-24-33', specializations: ['editorial'], image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80' },
      { name: 'Sophia Taylor', location: 'Chicago', height: 69, measurements: '32-25-35', specializations: ['commercial', 'runway'], image: 'https://images.unsplash.com/photo-1503342452485-86b7f54527ef?auto=format&fit=crop&w=400&q=80' }
    ];

    // Convert height in inches to feet and inches
    function inchesToFeetInches(inches) {
      const feet = Math.floor(inches / 12);
      const remainingInches = inches % 12;
      return `${feet}' ${remainingInches}"`;
    }

    // Filter talent based on criteria
    function filterTalent() {
      const location = locationFilter?.value || '';
      const minHeight = heightFilter ? parseInt(heightFilter.value) : 60;
      const measurements = measurementsFilter?.value.trim() || '';
      const selectedSpecializations = Array.from(specializationCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      const filtered = talentData.filter(talent => {
        // Location filter
        if (location && talent.location !== location) return false;

        // Height filter
        if (talent.height < minHeight) return false;

        // Measurements filter (simplified - just check if it matches)
        if (measurements && !talent.measurements.includes(measurements.replace(/\s/g, ''))) return false;

        // Specializations filter
        if (selectedSpecializations.length > 0) {
          const hasSpecialization = selectedSpecializations.some(spec => 
            talent.specializations.includes(spec)
          );
          if (!hasSpecialization) return false;
        }

        return true;
      });

      renderResults(filtered);
    }

    // Render filtered results
    function renderResults(results) {
      if (!resultsGrid) return;

      resultsGrid.innerHTML = '';

      if (results.length === 0) {
        if (resultsEmpty) resultsEmpty.hidden = false;
        if (resultsCount) resultsCount.textContent = '0 models';
        return;
      }

      if (resultsEmpty) resultsEmpty.hidden = true;
      if (resultsCount) {
        resultsCount.textContent = `${results.length} ${results.length === 1 ? 'model' : 'models'}`;
      }

      results.forEach(talent => {
        const card = document.createElement('div');
        card.className = 'feature-demo__talent-card';
        card.innerHTML = `
          <img src="${talent.image}" alt="${talent.name}" class="feature-demo__talent-card-image" loading="lazy">
          <div class="feature-demo__talent-card-info">
            <div class="feature-demo__talent-card-name">${talent.name}</div>
            <div class="feature-demo__talent-card-location">${talent.location}</div>
          </div>
        `;
        resultsGrid.appendChild(card);
      });
    }

    // Update height display
    if (heightFilter && heightValue) {
      heightFilter.addEventListener('input', () => {
        const inches = parseInt(heightFilter.value);
        heightValue.textContent = inchesToFeetInches(inches);
        filterTalent();
      });
    }

    // Filter on change
    if (locationFilter) {
      locationFilter.addEventListener('change', filterTalent);
    }

    if (measurementsFilter) {
      measurementsFilter.addEventListener('input', () => {
        clearTimeout(measurementsFilter.filterTimeout);
        measurementsFilter.filterTimeout = setTimeout(filterTalent, 500);
      });
    }

    specializationCheckboxes.forEach(cb => {
      cb.addEventListener('change', filterTalent);
    });

    // Initial render
    filterTalent();
  }
})();

