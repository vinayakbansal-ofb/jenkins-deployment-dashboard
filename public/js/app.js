/**
 * OASYS Jenkins Dashboard — STG Tab View
 * ──────────────────────────────────────
 * Fetches live data from /api/deployments, extracts environments,
 * renders clickable STG tabs, and shows jobs per environment in a table.
 */

// ── Constants ──────────────────────────────────────────────────────────────
const REFRESH_SEC = 30;
const TAB_COLORS = [
    '#4a7cf7', '#f59e0b', '#22c55e', '#ef4444',
    '#a78bfa', '#06b6d4', '#f97316', '#ec4899',
    '#10b981', '#8b5cf6',
];

// Job avatar colour pairs (gradient)
const JOB_COLORS = [
    ['#4a7cf7', '#7c3aed'], ['#f59e0b', '#ef4444'], ['#22c55e', '#06b6d4'],
    ['#ec4899', '#a78bfa'], ['#f97316', '#f59e0b'], ['#10b981', '#22c55e'],
    ['#8b5cf6', '#4a7cf7'], ['#6366f1', '#a78bfa'],
];

// ── State ──────────────────────────────────────────────────────────────────
let allDeployments = [];   // flat array from /api/deployments
let activeEnv = 'all';
let countdown = REFRESH_SEC;
let countdownTimer = null;
let configuredJobs = [];   // from /api/jobs

// ── Utility ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const esc = str => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const relTime = iso => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const fmtFull = iso => iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

const statusLabel = s => ({
    SUCCESS: 'Success', FAILED: 'Failed', RUNNING: 'Running',
    ABORTED: 'Aborted', UNSTABLE: 'Unstable', NO_BUILDS: 'No Builds',
    ERROR: 'Error', UNKNOWN: 'Unknown'
})[s] || s;

/** Consistent colour index from string seed */
const hashIdx = (str, len) => {
    let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
    return Math.abs(h) % len;
};

const jobColors = name => JOB_COLORS[hashIdx(name, JOB_COLORS.length)];

/** Returns first 2 uppercase chars as avatar initials */
const initials = name => {
    const parts = name.replace(/[-_]/g, ' ').split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name.substring(0, 2)).toUpperCase();
};

// ── Derived Data ──────────────────────────────────────────────────────────
const getEnvs = () => {
    const envSet = new Set();
    allDeployments.forEach(d => { if (d.environment && d.environment !== '—') envSet.add(d.environment); });
    return ['all', ...Array.from(envSet).sort((a, b) => {
        // Sort: stg1 < stg2 < stg10 < otherstuff
        const an = parseInt(a.replace(/\D/g, ''), 10);
        const bn = parseInt(b.replace(/\D/g, ''), 10);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return a.localeCompare(b);
    })];
};

const applyFilters = (data) => {
    const q = $('searchInput').value.trim().toLowerCase();
    const job = $('filterJob').value;
    return data.filter(d => {
        if (job && d.job !== job) return false;
        if (q) {
            const hay = `${d.job} ${d.branch} ${d.deployedBy} ${d.commit}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
};

const getVisibleDeployments = () => {
    let data = allDeployments;
    if (activeEnv !== 'all') {
        data = data.filter(d => d.environment === activeEnv);
    }
    return applyFilters(data);
};

// ── Render Functions ───────────────────────────────────────────────────────
const renderTabs = () => {
    const envs = getEnvs();
    const tabs = $('envTabs');
    tabs.innerHTML = envs.map((env, idx) => {
        const isAll = env === 'all';
        const color = isAll ? '#8b93b0' : TAB_COLORS[hashIdx(env, TAB_COLORS.length)];
        const jobs = isAll ? allDeployments : allDeployments.filter(d => d.environment === env);
        const count = jobs.length;
        const hasErr = jobs.some(d => d.status === 'FAILED' || d.status === 'ERROR');
        const hasRun = jobs.some(d => d.status === 'RUNNING');
        const label = isAll ? 'All' : env.toUpperCase();
        const active = activeEnv === env ? 'active' : '';
        const errClass = hasErr ? 'has-error' : (hasRun ? 'has-running' : '');

        return `<button
            class="env-tab ${isAll ? 'tab-all' : ''} ${active} ${errClass}"
            data-env="${esc(env)}"
            style="--tab-color:${color}"
            onclick="selectEnv('${esc(env)}')"
        >
            <div class="tab-status-dot"></div>
            <span class="env-tab-name">${esc(label)}</span>
            <span class="env-tab-count">${count} Job${count !== 1 ? 's' : ''}</span>
        </button>`;
    }).join('');
};

const renderTable = () => {
    const data = getVisibleDeployments();
    const wrap = $('tableWrap');
    const empty = $('emptyState');
    const noEnv = $('noEnvJobs');

    // Show/hide states
    $('loadingState').classList.add('hidden');
    noEnv.classList.add('hidden');
    empty.classList.add('hidden');
    wrap.classList.add('hidden');

    if (allDeployments.length === 0) {
        empty.classList.remove('hidden');
        return;
    }

    if (data.length === 0) {
        noEnv.classList.remove('hidden');
        return;
    }

    wrap.classList.remove('hidden');
    $('tableBody').innerHTML = data.map(d => {
        const [ca, cb] = jobColors(d.job);
        const ini = initials(d.job);
        const userIni = initials(d.deployedBy !== '—' ? d.deployedBy : '??');
        const jenUrl = esc(d.url || '#');

        // Shorten email deployedBy → first part before @
        const userDisplay = d.deployedBy !== '—'
            ? d.deployedBy.split('@')[0]
            : '—';

        return `<tr>
            <td>
                <div class="job-cell">
                    <div class="job-avatar" style="--job-c-a:${ca};--job-c-b:${cb}">${ini}</div>
                    <div>
                        <a href="${jenUrl}" target="_blank" class="job-name-link">${esc(d.job)}</a>
                        ${d.environment !== '—' ? `<div class="job-sub">${esc(d.environment.toUpperCase())}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                ${d.branch !== '—'
                ? `<span class="branch-tag"><span class="branch-icon">⎇</span>${esc(d.branch)}</span>`
                : '<span style="color:var(--text-muted)">—</span>'}
            </td>
            <td class="build-num">${d.buildNumber !== null ? `#${esc(String(d.buildNumber))}` : '—'}</td>
            <td>
                <div class="sp sp-${esc(d.status)}">
                    <div class="dot"></div>${esc(statusLabel(d.status))}
                </div>
            </td>
            <td>
                ${userDisplay !== '—'
                ? `<div class="user-cell">
                         <div class="user-avatar">${userIni}</div>
                         <span class="user-name" title="${esc(d.deployedBy)}">${esc(userDisplay)}</span>
                       </div>`
                : '<span style="color:var(--text-muted)">—</span>'}
            </td>
            <td class="time-cell" title="${esc(fmtFull(d.timestamp))}">${relTime(d.timestamp)}</td>
            <td><button class="btn-hist" onclick="openHistory('${esc(d.job)}')">History</button></td>
        </tr>`;
    }).join('');

    // Update "last updated" footer time
    $('lastUpdateText').textContent = 'Just now';
};

// ── Environment Selection ──────────────────────────────────────────────────
window.selectEnv = (env) => {
    activeEnv = env;
    renderTabs();
    renderTable();
};

// ── Filter Population ──────────────────────────────────────────────────────
const populateJobFilter = () => {
    const sel = $('filterJob');
    const current = sel.value;
    const jobs = [...new Set(allDeployments.map(d => d.job))].sort();
    sel.innerHTML = `<option value="">Filter: All Jobs</option>` +
        jobs.map(j => `<option value="${esc(j)}"${j === current ? ' selected' : ''}>${esc(j)}</option>`).join('');
};

// ── Fetch & Refresh ────────────────────────────────────────────────────────
const fetchData = async (quiet = false) => {
    if (!quiet) {
        $('loadingState').classList.remove('hidden');
        $('tableWrap').classList.add('hidden');
        $('emptyState').classList.add('hidden');
    }
    $('refreshBtn').classList.add('spinning');
    $('refreshText').textContent = '…';
    document.querySelector('.rdot').classList.add('loading');

    try {
        const res = await fetch('/api/deployments');
        if (!res.ok) throw new Error(`Server: ${res.status}`);
        allDeployments = await res.json();

        renderTabs();
        populateJobFilter();
        renderTable();

        if (!quiet) showToast(`✅ Loaded ${allDeployments.length} deployments`);
    } catch (err) {
        console.error('Fetch error:', err);
        $('loadingState').classList.add('hidden');
        $('emptyState').classList.remove('hidden');
        if (!quiet) showToast('⚠️ Failed to load Jenkins data', 'err');
    } finally {
        $('refreshBtn').classList.remove('spinning');
        $('refreshText').textContent = 'Live';
        document.querySelector('.rdot').classList.remove('loading');
    }
};

const startCountdown = () => {
    countdown = REFRESH_SEC;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        countdown--;
        $('refreshText').textContent = countdown > 5 ? 'Live' : `${countdown}s`;
        if (countdown <= 0) { countdown = REFRESH_SEC; fetchData(true); }
    }, 1000);
};

// ── History Modal ──────────────────────────────────────────────────────────
window.openHistory = async (job) => {
    const modal = $('historyModal');
    modal.classList.remove('hidden');
    $('modalTitle').textContent = job;
    $('modalSubtitle').textContent = 'Last 20 builds from Jenkins';
    $('modalBody').innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>`;

    try {
        const res = await fetch(`/api/history/${encodeURIComponent(job)}`);
        const data = await res.json();
        const hist = data.history || [];

        if (!hist.length) {
            $('modalBody').innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>No history</h3><p>No past builds found for this job.</p></div>`;
            return;
        }

        $('modalBody').innerHTML = `<div>` + hist.map(h => `
        <div class="hist-item">
            <span class="hist-num">#${h.buildNumber ?? '?'}</span>
            <div class="hist-body">
                <div class="hist-top">
                    <span class="hist-branch">${esc(h.branch)}</span>
                    <span class="hist-commit">${esc(h.commit)}</span>
                    <div class="sp sp-${esc(h.status)}"><div class="dot"></div>${esc(statusLabel(h.status))}</div>
                    ${h.environment !== '—' ? `<span style="font-size:11px;color:var(--text-muted)">${esc(h.environment.toUpperCase())}</span>` : ''}
                </div>
                <div class="hist-meta">
                    <span>👤 ${esc((h.deployedBy || '—').split('@')[0])}</span>
                    <span>🕐 ${esc(fmtFull(h.timestamp))}</span>
                    <span>${relTime(h.timestamp)}</span>
                </div>
            </div>
            <a class="hist-link" href="${esc(h.url || '#')}" target="_blank">↗</a>
        </div>`).join('') + `</div>`;
    } catch (err) {
        $('modalBody').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(err.message)}</p></div>`;
    }
};

const closeModal = () => $('historyModal').classList.add('hidden');

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
const showToast = (msg) => {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
};

// ── Events ─────────────────────────────────────────────────────────────────
$('refreshBtn').addEventListener('click', () => { fetchData(); startCountdown(); });
$('modalClose').addEventListener('click', closeModal);
$('historyModal').addEventListener('click', e => { if (e.target === $('historyModal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('searchInput').addEventListener('input', () => { renderTabs(); renderTable(); });
$('filterJob').addEventListener('change', () => { renderTabs(); renderTable(); });

// ── Theme Management ──────────────────────────────────────────────────────
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon('light');
    }
};

const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeIcon(target);
    showToast(`🌙 Switched to ${target} mode`);
};

const updateThemeIcon = (theme) => {
    const icon = $('themeIcon');
    if (theme === 'dark') {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    } else {
        icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
    }
};

// ── Boot ───────────────────────────────────────────────────────────────────
(async () => {
    initTheme();
    $('themeToggle').addEventListener('click', toggleTheme);
    await fetchData();
    startCountdown();
})();
