(function () {
  'use strict';

  console.log('[ZipSite Homepage] Script loaded at', new Date().toISOString());

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

  function initHeaderScroll() {
    const header = document.querySelector('.universal-header--homepage') || document.querySelector('.universal-header');
    if (!header) return;

    let ticking = false;

    function updateHeader() {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

      if (currentScroll > 50) {
        if (!header.classList.contains('scrolled')) {
          header.classList.add('scrolled');
        }
      } else {
        if (header.classList.contains('scrolled')) {
          header.classList.remove('scrolled');
        }
      }

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });

    updateHeader();
  }

  // Transformation Hero Animation
  function initTransformationHero() {
    const heroSection = document.getElementById('transformation-hero');
    if (!heroSection) return;

    const rawDocument = heroSection.querySelector('.email-draft');
    const portfolioCard = heroSection.querySelector('.portfolio-card');
    const transformationZone = document.getElementById('transformation-zone');
    const replayButton = document.getElementById('replay-transformation');

    if (!rawDocument || !portfolioCard || !transformationZone) return;

    let isAnimating = false;
    const EMAIL_SHOW_DURATION = 2000; // Show email for 2 seconds
    const BUILD_DURATION = 4000; // Portfolio build takes 4 seconds

    // Build portfolio card in real-time
    function buildPortfolio() {
      if (isAnimating) return;
      
      isAnimating = true;
      transformationZone.classList.add('animating');

      // Step 1: Build header (name and location)
      const header = portfolioCard.querySelector('.portfolio-card__header');
      const name = portfolioCard.querySelector('.portfolio-card__name');
      const location = portfolioCard.querySelector('.portfolio-card__location');
      
      setTimeout(() => {
        if (header) {
          header.style.opacity = '0';
          header.style.transform = 'translateY(-20px)';
          header.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          header.style.opacity = '1';
          header.style.transform = 'translateY(0)';
        }
      }, 0);

      setTimeout(() => {
        if (name) {
          name.style.opacity = '0';
          name.style.transform = 'translateY(10px) scale(0.95)';
          name.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
          name.style.opacity = '1';
          name.style.transform = 'translateY(0) scale(1)';
        }
      }, 300);

      setTimeout(() => {
        if (location) {
          location.style.opacity = '0';
          location.style.transform = 'translateY(5px)';
          location.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          location.style.opacity = '1';
          location.style.transform = 'translateY(0)';
        }
      }, 800);

      // Step 2: Build hero image
      const heroImage = portfolioCard.querySelector('.portfolio-card__hero-image');
      const heroImg = portfolioCard.querySelector('.portfolio-card__hero-image img');
      
      setTimeout(() => {
        if (heroImage) {
          heroImage.style.opacity = '0';
          heroImage.style.transform = 'scale(0.98)';
          heroImage.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
          heroImage.style.opacity = '1';
          heroImage.style.transform = 'scale(1)';
        }
        if (heroImg) {
          heroImg.style.filter = 'brightness(0.7) contrast(0.8) grayscale(0.3)';
          heroImg.style.transition = 'filter 1.2s ease';
          heroImg.style.filter = 'brightness(1.05) contrast(1.08) grayscale(0)';
        }
      }, 1200);

      // Step 3: Build stats section
      const stats = portfolioCard.querySelector('.portfolio-card__stats');
      const statItems = portfolioCard.querySelectorAll('.portfolio-card__stat');
      const contact = portfolioCard.querySelector('.portfolio-card__contact');
      
      setTimeout(() => {
        if (stats) {
          stats.style.opacity = '0';
          stats.style.transform = 'translateY(15px)';
          stats.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
          stats.style.opacity = '1';
          stats.style.transform = 'translateY(0)';
        }
      }, 2000);

      statItems.forEach((stat, index) => {
        const label = stat.querySelector('.portfolio-card__stat-label');
        const value = stat.querySelector('.portfolio-card__stat-value');
        
        setTimeout(() => {
          if (label) {
            label.style.opacity = '0';
            label.style.transform = 'translateX(-10px)';
            label.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            label.style.opacity = '1';
            label.style.transform = 'translateX(0)';
          }
        }, 2200 + (index * 150));

        setTimeout(() => {
          if (value) {
            value.style.opacity = '0';
            value.style.transform = 'translateY(5px)';
            value.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            value.style.opacity = '1';
            value.style.transform = 'translateY(0)';
          }
        }, 2400 + (index * 150));
      });

      // Step 3.5: Build contact info
      setTimeout(() => {
        if (contact) {
          contact.style.opacity = '0';
          contact.style.transform = 'translateY(5px)';
          contact.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          contact.style.opacity = '1';
          contact.style.transform = 'translateY(0)';
        }
      }, 2900);

      // Step 4: Build gallery
      const gallery = portfolioCard.querySelector('.portfolio-card__gallery');
      const galleryItems = portfolioCard.querySelectorAll('.portfolio-card__gallery-item');
      
      setTimeout(() => {
        if (gallery) {
          gallery.style.opacity = '0';
          gallery.style.transform = 'translateY(10px)';
          gallery.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          gallery.style.opacity = '1';
          gallery.style.transform = 'translateY(0)';
        }
      }, 3000);

      galleryItems.forEach((item, index) => {
        const img = item.querySelector('img');
        setTimeout(() => {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.9)';
          item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
          
          if (img) {
            img.style.filter = 'brightness(0.8) contrast(0.85) grayscale(0.2)';
            img.style.transition = 'filter 0.8s ease';
            img.style.filter = 'brightness(1.05) contrast(1.05) grayscale(0)';
          }
        }, 3200 + (index * 120));
      });

      // Step 5: Build bio
      const bio = portfolioCard.querySelector('.portfolio-card__bio');
      const bioText = portfolioCard.querySelector('.portfolio-card__bio-text');
      
      setTimeout(() => {
        if (bio) {
          bio.style.opacity = '0';
          bio.style.transform = 'translateY(10px)';
          bio.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
          bio.style.opacity = '1';
          bio.style.transform = 'translateY(0)';
        }
        if (bioText) {
          bioText.style.opacity = '0';
          bioText.style.transform = 'translateY(5px)';
          bioText.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
          bioText.style.opacity = '1';
          bioText.style.transform = 'translateY(0)';
        }
      }, 4000);

      // Fade out email draft while building
      setTimeout(() => {
        const emailFields = rawDocument.querySelectorAll('.email-draft__field-value, .email-draft__subject');
        const emailBody = rawDocument.querySelector('.email-draft__body-content');
        
        emailFields.forEach((el, index) => {
          setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '0.2';
            el.style.transform = 'translateX(-15px)';
          }, index * 50);
        });

        if (emailBody) {
          setTimeout(() => {
            emailBody.style.transition = 'opacity 0.6s ease';
            emailBody.style.opacity = '0.15';
          }, 500);
        }
      }, 1000);

      // Show replay button after build completes
      setTimeout(() => {
        transformationZone.classList.remove('animating');
        if (replayButton) {
          replayButton.classList.add('visible');
        }
        isAnimating = false;
      }, EMAIL_SHOW_DURATION + BUILD_DURATION);
    }

    // Reset transformation
    function resetTransformation() {
      isAnimating = false;
      transformationZone.classList.remove('animating');
      
      // Reset email draft
      const emailFields = rawDocument.querySelectorAll('.email-draft__field-value, .email-draft__subject');
      const emailBody = rawDocument.querySelector('.email-draft__body-content');
      
      emailFields.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(0)';
        el.style.transition = 'none';
      });

      if (emailBody) {
        emailBody.style.opacity = '1';
        emailBody.style.transition = 'none';
      }

      // Reset portfolio card - hide all elements
      const portfolioSections = portfolioCard.querySelectorAll('.portfolio-card__header, .portfolio-card__hero-image, .portfolio-card__stats, .portfolio-card__gallery, .portfolio-card__bio');
      const portfolioElements = portfolioCard.querySelectorAll('.portfolio-card__name, .portfolio-card__location, .portfolio-card__stat-label, .portfolio-card__stat-value, .portfolio-card__bio-text, .portfolio-card__contact');
      const portfolioItems = portfolioCard.querySelectorAll('.portfolio-card__gallery-item');
      const portfolioImages = portfolioCard.querySelectorAll('.portfolio-card__hero-image img, .portfolio-card__gallery-item img');
      
      portfolioSections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = '';
        section.style.transition = 'none';
      });

      portfolioElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = '';
        el.style.transition = 'none';
      });

      portfolioItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'scale(0.9)';
        item.style.transition = 'none';
      });

      portfolioImages.forEach(img => {
        img.style.filter = 'brightness(0.7) contrast(0.8) grayscale(0.3)';
        img.style.transition = 'none';
      });

      // Hide replay button
      if (replayButton) {
        replayButton.classList.remove('visible');
      }

      // Restore transitions and restart after brief delay
      setTimeout(() => {
        portfolioSections.forEach(section => {
          section.style.transition = '';
        });
        portfolioElements.forEach(el => {
          el.style.transition = '';
        });
        portfolioItems.forEach(item => {
          item.style.transition = '';
        });
        portfolioImages.forEach(img => {
          img.style.transition = '';
        });
        emailFields.forEach(el => {
          el.style.transition = '';
        });
        if (emailBody) {
          emailBody.style.transition = '';
        }
        
        // Start sequence: show email, then build portfolio
        setTimeout(() => {
          buildPortfolio();
        }, EMAIL_SHOW_DURATION);
      }, 300);
    }

    // Set up replay button handler
    if (replayButton) {
      replayButton.addEventListener('click', (e) => {
        e.preventDefault();
        resetTransformation();
      });
    }

    // Initial state: show email fully, hide portfolio completely
    const portfolioSections = portfolioCard.querySelectorAll('.portfolio-card__header, .portfolio-card__hero-image, .portfolio-card__stats, .portfolio-card__gallery, .portfolio-card__bio');
    const portfolioElements = portfolioCard.querySelectorAll('.portfolio-card__name, .portfolio-card__location, .portfolio-card__stat-label, .portfolio-card__stat-value, .portfolio-card__bio-text, .portfolio-card__contact');
    const portfolioItems = portfolioCard.querySelectorAll('.portfolio-card__gallery-item');
    const portfolioImages = portfolioCard.querySelectorAll('.portfolio-card__hero-image img, .portfolio-card__gallery-item img');
    
    portfolioSections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = '';
      section.style.transition = 'none';
    });

    portfolioElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = '';
      el.style.transition = 'none';
    });

    portfolioItems.forEach(item => {
      item.style.opacity = '0';
      item.style.transform = 'scale(0.9)';
      item.style.transition = 'none';
    });

    portfolioImages.forEach(img => {
      img.style.filter = 'brightness(0.7) contrast(0.8) grayscale(0.3)';
      img.style.transition = 'none';
    });

    // Reset transitions after initial state
    setTimeout(() => {
      portfolioSections.forEach(section => {
        section.style.transition = '';
      });
      portfolioElements.forEach(el => {
        el.style.transition = '';
      });
      portfolioItems.forEach(item => {
        item.style.transition = '';
      });
      portfolioImages.forEach(img => {
        img.style.transition = '';
      });
    }, 100);

    // Start sequence: show email first, then build portfolio
    setTimeout(() => {
      buildPortfolio();
    }, EMAIL_SHOW_DURATION);
  }

  // Portfolio Showcase Grid Scroll Animations
  function initPortfolioShowcaseAnimations() {
    const showcaseSection = document.getElementById('homepage-portfolio-showcase');
    if (!showcaseSection) return;

    const cards = showcaseSection.querySelectorAll('.homepage-portfolio-showcase__card');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animation
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, index * 80);
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    cards.forEach(card => {
      observer.observe(card);
    });
  }

  // Scroll-triggered animations for other sections
  function initScrollAnimations() {
    const sections = document.querySelectorAll('.homepage-value-prop, .homepage-testimonials, .homepage-agency, .homepage-cta');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    sections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(30px)';
      section.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      observer.observe(section);
    });
  }

  // Reduced motion support
  function respectReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      // Disable animations
      const style = document.createElement('style');
      style.textContent = `
        .transformation-zone__particles,
        .transformation-zone__flow,
        .homepage-value-prop__icon,
        .homepage-portfolio-showcase__card {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Initialize everything when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initUniversalHeaderMenu();
    initHeaderScroll();
    initTransformationHero();
    initPortfolioShowcaseAnimations();
    initScrollAnimations();
    respectReducedMotion();
  });
})();
