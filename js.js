(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // Official Lucide runtime. If the CDN fails, the site remains usable.
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });

  const topbar = $('#topbar');
  const menuToggle = $('#menuToggle');
  const menuOverlay = $('#menuOverlay');
  let lockedScrollY = 0;
  let menuOpen = false;

  function updateTopbar() {
    topbar.classList.toggle('scrolled', window.scrollY > 42 && !menuOpen);
  }

  // Scroll lock that preserves the exact visual position. Opening/closing does not animate
  // the document, jump to the top, or re-run smooth scrolling.
  function lockPage() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockPage(restore = true) {
    const y = lockedScrollY;
    document.documentElement.classList.add('menu-restoring');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    if (restore) window.scrollTo(0, y);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('menu-restoring');
      updateTopbar();
    }));
  }

  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    if (open) {
      lockPage();
      menuOverlay.classList.add('is-open');
      menuOverlay.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Fechar menu');
      menuToggle.innerHTML = '<i data-lucide="x"></i>';
      topbar.classList.remove('scrolled');
    } else {
      menuOverlay.classList.remove('is-open');
      menuOverlay.setAttribute('aria-hidden', 'true');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menu');
      menuToggle.innerHTML = '<i data-lucide="menu"></i>';
      unlockPage(true);
    }
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  menuToggle.addEventListener('click', () => setMenu(!menuOpen));
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay) setMenu(false);
  });

  $$('.menu-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const selector = link.getAttribute('href');
      const target = $(selector);
      if (!target) return;
      const targetY = lockedScrollY + target.getBoundingClientRect().top - 76;
      setMenu(false);
      requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      });
    });
  });

  window.addEventListener('scroll', updateTopbar, { passive: true });
  updateTopbar();

  // Reveal elements.
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  $$('.reveal').forEach(el => revealObserver.observe(el));

  // Native touch carousel + 3D focus treatment. Native scrolling means vertical page scroll
  // still works naturally when the gesture is mostly vertical.
  const gallery = $('#galleryTrack');
  const galleryCurrent = $('#galleryCurrent');
  const galleryCards = $$('.gallery-card', gallery);
  let galleryRaf = 0;

  function updateGallery3D() {
    galleryRaf = 0;
    const box = gallery.getBoundingClientRect();
    const center = box.left + box.width / 2;
    let nearest = 0;
    let nearestDist = Infinity;

    galleryCards.forEach((card, index) => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const delta = (cardCenter - center) / Math.max(1, box.width);
      const dist = Math.abs(delta);
      const focus = Math.max(0, 1 - dist * 1.5);
      const scale = 0.94 + focus * 0.06;
      const rotate = Math.max(-5, Math.min(5, -delta * 9));
      const lift = (1 - focus) * 8;
      card.style.transform = `perspective(1100px) translateY(${lift}px) rotateY(${rotate}deg) scale(${scale})`;
      card.style.filter = `saturate(${0.82 + focus * 0.18})`;
      if (dist < nearestDist) { nearestDist = dist; nearest = index; }
    });
    galleryCurrent.textContent = String(nearest + 1).padStart(2, '0');
  }

  function scheduleGallery3D() {
    if (!galleryRaf) galleryRaf = requestAnimationFrame(updateGallery3D);
  }
  gallery.addEventListener('scroll', scheduleGallery3D, { passive: true });
  window.addEventListener('resize', scheduleGallery3D, { passive: true });
  scheduleGallery3D();

  // Mouse drag for desktop. Touch stays native so it never blocks vertical swipes.
  let dragging = false, startX = 0, startLeft = 0;
  gallery.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    dragging = true;
    startX = e.clientX;
    startLeft = gallery.scrollLeft;
    gallery.setPointerCapture(e.pointerId);
    gallery.style.cursor = 'grabbing';
  });
  gallery.addEventListener('pointermove', e => {
    if (!dragging || e.pointerType !== 'mouse') return;
    gallery.scrollLeft = startLeft - (e.clientX - startX);
  });
  const stopDrag = e => {
    if (!dragging) return;
    dragging = false;
    gallery.style.cursor = '';
    try { gallery.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  gallery.addEventListener('pointerup', stopDrag);
  gallery.addEventListener('pointercancel', stopDrag);

  // Subtle card tilt only on fine pointers.
  if (matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.tilt-card').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(900px) rotateX(${-y * 4}deg) rotateY(${x * 5}deg) translateY(-3px)`;
      });
      card.addEventListener('pointerleave', () => card.style.transform = '');
    });
  }

  // Keep hero movement tiny, avoiding heavy parallax and mobile jank.
  const heroImage = $('.hero-media img');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      if (window.scrollY < window.innerHeight * 1.15) {
        const shift = Math.min(36, window.scrollY * .035);
        heroImage.style.transform = `scale(1.04) translateY(${shift}px)`;
      }
    }, { passive: true });
  }
})();
