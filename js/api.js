// ============================================================
//  QURAN ACADEMY — api.js
//  Google Apps Script Web App interface + request queue
//  Replace APPS_SCRIPT_URL with your deployed Web App URL
// ============================================================

const API = (() => {

  // ── CONFIG — replace this after deploying Code.gs ────────
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxS9WuDkZjXzNA1_ZsQnuniY1FDur9j7OmodMg9pUUXjp7hjlKna96kkNJSETFCPEyv/exec';

  // ── Request queue (avoid hitting 30 req/min limit) ────────
  const queue = [];
  let isProcessing = false;
  const RATE_LIMIT_MS = 300; // min gap between requests

  function enqueue(action, body = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
      queue.push({ action, body, method, resolve, reject });
      if (!isProcessing) processQueue();
    });
  }

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const result = await rawRequest(item.action, item.body, item.method);
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
      if (queue.length > 0) await sleep(RATE_LIMIT_MS);
    }
    isProcessing = false;
  }

  async function rawRequest(action, body = {}, method = 'POST') {
    const token = Auth.getToken();

    let url  = APPS_SCRIPT_URL;
    let opts = {};

    if (method === 'GET') {
      const params = new URLSearchParams({ action, ...body });
      if (token) params.append('token', token);
      url = url + '?' + params.toString();
      opts = { method: 'GET' };
    } else {
      const payload = { action, ...body };
      if (token) payload.token = token;
      opts = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      };
    }

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Request failed');
    return data;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Public API methods ───────────────────────────────────

  // Auth
  const register = (formData) => enqueue('register', formData);
  const login    = (email, password, role) => enqueue('login', { email, password, role });
  const verifyToken = (token) => enqueue('verifyToken', { token });

  // Admin — Students
  const getPendingStudents = () => enqueue('getPendingStudents', {}, 'GET');
  const getAllStudents      = () => enqueue('getAllStudents', {}, 'GET');
  const approveStudent     = (studentId, classGroupId) =>
    enqueue('approveStudent', { studentId, classGroupId, approvedBy: Auth.getUserName() });
  const rejectStudent      = (studentId) => enqueue('rejectStudent', { studentId });
  const suspendStudent     = (studentId) => enqueue('suspendStudent', { studentId });

  // Admin — Teachers
  const addTeacher  = (data) => enqueue('addTeacher', data);
  const getTeachers = () => enqueue('getTeachers', {}, 'GET');

  // Classes
  const createClass  = (data) => enqueue('createClass', data);
  const getClasses   = (filters = {}) => enqueue('getClasses', filters, 'GET');
  const updateClass  = (data) => enqueue('updateClass', data);
  const deleteClass  = (classId) => enqueue('deleteClass', { classId });

  // Enrollments
  const enrollStudent  = (studentId, classId) => enqueue('enrollStudent', { studentId, classId });
  const getEnrollments = (filters = {}) => enqueue('getEnrollments', filters, 'GET');

  // Schedule
  const getStudentSchedule = (studentId) => enqueue('getStudentSchedule', { studentId }, 'GET');
  const getAllSchedule      = () => enqueue('getAllSchedule', {}, 'GET');

  // Attendance
  const markAttendance = (classId, sessionDate, records) =>
    enqueue('markAttendance', {
      classId, sessionDate, records,
      markedBy: Auth.getUserId()
    });
  const getAttendance      = (filters = {}) => enqueue('getAttendance', filters, 'GET');
  const getClassAttendance = (classId, sessionDate) =>
    enqueue('getClassAttendance', { classId, sessionDate }, 'GET');

  // Progress
  const addProgress = (data) => enqueue('addProgress', {
    ...data, teacherId: Auth.getUserId()
  });
  const getProgress = (studentId) => enqueue('getProgress', { studentId }, 'GET');

  // Announcements
  const createAnnouncement = (data) => enqueue('createAnnouncement', {
    ...data, postedBy: Auth.getUserName()
  });
  const getAnnouncements = (audience, classId) =>
    enqueue('getAnnouncements', { audience, classId }, 'GET');

  // Stats
  const getDashboardStats = () => enqueue('getDashboardStats', {}, 'GET');

  // ── Quran API (external — no queue needed) ───────────────
  const QURAN_API = 'https://api.alquran.cloud/v1';

  async function getQuranSurah(surahNumber, edition = 'quran-uthmani') {
    const res = await fetch(`${QURAN_API}/surah/${surahNumber}/${edition}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error('Quran API error');
    return data.data;
  }

  async function getQuranSurahList() {
    const res = await fetch(`${QURAN_API}/surah`);
    const data = await res.json();
    return data.data;
  }

  async function getQuranAyah(reference, edition = 'en.asad') {
    const res = await fetch(`${QURAN_API}/ayah/${reference}/${edition}`);
    const data = await res.json();
    return data.data;
  }

  async function getPrayerTimes(city, country) {
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${city}&country=${country}&method=2`);
    const data = await res.json();
    return data.data;
  }

  return {
    // Auth
    register, login, verifyToken,
    // Students
    getPendingStudents, getAllStudents, approveStudent, rejectStudent, suspendStudent,
    // Teachers
    addTeacher, getTeachers,
    // Classes
    createClass, getClasses, updateClass, deleteClass,
    // Enrollments
    enrollStudent, getEnrollments,
    // Schedule
    getStudentSchedule, getAllSchedule,
    // Attendance
    markAttendance, getAttendance, getClassAttendance,
    // Progress
    addProgress, getProgress,
    // Announcements
    createAnnouncement, getAnnouncements,
    // Stats
    getDashboardStats,
    // Quran
    getQuranSurah, getQuranSurahList, getQuranAyah, getPrayerTimes,
    // Utils
    isConfigured: () => !APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')
  };

})();


// ============================================================
//  Auth.js — Session management (same file or separate)
// ============================================================
const Auth = (() => {
  const TOKEN_KEY   = 'qa_token';
  const USER_KEY    = 'qa_user';
  const ROLE_KEY    = 'qa_role';

  function saveSession(token, user, role) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_KEY, role);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  function getToken()    { return localStorage.getItem(TOKEN_KEY); }
  function getUser()     { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
  function getRole()     { return localStorage.getItem(ROLE_KEY); }
  function getUserId()   { const u = getUser(); return u ? (u.ID || u.AdminID || u.StudentID || '') : ''; }
  function getUserName() { const u = getUser(); return u ? (u.FullName || 'Unknown') : 'Unknown'; }
  function isLoggedIn()  { return !!getToken(); }

  async function login(email, password, role) {
    const res = await API.login(email, password, role);
    saveSession(res.token, res.user, res.role);
    return res;
  }

  function logout() {
    clearSession();
    window.location.href = '/index.html';
  }

  // Guard: redirect if not logged in or wrong role
  function requireAuth(expectedRole) {
    if (!isLoggedIn()) {
      window.location.href = '/index.html?redirect=' + encodeURIComponent(window.location.href);
      return false;
    }
    if (expectedRole && getRole() !== expectedRole) {
      // Try to send to right dashboard
      const roleMap = { admin: '/admin/dashboard.html', teacher: '/teacher/dashboard.html', student: '/student/dashboard.html' };
      window.location.href = roleMap[getRole()] || '/index.html';
      return false;
    }
    return true;
  }

  return {
    saveSession, clearSession,
    getToken, getUser, getRole, getUserId, getUserName,
    isLoggedIn, login, logout, requireAuth
  };
})();


// ============================================================
//  Utils.js — Shared helpers
// ============================================================
const Utils = (() => {

  // Show toast notification
  function toast(message, type = 'info', duration = 3500) {
    const existing = document.querySelector('.qa-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `qa-toast qa-toast--${type}`;
    el.innerHTML = `<span class="qa-toast__icon">${iconFor(type)}</span><span>${message}</span>`;
    document.body.appendChild(el);

    requestAnimationFrame(() => el.classList.add('qa-toast--show'));
    setTimeout(() => {
      el.classList.remove('qa-toast--show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function iconFor(type) {
    return { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
  }

  // Show/hide loading spinner
  function showLoader(text = 'Loading...') {
    let el = document.getElementById('qa-loader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'qa-loader';
      el.innerHTML = `<div class="qa-loader__backdrop"><div class="qa-loader__box"><div class="qa-loader__pattern"></div><div class="qa-loader__spinner"></div><p>${text}</p></div></div>`;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  }

  function hideLoader() {
    const el = document.getElementById('qa-loader');
    if (el) el.style.display = 'none';
  }

  // Format UTC time to local
  function utcToLocal(timeStr, daysOfWeek) {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const now = new Date();
      now.setUTCHours(h, m, 0, 0);
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return timeStr; }
  }

  // Format date nicely
  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Parse days array
  function parseDays(raw) {
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  }

  function daysDisplay(raw) {
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return parseDays(raw).map(d => typeof d === 'number' ? dayNames[d] : d).join(', ');
  }

  // Validate email
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Capitalize
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // Truncate
  function truncate(str, n = 80) {
    return str && str.length > n ? str.slice(0, n) + '...' : str;
  }

  // Attendance heatmap data
  function buildHeatmap(attendanceRecords) {
    const map = {};
    attendanceRecords.forEach(r => {
      map[r.SessionDate] = r.Status;
    });
    return map;
  }

  // Generate initials avatar
  function initialsAvatar(name, size = 40) {
    const parts = (name || 'U').split(' ');
    const initials = parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="qa-avatar" style="width:${size}px;height:${size}px;">${initials}</div>`;
  }

  // Sanitize HTML
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Get time until next class
  function timeUntilClass(timeUTC, daysOfWeek) {
    const days = parseDays(daysOfWeek);
    const now = new Date();
    const [h, m] = (timeUTC || '00:00').split(':').map(Number);

    let minDiff = Infinity;
    days.forEach(day => {
      const next = new Date();
      next.setUTCHours(h, m, 0, 0);
      let diff = (next - now) / 60000;
      if (diff < 0) diff += 7 * 24 * 60;
      if (diff < minDiff) minDiff = diff;
    });

    if (minDiff < 0) return null;
    if (minDiff < 10) return 'Starting now!';
    if (minDiff < 60) return `In ${Math.round(minDiff)} min`;
    const hrs = Math.round(minDiff / 60);
    if (hrs < 24) return `In ${hrs}h`;
    return `In ${Math.round(hrs/24)}d`;
  }

  // Islamic greeting based on time
  function islamicGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير — Good Morning';
    if (h < 17) return 'مساء الخير — Good Afternoon';
    return 'مساء النور — Good Evening';
  }

  // Async wrapper with loading
  async function withLoader(fn, loaderText = 'Please wait...') {
    showLoader(loaderText);
    try {
      return await fn();
    } finally {
      hideLoader();
    }
  }

  return {
    toast, showLoader, hideLoader, withLoader,
    utcToLocal, formatDate, parseDays, daysDisplay,
    isValidEmail, capitalize, truncate,
    buildHeatmap, initialsAvatar, sanitize,
    timeUntilClass, islamicGreeting
  };
})();
