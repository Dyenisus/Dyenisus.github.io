// Paste your Google Apps Script Web App URL ending in /exec here:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycfDwI82WDzeYH-6j2JusKcPpEvRl84tCcUxy0EGz6HBMLZi41MiuoPMsEOWB8uIpE/exec";

let questions = [];
let currentIndex = 0;
let score = 0;
const QUIZ_LENGTH = 10;

// User Credentials
let currentUser = {
  studentId: '',
  name: ''
};

let startTime = null;
let totalTimeTaken = 0;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 1. Registration Screen Handler
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  currentUser.studentId = document.getElementById('input-student-id').value.trim();
  currentUser.name = document.getElementById('input-name').value.trim();

  if (!currentUser.studentId || !currentUser.name) return;

  // Switch views
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.remove('hidden');

  startQuiz();
});

async function startQuiz() {
  try {
    const res = await fetch('questions.json');
    const data = await res.json();

    const selectedSubset = shuffle(data).slice(0, QUIZ_LENGTH);

    questions = selectedSubset.map(q => {
      const pairedOptions = q.options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.correctIndex
      }));

      return {
        ...q,
        shuffledOptions: shuffle(pairedOptions)
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
  document.getElementById('question-text').textContent = q.question;

  const container = document.getElementById('options-container');
  container.innerHTML = '';
  document.getElementById('feedback').classList.add('hidden');

  q.shuffledOptions.forEach((optObj) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = optObj.text;
    btn.onclick = () => selectOption(optObj, btn);
    container.appendChild(btn);
  });
}

function selectOption(selectedOpt, selectedBtn) {
  const allBtns = document.querySelectorAll('.option-btn');
  const q = questions[currentIndex];

  allBtns.forEach(b => b.disabled = true);

  if (selectedOpt.isCorrect) {
    selectedBtn.classList.add('correct');
    score++;
  } else {
    selectedBtn.classList.add('incorrect');
    q.shuffledOptions.forEach((opt, idx) => {
      if (opt.isCorrect) {
        allBtns[idx].classList.add('correct');
      }
    });
  }

  document.getElementById('explanation-text').textContent = q.explanation;
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

function finishQuiz() {
  totalTimeTaken = Math.max(1, Math.floor((Date.now() - startTime) / 1000));

  // Hide quiz screen, show results screen
  document.getElementById('quiz-screen').classList.add('hidden');
  const results = document.getElementById('results');
  results.classList.remove('hidden');

  document.getElementById('player-greeting').textContent = `${currentUser.name} (${currentUser.studentId})`;
  document.getElementById('score-text').textContent = `Score: ${score} / ${questions.length}`;
  document.getElementById('time-text').textContent = `Completed in ${totalTimeTaken} seconds`;

  // Auto-record the score to Google Sheets
  autoSaveScore();
}

async function autoSaveScore() {
  const statusEl = document.getElementById('save-status');

  const params = new URLSearchParams({
    action: 'save',
    student_id: currentUser.studentId,
    name: currentUser.name,
    score: score.toString(),
    time: totalTimeTaken.toString()
  });

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const result = await res.json();

    if (result.status === "success") {
      statusEl.textContent = '✅ Recorded to club leaderboard!';
      statusEl.style.color = 'var(--correct)';
    } else {
      statusEl.textContent = '⚠️ Could not save score.';
      statusEl.style.color = 'var(--incorrect)';
    }
  } catch (err) {
    console.error('Error saving score:', err);
    statusEl.textContent = '⚠️ Connection error while saving score.';
    statusEl.style.color = 'var(--incorrect)';
  }

  displayLeaderboard();
}

async function displayLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<li style="color: var(--text-muted);">Loading live standings...</li>';

  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE")) {
    list.innerHTML = '<li style="color: var(--text-muted);">Configure GOOGLE_SCRIPT_URL in app.js.</li>';
    return;
  }

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const leaderboard = await res.json();

    list.innerHTML = '';
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      list.innerHTML = '<li style="color: var(--text-muted);">No entries yet! Be the first.</li>';
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
    list.innerHTML = '<li style="color: var(--text-muted);">Failed to load leaderboard.</li>';
    console.error(err);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
