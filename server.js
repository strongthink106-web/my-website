'use strict';

require('dotenv').config?.();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const uploadsDir = path.join(__dirname, 'storage', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('In production, set SESSION_SECRET to a random value at least 32 characters long.');
}
if (production && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14 || ['ChangeMe!2026', 'ClientDemo!2026'].includes(process.env.ADMIN_PASSWORD))) {
  throw new Error('In production, set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 14 characters.');
}

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'strongthink.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','client')),
  company TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  industry TEXT DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'Discovery',
  progress INTEGER NOT NULL DEFAULT 10,
  deadline TEXT DEFAULT '',
  budget REAL DEFAULT 0,
  hours_logged REAL DEFAULT 0,
  description TEXT DEFAULT '',
  contract_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'To do',
  due_date TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Retail',
  service TEXT NOT NULL DEFAULT 'Web Design',
  summary TEXT DEFAULT '',
  challenge TEXT DEFAULT '',
  solution TEXT DEFAULT '',
  results TEXT DEFAULT '',
  client_testimonial TEXT DEFAULT '',
  live_url TEXT DEFAULT '',
  image TEXT DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  price_label TEXT DEFAULT 'Custom quote',
  features TEXT DEFAULT '',
  icon TEXT DEFAULT '✳',
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS blog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'Insights',
  excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '',
  author TEXT DEFAULT 'Strong Think Team',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT NOT NULL,
  company TEXT DEFAULT '',
  quote TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  project_type TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  source TEXT DEFAULT 'Website',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  paid_at TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS project_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL DEFAULT 'Comment',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hour_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hours REAL NOT NULL,
  note TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const portfolioColumns = db.pragma('table_info(portfolio)');
if (!portfolioColumns.some(column => column.name === 'client_testimonial')) db.exec("ALTER TABLE portfolio ADD COLUMN client_testimonial TEXT DEFAULT ''");

const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (!hasUsers) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@strongthink.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
  const insertUser = db.prepare('INSERT INTO users (name,email,password_hash,role,company) VALUES (?,?,?,?,?)');
  insertUser.run('Strong Think Admin', adminEmail, bcrypt.hashSync(adminPassword, 12), 'admin', 'Strong Think Web Designers');
  if (!production) {
    const clientEmail = process.env.CLIENT_EMAIL || 'client@example.com';
    const clientPassword = process.env.CLIENT_PASSWORD || 'ClientDemo!2026';
    const clientId = Number(insertUser.run('Alex Morgan', clientEmail, bcrypt.hashSync(clientPassword, 12), 'client', 'Northstar Studio').lastInsertRowid);
    const insertProject = db.prepare('INSERT INTO projects (client_id,title,industry,status,progress,deadline,budget,hours_logged,description,contract_url) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const projectId = Number(insertProject.run(clientId, 'Northstar Digital Storefront', 'Retail & E-Commerce', 'Design', 62, '2026-11-18', 4800, 24.5, 'A conversion-focused storefront concept with product discovery, mobile-first checkout, and a flexible content system.', '').lastInsertRowid);
    const task = db.prepare('INSERT INTO tasks(project_id,title,status,due_date,assigned_to) VALUES (?,?,?,?,?)');
    task.run(projectId, 'Approve homepage direction', 'In review', '2026-10-29', 'Client');
    task.run(projectId, 'Build responsive product listing', 'In progress', '2026-11-04', 'Strong Think');
    task.run(projectId, 'Prepare launch checklist', 'To do', '2026-11-14', 'Strong Think');
    const port = db.prepare('INSERT INTO portfolio(title,category,service,summary,challenge,solution,results,live_url,image,featured) VALUES (?,?,?,?,?,?,?,?,?,?)');
    port.run('Northstar Commerce', 'Retail', 'E-Commerce', 'A modern storefront designed to turn browsing into buying.', 'A growing retailer needed a fast and clear product journey across devices.', 'We mapped the purchase journey, simplified discovery, and designed a mobile-first store system.', 'Demo concept: clearer product discovery, consistent brand expression, and a scalable store foundation.', '', '/assets/work-commerce.svg', 1);
    port.run('Sunday Table', 'Restaurant', 'Web Design', 'A warm digital home for a neighbourhood dining brand.', 'The restaurant needed menus, reservations, and brand personality in one place.', 'We created a menu-first experience with prominent booking actions and an editorial visual system.', 'Demo concept: a clearer path from menu discovery to a reservation inquiry.', '', '/assets/work-restaurant.svg', 1);
    port.run('Ledgerline Advisory', 'Finance', 'Branding', 'A confident, calm identity for an advisory practice.', 'The existing presence felt fragmented and difficult to navigate.', 'We aligned the identity, messaging, and service architecture around trust and clarity.', 'Demo concept: a consistent identity system and cleaner service discovery.', '', '/assets/work-finance.svg', 1);
    port.run('Forma Studio', 'Fashion', 'Web Design', 'A campaign-ready fashion store with a distinctive editorial feel.', 'A new label needed a digital launch platform that could grow with collections.', 'We paired strong typography with visual-led collection browsing and a flexible content structure.', 'Demo concept: a launch-ready storefront foundation built for future collections.', '', '/assets/work-fashion.svg', 0);
    const serv = db.prepare('INSERT INTO services(title,category,description,price_label,features,icon,sort_order) VALUES (?,?,?,?,?,?,?)');
    serv.run('E-Commerce & Retail', 'Retail', 'Conversion-minded stores built for discovery, trust, and repeat business.', 'Packages from $900', 'Product catalog\nSmart filters\nSecure checkout planning', '↗', 1);
    serv.run('Hospitality Websites', 'Restaurant', 'Make your menu, atmosphere, and next booking impossible to miss.', 'Packages from $650', 'Digital menus\nReservation journeys\nOrder flow planning', '✳', 2);
    serv.run('Finance & Advisory', 'Finance', 'Calm, credible digital experiences for complex services and sensitive decisions.', 'Custom quote', 'Service architecture\nClient portal planning\nData-led UX', '◈', 3);
    serv.run('Brand Identity & Design', 'Branding', 'Build a recognisable brand system, not just a good-looking logo.', 'Packages from $350', 'Visual identity\nBrand guidelines\nSocial media toolkit', '✎', 4);
    serv.run('Fashion & Lifestyle', 'Fashion', 'Editorial storefronts that let collections and personality lead.', 'Packages from $850', 'Size & colour variants\nCollection galleries\nSocial integration', '◇', 5);
    const article = db.prepare('INSERT INTO blog(title,slug,category,excerpt,content,author,published) VALUES (?,?,?,?,?,?,?)');
    article.run('Your website is a business system, not a business card', 'website-as-business-system', 'Web Strategy', 'A practical framework for connecting your website to the outcomes your business actually needs.', 'Start with the business decision you want visitors to make. Then remove friction around that decision: sharpen the message, show proof, make the next step obvious, and measure what happens. Great websites are not collections of pages; they are systems that help people move forward.', 'Strong Think Team', 1);
    article.run('Five essentials for a restaurant website that gets noticed', 'restaurant-website-essentials', 'Hospitality', 'From menu clarity to booking flow, small improvements can make the guest journey feel effortless.', 'A great restaurant site makes the essentials easy to find: current menu, location and hours, reservations, dietary notes, and a visual sense of the experience. Keep these actions available on mobile and give every page a clear next step. The examples here are strategy guidance, not a promise of specific business results.', 'Strong Think Team', 1);
    article.run('Designing trust into a financial services website', 'designing-trust-finance', 'Finance UX', 'Use hierarchy, plain language, and thoughtful interaction design to help people make informed decisions.', 'Trust is built through clarity. Describe services in human language, explain the process, make credentials easy to verify, and keep forms proportionate to the request. Handle sensitive information with care and avoid unsupported performance claims.', 'Strong Think Team', 1);
    const testi = db.prepare('INSERT INTO testimonials(client_name,company,quote,rating) VALUES (?,?,?,?)');
    testi.run('Jordan Lee', 'Independent Retailer', 'The process felt considered from the first conversation. We finally had a clear direction for how our brand should show up online.', 5);
    testi.run('Maya Rahman', 'Hospitality Founder', 'Strong Think brought structure to a lot of ideas and made the next steps feel manageable.', 5);
    db.prepare('INSERT INTO invoices(client_id,project_id,invoice_number,description,amount,currency,due_date,status) VALUES (?,?,?,?,?,?,?,?)')
      .run(clientId, projectId, 'ST-2026-001', 'Design milestone — Northstar Digital Storefront', 1200, 'USD', '2026-11-05', 'Sent');
  }
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.googletagmanager.com", "https://connect.facebook.net", "https://static.hotjar.com", "https://script.hotjar.com"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://stats.g.doubleclick.net', 'https://www.facebook.com', 'https://connect.facebook.net', 'https://*.hotjar.com', 'https://*.hotjar.io', 'wss://*.hotjar.com', 'https://api.mailchimp.com'],
      frameSrc: ["'self'", 'https://www.google.com', 'https://calendly.com', 'https://www.paypal.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: production ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signatureHeader = req.get('stripe-signature') || '';
  if (!secret) return res.status(503).send('Stripe webhook is not configured.');
  const parts = Object.fromEntries(signatureHeader.split(',').map(part => part.split('=')));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return res.status(400).send('Invalid webhook signature.');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${req.body.toString('utf8')}`).digest('hex');
  const expectedBuf = Buffer.from(expected), sentBuf = Buffer.from(signature);
  if (expectedBuf.length !== sentBuf.length || !crypto.timingSafeEqual(expectedBuf, sentBuf)) return res.status(400).send('Invalid webhook signature.');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid event payload.'); }
  if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
    const invoiceId = Number(event.data.object.metadata?.invoice_id);
    if (Number.isInteger(invoiceId) && invoiceId > 0) db.prepare("UPDATE invoices SET status='Paid', paid_at=CURRENT_TIMESTAMP WHERE id=?").run(invoiceId);
  }
  res.json({ received: true });
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try { const row = db.prepare('SELECT sess, expires FROM sessions WHERE sid=?').get(sid); if (!row) return callback(null, null); if (row.expires <= Date.now()) { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); return callback(null, null); } callback(null, JSON.parse(row.sess)); }
    catch (error) { callback(error); }
  }
  set(sid, sess, callback = () => {}) {
    try { const maxAge = Number(sess.cookie?.maxAge || 1000 * 60 * 60 * 8); const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + maxAge; db.prepare('INSERT INTO sessions(sid,sess,expires) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expires=excluded.expires').run(sid, JSON.stringify(sess), expires); db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now()); callback(null); }
    catch (error) { callback(error); }
  }
  touch(sid, sess, callback = () => {}) {
    try { const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + Number(sess.cookie?.maxAge || 1000 * 60 * 60 * 8); db.prepare('UPDATE sessions SET expires=? WHERE sid=?').run(expires, sid); callback(null); }
    catch (error) { callback(error); }
  }
  destroy(sid, callback = () => {}) { try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); callback(null); } catch (error) { callback(error); } }
}
if (production) app.set('trust proxy', 1);
app.use(session({
  name: 'strongthink.sid',
  store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || 'local-development-only-change-me-before-deploying-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: production ? '7d' : 0, etag: true }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } });
const leadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } });
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const asInt = value => Number.parseInt(value, 10);
const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'Please sign in to continue.' });
const requireAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.status(req.session.user ? 403 : 401).json({ error: 'Admin access required.' });
const verifyCsrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (['/api/auth/login', '/api/leads', '/api/newsletter'].includes(`${req.baseUrl}${req.path}`)) return next();
  const sent = req.get('x-csrf-token');
  if (!sent || !req.session.csrfToken || sent.length !== req.session.csrfToken.length || !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrfToken))) return res.status(403).json({ error: 'Security token expired. Refresh the page and try again.' });
  next();
};
app.use('/api', verifyCsrf);
app.get('/api/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: req.session.csrfToken });
});

app.get('/api/public-config', (_req, res) => res.json({ googleMapsEmbedUrl: (process.env.GOOGLE_MAPS_EMBED_URL || '').startsWith('https://www.google.com/maps/embed') ? process.env.GOOGLE_MAPS_EMBED_URL : '', ga4: process.env.GA4_MEASUREMENT_ID || '', metaPixel: process.env.META_PIXEL_ID || '', hotjar: process.env.HOTJAR_ID || '', calendlyUrl: process.env.CALENDLY_URL || '', stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), paypalEnabled: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET), demoCredentials: production ? null : { adminEmail: process.env.ADMIN_EMAIL || 'admin@strongthink.local', adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe!2026', clientEmail: process.env.CLIENT_EMAIL || 'client@example.com', clientPassword: process.env.CLIENT_PASSWORD || 'ClientDemo!2026' } }));

app.get('/api/site', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
  const portfolio = db.prepare('SELECT * FROM portfolio ORDER BY featured DESC, id DESC').all();
  const blog = db.prepare('SELECT id,title,slug,category,excerpt,content,author,created_at FROM blog WHERE published=1 ORDER BY id DESC').all();
  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all();
  res.json({ services, portfolio, blog, testimonials });
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase();
  const password = String(req.body?.password ?? '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start a secure session.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company };
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: 'Could not save your session.' });
      res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
    });
  });
});
app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/auth/logout', requireAuth, (req, res) => req.session.destroy(err => {
  if (err) return res.status(500).json({ error: 'Could not sign out.' });
  res.clearCookie('strongthink.sid', { httpOnly: true, sameSite: 'lax', secure: production });
  res.json({ ok: true });
}));

app.post('/api/leads', leadLimiter, async (req, res) => {
  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 254).toLowerCase();
  const details = clean(req.body?.details, 5000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !details) return res.status(400).json({ error: 'Please provide your name, a valid email, and a little project context.' });
  const result = db.prepare(`INSERT INTO leads(name,email,company,project_type,industry,budget,details,source)
    VALUES (?,?,?,?,?,?,?,?)`).run(name, email, clean(req.body.company, 180), clean(req.body.projectType, 100), clean(req.body.industry, 100), clean(req.body.budget, 100), details, clean(req.body.source || 'Website', 80));
  db.prepare('INSERT INTO interactions(lead_id,note) VALUES (?,?)').run(result.lastInsertRowid, 'New inquiry received through the website.');
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.ADMIN_EMAIL) {
    try {
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
      await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: process.env.ADMIN_EMAIL, replyTo: email, subject: `New Strong Think inquiry: ${name}`, text: `Name: ${name}\nEmail: ${email}\nCompany: ${clean(req.body.company,180)}\nProject type: ${clean(req.body.projectType,100)}\nIndustry: ${clean(req.body.industry,100)}\nBudget: ${clean(req.body.budget,100)}\n\nProject details:\n${details}` });
    } catch (mailError) { console.error('Inquiry notification could not be delivered; the lead remains saved in the CRM.', mailError.message); }
  }
  res.status(201).json({ ok: true, message: 'Your inquiry is in. We’ll be in touch soon.' });
});
app.post('/api/newsletter', leadLimiter, async (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  try { db.prepare('INSERT INTO subscribers(email) VALUES (?)').run(email); }
  catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
  if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID) {
    const dcMatch = process.env.MAILCHIMP_API_KEY.match(/-([a-z0-9]+)$/i);
    if (dcMatch) {
      try {
        const response = await fetch(`https://${dcMatch[1]}.api.mailchimp.com/3.0/lists/${encodeURIComponent(process.env.MAILCHIMP_AUDIENCE_ID)}/members`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`strongthink:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email_address: email, status_if_new: 'subscribed' }) });
        if (!response.ok && response.status !== 400) console.error('Mailchimp sync failed with status', response.status);
      } catch (error) { console.error('Mailchimp sync could not complete; subscription remains saved locally.', error.message); }
    }
  }
  res.status(201).json({ ok: true, message: 'You’re on the list.' });
});

app.get('/api/client/dashboard', requireAuth, (req, res) => {
  if (req.session.user.role !== 'client') return res.status(403).json({ error: 'This area is for client accounts.' });
  const projects = db.prepare('SELECT * FROM projects WHERE client_id=? ORDER BY id DESC').all(req.session.user.id);
  const projectIds = projects.map(p => p.id);
  const tasks = projectIds.length ? db.prepare(`SELECT t.*, p.title AS project_title FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.client_id=? ORDER BY t.id DESC`).all(req.session.user.id) : [];
  const invoices = db.prepare('SELECT i.*, p.title AS project_title FROM invoices i LEFT JOIN projects p ON p.id=i.project_id WHERE i.client_id=? ORDER BY i.id DESC').all(req.session.user.id);
  const files = db.prepare(`SELECT f.*, p.title AS project_title FROM project_files f JOIN projects p ON p.id=f.project_id WHERE p.client_id=? ORDER BY f.id DESC`).all(req.session.user.id).map(file => ({ ...file, download_url: `/api/files/${file.id}/download` }));
  const feedback = db.prepare('SELECT f.*, p.title AS project_title FROM feedback f JOIN projects p ON p.id=f.project_id WHERE f.client_id=? ORDER BY f.id DESC').all(req.session.user.id);
  res.json({ projects, tasks, invoices, files, feedback, paymentInstructions: clean(process.env.BANK_TRANSFER_INSTRUCTIONS || '', 2000) });
});
app.post('/api/client/feedback', requireAuth, (req, res) => {
  if (req.session.user.role !== 'client') return res.status(403).json({ error: 'Client access required.' });
  const projectId = asInt(req.body?.projectId);
  const message = clean(req.body?.message, 3000);
  const type = clean(req.body?.type || 'Comment', 40);
  const project = db.prepare('SELECT id FROM projects WHERE id=? AND client_id=?').get(projectId, req.session.user.id);
  if (!project || !message) return res.status(400).json({ error: 'Choose one of your projects and enter feedback.' });
  db.prepare('INSERT INTO feedback(project_id,client_id,feedback_type,message) VALUES (?,?,?,?)').run(projectId, req.session.user.id, type, message);
  res.status(201).json({ ok: true, message: 'Feedback sent to your project team.' });
});

const resources = {
  projects: { table: 'projects', fields: ['client_id','title','industry','status','progress','deadline','budget','hours_logged','description','contract_url'], required: ['title'], order: 'id DESC' },
  tasks: { table: 'tasks', fields: ['project_id','title','status','due_date','assigned_to'], required: ['project_id','title'], order: 'id DESC' },
  portfolio: { table: 'portfolio', fields: ['title','category','service','summary','challenge','solution','results','client_testimonial','live_url','image','featured'], required: ['title'], order: 'featured DESC, id DESC' },
  services: { table: 'services', fields: ['title','category','description','price_label','features','icon','sort_order'], required: ['title'], order: 'sort_order, id DESC' },
  blog: { table: 'blog', fields: ['title','slug','category','excerpt','content','author','published'], required: ['title','slug'], order: 'id DESC' },
  testimonials: { table: 'testimonials', fields: ['client_name','company','quote','rating'], required: ['client_name','quote'], order: 'id DESC' },
  leads: { table: 'leads', fields: ['name','email','company','project_type','industry','budget','details','status','source'], required: ['name','email'], order: 'id DESC' },
  invoices: { table: 'invoices', fields: ['client_id','project_id','invoice_number','description','amount','currency','due_date','status','paid_at'], required: ['invoice_number','amount'], order: 'id DESC' },
  feedback: { table: 'feedback', fields: ['status'], required: [], order: 'id DESC' }
};
const numberFields = new Set(['client_id','project_id','progress','budget','hours_logged','featured','sort_order','published','rating','amount']);
const normalizeValue = (field, value) => {
  if (numberFields.has(field)) {
    if (['client_id','project_id'].includes(field) && String(value ?? '').trim() === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${field} must be a number.`);
    if (['client_id','project_id','progress','featured','sort_order','published','rating'].includes(field) && !Number.isInteger(n)) throw new Error(`${field} must be a whole number.`);
    if (field === 'progress') return Math.min(100, Math.max(0, n));
    if (['featured','published'].includes(field)) return n ? 1 : 0;
    if (['budget','hours_logged','amount'].includes(field) && n < 0) throw new Error(`${field} cannot be negative.`);
    return n;
  }
  const normalized = clean(value, field === 'content' || field === 'details' || field === 'description' ? 10000 : 4000);
  if (['live_url','contract_url','image'].includes(field) && normalized && !(/^https?:\/\//i.test(normalized) || (normalized.startsWith('/') && !normalized.startsWith('//')))) throw new Error(`${field.replaceAll('_',' ')} must be an https URL or a local path starting with one slash.`);
  return normalized;
};

app.get('/api/files/:id/download', requireAuth, (req, res) => {
  const file = db.prepare('SELECT f.*, p.client_id FROM project_files f JOIN projects p ON p.id=f.project_id WHERE f.id=?').get(asInt(req.params.id));
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (req.session.user.role !== 'admin' && file.client_id !== req.session.user.id) return res.status(403).json({ error: 'You do not have access to this project file.' });
  const safePath = path.join(uploadsDir, path.basename(file.stored_name));
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'The requested file is no longer available.' });
  res.download(safePath, path.basename(file.original_name), error => { if (error && !res.headersSent) res.status(500).end(); });
});

app.post('/api/client/invoices/:id/stripe-checkout', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'client') return res.status(403).json({ error: 'Client access required.' });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe payments are not configured yet.' });
  const invoiceId = asInt(req.params.id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE id=? AND client_id=?').get(invoiceId, req.session.user.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  if (['Paid','Void'].includes(invoice.status)) return res.status(400).json({ error: 'This invoice is not payable.' });
  const currency = String(invoice.currency || 'USD').toLowerCase();
  if (!['usd','eur','gbp','cad','aud','nzd','sgd'].includes(currency)) return res.status(400).json({ error: `Stripe checkout is not enabled for ${invoice.currency}. Please use another payment option.` });
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const form = new URLSearchParams();
  form.set('mode','payment'); form.set('success_url',`${base}/portal?payment=success&invoice_id=${invoice.id}`); form.set('cancel_url',`${base}/portal?payment=cancel&invoice_id=${invoice.id}`);
  form.set('customer_email',req.session.user.email); form.set('client_reference_id',String(invoice.id)); form.set('metadata[invoice_id]',String(invoice.id));
  form.set('line_items[0][quantity]','1'); form.set('line_items[0][price_data][currency]',currency); form.set('line_items[0][price_data][unit_amount]',String(Math.round(Number(invoice.amount)*100)));
  form.set('line_items[0][price_data][product_data][name]',`Invoice ${invoice.invoice_number}`); form.set('line_items[0][price_data][product_data][description]',clean(invoice.description || invoice.invoice_number,200));
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
    const data = await response.json();
    if (!response.ok || !data.url) return res.status(502).json({ error: data.error?.message || 'Stripe could not create a checkout session.' });
    res.json({ url:data.url });
  } catch (error) { console.error('Stripe checkout error:',error.message); res.status(502).json({ error:'Could not connect to Stripe. Please try another payment method.' }); }
});

const paypalBase = () => process.env.PAYPAL_API_BASE || (production ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
async function getPaypalToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${credentials}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const data = await response.json(); if(!response.ok || !data.access_token) throw new Error('PayPal authentication failed.'); return data.access_token;
}
app.post('/api/client/invoices/:id/paypal-order', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'client') return res.status(403).json({ error: 'Client access required.' });
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'PayPal payments are not configured yet.' });
  const invoiceId=asInt(req.params.id);const invoice=db.prepare('SELECT * FROM invoices WHERE id=? AND client_id=?').get(invoiceId,req.session.user.id);
  if(!invoice)return res.status(404).json({error:'Invoice not found.'});if(['Paid','Void'].includes(invoice.status))return res.status(400).json({error:'This invoice is not payable.'});
  const base=(process.env.PUBLIC_BASE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
  try{
    const token=await getPaypalToken();const response=await fetch(`${paypalBase()}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:String(invoice.id),custom_id:String(invoice.id),description:clean(invoice.description||invoice.invoice_number,120),amount:{currency_code:String(invoice.currency||'USD').toUpperCase(),value:Number(invoice.amount).toFixed(2)}}],application_context:{return_url:`${base}/portal?paypal=return&invoice_id=${invoice.id}`,cancel_url:`${base}/portal?paypal=cancel&invoice_id=${invoice.id}`,user_action:'PAY_NOW'}})});
    const data=await response.json();if(!response.ok)return res.status(502).json({error:data.message||'PayPal could not create a checkout order.'});const approval=data.links?.find(link=>link.rel==='approve')?.href;if(!approval)return res.status(502).json({error:'PayPal did not return an approval link.'});res.json({url:approval});
  }catch(error){console.error('PayPal order error:',error.message);res.status(502).json({error:'Could not connect to PayPal. Please try another payment method.'});}
});
app.post('/api/client/invoices/:id/paypal-capture', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'client') return res.status(403).json({ error: 'Client access required.' });
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'PayPal payments are not configured.' });
  const invoiceId=asInt(req.params.id),orderId=clean(req.body?.orderId,120);const invoice=db.prepare('SELECT * FROM invoices WHERE id=? AND client_id=?').get(invoiceId,req.session.user.id);
  if(!invoice||!orderId)return res.status(400).json({error:'Invoice or PayPal order could not be verified.'});
  try{
    const token=await getPaypalToken();const response=await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});const data=await response.json();
    if(!response.ok || data.status!=='COMPLETED')return res.status(400).json({error:data.message||'PayPal has not completed this payment.'});
    const customId=data.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id||data.purchase_units?.[0]?.custom_id;
    if(String(customId)!==String(invoice.id))return res.status(400).json({error:'This PayPal payment does not match the selected invoice.'});
    db.prepare("UPDATE invoices SET status='Paid', paid_at=CURRENT_TIMESTAMP WHERE id=?").run(invoice.id);res.json({ok:true,message:'PayPal payment confirmed and invoice updated.'});
  }catch(error){console.error('PayPal capture error:',error.message);res.status(502).json({error:'Could not confirm the PayPal payment. Contact your project team if money was taken.'});}
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const scalar = (sql) => db.prepare(sql).get().n;
  const recentLeads = db.prepare('SELECT id,name,email,company,project_type,status,created_at FROM leads ORDER BY id DESC LIMIT 6').all();
  const projects = db.prepare(`SELECT p.*, u.name AS client_name FROM projects p LEFT JOIN users u ON u.id=p.client_id ORDER BY p.id DESC LIMIT 6`).all();
  const openInvoices = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status NOT IN ('Paid','Void')").get().n;
  const paidRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status='Paid'").get().n;
  res.json({ counts: { projects: scalar('SELECT COUNT(*) AS n FROM projects'), clients: scalar("SELECT COUNT(*) AS n FROM users WHERE role='client'"), leads: scalar("SELECT COUNT(*) AS n FROM leads WHERE status='New'"), portfolio: scalar('SELECT COUNT(*) AS n FROM portfolio') }, openInvoices, paidRevenue, recentLeads, projects, feedback: db.prepare("SELECT f.*, p.title AS project_title, u.name AS client_name FROM feedback f JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=f.client_id ORDER BY f.id DESC LIMIT 5").all() });
});

app.get('/api/admin/:resource', requireAdmin, (req, res, next) => {
  const config = resources[req.params.resource];
  if (!config) return next();
  let rows;
  if (req.params.resource === 'feedback') {
    rows = db.prepare(`SELECT f.*, p.title AS project_title, u.name AS client_name FROM feedback f JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=f.client_id ORDER BY ${config.order}`).all();
  } else if (req.params.resource === 'projects') {
    rows = db.prepare(`SELECT p.*, u.name AS client_name, u.email AS client_email FROM projects p LEFT JOIN users u ON u.id=p.client_id ORDER BY ${config.order}`).all();
  } else if (req.params.resource === 'invoices') {
    rows = db.prepare(`SELECT i.*, u.name AS client_name, p.title AS project_title FROM invoices i LEFT JOIN users u ON u.id=i.client_id LEFT JOIN projects p ON p.id=i.project_id ORDER BY ${config.order}`).all();
  } else if (req.params.resource === 'tasks') {
    rows = db.prepare(`SELECT t.*, p.title AS project_title FROM tasks t LEFT JOIN projects p ON p.id=t.project_id ORDER BY ${config.order}`).all();
  } else rows = db.prepare(`SELECT * FROM ${config.table} ORDER BY ${config.order}`).all();
  res.json({ items: rows });
});
app.post('/api/admin/:resource', requireAdmin, (req, res, next) => {
  const config = resources[req.params.resource];
  if (!config) return next();
  const body = req.body || {};
  for (const field of config.required) if (body[field] === undefined || String(body[field]).trim() === '') return res.status(400).json({ error: `${field.replaceAll('_',' ')} is required.` });
  const fields = config.fields.filter(field => body[field] !== undefined);
  if (!fields.length) return res.status(400).json({ error: 'No editable fields were supplied.' });
  if (req.params.resource === 'feedback') return res.status(405).json({ error: 'Feedback cannot be created from this screen.' });
  let values;
  try { values = fields.map(field => normalizeValue(field, body[field])); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const result = db.prepare(`INSERT INTO ${config.table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...values);
    const item = db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(result.lastInsertRowid);
    res.status(201).json({ item });
  } catch (error) { res.status(400).json({ error: error.message.includes('UNIQUE') ? 'That value already exists.' : 'Could not save this item. Check linked records and required fields.' }); }
});
app.put('/api/admin/:resource/:id', requireAdmin, (req, res, next) => {
  const config = resources[req.params.resource];
  if (!config) return next();
  const id = asInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid item ID.' });
  const fields = config.fields.filter(field => req.body?.[field] !== undefined);
  if (!fields.length) return res.status(400).json({ error: 'No editable fields were supplied.' });
  let values;
  try { values = fields.map(field => normalizeValue(field, req.body[field])); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const result = db.prepare(`UPDATE ${config.table} SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=?`).run(...values, id);
    if (!result.changes) return res.status(404).json({ error: 'Item not found.' });
    res.json({ item: db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(id) });
  } catch (error) { res.status(400).json({ error: error.message.includes('UNIQUE') ? 'That value already exists.' : 'Could not update this item.' }); }
});
app.delete('/api/admin/:resource/:id', requireAdmin, (req, res, next) => {
  const config = resources[req.params.resource];
  if (!config) return next();
  if (['projects','invoices','leads'].includes(req.params.resource)) return res.status(405).json({ error: 'For auditability, archive or update this item instead of deleting it.' });
  const id = asInt(req.params.id);
  const result = db.prepare(`DELETE FROM ${config.table} WHERE id=?`).run(id);
  if (!result.changes) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/clients', requireAdmin, (req, res) => {
  res.json({ items: db.prepare("SELECT id,name,email,company,created_at FROM users WHERE role='client' ORDER BY id DESC").all() });
});
app.post('/api/admin/clients', requireAdmin, async (req, res) => {
  const name = clean(req.body?.name, 120), email = clean(req.body?.email, 254).toLowerCase(), company = clean(req.body?.company, 180);
  const password = String(req.body?.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return res.status(400).json({ error: 'Provide a name, valid email, and a temporary password of at least 12 characters.' });
  try {
    const result = db.prepare("INSERT INTO users(name,email,password_hash,role,company) VALUES (?,?,?,'client',?)").run(name,email,await bcrypt.hash(password,12),company);
    res.status(201).json({ item: db.prepare('SELECT id,name,email,company,created_at FROM users WHERE id=?').get(result.lastInsertRowid) });
  } catch (error) { res.status(400).json({ error: error.message.includes('UNIQUE') ? 'An account with that email already exists.' : 'Could not create client.' }); }
});
app.put('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const fields = ['name','email','company'].filter(f => req.body?.[f] !== undefined);
  if (!fields.length) return res.status(400).json({ error: 'No editable fields were supplied.' });
  const values = fields.map(f => clean(f === 'email' ? req.body[f] : req.body[f], 254));
  if (req.body.email && !/^\S+@\S+\.\S+$/.test(clean(req.body.email,254))) return res.status(400).json({ error: 'Enter a valid email address.' });
  try {
    const result = db.prepare(`UPDATE users SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=? AND role='client'`).run(...values, asInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'Client not found.' });
    res.json({ item: db.prepare("SELECT id,name,email,company,created_at FROM users WHERE id=?").get(asInt(req.params.id)) });
  } catch { res.status(400).json({ error: 'Could not update this client.' }); }
});

app.post('/api/admin/projects/:id/hours', requireAdmin, (req, res) => {
  const projectId = asInt(req.params.id), hours = Number(req.body?.hours), note = clean(req.body?.note, 1000);
  if (!db.prepare('SELECT id FROM projects WHERE id=?').get(projectId) || !Number.isFinite(hours) || hours <= 0 || hours > 24) return res.status(400).json({ error: 'Choose a valid project and enter hours between 0 and 24.' });
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO hour_logs(project_id,hours,note,created_by) VALUES (?,?,?,?)').run(projectId,hours,note,req.session.user.id);
    db.prepare('UPDATE projects SET hours_logged=hours_logged+? WHERE id=?').run(hours,projectId);
  });
  tx();
  res.status(201).json({ ok: true });
});
app.get('/api/admin/projects/:id/hours', requireAdmin, (req, res) => res.json({ items: db.prepare('SELECT h.*, u.name AS created_by_name FROM hour_logs h LEFT JOIN users u ON u.id=h.created_by WHERE h.project_id=? ORDER BY h.id DESC').all(asInt(req.params.id)) }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => {
  const allowed = new Set(['image/jpeg','image/png','image/webp','application/pdf']);
  if (!allowed.has(file.mimetype)) return cb(new Error('Upload a JPG, PNG, WEBP, or PDF file (8 MB maximum).'));
  cb(null, true);
} });
app.post('/api/admin/projects/:id/uploads', requireAdmin, (req, res) => {
  upload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ error: error.message || 'Upload failed.' });
    const projectId = asInt(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id=?').get(projectId)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const result = db.prepare('INSERT INTO project_files(project_id,original_name,stored_name,mime_type,uploaded_by) VALUES (?,?,?,?,?)')
      .run(projectId, clean(req.file.originalname, 200), req.file.filename, req.file.mimetype, req.session.user.id);
    res.status(201).json({ item: db.prepare('SELECT * FROM project_files WHERE id=?').get(result.lastInsertRowid) });
  });
});

app.post('/api/admin/invoices/:id/mark-paid', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const result = db.prepare("UPDATE invoices SET status='Paid', paid_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  if (!result.changes) return res.status(404).json({ error: 'Invoice not found.' });
  res.json({ ok: true });
});
app.post('/api/admin/leads/:id/interactions', requireAdmin, (req, res) => {
  const id = asInt(req.params.id), note = clean(req.body?.note, 1500);
  if (!note || !db.prepare('SELECT id FROM leads WHERE id=?').get(id)) return res.status(400).json({ error: 'Choose a valid lead and write an interaction note.' });
  db.prepare('INSERT INTO interactions(lead_id,note) VALUES (?,?)').run(id,note);
  res.status(201).json({ ok: true });
});
app.get('/api/admin/leads/:id/interactions', requireAdmin, (req, res) => res.json({ items: db.prepare('SELECT * FROM interactions WHERE lead_id=? ORDER BY id DESC').all(asInt(req.params.id)) }));

app.get('/services', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'services.html')));
app.get('/portfolio', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'portfolio.html')));
app.get('/about', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/journal', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'journal.html')));
app.get('/contact', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/portal', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'strong-think-platform' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Strong Think platform running at http://localhost:${PORT}`);
  if (!production) console.log(`Demo admin: ${process.env.ADMIN_EMAIL || 'admin@strongthink.local'} / ${process.env.ADMIN_PASSWORD || 'ChangeMe!2026'}`);
});
