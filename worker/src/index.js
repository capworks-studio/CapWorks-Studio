// ═══════════════════════════════════════════════════════════════
//  CapWorks Studio — Cloudflare Worker API
//  Storage: Cloudflare KV  |  Auth: JWT-like tokens  |  OTP: Resend
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ── CORS ──
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*');
    const corsOk = allowed === '*' || origin === allowed;
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOk ? origin || '*' : allowed,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const res = await handleRequest(url, method, request, env);
      for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
      return res;
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal error' }, 500, corsHeaders);
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

async function handleRequest(url, method, request, env) {
  const path = url.pathname;
  const body = ['POST', 'PUT', 'DELETE'].includes(method)
    ? await request.json().catch(() => ({}))
    : null;

  // Helper: extract authenticated user from Bearer token
  const getUser = () => authUser(request, env);

  // ── Public ──
  if (method === 'GET' && path === '/api/config')        return getConfig(env);
  if (method === 'GET' && path === '/api/services')       return getServices(env);
  if (method === 'GET' && path === '/api/team')           return getTeam(env);
  if (method === 'GET' && path === '/api/users/count')    return getUsersCount(env);
  if (method === 'GET' && path === '/api/projects')       return getProjects(url, env);

  // ── Auth ──
  if (method === 'POST' && path === '/api/auth/otp/request')        return authOtpRequest(body, env);
  if (method === 'POST' && path === '/api/auth/otp/verify-register') return authOtpVerifyRegister(body, env);
  if (method === 'POST' && path === '/api/auth/otp/resend')         return authOtpResend(body, env);
  if (method === 'POST' && path === '/api/auth/login')              return authLogin(body, env);
  if (method === 'POST' && path === '/api/auth/otp/request-email')  return authOtpRequestEmail(body, getUser, env);
  if (method === 'POST' && path === '/api/auth/otp/verify-email')   return authOtpVerifyEmail(body, getUser, env);

  // ── User (auth required) ──
  if (method === 'POST' && path === '/api/user/online')           return userOnline(body, getUser, env);
  if (method === 'POST' && path === '/api/user/change-username')  return userChangeUsername(body, getUser, env);
  if (method === 'POST' && path === '/api/user/update')           return userUpdate(body, getUser, env);

  // ── Interactions ──
  if (method === 'POST' && path === '/api/like')              return postLike(body, env);
  if (method === 'POST' && path === '/api/project/view')      return postProjectView(body, env);
  if (method === 'POST' && path === '/api/project/download')  return postProjectDownload(body, env);
  if (method === 'POST' && path === '/api/order')             return postOrder(body, env);
  if (method === 'POST' && path === '/api/contact')           return postContact(body, env);
  if (method === 'POST' && path === '/api/contribute')        return postContribute(body, env);

  // ── Support ──
  if (method === 'POST' && path === '/api/support/send') return supportSend(body, getUser, env);
  if (method === 'POST' && path === '/api/support/save') return supportSave(body, env);

  // ── Admin ──
  if (method === 'POST' && path === '/api/admin/login')           return adminLogin(body, env);
  if (method === 'POST' && path === '/api/admin/config')          return adminConfig(body, getUser, env);
  if (method === 'PUT'  && path === '/api/admin/services')        return adminPutService(body, getUser, env);
  if (method === 'DELETE' && path === '/api/admin/services')      return adminDeleteService(body, getUser, env);
  if (method === 'PUT'  && path === '/api/admin/team')            return adminPutTeam(body, getUser, env);
  if (method === 'DELETE' && path === '/api/admin/team')          return adminDeleteTeam(body, getUser, env);
  if (method === 'GET'  && path === '/api/admin/users')           return adminGetUsers(getUser, env);
  if (method === 'GET'  && path === '/api/admin/tickets')         return adminGetTickets(getUser, env);
  if (method === 'DELETE' && path === '/api/admin/tickets')       return adminDeleteTickets(body, getUser, env);
  if (method === 'POST' && path === '/api/admin/users/role')      return adminSetRole(body, getUser, env);
  if (method === 'POST' && path === '/api/admin/users/password')  return adminSetPassword(body, getUser, env);
  if (method === 'DELETE' && path === '/api/admin/users')         return adminDeleteUser(body, getUser, env);
  if (method === 'POST' && path === '/api/admin/change-password') return adminChangePassword(body, getUser, env);
  if (method === 'POST' && path === '/api/admin/webhook/test')    return adminWebhookTest(getUser, env);
  if (method === 'PUT'  && path === '/api/admin/projects')        return adminPutProject(body, getUser, env);
  if (method === 'DELETE' && path === '/api/admin/projects')      return adminDeleteProject(body, getUser, env);

  return json({ error: 'Not found' }, 404);
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Simple token: base64(username:random:timestamp) signed with HMAC
async function createToken(username, env) {
  const payload = `${username}:${uid()}:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = btoa(payload) + '.' + sigHex;
  // Store token → username mapping (30 days TTL)
  await env.CW_KV.put(`token:${token}`, username, { expirationTtl: 30 * 86400 });
  return token;
}

async function authUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const username = await env.CW_KV.get(`token:${token}`);
  if (!username) return null;
  const user = await env.CW_KV.get(`user:${username}`, 'json');
  if (!user) return null;
  return { ...user, username, token };
}

async function requireUser(getUser) {
  const user = await getUser();
  if (!user) throw { status: 401, message: 'Non authentifie' };
  return user;
}

async function requireAdmin(getUser, env) {
  const user = await getUser();
  if (!user) throw { status: 401, message: 'Non authentifie' };
  if (user.role !== 'owner' && user.role !== 'mod') {
    throw { status: 403, message: 'Acces refuse' };
  }
  return user;
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendOtpEmail(email, code, env) {
  if (!env.RESEND_API_KEY) {
    console.log(`[OTP] Code for ${email}: ${code} (no RESEND_API_KEY configured)`);
    return;
  }
  const fromEmail = env.FROM_EMAIL || 'CapWorks Studio <noreply@capworks.studio>';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'CapWorks Studio — Code de verification',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:30px;background:#0d0d1a;color:#eeeeff;border-radius:12px">
          <h2 style="color:#7c6cff;margin:0 0 16px">CapWorks Studio</h2>
          <p>Votre code de verification :</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#111120;border-radius:8px;color:#22d3ee;margin:16px 0">${code}</div>
          <p style="color:#8888b0;font-size:13px">Ce code expire dans 10 minutes. Ne le partagez avec personne.</p>
        </div>
      `,
    }),
  });
}

async function sendDiscord(env, embed) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'CapWorks Studio',
      embeds: [embed],
    }),
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
//  KV helpers — lists stored as JSON arrays
// ═══════════════════════════════════════════════════════════════

async function kvGetList(env, key) {
  const data = await env.CW_KV.get(key, 'json');
  return Array.isArray(data) ? data : [];
}

async function kvGetObj(env, key, fallback = {}) {
  const data = await env.CW_KV.get(key, 'json');
  return data || fallback;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC endpoints
// ═══════════════════════════════════════════════════════════════

async function getConfig(env) {
  const config = await kvGetObj(env, 'config', { sections: { services: true, projects: true, team: true, support: true } });
  return json(config);
}

async function getServices(env) {
  const svcs = await kvGetList(env, 'services');
  return json(svcs);
}

async function getTeam(env) {
  const team = await kvGetList(env, 'team');
  return json(team);
}

async function getUsersCount(env) {
  const count = await env.CW_KV.get('users_count');
  return json({ count: parseInt(count || '0', 10) });
}

async function getProjects(url, env) {
  const cat = url.searchParams.get('cat') || 'all';
  if (cat === 'all') {
    const cats = ['sites', 'games', 'software', 'animations', 'bots', 'ai', 'assets', 'other'];
    const all = {};
    for (const c of cats) all[c] = await kvGetList(env, `projects:${c}`);
    return json(all);
  }
  const projects = await kvGetList(env, `projects:${cat}`);
  return json(projects);
}

// ═══════════════════════════════════════════════════════════════
//  AUTH endpoints
// ═══════════════════════════════════════════════════════════════

async function authOtpRequest(body, env) {
  const { username, email, password, emoji } = body;
  if (!username || !email || !password) return json({ error: 'Champs requis manquants' }, 400);

  // Check if username already exists
  const existing = await env.CW_KV.get(`user:${username}`, 'json');
  if (existing) return json({ error: 'Ce nom d\'utilisateur est deja pris' }, 409);

  const code = randomCode();
  await env.CW_KV.put(
    `otp:${username}`,
    JSON.stringify({ code, email, password: await hashPassword(password), emoji: emoji || '', expires: Date.now() + 600000 }),
    { expirationTtl: 660 },
  );

  await sendOtpEmail(email, code, env);
  return json({ ok: true, message: 'Code envoye' });
}

async function authOtpVerifyRegister(body, env) {
  const { username, code } = body;
  if (!username || !code) return json({ error: 'Champs requis' }, 400);

  const otpData = await env.CW_KV.get(`otp:${username}`, 'json');
  if (!otpData) return json({ error: 'Aucun code en attente' }, 400);
  if (Date.now() > otpData.expires) return json({ error: 'Code expire' }, 400);
  if (otpData.code !== code) return json({ error: 'Code incorrect' }, 400);

  // Create user
  const user = {
    email: otpData.email,
    password: otpData.password,
    emoji: otpData.emoji || '',
    role: 'user',
    online: true,
    createdAt: new Date().toISOString(),
  };
  await env.CW_KV.put(`user:${username}`, JSON.stringify(user));
  await env.CW_KV.delete(`otp:${username}`);

  // Increment user count
  const count = parseInt((await env.CW_KV.get('users_count')) || '0', 10);
  await env.CW_KV.put('users_count', String(count + 1));

  const token = await createToken(username, env);

  await sendDiscord(env, {
    title: 'Nouvel utilisateur',
    description: `**${username}** vient de s'inscrire !`,
    color: 0x10f099,
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true, token, username, emoji: user.emoji, role: user.role });
}

async function authOtpResend(body, env) {
  const { username, email } = body;
  if (!username) return json({ error: 'Username requis' }, 400);

  const otpData = await env.CW_KV.get(`otp:${username}`, 'json');
  if (!otpData) return json({ error: 'Aucune inscription en attente' }, 400);

  const code = randomCode();
  otpData.code = code;
  otpData.expires = Date.now() + 600000;
  await env.CW_KV.put(`otp:${username}`, JSON.stringify(otpData), { expirationTtl: 660 });

  await sendOtpEmail(email || otpData.email, code, env);
  return json({ ok: true, message: 'Code renvoye' });
}

async function authLogin(body, env) {
  const { username, password } = body;
  if (!username || !password) return json({ error: 'Champs requis' }, 400);

  const user = await env.CW_KV.get(`user:${username}`, 'json');
  if (!user) return json({ error: 'Utilisateur introuvable' }, 401);

  const hash = await hashPassword(password);
  if (user.password !== hash) return json({ error: 'Mot de passe incorrect' }, 401);

  const token = await createToken(username, env);

  // Set online
  user.online = true;
  await env.CW_KV.put(`user:${username}`, JSON.stringify(user));

  return json({ ok: true, token, username, emoji: user.emoji || '', role: user.role || 'user' });
}

async function authOtpRequestEmail(body, getUser, env) {
  const user = await requireUser(getUser);
  const { newEmail } = body;
  if (!newEmail) return json({ error: 'Email requis' }, 400);

  const code = randomCode();
  await env.CW_KV.put(
    `otp_email:${user.username}`,
    JSON.stringify({ code, newEmail, expires: Date.now() + 600000 }),
    { expirationTtl: 660 },
  );

  await sendOtpEmail(newEmail, code, env);
  return json({ ok: true, message: 'Code envoye' });
}

async function authOtpVerifyEmail(body, getUser, env) {
  const user = await requireUser(getUser);
  const { code } = body;
  if (!code) return json({ error: 'Code requis' }, 400);

  const otpData = await env.CW_KV.get(`otp_email:${user.username}`, 'json');
  if (!otpData) return json({ error: 'Aucun changement en attente' }, 400);
  if (Date.now() > otpData.expires) return json({ error: 'Code expire' }, 400);
  if (otpData.code !== code) return json({ error: 'Code incorrect' }, 400);

  // Update user email
  const userData = await env.CW_KV.get(`user:${user.username}`, 'json');
  userData.email = otpData.newEmail;
  await env.CW_KV.put(`user:${user.username}`, JSON.stringify(userData));
  await env.CW_KV.delete(`otp_email:${user.username}`);

  return json({ ok: true, email: otpData.newEmail });
}

// ═══════════════════════════════════════════════════════════════
//  USER endpoints (auth required)
// ═══════════════════════════════════════════════════════════════

async function userOnline(body, getUser, env) {
  const user = await requireUser(getUser);
  const userData = await env.CW_KV.get(`user:${user.username}`, 'json');
  userData.online = body.online !== false;
  await env.CW_KV.put(`user:${user.username}`, JSON.stringify(userData));
  return json({ ok: true });
}

async function userChangeUsername(body, getUser, env) {
  const user = await requireUser(getUser);
  const { newUsername } = body;
  if (!newUsername || newUsername.length < 3) return json({ error: 'Pseudo trop court (min 3 caracteres)' }, 400);

  const existing = await env.CW_KV.get(`user:${newUsername}`, 'json');
  if (existing) return json({ error: 'Ce pseudo est deja pris' }, 409);

  // Copy user data to new key
  const userData = await env.CW_KV.get(`user:${user.username}`, 'json');
  await env.CW_KV.put(`user:${newUsername}`, JSON.stringify(userData));
  await env.CW_KV.delete(`user:${user.username}`);

  // Update token mapping
  await env.CW_KV.put(`token:${user.token}`, newUsername, { expirationTtl: 30 * 86400 });

  return json({ ok: true, username: newUsername });
}

async function userUpdate(body, getUser, env) {
  const user = await requireUser(getUser);
  const userData = await env.CW_KV.get(`user:${user.username}`, 'json');

  if (body.emoji !== undefined) userData.emoji = body.emoji;

  if (body.newPassword) {
    if (!body.currentPassword) return json({ error: 'Mot de passe actuel requis' }, 400);
    const currentHash = await hashPassword(body.currentPassword);
    if (currentHash !== userData.password) return json({ error: 'Mot de passe actuel incorrect' }, 400);
    userData.password = await hashPassword(body.newPassword);
  }

  await env.CW_KV.put(`user:${user.username}`, JSON.stringify(userData));
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
//  INTERACTIONS
// ═══════════════════════════════════════════════════════════════

async function postLike(body, env) {
  const { cat, id, delta } = body;
  if (!cat || !id) return json({ error: 'cat et id requis' }, 400);

  const projects = await kvGetList(env, `projects:${cat}`);
  const proj = projects.find((p) => p.id === id);
  if (proj) {
    proj.likes = Math.max(0, (proj.likes || 0) + (delta || 1));
    await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  }
  return json({ ok: true, likes: proj?.likes || 0 });
}

async function postProjectView(body, env) {
  const { cat, id } = body;
  if (!cat || !id) return json({ ok: true });

  const projects = await kvGetList(env, `projects:${cat}`);
  const proj = projects.find((p) => p.id === id);
  if (proj) {
    proj.views = (proj.views || 0) + 1;
    await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  }
  return json({ ok: true });
}

async function postProjectDownload(body, env) {
  const { cat, id } = body;
  if (!cat || !id) return json({ ok: true });

  const projects = await kvGetList(env, `projects:${cat}`);
  const proj = projects.find((p) => p.id === id);
  if (proj) {
    proj.downloads = (proj.downloads || 0) + 1;
    await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  }
  return json({ ok: true });
}

async function postOrder(body, env) {
  const { sName, tName, price, email, ord, buyer } = body;

  // Save order
  const orders = await kvGetList(env, 'orders');
  orders.push({ sName, tName, price, email, ord, buyer, date: new Date().toISOString() });
  await env.CW_KV.put('orders', JSON.stringify(orders));

  // Notify Discord
  await sendDiscord(env, {
    title: 'Nouvelle commande !',
    color: 0x7c6cff,
    fields: [
      { name: 'Service', value: sName, inline: true },
      { name: 'Niveau', value: tName, inline: true },
      { name: 'Prix', value: `${price} EUR`, inline: true },
      { name: 'Acheteur', value: buyer, inline: true },
      { name: 'Email', value: email, inline: true },
      { name: 'Reference', value: ord, inline: true },
    ],
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true, ord });
}

async function postContact(body, env) {
  const { name, email, subject, message } = body;
  if (!name || !email || !message) return json({ error: 'Champs requis manquants' }, 400);

  // Save contact
  const contacts = await kvGetList(env, 'contacts');
  contacts.push({ name, email, subject, message, date: new Date().toISOString() });
  await env.CW_KV.put('contacts', JSON.stringify(contacts));

  // Notify Discord
  await sendDiscord(env, {
    title: 'Nouveau message de contact',
    color: 0x22d3ee,
    fields: [
      { name: 'Nom', value: name, inline: true },
      { name: 'Email', value: email, inline: true },
      { name: 'Sujet', value: subject || 'N/A', inline: true },
      { name: 'Message', value: message.slice(0, 1024) },
    ],
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true });
}

async function postContribute(body, env) {
  const { cat, id, amount, message } = body;
  if (!cat || !id || !amount) return json({ error: 'Champs requis' }, 400);

  const projects = await kvGetList(env, `projects:${cat}`);
  const proj = projects.find((p) => p.id === id);
  if (proj) {
    proj.contributeTotal = (proj.contributeTotal || 0) + parseFloat(amount);
    await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  }

  await sendDiscord(env, {
    title: 'Nouvelle contribution !',
    color: 0xfbbf24,
    fields: [
      { name: 'Projet', value: proj?.title || id, inline: true },
      { name: 'Montant', value: `${amount} EUR`, inline: true },
      { name: 'Message', value: message || '—' },
    ],
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true, total: proj?.contributeTotal || 0 });
}

// ═══════════════════════════════════════════════════════════════
//  SUPPORT
// ═══════════════════════════════════════════════════════════════

async function supportSend(body, getUser, env) {
  const { target, text, type } = body;
  if (!target || !text) return json({ error: 'Champs requis' }, 400);

  const messages = await kvGetList(env, `tickets:${target}`);
  const user = await getUser();
  messages.push({
    user: user?.username || 'system',
    emoji: user?.emoji || '',
    role: user?.role || 'user',
    text,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    type: type || 'message',
    date: new Date().toISOString(),
  });
  await env.CW_KV.put(`tickets:${target}`, JSON.stringify(messages));

  // Notify Discord for new support messages
  if (type !== 'order') {
    await sendDiscord(env, {
      title: 'Message support',
      color: 0x60a5fa,
      fields: [
        { name: 'De', value: user?.username || 'system', inline: true },
        { name: 'Pour', value: target, inline: true },
        { name: 'Message', value: text.slice(0, 1024) },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  return json({ ok: true });
}

async function supportSave(body, env) {
  const { username, messages } = body;
  if (!username) return json({ error: 'username requis' }, 400);
  await env.CW_KV.put(`tickets:${username}`, JSON.stringify(messages || []));
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN endpoints
// ═══════════════════════════════════════════════════════════════

async function adminLogin(body, env) {
  const { password } = body;
  if (!password) return json({ error: 'Mot de passe requis' }, 400);

  // Check against stored hash or env secret
  const storedHash = await env.CW_KV.get('admin_password_hash');
  const inputHash = await hashPassword(password);

  if (storedHash) {
    if (inputHash !== storedHash) return json({ error: 'Mot de passe incorrect' }, 401);
  } else {
    // First time: compare with env secret
    if (password !== env.ADMIN_PASSWORD) return json({ error: 'Mot de passe incorrect' }, 401);
    // Store the hash for future logins
    await env.CW_KV.put('admin_password_hash', inputHash);
  }

  return json({ ok: true });
}

async function adminConfig(body, getUser, env) {
  // Admin config update — check admin access via session or admin login
  const config = await kvGetObj(env, 'config', {});
  if (body.sections) config.sections = body.sections;
  await env.CW_KV.put('config', JSON.stringify(config));
  return json({ ok: true });
}

async function adminPutService(body, getUser, env) {
  const svcs = await kvGetList(env, 'services');
  const idx = svcs.findIndex((s) => s.id === body.id);
  if (idx >= 0) svcs[idx] = { ...svcs[idx], ...body };
  else svcs.push(body);
  await env.CW_KV.put('services', JSON.stringify(svcs));
  return json({ ok: true });
}

async function adminDeleteService(body, getUser, env) {
  let svcs = await kvGetList(env, 'services');
  svcs = svcs.filter((s) => s.id !== body.id);
  await env.CW_KV.put('services', JSON.stringify(svcs));
  return json({ ok: true });
}

async function adminPutTeam(body, getUser, env) {
  const team = await kvGetList(env, 'team');
  const idx = team.findIndex((m) => m.id === body.id);
  if (idx >= 0) team[idx] = { ...team[idx], ...body };
  else team.push(body);
  await env.CW_KV.put('team', JSON.stringify(team));
  return json({ ok: true });
}

async function adminDeleteTeam(body, getUser, env) {
  let team = await kvGetList(env, 'team');
  team = team.filter((m) => m.id !== body.id);
  await env.CW_KV.put('team', JSON.stringify(team));
  return json({ ok: true });
}

async function adminGetUsers(getUser, env) {
  // List all users — scan KV by prefix
  const list = await env.CW_KV.list({ prefix: 'user:' });
  const users = [];
  for (const key of list.keys) {
    const username = key.name.replace('user:', '');
    const data = await env.CW_KV.get(key.name, 'json');
    if (data) {
      users.push({
        id: username,
        username,
        email: data.email || '',
        emoji: data.emoji || '',
        role: data.role || 'user',
        online: data.online || false,
        createdAt: data.createdAt || '',
      });
    }
  }
  return json(users);
}

async function adminGetTickets(getUser, env) {
  const list = await env.CW_KV.list({ prefix: 'tickets:' });
  const tickets = [];
  for (const key of list.keys) {
    const username = key.name.replace('tickets:', '');
    const messages = await env.CW_KV.get(key.name, 'json');
    if (messages && messages.length > 0) {
      tickets.push({ username, messages });
    }
  }
  return json(tickets);
}

async function adminDeleteTickets(body, getUser, env) {
  const { username } = body;
  if (!username) return json({ error: 'username requis' }, 400);
  await env.CW_KV.delete(`tickets:${username}`);
  return json({ ok: true });
}

async function adminSetRole(body, getUser, env) {
  const { username, role } = body;
  if (!username || !role) return json({ error: 'Champs requis' }, 400);

  const userData = await env.CW_KV.get(`user:${username}`, 'json');
  if (!userData) return json({ error: 'Utilisateur introuvable' }, 404);

  userData.role = role;
  await env.CW_KV.put(`user:${username}`, JSON.stringify(userData));
  return json({ ok: true });
}

async function adminSetPassword(body, getUser, env) {
  const { username, password } = body;
  if (!username || !password) return json({ error: 'Champs requis' }, 400);

  const userData = await env.CW_KV.get(`user:${username}`, 'json');
  if (!userData) return json({ error: 'Utilisateur introuvable' }, 404);

  userData.password = await hashPassword(password);
  await env.CW_KV.put(`user:${username}`, JSON.stringify(userData));
  return json({ ok: true });
}

async function adminDeleteUser(body, getUser, env) {
  const { username } = body;
  if (!username) return json({ error: 'username requis' }, 400);

  await env.CW_KV.delete(`user:${username}`);
  await env.CW_KV.delete(`tickets:${username}`);

  // Decrement user count
  const count = parseInt((await env.CW_KV.get('users_count')) || '0', 10);
  await env.CW_KV.put('users_count', String(Math.max(0, count - 1)));

  return json({ ok: true });
}

async function adminChangePassword(body, getUser, env) {
  const { newPassword } = body;
  if (!newPassword || newPassword.length < 6) return json({ error: 'Mot de passe trop court (min 6)' }, 400);

  const hash = await hashPassword(newPassword);
  await env.CW_KV.put('admin_password_hash', hash);
  return json({ ok: true });
}

async function adminWebhookTest(getUser, env) {
  if (!env.DISCORD_WEBHOOK_URL) return json({ error: 'DISCORD_WEBHOOK_URL non configure' }, 400);

  await sendDiscord(env, {
    title: 'Test Webhook',
    description: 'Le webhook fonctionne correctement !',
    color: 0x10f099,
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true, message: 'Webhook envoye' });
}

async function adminPutProject(body, getUser, env) {
  const { cat, project, id, hidden } = body;
  if (!cat) return json({ error: 'Categorie requise' }, 400);

  const projects = await kvGetList(env, `projects:${cat}`);

  // Toggle hidden flag
  if (id && hidden !== undefined && !project) {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      proj.hidden = hidden;
      await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
    }
    return json({ ok: true });
  }

  // Upsert project
  if (project) {
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = { ...projects[idx], ...project };
    else projects.push(project);
    await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  }

  return json({ ok: true });
}

async function adminDeleteProject(body, getUser, env) {
  const { cat, id } = body;
  if (!cat || !id) return json({ error: 'cat et id requis' }, 400);

  let projects = await kvGetList(env, `projects:${cat}`);
  projects = projects.filter((p) => p.id !== id);
  await env.CW_KV.put(`projects:${cat}`, JSON.stringify(projects));
  return json({ ok: true });
}
