// ============================================================
//  QURAN ACADEMY — api.js (Improved with better error handling)
// ============================================================

const API = (() => {

  // ── CONFIG — REPLACE THIS WITH YOUR DEPLOYED URL ────────
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwDPYdVrej30Qpz76u3QxWc8v80TB_bKFaM3mVFZW4Ute8BBalamgQAhjKyj3so-SlS/exec';
  
  // Add a test endpoint to verify connectivity
  const TEST_MODE = true; // Set to false in production

  // ── Request queue ────────────────────────────────────────
  const queue = [];
  let isProcessing = false;
  const RATE_LIMIT_MS = 300;

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
        console.error(`Request failed for ${item.action}:`, err);
        item.reject(err);
      }
      if (queue.length > 0) await sleep(RATE_LIMIT_MS);
    }
    isProcessing = false;
  }

  async function rawRequest(action, body = {}, method = 'POST') {
    // Get token safely
    let token = null;
    try {
      if (typeof Auth !== 'undefined' && Auth.getToken) {
        token = Auth.getToken();
      }
    } catch(e) {
      console.warn('Auth not available');
    }

    let url = APPS_SCRIPT_URL;
    let opts = {};

    // Add cache busting to prevent caching issues
    const cacheBuster = `_cb=${Date.now()}`;

    if (method === 'GET') {
      const params = new URLSearchParams();
      params.append('action', action);
      
      Object.keys(body).forEach(key => {
        if (body[key] !== undefined && body[key] !== null) {
          params.append(key, typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
        }
      });
      
      if (token) params.append('token', token);
      params.append('_', Date.now()); // Cache busting
      
      url = url + '?' + params.toString();
      opts = { 
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      };
    } else {
      const payload = { action, ...body };
      if (token) payload.token = token;
      
      opts = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      };
    }

    try {
      console.log(`Sending ${method} request to:`, url);
      console.log('Request payload:', opts.body || 'GET request');
      
      const res = await fetch(url, opts);
      
      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Response data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (err) {
      console.error(`API Error (${action}):`, err);
      
      // Provide more helpful error messages
      if (err.message === 'Failed to fetch') {
        throw new Error(`Cannot connect to server. Please check:\n1. Web App URL is correct: ${APPS_SCRIPT_URL}\n2. Web App is deployed and published\n3. You're not behind a firewall\n4. Try opening the URL directly in browser`);
      }
      
      throw err;
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Test connectivity to the backend
  async function testConnection() {
    try {
      console.log('Testing connection to:', APPS_SCRIPT_URL);
      const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStudents&_=${Date.now()}`, {
        method: 'GET',
        mode: 'cors'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Connection test successful:', data);
        return { success: true, message: 'Connected successfully' };
      } else {
        return { success: false, message: `HTTP ${response.status}` };
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      return { success: false, message: err.message };
    }
  }

  // Helper functions
  function getAuthUserId() {
    try {
      return typeof Auth !== 'undefined' && Auth.getUserId ? Auth.getUserId() : '';
    } catch { return ''; }
  }
  
  function getAuthUserName() {
    try {
      return typeof Auth !== 'undefined' && Auth.getUserName ? Auth.getUserName() : 'System';
    } catch { return 'System'; }
  }

  // ── Public API methods ───────────────────────────────────
  const register = (formData) => enqueue('register', formData);
  const login = (email, password, role) => enqueue('login', { email, password, role });
  const verifyToken = (token) => enqueue('verifyToken', { token });

  const getPendingStudents = () => enqueue('getPendingStudents', {}, 'GET');
  const getAllStudents = () => enqueue('getAllStudents', {}, 'GET');
  const approveStudent = (studentId, classGroupId) =>
    enqueue('approveStudent', { studentId, classGroupId, approvedBy: getAuthUserName() });
  const rejectStudent = (studentId) => enqueue('rejectStudent', { studentId });
  const suspendStudent = (studentId) => enqueue('suspendStudent', { studentId });

  const addTeacher = (data) => enqueue('addTeacher', data);
  const getTeachers = () => enqueue('getTeachers', {}, 'GET');

  const createClass = (data) => enqueue('createClass', data);
  const getClasses = (filters = {}) => enqueue('getClasses', filters, 'GET');
  const updateClass = (data) => enqueue('updateClass', data);
  const deleteClass = (classId) => enqueue('deleteClass', { classId });

  const enrollStudent = (studentId, classId) => enqueue('enrollStudent', { studentId, classId });
  const getEnrollments = (filters = {}) => enqueue('getEnrollments', filters, 'GET');

  const getStudentSchedule = (studentId) => enqueue('getStudentSchedule', { studentId }, 'GET');
  const getAllSchedule = () => enqueue('getAllSchedule', {}, 'GET');

  const markAttendance = (classId, sessionDate, records) =>
    enqueue('markAttendance', { classId, sessionDate, records, markedBy: getAuthUserId() });
  const getAttendance = (filters = {}) => enqueue('getAttendance', filters, 'GET');
  const getClassAttendance = (classId, sessionDate) =>
    enqueue('getClassAttendance', { classId, sessionDate }, 'GET');

  const addProgress = (data) => enqueue('addProgress', { ...data, teacherId: getAuthUserId() });
  const getProgress = (studentId) => enqueue('getProgress', { studentId }, 'GET');

  const createAnnouncement = (data) => enqueue('createAnnouncement', { ...data, postedBy: getAuthUserName() });
  const getAnnouncements = (audience, classId) => enqueue('getAnnouncements', { audience, classId }, 'GET');

  const getDashboardStats = () => enqueue('getDashboardStats', {}, 'GET');

  // Quran API
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
    testConnection,  // Add this to test connectivity
    register, login, verifyToken,
    getPendingStudents, getAllStudents, approveStudent, rejectStudent, suspendStudent,
    addTeacher, getTeachers,
    createClass, getClasses, updateClass, deleteClass,
    enrollStudent, getEnrollments,
    getStudentSchedule, getAllSchedule,
    markAttendance, getAttendance, getClassAttendance,
    addProgress, getProgress,
    createAnnouncement, getAnnouncements,
    getDashboardStats,
    getQuranSurah, getQuranSurahList, getQuranAyah, getPrayerTimes,
    isConfigured: () => !APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')
  };

})();
