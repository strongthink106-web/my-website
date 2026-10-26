'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = $('#toast');
  let toastTimeout;
  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
  }
  const safeUrl = (value) => {
    const raw = String(value || '').trim();
    if (/^https?:\/\//i.test(raw) || (raw.startsWith('/') && !raw.startsWith('//'))) return raw;
    return '';
  };
  const text = (value, fallback = '') => String(value ?? fallback);
  const element = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };

  // Mobile navigation
  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      mainNav.classList.toggle('open', !expanded);
    });
    $$('#mainNav a').forEach(link => link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      mainNav.classList.remove('open');
    }));
  }
  const year = $('#yearNow');
  if (year) year.textContent = String(new Date().getFullYear());

  function renderServices(items) {
    const container = $('#servicesGrid');
    if (!container || !Array.isArray(items)) return;
    container.replaceChildren();
    if (!items.length) {
      const empty = element('p', 'empty-work', 'Our service menu is being refreshed. Tell us what you are building and we will plan the right approach.');
      container.append(empty);
      return;
    }
    items.slice(0, 8).forEach((item, index) => {
      const card = document.createElement('article');
      card.className = `service-card${index === 0 ? ' service-card-featured' : ''}`;
      const top = document.createElement('div'); top.className = 'service-top';
      const icon = document.createElement('span'); icon.className = 'service-icon'; icon.textContent = text(item.icon, '✳');
      const number = document.createElement('span'); number.className = 'service-index'; number.textContent = `${String(index + 1).padStart(2, '0')} / ${text(item.category, 'SERVICE').toUpperCase()}`;
      top.append(icon, number);
      const title = document.createElement('h3'); title.textContent = text(item.title).replace(/\s*&\s*/g, ' & ');
      const desc = document.createElement('p'); desc.textContent = text(item.description);
      const tags = document.createElement('div'); tags.className = 'service-tags';
      const parts = String(item.features || '').split(/\n|,|\|/).map(s => s.trim()).filter(Boolean).slice(0, 3);
      (parts.length ? parts : [item.price_label || 'Custom quote']).forEach(part => { const tag = document.createElement('span'); tag.textContent = part; tags.append(tag); });
      const link = document.createElement('a'); link.className = 'service-link'; link.href = '#work'; link.dataset.serviceFilter = text(item.category); link.textContent = '↗'; link.setAttribute('aria-label', `See work related to ${item.title}`);
      card.append(top, title, desc, tags, link);
      container.append(card);
    });
  }

  let portfolioItems = [];
  let blogItems = [];
  function renderPortfolio(filter = 'All') {
    const container = $('#workGrid');
    if (!container) return;
    const filtered = portfolioItems.filter(item => filter === 'All' || String(item.category).toLowerCase() === filter.toLowerCase() || String(item.service).toLowerCase().includes(filter.toLowerCase()));
    container.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p'); empty.className = 'empty-work'; empty.textContent = 'No projects in this category yet. Tell us what we should create next.'; container.append(empty); return;
    }
    filtered.forEach((item, index) => {
      const card = document.createElement('article'); card.className = `work-card${index === 0 ? ' work-card-large' : ''}`; card.dataset.category = item.category || 'All';
      const art = document.createElement('div'); art.className = 'work-art dynamic-work-art';
      const imageUrl = safeUrl(item.image);
      if (imageUrl) { const img = document.createElement('img'); img.src = imageUrl; img.alt = `${text(item.title)} project visual`; img.loading = 'lazy'; art.append(img); }
      else { art.style.background = ['#d8def8', '#e8d4be', '#d8e3df', '#d8c6b7'][index % 4]; }
      const pill = document.createElement('span'); pill.className = 'work-pill'; pill.textContent = text(item.service || item.category, 'SELECTED WORK').toUpperCase();
      const overlay = document.createElement('div'); overlay.className = 'dynamic-work-overlay';
      const title = document.createElement('strong'); title.textContent = text(item.title);
      const summary = document.createElement('span'); summary.textContent = text(item.summary, 'Thoughtful digital work, built with intention.');
      const caseButton = document.createElement('button'); caseButton.type = 'button'; caseButton.className = 'case-study-open'; caseButton.textContent = 'Read case study ↗'; caseButton.addEventListener('click', () => openCaseStudy(item));
      overlay.append(title, summary, caseButton); art.append(pill, overlay);
      const info = document.createElement('div'); info.className = 'work-info';
      const left = document.createElement('div'); const h3 = document.createElement('h3'); h3.textContent = text(item.title); const p = document.createElement('p'); p.textContent = `${text(item.category, 'Digital')} · ${text(item.service, 'Design')}`; left.append(h3, p);
      const link = document.createElement('a'); link.href = safeUrl(item.live_url) || '#contact'; link.textContent = '↗'; link.setAttribute('aria-label', `Explore ${item.title}`); if (safeUrl(item.live_url)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } 
      info.append(left, link); card.append(art, info); container.append(card);
    });
  }

  function renderInsights(items, filter = 'All') {
    const container = $('#insightsGrid');
    if (!container || !Array.isArray(items)) return;
    const filtered = items.filter(item => filter === 'All' || String(item.category || '').toLowerCase() === String(filter).toLowerCase());
    const limit = container.dataset.limit === 'all' ? filtered.length : Math.max(1, Number(container.dataset.limit || 3));
    container.replaceChildren();
    if (!filtered.length) { container.append(element('p','empty-insights','No articles in this category yet. Check back for the next Strong Think note.')); return; }
    filtered.slice(0, limit).forEach((item, index) => {
      const card = document.createElement('article'); card.className = 'insight-card';
      const art = document.createElement('div'); art.className = `insight-art insight-art-${['one','two','three'][index % 3]}`;
      const flag = document.createElement('span'); flag.textContent = `${text(item.category, 'INSIGHT').toUpperCase()} / ${String(index + 1).padStart(3,'0')}`;
      const artTitle = document.createElement('div'); artTitle.className = 'dynamic-insight-type'; artTitle.textContent = text(item.category, 'THINK BETTER').replace(/\s*&\s*/g, ' & ').toUpperCase();
      art.append(flag, artTitle);
      const meta = document.createElement('div'); meta.className = 'insight-meta';
      const category = document.createElement('span'); category.textContent = text(item.category, 'INSIGHTS').toUpperCase();
      const date = document.createElement('span'); date.textContent = item.created_at ? String(item.created_at).slice(0,10) : 'STRONG THINK JOURNAL'; meta.append(category, date);
      const title = document.createElement('h3'); title.textContent = text(item.title);
      const excerpt = document.createElement('p'); excerpt.className = 'insight-excerpt'; excerpt.textContent = text(item.excerpt, 'A practical point of view on digital strategy and better experiences.');
      const link = document.createElement('button'); link.type = 'button'; link.className = 'text-link insight-read'; link.innerHTML = 'Read the article <span>↗</span>'; link.addEventListener('click', () => openArticle(item));
      card.append(art, meta, title, excerpt, link); container.append(card);
    });
  }

  let testimonials = [];
  let testimonialIndex = 0;
  function showTestimonial(index) {
    if (!testimonials.length) return;
    testimonialIndex = (index + testimonials.length) % testimonials.length;
    const item = testimonials[testimonialIndex];
    if ($('#testimonialQuote')) $('#testimonialQuote').textContent = `“${text(item.quote)}”`;
    if ($('#testimonialName')) $('#testimonialName').textContent = text(item.client_name);
    if ($('#testimonialCompany')) $('#testimonialCompany').textContent = text(item.company);
    const avatar = $('.attribution-avatar');
    if (avatar) avatar.textContent = text(item.client_name).split(/\s+/).map(v => v[0]).join('').slice(0, 2).toUpperCase();
  }
  $('#quotePrev')?.addEventListener('click', () => showTestimonial(testimonialIndex - 1));
  $('#quoteNext')?.addEventListener('click', () => showTestimonial(testimonialIndex + 1));

  $('#workFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    $$('.filter-button').forEach(b => b.classList.toggle('active', b === button));
    renderPortfolio(button.dataset.filter);
  });

  function openArticle(item) {
    const modal = $('#articleModal'); if (!modal) return;
    $('#articleModalCategory').textContent = text(item.category, 'STRONG THINK JOURNAL').toUpperCase();
    $('#articleModalTitle').textContent = text(item.title, 'Strong Think Journal');
    $('#articleModalExcerpt').textContent = text(item.excerpt, 'Ideas for building better digital experiences.');
    $('#articleModalAuthor').textContent = text(item.author, 'Strong Think Team');
    $('#articleModalDate').textContent = item.created_at ? String(item.created_at).slice(0,10) : '';
    const content = $('#articleModalContent'); content.replaceChildren();
    const paragraphs = text(item.content, 'This article is being prepared. Check back soon.').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
    paragraphs.forEach(paragraph => { const p = document.createElement('p'); p.textContent = paragraph; content.append(p); });
    modal.hidden = false; document.body.classList.add('modal-open'); $('#articleModalClose')?.focus();
  }
  function closeArticle() { const modal = $('#articleModal'); if (modal) modal.hidden = true; if (!$('#caseStudyModal') || $('#caseStudyModal').hidden) document.body.classList.remove('modal-open'); }
  $('#articleModalClose')?.addEventListener('click', closeArticle);
  $('#articleModal')?.addEventListener('click', event => { if (event.target.id === 'articleModal') closeArticle(); });
  $('#insightFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-insight-filter]'); if (!button) return;
    $$('#insightFilters [data-insight-filter]').forEach(b => b.classList.toggle('active', b === button));
    renderInsights(blogItems, button.dataset.insightFilter);
  });

  function openCaseStudy(item) {
    const modal = $('#caseStudyModal'); if (!modal) return;
    $('#caseStudyCategory').textContent = `${text(item.category, 'DIGITAL')} / ${text(item.service, 'SELECTED WORK')}`.toUpperCase();
    $('#caseStudyTitle').textContent = text(item.title, 'Selected project');
    $('#caseStudySummary').textContent = text(item.summary, 'A thoughtful digital experience built around a real business need.');
    $('#caseStudyChallenge').textContent = text(item.challenge, 'The project challenge will be added as the case study is developed.');
    $('#caseStudySolution').textContent = text(item.solution, 'Our approach combines business context, considered design, and a careful build.');
    $('#caseStudyResults').textContent = text(item.results, 'Project outcomes will be added when they are confirmed.');
    const testimonial = text(item.client_testimonial).trim();
    $('#caseStudyTestimonialBlock').hidden = !testimonial;
    $('#caseStudyTestimonial').textContent = testimonial;
    const liveLink = $('#caseStudyLiveLink'); const url = safeUrl(item.live_url);
    liveLink.hidden = !url; if (url) liveLink.href = url; else liveLink.removeAttribute('href');
    modal.hidden = false; document.body.classList.add('modal-open'); $('#caseStudyClose')?.focus();
  }
  function closeCaseStudy() { const modal = $('#caseStudyModal'); if (modal) modal.hidden = true; document.body.classList.remove('modal-open'); }
  $('#caseStudyClose')?.addEventListener('click', closeCaseStudy);
  $('#caseStudyModal')?.addEventListener('click', event => { if (event.target.id === 'caseStudyModal') closeCaseStudy(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeCaseStudy(); closeArticle(); } });
  $('#servicesGrid')?.addEventListener('click', event => {
    const link = event.target.closest('[data-service-filter]'); if (!link) return;
    const category = link.dataset.serviceFilter;
    const filter = $(`#workFilters [data-filter="${CSS.escape(category)}"]`);
    if (filter) { $$('#workFilters .filter-button').forEach(button => button.classList.toggle('active', button === filter)); renderPortfolio(category); }
  });

  async function loadSiteContent() {
    try {
      const response = await fetch('/api/site', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      renderServices(data.services);
      portfolioItems = Array.isArray(data.portfolio) ? data.portfolio : [];
      renderPortfolio('All');
      testimonials = Array.isArray(data.testimonials) ? data.testimonials : [];
      const quoteSection = $('.quote-section');
      if (quoteSection) { quoteSection.hidden = testimonials.length === 0; quoteSection.style.display = testimonials.length ? '' : 'none'; }
      if (testimonials.length) showTestimonial(0);
      blogItems = Array.isArray(data.blog) ? data.blog : [];
      renderInsights(blogItems);
      $$('.filter-button').forEach(button => {
        if (button.dataset.filter === 'All') {
          const count = button.querySelector('span');
          if (count) count.textContent = String(portfolioItems.length).padStart(2, '0');
        }
      });
    } catch (error) { console.warn('Public content could not be refreshed; showing the built-in design.', error); }
  }
  loadSiteContent();

  const contactForm = $('#contactForm');
  contactForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = $('#formFeedback');
    const button = $('.button-submit', contactForm);
    const originalText = button.innerHTML;
    button.disabled = true; button.innerHTML = 'Sending inquiry…';
    feedback.textContent = '';
    const formData = new FormData(contactForm);
    const body = Object.fromEntries(formData.entries());
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your inquiry.');
      feedback.textContent = result.message || 'Your inquiry is in. We’ll be in touch soon.';
      contactForm.reset();
      notify('Thanks for reaching out. Your inquiry has been received.');
    } catch (error) {
      feedback.textContent = error.message || 'Something went wrong. Please email us directly.';
    } finally { button.disabled = false; button.innerHTML = originalText; }
  });

  const newsletterForm = $('#newsletterForm');
  newsletterForm?.addEventListener('submit', async event => {
    event.preventDefault(); const button = $('button[type=submit]', newsletterForm); const status = $('#newsletterFeedback'); const old = button.innerHTML; button.disabled = true; status.textContent = '';
    const email = new FormData(newsletterForm).get('email');
    try { const response = await fetch('/api/newsletter', { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify({email}) }); const data = await response.json(); if(!response.ok) throw new Error(data.error || 'Unable to subscribe.'); status.textContent = data.message || 'You’re on the list.'; newsletterForm.reset(); }
    catch(error) { status.textContent = error.message; } finally { button.disabled=false; button.innerHTML=old; }
  });

  // Optional analytics stay off until a visitor explicitly opts in.
  const consentKey = 'strongthink-analytics-consent-v1';
  let publicConfig = null;
  let analyticsLoaded = false;
  function loadOptionalAnalytics(config) {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    if (config.ga4) {
      window.dataLayer = window.dataLayer || []; window.gtag = function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', config.ga4);
      const script = document.createElement('script'); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4)}`; document.head.append(script);
    }
    if (config.metaPixel) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', config.metaPixel); window.fbq('track', 'PageView');
    }
    if (config.hotjar) {
      window.hj=window.hj||function(){(window.hj.q=window.hj.q||[]).push(arguments)};window._hjSettings={hjid:Number(config.hotjar),hjsv:6};
      const script=document.createElement('script');script.async=true;script.src=`https://static.hotjar.com/c/hotjar-${encodeURIComponent(config.hotjar)}.js?sv=6`;document.head.append(script);
    }
  }
  function saveAnalyticsChoice(accepted) {
    try { localStorage.setItem(consentKey, accepted ? 'accepted' : 'rejected'); } catch {}
    const panel = $('#analyticsConsent'); if (panel) panel.hidden = true;
    if (accepted && publicConfig) loadOptionalAnalytics(publicConfig);
  }
  function showAnalyticsChoices() {
    if (!publicConfig) return;
    let panel = $('#analyticsConsent');
    if (!panel) {
      panel = element('section', 'analytics-consent'); panel.id = 'analyticsConsent'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Optional analytics preferences');
      const copy = element('div', 'analytics-consent-copy');
      copy.append(element('strong', '', 'Your privacy choices'), element('p', '', 'Strong Think can use optional analytics to understand how the website is used and improve the experience. These tools stay off unless you choose to allow them. You can change this choice later.'));
      const actions = element('div', 'analytics-consent-actions');
      const reject = element('button', 'consent-button consent-button-muted', 'Reject optional'); reject.type = 'button'; reject.addEventListener('click', () => saveAnalyticsChoice(false));
      const accept = element('button', 'consent-button consent-button-primary', 'Allow analytics'); accept.type = 'button'; accept.addEventListener('click', () => saveAnalyticsChoice(true));
      actions.append(reject, accept); panel.append(copy, actions); document.body.append(panel);
    }
    panel.hidden = false;
    $('.consent-button-muted', panel)?.focus();
  }
  $('#privacyChoices')?.addEventListener('click', showAnalyticsChoices);
  fetch('/api/public-config').then(r => r.ok ? r.json() : null).then(config => {
    if (!config) return;
    publicConfig = config;
    const calendarLink = document.querySelector('#calendarLink');
    if (calendarLink && config.calendlyUrl) { calendarLink.href = config.calendlyUrl; calendarLink.hidden = false; calendarLink.target = '_blank'; calendarLink.rel = 'noopener noreferrer'; }
    const mapFrame = document.querySelector('#contactMapFrame'); const map = document.querySelector('#contactMap');
    if (mapFrame && map && config.googleMapsEmbedUrl) { mapFrame.src = config.googleMapsEmbedUrl; map.hidden = false; }
    const hasOptionalAnalytics = Boolean(config.ga4 || config.metaPixel || config.hotjar);
    let choice = null;
    try { choice = localStorage.getItem(consentKey); } catch {}
    if (choice === 'accepted') loadOptionalAnalytics(config);
    else if (hasOptionalAnalytics && choice !== 'rejected') showAnalyticsChoices();
  }).catch(() => {});
})();
