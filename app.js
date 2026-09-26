// Paste your Google Apps Script Web App URL ending in /exec here:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyhpdj20BgtJ8pd7dSHuEzBz5mrjVQknHAcnnxwUkPKxNofz0C-Lt5oSxKl4s6miB35/exec";

// Admin Credentials
const ADMIN_ID = 'bilisimyk';
const ADMIN_NAME = 'bravoekip';

let currentLang = localStorage.getItem('quiz_lang') || 'en';

const translations = {
  en: {
    loginTitle: "Welcome to the Tech Quiz!",
    loginSubtitle: "Enter your details to compete.",
    labelStudentId: "Student Number",
    labelName: "Full Name",
    placeholderId: "e.g. 210101001",
    placeholderName: "e.g. Arthur Morgan",
    btnStart: "Start Quiz",
    checkingAttendance: "Checking attendance...",
    alreadyParticipated: "You have already participated today!",
    connectionBusy: "Connection busy. Please click \"Start Quiz\" again.",
    questionWord: "Question",
    btnNext: "Next Question",
    resultsTitle: "Quiz Complete!",
    scorePrefix: "Score",
    timePrefix: "Completed in",
    timeSeconds: "seconds",
    statusSaving: "Saving score to leaderboard...",
    statusSaved: "✅ Recorded to club leaderboard!",
    statusSaveError: "⚠️ Could not save score.",
    statusConnectionError: "⚠️ Connection error while saving score.",
    leaderboardTitle: "🏆 Live Hall of Fame",
    loadingStandings: "Loading live standings...",
    noEntries: "No entries yet! Be the first.",
    failedLeaderboard: "Failed to load leaderboard.",
    btnRestart: "Next Player",
    adminTitle: "🛠️ Admin Dashboard",
    btnLogout: "Log Out",
    adminQuestionsTitle: "📚 Question Bank & Explanations",
    loadingQuestions: "Loading questions...",
    failedQuestions: "Failed to load questions.json.",
    explanationLabel: "Explanation",
    noExplanation: "No explanation provided."
  },
  tr: {
    loginTitle: "Teknoloji Kulübü Bilgi Yarışması!",
    loginSubtitle: "Yarışmak için bilgilerinizi girin.",
    labelStudentId: "Öğrenci Numarası",
    labelName: "Ad Soyad",
    placeholderId: "Örn. 210101001",
    placeholderName: "Örn. Ahmet Bulut",
    btnStart: "Yarışmaya Başla",
    checkingAttendance: "Katılım kontrol ediliyor...",
    alreadyParticipated: "Bugün zaten katılım sağladınız!",
    connectionBusy: "Bağlantı meşgul. Lütfen tekrar \"Yarışmaya Başla\" butonuna basın.",
    questionWord: "Soru",
    btnNext: "Sonraki Soru",
    resultsTitle: "Yarışma Tamamlandı!",
    scorePrefix: "Puan",
    timePrefix: "Tamamlanma süresi",
    timeSeconds: "saniye",
    statusSaving: "Skor sıralamaya kaydediliyor...",
    statusSaved: "✅ Kulüp sıralamasına kaydedildi!",
    statusSaveError: "⚠️ Skor kaydedilemedi.",
    statusConnectionError: "⚠️ Skor kaydedilirken bağlantı hatası oluştu.",
    leaderboardTitle: "🏆 Canlı Sıralama",
    loadingStandings: "Canlı sıralama yükleniyor...",
    noEntries: "Henüz kayıt yok! İlk katılan siz olun.",
    failedLeaderboard: "Sıralama yüklenemedi.",
    btnRestart: "Sıradaki Yarışmacı",
    adminTitle: "🛠️ Yönetici Paneli",
    btnLogout: "Çıkış Yap",
    adminQuestionsTitle: "📚 Soru Bankası ve Açıklamalar",
    loadingQuestions: "Sorular yükleniyor...",
    failedQuestions: "questions.json dosyası yüklenemedi.",
    explanationLabel: "Açıklama",
    noExplanation: "Açıklama bulunmuyor."
  }
};

let rawQuestionBank = [];
let questions = [];
let currentIndex = 0;
let score = 0;
const QUIZ_LENGTH = 10;

let currentUser = {
  studentId: '',
  name: ''
};

let startTime = null;
let totalTimeTaken = 0;

// Helper: Safely resolve localized vs plain strings
function getLocalized(val) {
  if (!val) return '';
  if (typeof val === 'object') {
    return val[currentLang] || val['en'] || Object.values(val)[0] || '';
  }
  return val;
}

// Helper: Safely resolve localized vs plain arrays
function getLocalizedOptions(options) {
  return Array.isArray(options) ? options : (options[currentLang] || options['en'] || []);
}

// Update UI Text elements by language
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('quiz_lang', lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const t = translations[lang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  // Inputs
  const idInput = document.getElementById('input-student-id');
  const nameInput = document.getElementById('input-name');
  if (idInput) idInput.placeholder = t.placeholderId;
  if (nameInput) nameInput.placeholder = t.placeholderName;

  // Refresh current quiz question if active
  if (!document.getElementById('quiz-screen').classList.contains('hidden') && questions[currentIndex]) {
    renderQuestion();
  }

  // Refresh results text if completed
  if (!document.getElementById('results').classList.contains('hidden')) {
    updateResultsText();
  }

  // Refresh admin questions list if opened
  if (!document.getElementById('admin-screen').classList.contains('hidden')) {
    renderAdminQuestions();
  }
}

// Language Switch Event Listeners
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyLanguage(btn.dataset.lang);
  });
});

// Fisher-Yates (Knuth) in-place shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Resilient fetch helper
async function fetchWithRetry(url, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// 1. Registration & Daily Attendance Check
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const t = translations[currentLang];
  const studentIdInput = document.getElementById('input-student-id').value.trim();
  const nameInput = document.getElementById('input-name').value.trim();
  const startBtn = document.getElementById('start-btn');
  const errorBox = document.getElementById('login-error');

  errorBox.classList.add('hidden');
  errorBox.textContent = '';

  if (!studentIdInput || !nameInput) return;

  // --- ADMIN INTERCEPT ---
  if (studentIdInput === ADMIN_ID && nameInput === ADMIN_NAME) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.remove('hidden');
    loadAdminDashboard();
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = t.checkingAttendance;

  try {
    const checkParams = new URLSearchParams({
      action: 'check',
      student_id: studentIdInput
    });

    const checkResult = await fetchWithRetry(`${GOOGLE_SCRIPT_URL}?${checkParams.toString()}`);

    if (!checkResult.allowed) {
      errorBox.textContent = checkResult.message || t.alreadyParticipated;
      errorBox.classList.remove('hidden');
      startBtn.disabled = false;
      startBtn.textContent = t.btnStart;
      return;
    }

    currentUser.studentId = studentIdInput;
    currentUser.name = nameInput;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');

    startQuiz();
  } catch (err) {
    console.error('Check failed:', err);
    errorBox.textContent = t.connectionBusy;
    errorBox.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.textContent = t.btnStart;
  }
});

// 2. Quiz Initialization & Preparation
async function startQuiz() {
  try {
    const res = await fetch('questions.json');
    rawQuestionBank = await res.json();

    const selectedSubset = shuffle([...rawQuestionBank]).slice(0, QUIZ_LENGTH);

    // Keep full question item references so we can dynamically re-translate on language change
    questions = selectedSubset.map(q => {
      // Determine option list for mapping
      const optionsArray = getLocalizedOptions(q.options);
      const indices = optionsArray.map((_, idx) => idx);
      const shuffledIndices = shuffle(indices);

      return {
        raw: q,
        correctIndex: q.correctIndex,
        shuffledIndices: shuffledIndices
      };
    });

    startTime = Date.now();
    renderQuestion();
  } catch (error) {
    document.getElementById('question-text').textContent = 'Failed to load questions.';
    console.error(error);
  }
}

function updateProgressBar() {
  const percentage = (currentIndex / questions.length) * 100;
  document.getElementById('progress-bar').style.width = `${percentage}%`;
}

function renderQuestion() {
  const q = questions[currentIndex];

  updateProgressBar();
  document.getElementById('current-q').textContent = `${currentIndex + 1} / ${questions.length}`;
  document.getElementById('question-text').textContent = getLocalized(q.raw.question);

  const container = document.getElementById('options-container');
  container.innerHTML = '';
  document.getElementById('feedback').classList.add('hidden');

  const optionsArray = getLocalizedOptions(q.raw.options);

  q.shuffledIndices.forEach((optIndex) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = optionsArray[optIndex];
    btn.onclick = () => selectOption(optIndex === q.correctIndex, btn);
    container.appendChild(btn);
  });
}

function selectOption(isCorrect, selectedBtn) {
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.disabled = true);

  if (isCorrect) {
    selectedBtn.classList.add('correct');
    score++;
  } else {
    selectedBtn.classList.add('incorrect');
  }

  document.getElementById('feedback').classList.remove('hidden');
}

document.getElementById('next-btn').onclick = () => {
  currentIndex++;
  if (currentIndex < questions.length) {
    renderQuestion();
  } else {
    finishQuiz();
  }
};

function updateResultsText() {
  const t = translations[currentLang];
  document.getElementById('score-text').textContent = `${t.scorePrefix}: ${score} / ${questions.length}`;
  document.getElementById('time-text').textContent = `${t.timePrefix} ${totalTimeTaken} ${t.timeSeconds}`;
}

function finishQuiz() {
  totalTimeTaken = Math.max(1, Math.floor((Date.now() - startTime) / 1000));

  document.getElementById('quiz-screen').classList.add('hidden');
  const results = document.getElementById('results');
  results.classList.remove('hidden');

  document.getElementById('player-greeting').textContent = `${currentUser.name} (${currentUser.studentId})`;
  updateResultsText();

  autoSaveScore();
}

// 3. Save Score to Google Sheets
async function autoSaveScore() {
  const statusEl = document.getElementById('save-status');
  const t = translations[currentLang];

  const params = new URLSearchParams({
    action: 'save',
    student_id: currentUser.studentId,
    name: currentUser.name,
    score: score.toString(),
    time: totalTimeTaken.toString()
  });

  try {
    const result = await fetchWithRetry(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);

    if (result && result.status === "success") {
      statusEl.textContent = t.statusSaved;
      statusEl.style.color = 'var(--correct)';
    } else {
      statusEl.textContent = t.statusSaveError;
      statusEl.style.color = 'var(--incorrect)';
    }
  } catch (err) {
    console.error('Error saving score:', err);
    statusEl.textContent = t.statusConnectionError;
    statusEl.style.color = 'var(--incorrect)';
  }

  fetchAndRenderLeaderboard('leaderboard-list');
}

// 4. Participant & Admin Leaderboard
async function fetchAndRenderLeaderboard(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const t = translations[currentLang];
  list.innerHTML = `<li style="color: var(--text-muted);">${t.loadingStandings}</li>`;

  try {
    const leaderboard = await fetchWithRetry(GOOGLE_SCRIPT_URL);

    list.innerHTML = '';
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      list.innerHTML = `<li style="color: var(--text-muted);">${t.noEntries}</li>`;
      return;
    }

    leaderboard.forEach((entry, index) => {
      const li = document.createElement('li');
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
      li.innerHTML = `
        <span><span class="player-rank">${medal}</span> ${escapeHTML(entry.name)}</span>
        <span class="player-stats">${entry.score}/${QUIZ_LENGTH} (${entry.time}s)</span>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li style="color: var(--text-muted);">${t.failedLeaderboard}</li>`;
    console.error(err);
  }
}

// 5. Admin Dashboard
async function loadAdminDashboard() {
  fetchAndRenderLeaderboard('admin-leaderboard-list');
  if (rawQuestionBank.length === 0) {
    try {
      const res = await fetch('questions.json');
      rawQuestionBank = await res.json();
    } catch (err) {
      console.error(err);
    }
  }
  renderAdminQuestions();
}

function renderAdminQuestions() {
  const container = document.getElementById('admin-questions-list');
  const t = translations[currentLang];

  if (!rawQuestionBank || rawQuestionBank.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">${t.loadingQuestions}</p>`;
    return;
  }

  container.innerHTML = '';

  rawQuestionBank.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'admin-question-item';

    const optionsArray = getLocalizedOptions(q.options);

    const optionsList = optionsArray.map((opt, i) => {
      const isCorrect = i === q.correctIndex;
      return `<li class="${isCorrect ? 'admin-correct-opt' : ''}">${escapeHTML(opt)} ${isCorrect ? '✓ (' + (currentLang === 'tr' ? 'Doğru' : 'Correct') + ')' : ''}</li>`;
    }).join('');

    const explanation = getLocalized(q.explanation) || t.noExplanation;

    item.innerHTML = `
      <h4>${idx + 1}. ${escapeHTML(getLocalized(q.question))}</h4>
      <ul class="admin-options-list">
        ${optionsList}
      </ul>
      <div class="admin-explanation">
        <strong>${t.explanationLabel}:</strong> ${escapeHTML(explanation)}
      </div>
    `;

    container.appendChild(item);
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize saved or default language on startup
applyLanguage(currentLang);