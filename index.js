/* --- JAVASCRIPT LOGIC (Roles, Tickets, Admin actions) --- */

// 1. Data & Configuration
let tickets = []; // Array to store ticket objects
let ticketCounter = 1; // Simple ID counter

// SLA hours
const SLA_HOURS = { low: 48, medium: 24, high: 8, critical: 2 };

// Current user state
let currentUser = { role: null, name: null, isAdmin: false };

// 2. DOM Elements
const navDashboard = document.getElementById('nav-dashboard');
const navNewTicket = document.getElementById('nav-new-ticket');
const navHelp = document.getElementById('nav-help');
const viewDashboard = document.getElementById('view-dashboard');
const viewNewTicket = document.getElementById('view-new-ticket');
const viewHelp = document.getElementById('view-help');
const ticketForm = document.getElementById('create-ticket-form');
const ticketListBody = document.getElementById('ticket-list-body');
const ticketCountSpan = document.getElementById('ticket-count');
const btnLogout = document.getElementById('btn-logout');
const filterSelect = document.getElementById('filter-select');
// Search input inside the sidebar
const searchInput = document.querySelector('.sidebar-search input');
let searchQuery = '';

// Attachments inputs (created in the form)
const attachmentInput = document.getElementById('attachment-input');
const attachmentPreview = document.getElementById('attachment-preview');
let attachmentsTemp = []; // [{name,type,data}] while composing a ticket

// Confirm modal elements
const confirmModal = document.getElementById('confirm-modal');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
let pendingConfirmId = null;

const profileNameEl = document.getElementById('profile-name');
const profileRoleEl = document.getElementById('profile-role');
const profileMenuEl = document.getElementById('profile-menu');
const profileSwitchBtn = document.getElementById('profile-switch');
const profileLogoutBtn = document.getElementById('profile-logout');

// Theme toggle button element (in header)
const themeToggleBtn = document.getElementById('btn-theme-toggle');

// Overlay elements
const roleOverlay = document.getElementById('role-overlay');
const workerNameInput = document.getElementById('worker-name-input');
const workerEnter = document.getElementById('worker-enter');
const adminPassInput = document.getElementById('admin-pass-input');
const adminEnter = document.getElementById('admin-enter');
const roleError = document.getElementById('role-error');

// Helper: persist/load
function saveState() {
    localStorage.setItem('tickets', JSON.stringify(tickets));
    localStorage.setItem('ticketCounter', String(ticketCounter));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function loadState() {
    const t = localStorage.getItem('tickets');
    if (t) tickets = JSON.parse(t).map(ti => ({ ...ti, slaDeadline: new Date(ti.slaDeadline) }));
    const c = localStorage.getItem('ticketCounter');
    if (c) ticketCounter = Number(c);
    const u = localStorage.getItem('currentUser');
    if (u) currentUser = JSON.parse(u);
}

// Ensure older tickets have alert flags to avoid repeated notifications
function normalizeLoadedTickets() {
    tickets = tickets.map(t => ({ alertedOverdue: false, alertedWarning: false, ...t }));
}

// --- n8n Webhook configuration (can be set via the Integration modal or localStorage)
// Example webhook URL: 'https://your-n8n-host/webhook/ticket-webhook'
// n8n integration removed: integration UI & webhook config were removed per user request

// Integration UI removed

// ...existing navigation code...

// 3. Navigation
function switchView(viewName) {
    if (viewName === 'dashboard') {
        viewDashboard.classList.add('active-section');
        viewNewTicket.classList.remove('active-section');
        navDashboard.classList.add('active');
        navNewTicket.classList.remove('active');
        renderTicketList();
    } else if (viewName === 'help') {
        viewDashboard.classList.remove('active-section');
        viewNewTicket.classList.remove('active-section');
        viewHelp.classList.add('active-section');
        navDashboard.classList.remove('active');
        navNewTicket.classList.remove('active');
        if (navHelp) navHelp.classList.add('active');
    } else if (viewName === 'new') {
        viewDashboard.classList.remove('active-section');
        viewNewTicket.classList.add('active-section');
        navDashboard.classList.remove('active');
        navNewTicket.classList.add('active');
    }
}

navDashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
navNewTicket.addEventListener('click', (e) => { e.preventDefault(); switchView('new'); });
if (navHelp) navHelp.addEventListener('click', (e) => { e.preventDefault(); switchView('help'); });

// Logout handling (clear current user and show role overlay)
if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
    currentUser = { role: null, name: null, isAdmin: false };
    saveState();
        showOverlay();
        // default to dashboard hidden
        switchView('dashboard');
        updateProfileDisplay();
    });
}

// Filter handling
if (filterSelect) {
    filterSelect.addEventListener('change', () => renderTicketList());
}

// Debounce helper
function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Search handling (live, debounced)
if (searchInput) {
    const onSearch = debounce((e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        renderTicketList();
    }, 220);
    searchInput.addEventListener('input', onSearch);
    // allow Enter to focus dashboard table (small UX enhancement)
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Move focus to table body
            const firstRow = document.querySelector('#ticket-list-body tr');
            if (firstRow) firstRow.focus && firstRow.focus();
        }
    });
}

// Attachment handling: read selected files into attachmentsTemp and show previews
function renderAttachmentPreview() {
    if (!attachmentPreview) return;
    attachmentPreview.innerHTML = '';
    if (!attachmentsTemp || attachmentsTemp.length === 0) return;
    const list = document.createElement('div');
    list.className = 'attachment-list';
    attachmentsTemp.forEach(att => {
        const it = document.createElement('div');
        it.className = 'attachment-item';
        const thumb = document.createElement('img');
        // show image thumb or generic icon
        if (att.type && att.type.startsWith('image/')) thumb.src = att.data;
        else thumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23e8e8e8"/><text x="24" y="28" font-size="12" text-anchor="middle" fill="%23666">PDF</text></svg>';
        const name = document.createElement('div');
        name.className = 'att-name';
        name.textContent = att.name;
        it.appendChild(thumb);
        it.appendChild(name);
        list.appendChild(it);
    });
    attachmentPreview.appendChild(list);
}

if (attachmentInput) {
    attachmentInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) { attachmentsTemp = []; renderAttachmentPreview(); return; }
        // read files as data URLs
        const readers = files.map(f => new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res({ name: f.name, type: f.type, data: r.result });
            r.onerror = () => res(null);
            r.readAsDataURL(f);
        }));
        const results = await Promise.all(readers);
        attachmentsTemp = results.filter(Boolean);
        renderAttachmentPreview();
    });
}

// Help -> create ticket prefill handler
document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.help-create-ticket');
    if (!btn) return;
    e.preventDefault();
    const subject = btn.getAttribute('data-subject') || '';
    const desc = btn.getAttribute('data-desc') || '';
    // prefill form
    const subjEl = document.getElementById('subject');
    const descEl = document.getElementById('description');
    if (subjEl) subjEl.value = subject;
    if (descEl) descEl.value = desc;
    // switch to new ticket view and focus
    switchView('new');
    setTimeout(() => { subjEl && subjEl.focus(); }, 80);
});

// 4. Role handling (overlay)
function showOverlay() { roleOverlay.style.display = 'flex'; }
function hideOverlay() { roleOverlay.style.display = 'none'; }

function updateProfileDisplay() {
    if (!profileNameEl || !profileRoleEl) return;
    profileNameEl.textContent = currentUser && currentUser.name ? currentUser.name : 'Invitado';
    if (!currentUser || !currentUser.role) profileRoleEl.textContent = 'Visitante';
    else profileRoleEl.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Trabajador';
}

workerEnter.addEventListener('click', () => {
    const name = workerNameInput.value && workerNameInput.value.trim();
    if (!name) {
        roleError.textContent = 'Introduce tu nombre para continuar.';
        return;
    }
    currentUser = { role: 'trabajador', name: name, isAdmin: false };
    saveState();
    hideOverlay();
    // go directly to the form for worker
    switchView('new');
    updateProfileDisplay();
    // focus subject
    document.getElementById('subject').focus();
});

adminEnter.addEventListener('click', () => {
    const pass = adminPassInput.value || '';
    if (pass === 'Admin1') {
        currentUser = { role: 'admin', name: 'Administrador', isAdmin: true };
        saveState();
        hideOverlay();
        switchView('dashboard');
        updateProfileDisplay();
    } else {
        roleError.textContent = 'Contraseña incorrecta.';
    }
});

// 5. Ticket creation
ticketForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const subject = document.getElementById('subject').value.trim();
    const description = document.getElementById('description').value.trim();
    const priority = document.getElementById('priority').value;

    if (!subject || !description) return;

    const now = new Date();
    const hoursToAdd = SLA_HOURS[priority];
    const deadline = new Date(now.getTime() + (hoursToAdd * 60 * 60 * 1000));

    const reporter = currentUser && currentUser.name ? currentUser.name : 'Anónimo';

    const newTicket = {
        id: '#' + String(ticketCounter++).padStart(3, '0'),
        subject,
        description,
        priority,
        status: 'Abierto',
        createdAt: now,
        slaDeadline: deadline,
        reporter,
        attachments: attachmentsTemp.slice()
    };

    tickets.push(newTicket);
    saveState();
    // Show success message
    showTemporaryMessage('Incidencia mandada correctamente.', 'success');

    ticketForm.reset();
    // clear attachment buffer and preview
    attachmentsTemp = [];
    if (attachmentPreview) attachmentPreview.innerHTML = '';
    // After sending, show dashboard (if admin) or show confirmation then dashboard
    switchView('dashboard');
});

// Temporary message helper
function showTemporaryMessage(text, type = 'info') {
    const msg = document.createElement('div');
    msg.className = 'toast ' + type;
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => { msg.classList.add('visible'); }, 50);
    setTimeout(() => { msg.classList.remove('visible'); setTimeout(() => msg.remove(), 300); }, 3000);
}

// 6. Render tickets (includes reporter and actions for admin)
function renderTicketList() {
    ticketListBody.innerHTML = '';
    const filter = (filterSelect && filterSelect.value) ? filterSelect.value : 'open';
    let shown = tickets;
    if (filter === 'open') shown = tickets.filter(t => t.status !== 'Solucionado');
    else if (filter === 'solved') shown = tickets.filter(t => t.status === 'Solucionado');

    // Apply search query (case-insensitive) across several ticket fields
    if (searchQuery && String(searchQuery).length > 0) {
        const q = searchQuery.toLowerCase();
        shown = shown.filter(t => {
            return [t.id, t.subject, t.description, t.reporter, t.priority, t.status]
                .some(f => String(f || '').toLowerCase().includes(q));
        });
    }

    ticketCountSpan.textContent = shown.length;

    if (shown.length === 0) {
        ticketListBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: gray;">No hay tickets por el momento.</td></tr>';
        return;
    }

    const now = new Date();

    shown.forEach(ticket => {
        const row = document.createElement('tr');

        // Priority badge
        const badgeClass = `badge-${ticket.priority}`;
        const priorityLabel = ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1);

        // SLA display
        const timeLeftMs = ticket.slaDeadline - now;
        let slaDisplay = '';
        let slaClass = '';
        if (timeLeftMs < 0) {
            const hoursOver = Math.abs(Math.round(timeLeftMs / (1000 * 60 * 60)));
            slaDisplay = `VENCIDO hace ${hoursOver}h`;
            slaClass = 'sla-overdue';
        } else {
            const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
            slaDisplay = `${hoursLeft}h ${minutesLeft}m restantes`;
            slaClass = (hoursLeft < 2) ? 'sla-warning' : 'sla-ok';
        }

        // Status visual
        const statusLabel = ticket.status === 'Solucionado' ? `<span style="color: var(--success); font-weight:700">${ticket.status}</span>` : ticket.status;

        // Actions: if admin show button to toggle solved and view attachments
        let actionsHtml = '';
        if (currentUser && currentUser.isAdmin) {
            const btnText = ticket.status === 'Solucionado' ? 'Marcar Abierto' : 'Marcar Solucionado';
            const viewAtt = (ticket.attachments && ticket.attachments.length) ? `<button class="btn-action btn-attach" data-id="${ticket.id}">Adjuntos (${ticket.attachments.length})</button>` : '';
            actionsHtml = `${viewAtt} <button class="btn-action" data-id="${ticket.id}">${btnText}</button>`;
        } else {
            actionsHtml = '-';
        }

        row.innerHTML = `
            <td><strong>${ticket.id}</strong></td>
            <td>${escapeHtml(ticket.subject)} ${ticket.attachments && ticket.attachments.length ? `<span title="${ticket.attachments.length} adjunto(s)">📎 ${ticket.attachments.length}</span>` : ''}</td>
            <td><span class="badge ${badgeClass}">${priorityLabel}</span></td>
            <td>${statusLabel}</td>
            <td>${escapeHtml(ticket.reporter || '')}</td>
            <td class="sla-timer ${slaClass}">${slaDisplay}</td>
            <td>${actionsHtml}</td>
        `;

        // If solved, add a class to row
        if (ticket.status === 'Solucionado') row.classList.add('ticket-solved');

        ticketListBody.appendChild(row);
    });

    // toggle / mark solved buttons
    document.querySelectorAll('.btn-action').forEach(btn => {
        // skip attach buttons here
        if (btn.classList.contains('btn-attach')) return;
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            promptConfirmToggle(id);
        });
    });

    // attach view attachments handlers
    document.querySelectorAll('.btn-attach').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            showTicketDetail(id);
        });
    });
}

function toggleTicketSolved(id) {
    const t = tickets.find(x => x.id === id);
    if (!t) return;
    t.status = (t.status === 'Solucionado') ? 'Abierto' : 'Solucionado';
    saveState();
    renderTicketList();
}

// Ticket detail modal: show attachments and info for admins
const ticketDetailModal = document.getElementById('ticket-detail-modal');
const ticketDetailContent = document.getElementById('ticket-detail-content');
const detailClose = document.getElementById('detail-close');

function showTicketDetail(id) {
    const t = tickets.find(x => x.id === id);
    if (!t || !ticketDetailModal || !ticketDetailContent) return;
    // build content
    const created = new Date(t.createdAt).toLocaleString();
    const deadline = new Date(t.slaDeadline).toLocaleString();
    let html = `<div><strong>${escapeHtml(t.subject)}</strong><div style="color:#666; font-size:0.95rem; margin-top:6px;">${escapeHtml(t.description)}</div>`;
    html += `<div style="margin-top:10px; font-size:0.9rem; color:#444;"><strong>Reportado por:</strong> ${escapeHtml(t.reporter||'')} • <strong>Prioridad:</strong> ${t.priority} • <strong>Estado:</strong> ${t.status}</div>`;
    html += `<div style="margin-top:6px; color:#666; font-size:0.9rem;"><strong>Creado:</strong> ${created} • <strong>Deadline:</strong> ${deadline}</div>`;

    // attachments
    if (t.attachments && t.attachments.length) {
        html += `<div class="attachments">`;
        t.attachments.forEach((a, idx) => {
            const safeName = escapeHtml(a.name || (`adjunto-${idx+1}`));
            const isImage = a.type && a.type.startsWith('image/');
            const thumb = isImage ? `<img src="${a.data}" alt="${safeName}" />` : `<div style="width:96px;height:64px;display:flex;align-items:center;justify-content:center;background:#f4f4f4;border-radius:6px;color:#666;">${safeName.split('.').pop().toUpperCase()}</div>`;
            html += `<div class="att">${thumb}<div class="att-meta"><div class="att-name">${safeName}</div><div style="font-size:0.85rem; color:#666;">${a.type || 'application/octet-stream'}</div><div><a class="download" href="${a.data}" download="${safeName}">Descargar</a> <span style="color:#999">•</span> <a target="_blank" rel="noopener noreferrer" href="${a.data}">Abrir</a></div></div></div>`;
        });
        html += `</div>`;
    } else {
        html += `<div style="margin-top:10px; color:#666;">No hay archivos adjuntos.</div>`;
    }

    html += `</div>`;
    ticketDetailContent.innerHTML = html;
    ticketDetailModal.style.display = 'flex';
}

if (detailClose) detailClose.addEventListener('click', (e) => { e.preventDefault(); if (ticketDetailModal) ticketDetailModal.style.display = 'none'; });
// also allow clicking outside to close
if (ticketDetailModal) ticketDetailModal.addEventListener('click', (e) => { if (e.target === ticketDetailModal) ticketDetailModal.style.display = 'none'; });

// Confirmation modal flow
function promptConfirmToggle(id) {
    const t = tickets.find(x => x.id === id);
    if (!t) return;
    pendingConfirmId = id;
    confirmTitle.textContent = t.status === 'Solucionado' ? 'Marcar como Abierto' : 'Marcar como Solucionado';
    confirmMessage.textContent = `¿Deseas marcar el ticket ${id} como ${t.status === 'Solucionado' ? 'Abierto' : 'Solucionado'}?`;
    confirmModal.style.display = 'flex';
}

confirmCancel.addEventListener('click', () => {
    pendingConfirmId = null;
    confirmModal.style.display = 'none';
});

confirmOk.addEventListener('click', () => {
    if (!pendingConfirmId) return;
    toggleTicketSolved(pendingConfirmId);
    pendingConfirmId = null;
    confirmModal.style.display = 'none';
});

// Simple HTML escape for text content
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 7. Demo data only if no saved tickets
function initDemoDataIfEmpty() {
    if (tickets.length > 0) return;
    const now = new Date();
    tickets.push({ id: '#001', subject: 'Servidor de correo caído', description: 'El servidor no responde', priority: 'critical', status: 'Abierto', createdAt: now, slaDeadline: new Date(now.getTime() + (1 * 60 * 60 * 1000)), reporter: 'Sistema' });
    tickets.push({ id: '#002', subject: 'Solicitud de nuevo teclado', description: 'Teclado defectuoso', priority: 'low', status: 'Abierto', createdAt: now, slaDeadline: new Date(now.getTime() + (47 * 60 * 60 * 1000)), reporter: 'Ana' });
    ticketCounter = 3;
    saveState();
}

// Load stored state and initialize
loadState();
normalizeLoadedTickets();
initDemoDataIfEmpty();

/* --- THEME (Dark Mode) --- */
const THEME_KEY = 'theme';
function applyTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark');
    else document.body.classList.remove('dark');
    if (themeToggleBtn) {
        const isDark = theme === 'dark';
        themeToggleBtn.setAttribute('aria-pressed', isDark);
        themeToggleBtn.textContent = isDark ? '☀︎' : '🌙';
        themeToggleBtn.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
}

function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) { applyTheme(saved); return; }
    // Respect user OS preference as fallback
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
}

function toggleTheme() {
    const isDarkNow = document.body.classList.toggle('dark');
    const next = isDarkNow ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    if (themeToggleBtn) {
        themeToggleBtn.setAttribute('aria-pressed', isDarkNow);
        themeToggleBtn.textContent = isDarkNow ? '☀️' : '🌙';
        themeToggleBtn.title = isDarkNow ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
}

if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
loadTheme();

// Update profile display on load
updateProfileDisplay();

// Profile menu behavior: toggle on profile click, and actions for change user / logout
const profileContainer = document.querySelector('.sidebar .profile');
if (profileContainer) {
    profileContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!profileMenuEl) return;
        profileMenuEl.style.display = (profileMenuEl.style.display === 'flex') ? 'none' : 'flex';
    });
}

// Hide profile menu when clicking elsewhere
document.addEventListener('click', () => { if (profileMenuEl) profileMenuEl.style.display = 'none'; });

if (profileSwitchBtn) profileSwitchBtn.addEventListener('click', (e) => { e.preventDefault(); if (profileMenuEl) profileMenuEl.style.display = 'none'; showOverlay(); });
if (profileLogoutBtn) profileLogoutBtn.addEventListener('click', (e) => { e.preventDefault(); if (btnLogout) btnLogout.click(); if (profileMenuEl) profileMenuEl.style.display = 'none'; });

// SLA notifications: warn when <2h left, alert when overdue. Persist simple alert flags to avoid repeated spam.
function requestNotificationPermissionIfNeeded() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) { /* ignore */ }
    }
}

function checkSLAAlerts() {
    const now = new Date();
    let changed = false;
    tickets.forEach(t => {
        if (!t || t.status === 'Solucionado') return;
        const ms = new Date(t.slaDeadline) - now;
        // overdue
        if (ms < 0 && !t.alertedOverdue) {
            showTemporaryMessage(`Ticket ${t.id} vencido. Prioridad: ${t.priority}`, 'info');
            try {
                if (Notification && Notification.permission === 'granted') {
                    new Notification('Ticket vencido', { body: `${t.id} - ${t.subject}` });
                }
            } catch (e) {}
            t.alertedOverdue = true; changed = true;
        } else if (ms > 0 && ms <= (2 * 60 * 60 * 1000) && !t.alertedWarning) {
            showTemporaryMessage(`Ticket ${t.id} cerca del SLA (${t.priority}). Quedan <2h.`, 'info');
            try {
                if (Notification && Notification.permission === 'granted') {
                    new Notification('SLA próxima', { body: `${t.id} - ${t.subject}` });
                }
            } catch (e) {}
            t.alertedWarning = true; changed = true;
        }
    });
    if (changed) saveState();
}

// Ask permission proactively when the app starts (non-intrusive)
requestNotificationPermissionIfNeeded();
// Run once now and then every minute
setTimeout(checkSLAAlerts, 2000);
setInterval(checkSLAAlerts, 60 * 1000);

// If user already selected, skip overlay
if (currentUser && currentUser.role) {
    hideOverlay();
    if (currentUser.role === 'trabajador') switchView('new');
    else switchView('dashboard');
} else {
    showOverlay();
}

renderTicketList();

// Update SLA timers every minute
setInterval(renderTicketList, 60000);

/* --- FAQ Assistant (simple client-side 'IA') --- */
// Knowledge base: short answers and keywords
const FAQ_KB = [
    { keywords: ['internet','conexion','conexión','router','wifi'], answer: 'Prueba reiniciar el router/modem, desconectar y volver a conectar el Wi‑Fi, y si es general reinicia el equipo. Si sigue sin funcionar, crea un ticket con los pasos que has probado.' },
    { keywords: ['impresora','imprime','impresión','cola'], answer: 'Comprueba que la impresora esté encendida, papel/tóner y revisa la cola de impresión en el equipo. Reinicia la impresora y el PC. Si persiste, abre un ticket indicando modelo y mensajes de error.' },
    { keywords: ['correo','email','mail','webmail'], answer: 'Intenta entrar por webmail para descartar cliente local. Revisa usuario/contraseña y restablece si es necesario. Si falla, crea un ticket indicando el error exacto.' },
    { keywords: ['lento','lentitud','velocidad','cpu','memoria'], answer: 'Cierra aplicaciones innecesarias, revisa procesos que consumen CPU/memoria y libera espacio en disco. Si no mejora, abre un ticket con observaciones y capturas.' },
    { keywords: ['contraseña','clave','olvidé','restablecer'], answer: 'Usa la opción de restablecer contraseña del servicio. Si no existe, solicita el restablecimiento via ticket indicando tu usuario y DNI.' },
    { keywords: ['aplicación','app','error','se cierra','crash'], answer: 'Anota el mensaje de error y pasos para reproducirlo. Reinicia la app y, si persiste, adjunta capturas o logs en un ticket.' },
    { keywords: ['pantalla','monitor','negro','sin señal'], answer: 'Revisa cables de vídeo y alimentación, prueba otro cable/monitor y anota pitidos BIOS si no arranca. Si no se soluciona, registra un ticket.' },
    { keywords: ['vpn','conexión vpn','vpn no conecta'], answer: 'Verifica credenciales y versión del cliente VPN, reinicia el cliente y la conexión. Si sigue fallando, adjunta logs del cliente en un ticket.' },
    { keywords: ['telefono','voip','fono','teléfono'], answer: 'Reinicia el teléfono, revisa cables y configuración de red. Si hay caída general, crea un ticket indicando la extensión y síntoma.' }
];

function appendAssistantBubble(text, from = 'bot'){
    const convo = document.getElementById('assistant-convo');
    if(!convo) return;
    const div = document.createElement('div');
    div.className = 'assistant-bubble ' + (from === 'user' ? 'user' : 'bot');
    div.textContent = text;
    convo.appendChild(div);
    convo.scrollTop = convo.scrollHeight;
}

function findAnswerFor(question){
    const q = (question||'').toLowerCase();
    for(const item of FAQ_KB){
        for(const kw of item.keywords){
            if(q.includes(kw)) return item.answer;
        }
    }
    return null;
}

// Wire assistant UI
const assistantInput = document.getElementById('assistant-input');
const assistantSend = document.getElementById('assistant-send');
const assistantSuggest = document.getElementById('assistant-suggest');

function assistantHandleSend(){
    const q = assistantInput && assistantInput.value && assistantInput.value.trim();
    if(!q) return;
    appendAssistantBubble(q, 'user');
    if(assistantInput) assistantInput.value = '';
    appendAssistantBubble('Analizando tu pregunta...', 'bot');
    setTimeout(()=>{
        // remove the 'analizando' last bot bubble
        const convo = document.getElementById('assistant-convo');
        if(convo){
            const nodes = convo.querySelectorAll('.assistant-bubble.bot');
            if(nodes && nodes.length) nodes[nodes.length-1].remove();
        }
        const ans = findAnswerFor(q);
        if(ans){
            appendAssistantBubble(ans, 'bot');
            // offer quick actions
            if(assistantSuggest) assistantSuggest.innerHTML = `<div>¿Quieres registrar un ticket sobre esto? <button class="btn-action assistant-create-ticket" data-subject="${escapeHtml(q).slice(0,80)}" data-desc="${escapeHtml(q)}">Crear ticket</button></div>`;
        } else {
            appendAssistantBubble('No tengo una respuesta exacta. Puedo abrir un ticket con tu consulta para que el equipo lo revise.', 'bot');
            if(assistantSuggest) assistantSuggest.innerHTML = `<div>¿Registrar un ticket? <button class="btn-action assistant-create-ticket" data-subject="${escapeHtml(q).slice(0,80)}" data-desc="${escapeHtml(q)}">Crear ticket</button></div>`;
        }
    }, 700);
}

if (assistantSend) assistantSend.addEventListener('click', (e)=>{ e.preventDefault(); assistantHandleSend(); });
if (assistantInput) assistantInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); assistantHandleSend(); } });

// Create ticket from assistant suggestions
document.addEventListener('click', (e)=>{
    const a = e.target.closest && e.target.closest('.assistant-create-ticket');
    if(!a) return;
    e.preventDefault();
    const subject = a.getAttribute('data-subject') || '';
    const desc = a.getAttribute('data-desc') || '';
    const subjEl = document.getElementById('subject');
    const descEl = document.getElementById('description');
    if(subjEl) subjEl.value = subject;
    if(descEl) descEl.value = desc;
    // clear suggestions
    if(assistantSuggest) assistantSuggest.innerHTML = '';
    // switch to new ticket view
    switchView('new');
    setTimeout(()=>{ subjEl && subjEl.focus(); }, 80);
});
