/* Arquitecta Emocional — interacciones del sitio */
(function () {
  // --- Nav: estado al hacer scroll ---
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Menú móvil ---
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Reveal al hacer scroll ---
  var els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  // --- Parallax sutil de las marcas decorativas ---
  var decos = document.querySelectorAll('[data-parallax]');
  if (decos.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        decos.forEach(function (d) {
          var speed = parseFloat(d.getAttribute('data-parallax')) || 0.06;
          d.style.transform = 'translateY(' + (y * speed) + 'px) rotate(' + (y * speed * 0.04) + 'deg)';
        });
        ticking = false;
      });
    }, { passive: true });
  }

  // --- Formulario de contacto (Formspree) ---
  var form = document.querySelector('form[data-contact]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (f) {
        var valid = f.value.trim() !== '' && (f.type !== 'email' || /.+@.+\..+/.test(f.value));
        f.classList.toggle('invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) return;

      var card = form.closest('.form-card') || form.parentNode;
      var errBox = card.querySelector('[data-error]');
      var btn = form.querySelector('button[type="submit"]');
      if (errBox) errBox.hidden = true;
      if (btn) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }

      function showError() {
        if (btn) { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); }
        if (errBox) errBox.hidden = false;
      }

      function showSuccess() {
        form.style.transition = 'opacity .5s';
        form.style.opacity = '0';
        setTimeout(function () {
          form.style.display = 'none';
          var done = card.querySelector('[data-sent]');
          if (done) { done.hidden = false; setTimeout(function () { done.classList.add('in'); }, 40); }
        }, 500);
      }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) showSuccess();
        else showError();
      }).catch(showError);
    });
  }
})();
