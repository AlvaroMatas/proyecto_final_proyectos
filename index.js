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
const viewDashboard = document.getElementById('view-dashboard');
const viewNewTicket = document.getElementById('view-new-ticket');
const ticketForm = document.getElementById('create-ticket-form');
const ticketListBody = document.getElementById('ticket-list-body');
const ticketCountSpan = document.getElementById('ticket-count');
const btnLogout = document.getElementById('btn-logout');
const filterSelect = document.getElementById('filter-select');
// Search input inside the sidebar
const searchInput = document.querySelector('.sidebar-search input');
let searchQuery = '';

// Confirm modal elements
const confirmModal = document.getElementById('confirm-modal');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
let pendingConfirmId = null;

const profileNameEl = document.getElementById('profile-name');
const profileRoleEl = document.getElementById('profile-role');

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

// 3. Navigation
function switchView(viewName) {
    if (viewName === 'dashboard') {
        viewDashboard.classList.add('active-section');
        viewNewTicket.classList.remove('active-section');
        navDashboard.classList.add('active');
        navNewTicket.classList.remove('active');
        renderTicketList();
    } else if (viewName === 'new') {
        viewDashboard.classList.remove('active-section');
        viewNewTicket.classList.add('active-section');
        navDashboard.classList.remove('active');
        navNewTicket.classList.add('active');
    }
}

navDashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
navNewTicket.addEventListener('click', (e) => { e.preventDefault(); switchView('new'); });

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
        reporter
    };

    tickets.push(newTicket);
    saveState();

    // Show success message
    showTemporaryMessage('Incidencia mandada correctamente.', 'success');

    ticketForm.reset();
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

        // Actions: if admin show button to toggle solved
        let actionsHtml = '';
        if (currentUser && currentUser.isAdmin) {
            const btnText = ticket.status === 'Solucionado' ? 'Marcar Abierto' : 'Marcar Solucionado';
            actionsHtml = `<button class="btn-action" data-id="${ticket.id}">${btnText}</button>`;
        } else {
            actionsHtml = '-';
        }

        row.innerHTML = `
            <td><strong>${ticket.id}</strong></td>
            <td>${escapeHtml(ticket.subject)}</td>
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

    // Attach action listeners for admin buttons (confirm before toggling)
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            promptConfirmToggle(id);
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