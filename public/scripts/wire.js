(function () {
  const ZipSite = (window.ZipSite = window.ZipSite || {});

  function toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const note = document.createElement('div');
    note.className = `toast toast-${type}`;
    note.textContent = message;
    container.appendChild(note);
    requestAnimationFrame(() => {
      note.classList.add('show');
    });
    setTimeout(() => {
      note.classList.remove('show');
      note.addEventListener(
        'transitionend',
        () => {
          note.remove();
          if (!container.childElementCount) {
            container.remove();
          }
        },
        { once: true }
      );
    }, 3600);
  }

  ZipSite.toast = toast;

  function setLoading(button, loadingText) {
    if (!button) return () => {};
    const originalText = button.dataset.originalText || button.textContent;
    button.dataset.originalText = originalText;
    button.disabled = true;
    if (loadingText) {
      button.textContent = loadingText;
    }
    button.classList.add('is-loading');
    return () => {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.textContent = originalText;
    };
  }

  ZipSite.setLoading = setLoading;

  function hydrateFlash() {
    const flashes = document.querySelectorAll('[data-flash]');
    flashes.forEach((node) => {
      toast(node.textContent.trim(), node.dataset.flashType || 'info');
      node.remove();
    });
  }

  function handleAsyncForms() {
    document.querySelectorAll('form[data-async]').forEach((form) => {
      form.addEventListener('submit', () => {
        const submitButton = form.querySelector('[type="submit"]');
        const loadingText = submitButton?.dataset.loadingText;
        if (submitButton) {
          setLoading(submitButton, loadingText);
        }
      });
    });
  }

  // Handle multi-step apply form
  function handleApplyForm() {
    const applyForm = document.getElementById('apply-form');
    if (!applyForm) return;

    const stepIndicators = applyForm.closest('.apply-form-card')?.querySelectorAll('.apply-steps li');
    const nextButton = document.getElementById('next-button');
    const prevButton = document.getElementById('prev-button');
    
    if (!stepIndicators || stepIndicators.length === 0) {
      // Fallback: if no step indicators, submit normally
      applyForm.addEventListener('submit', function(e) {
        const submitButton = applyForm.querySelector('[type="submit"]');
        if (submitButton) {
          const loadingText = submitButton?.dataset.loadingText;
          if (loadingText) {
            submitButton.disabled = true;
            submitButton.textContent = loadingText;
          }
        }
      });
      return;
    }

    // Multi-step form logic
    let currentStep = 0;
    const totalSteps = stepIndicators.length;
    
    // Defensive check: ensure we have the expected number of steps
    if (totalSteps !== 4) {
      console.warn('[Apply Form] Expected 4 steps, found:', totalSteps);
    }
    
    // Group form steps by data-step attribute
    const formSteps = Array.from(applyForm.querySelectorAll('.form-step[data-step]'));
    
    // Sort steps by data-step attribute to ensure correct order
    formSteps.sort((a, b) => {
      const stepA = parseInt(a.getAttribute('data-step'), 10);
      const stepB = parseInt(b.getAttribute('data-step'), 10);
      return stepA - stepB;
    });
    
    // Defensive check: ensure formSteps matches totalSteps
    if (formSteps.length !== totalSteps) {
      console.warn('[Apply Form] Mismatch: formSteps.length =', formSteps.length, 'totalSteps =', totalSteps);
    }

    function showStep(stepIndex) {
      // Validate step index
      if (stepIndex < 0 || stepIndex >= totalSteps) {
        console.warn('[Apply Form] Invalid step index:', stepIndex);
        return;
      }

      // Hide/show form steps (0-indexed, but data-step is 1-indexed)
      formSteps.forEach((step, index) => {
        if (index === stepIndex) {
          step.style.display = '';
        } else {
          step.style.display = 'none';
        }
      });

      // Update step indicators
      stepIndicators.forEach((indicator, index) => {
        indicator.classList.toggle('is-active', index === stepIndex);
      });

      // Update buttons - ALWAYS explicitly set type
      prevButton.disabled = stepIndex === 0;
      
      // Only on the LAST step (index totalSteps - 1) should button be submit
      const isLastStep = stepIndex === totalSteps - 1;
      if (isLastStep) {
        nextButton.textContent = 'Submit Application';
        nextButton.type = 'submit';
      } else {
        nextButton.textContent = 'Next';
        nextButton.type = 'button'; // Explicitly set to button for all non-final steps
      }

      currentStep = stepIndex;
    }

    function validateCurrentStep() {
      const currentStepElement = formSteps[currentStep];
      if (!currentStepElement) return true;
      
      let isValid = true;
      const inputs = currentStepElement.querySelectorAll('input[required], textarea[required], select[required]');
      
      inputs.forEach(input => {
        if (!input.checkValidity()) {
          input.reportValidity();
          isValid = false;
        }
      });
      
      return isValid;
    }

    // Initialize: hide all steps except the first
    formSteps.forEach((step, index) => {
      if (index !== 0) {
        step.style.display = 'none';
      }
    });
    showStep(0);

    // File upload handler for step 3
    const fileInput = document.getElementById('photos');
    const dropzone = document.querySelector('.file-upload-dropzone');
    const previewGrid = document.getElementById('file-preview-grid');
    const fileUploadLink = document.querySelector('.file-upload-link');
    const selectedFiles = [];

    if (fileInput && dropzone && previewGrid) {
      // Click on dropzone to trigger file input
      dropzone.addEventListener('click', () => fileInput.click());
      if (fileUploadLink) {
        fileUploadLink.addEventListener('click', (e) => {
          e.stopPropagation();
          fileInput.click();
        });
      }

      // File input change handler
      fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        selectedFiles.length = 0;
        selectedFiles.push(...files);
        updatePreview();
        updateReviewPhotos();
      });

      // Drag and drop handlers
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          dropzone.classList.add('drag-over');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          dropzone.classList.remove('drag-over');
        }, false);
      });

      dropzone.addEventListener('drop', function(e) {
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
          selectedFiles.push(...files);
          const dataTransfer = new DataTransfer();
          selectedFiles.forEach(file => dataTransfer.items.add(file));
          fileInput.files = dataTransfer.files;
          updatePreview();
          updateReviewPhotos();
        }
      });
    }

    function updatePreview() {
      previewGrid.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = function(e) {
          const item = document.createElement('div');
          item.className = 'file-preview-item';
          
          const img = document.createElement('img');
          img.src = e.target.result;
          img.alt = file.name;
          
          const removeBtn = document.createElement('button');
          removeBtn.className = 'file-preview-item__remove';
          removeBtn.type = 'button';
          removeBtn.innerHTML = '×';
          removeBtn.addEventListener('click', () => {
            selectedFiles.splice(index, 1);
            const dataTransfer = new DataTransfer();
            selectedFiles.forEach(f => dataTransfer.items.add(f));
            fileInput.files = dataTransfer.files;
            updatePreview();
            updateReviewPhotos();
          });
          
          item.appendChild(img);
          item.appendChild(removeBtn);
          previewGrid.appendChild(item);
        };
        reader.readAsDataURL(file);
      });
    }

    // Review step population
    function populateReview() {
      const form = applyForm;
      const nameEl = document.getElementById('review-name');
      const phoneEl = document.getElementById('review-phone');
      const cityEl = document.getElementById('review-city');
      const heightEl = document.getElementById('review-height');
      const measurementsEl = document.getElementById('review-measurements');
      const bustEl = document.getElementById('review-bust');
      const waistEl = document.getElementById('review-waist');
      const hipsEl = document.getElementById('review-hips');
      const shoeSizeEl = document.getElementById('review-shoe-size');
      const eyeColorEl = document.getElementById('review-eye-color');
      const hairColorEl = document.getElementById('review-hair-color');
      const bioEl = document.getElementById('review-bio');
      const specialtiesEl = document.getElementById('review-specialties');
      const photosCountEl = document.getElementById('review-photos-count');

      if (nameEl) {
        const firstName = form.querySelector('[name="first_name"]')?.value || '';
        const lastName = form.querySelector('[name="last_name"]')?.value || '';
        nameEl.textContent = `${firstName} ${lastName}`.trim() || '—';
      }
      if (phoneEl) phoneEl.textContent = form.querySelector('[name="phone"]')?.value || '—';
      if (cityEl) cityEl.textContent = form.querySelector('[name="city"]')?.value || '—';
      if (heightEl) heightEl.textContent = form.querySelector('[name="height_cm"]')?.value || '—';
      if (measurementsEl) measurementsEl.textContent = form.querySelector('[name="measurements"]')?.value || '—';
      if (bustEl) bustEl.textContent = form.querySelector('[name="bust"]')?.value ? `${form.querySelector('[name="bust"]').value}"` : '—';
      if (waistEl) waistEl.textContent = form.querySelector('[name="waist"]')?.value ? `${form.querySelector('[name="waist"]').value}"` : '—';
      if (hipsEl) hipsEl.textContent = form.querySelector('[name="hips"]')?.value ? `${form.querySelector('[name="hips"]').value}"` : '—';
      if (shoeSizeEl) shoeSizeEl.textContent = form.querySelector('[name="shoe_size"]')?.value || '—';
      if (eyeColorEl) eyeColorEl.textContent = form.querySelector('[name="eye_color"]')?.value || '—';
      if (hairColorEl) hairColorEl.textContent = form.querySelector('[name="hair_color"]')?.value || '—';
      if (bioEl) {
        const bio = form.querySelector('[name="bio"]')?.value || '';
        bioEl.textContent = bio || '—';
      }
      if (specialtiesEl) {
        const checkboxes = form.querySelectorAll('[name="specialties"]:checked');
        const specialties = Array.from(checkboxes).map(cb => cb.value);
        specialtiesEl.textContent = specialties.length > 0 ? specialties.join(', ') : '—';
      }
      updateReviewPhotos();
    }

    function updateReviewPhotos() {
      const photosCountEl = document.getElementById('review-photos-count');
      if (photosCountEl) {
        const count = selectedFiles.length;
        photosCountEl.textContent = `${count} image${count !== 1 ? 's' : ''} selected`;
      }
    }

    // Update review when moving to step 4
    const originalShowStep = showStep;
    showStep = function(stepIndex) {
      originalShowStep(stepIndex);
      if (stepIndex === 3) { // Step 4 is index 3 (0-indexed)
        populateReview();
      }
    };

    // Next button handler
    nextButton.addEventListener('click', function(e) {
      // Always prevent default to avoid accidental form submission
      e.preventDefault();
      e.stopPropagation();
      
      // Defensive check: ensure we're not on the last step before advancing
      if (currentStep < totalSteps - 1) {
        // Validate current step
        if (!validateCurrentStep()) {
          return;
        }
        // Move to next step
        showStep(currentStep + 1);
      } else {
        // Last step: submit form
        // Only submit if we're actually on the last step
        if (currentStep === totalSteps - 1 && validateCurrentStep()) {
          const submitButton = applyForm.querySelector('[type="submit"]');
          if (submitButton) {
            const loadingText = submitButton?.dataset.loadingText;
            if (loadingText) {
              submitButton.disabled = true;
              submitButton.textContent = loadingText;
            }
          }
          // Remove the submit handler temporarily to allow submission
          if (applyForm._formSubmitHandler) {
            applyForm.removeEventListener('submit', applyForm._formSubmitHandler);
          }
          applyForm.submit();
        }
      }
    });

    // Previous button handler
    prevButton.addEventListener('click', function() {
      if (currentStep > 0) {
        showStep(currentStep - 1);
      }
    });

    // Prevent form submission unless on last step
    const formSubmitHandler = function(e) {
      // Defensive check: prevent submission if not on last step
      if (currentStep < totalSteps - 1) {
        e.preventDefault();
        e.stopPropagation();
        // Validate and move to next step
        if (validateCurrentStep()) {
          showStep(currentStep + 1);
        }
        return false;
      }
      // On last step, allow submission to proceed
      // But ensure button type is submit
      if (nextButton.type !== 'submit') {
        nextButton.type = 'submit';
      }
    };
    
    applyForm.addEventListener('submit', formSubmitHandler);
    
    // Store reference for potential removal
    applyForm._formSubmitHandler = formSubmitHandler;
  }

  function handleCopyLinks() {
    document.querySelectorAll('[data-copy-link]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.getAttribute('data-copy-value');
        try {
          await navigator.clipboard.writeText(value);
          toast('Link copied to clipboard', 'success');
        } catch (error) {
          toast('Unable to copy link', 'error');
        }
      });
    });
  }

  function handlePdfButtons() {
    document.querySelectorAll('[data-action="download-pdf"]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const slug = button.getAttribute('data-slug');
        if (!slug) return;
        const done = setLoading(button, 'Generating…');
        try {
          const response = await fetch(`/pdf/${slug}?download=1`);
          if (!response.ok) {
            throw new Error('Unable to generate PDF');
          }
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ZipSite-${slug}-compcard.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
          toast('PDF downloaded', 'success');
        } catch (error) {
          toast(error.message, 'error');
        } finally {
          done();
        }
      });
    });
  }

  function wireMobileNav() {
    const toggle = document.querySelector('.mobile-nav-toggle');
    const panel = document.querySelector('#mobileNav');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
    });
  }

  function initUniversalHeaderMenu() {
    const menuToggle = document.querySelector('.universal-header__menu-toggle');
    const navPanel = document.getElementById('universalNav');

    if (menuToggle && navPanel) {
      const toggleMenu = () => {
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', String(!expanded));
        if (expanded) {
          navPanel.setAttribute('hidden', '');
        } else {
          navPanel.removeAttribute('hidden');
        }
      };

      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
      });

      const navLinks = navPanel.querySelectorAll('a');
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          toggleMenu();
        });
      });

      document.addEventListener('click', (e) => {
        if (!navPanel.hidden && !navPanel.contains(e.target) && !menuToggle.contains(e.target)) {
          if (menuToggle.getAttribute('aria-expanded') === 'true') {
            toggleMenu();
          }
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !navPanel.hidden) {
          toggleMenu();
        }
      });
    }
  }

  function initFooterAnimations() {
    const footer = document.querySelector('.universal-footer');
    if (!footer) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          footer.classList.add('is-visible');
          
          // Stagger animation for footer sections
          const brandSection = footer.querySelector('.universal-footer__brand-section');
          const navSections = footer.querySelector('.universal-footer__nav-sections');
          const newsletterSection = footer.querySelector('.universal-footer__newsletter-section');

          if (brandSection) {
            setTimeout(() => brandSection.classList.add('is-visible'), 100);
          }
          if (navSections) {
            setTimeout(() => navSections.classList.add('is-visible'), 200);
          }
          if (newsletterSection) {
            setTimeout(() => newsletterSection.classList.add('is-visible'), 300);
          }
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    observer.observe(footer);
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateFlash();
    handleAsyncForms();
    handleApplyForm();
    handleCopyLinks();
    handlePdfButtons();
    wireMobileNav();
    initUniversalHeaderMenu();
    initFooterAnimations();
  });
})();
