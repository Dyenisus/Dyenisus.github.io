let questions = [];
let currentIndex = 0;
let score = 0;

// Fisher-Yates (Knuth) in-place shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function initQuiz() {
  try {
    const res = await fetch('questions.json');
    const data = await res.json();

    // 1. Shuffle question pool order
    questions = shuffle(data).map(q => {
      // 2. Map options with correctness flag so position doesn't break scoring
      const pairedOptions = q.options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.correctIndex
      }));

      // 3. Shuffle options internally
      return {
        ...q,
        shuffledOptions: shuffle(pairedOptions)
      };
    });

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
    // Highlight the correct answer
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
    // Fill progress bar on completion
    document.getElementById('progress-bar').style.width = '100%';

    // Hide gameplay UI
    document.getElementById('quiz-header').classList.add('hidden');
    document.getElementById('options-container').classList.add('hidden');
    document.getElementById('feedback').classList.add('hidden');

    // Display summary
    const results = document.getElementById('results');
    results.classList.remove('hidden');
    document.getElementById('score-text').textContent = `You scored ${score} out of ${questions.length}!`;
  }
};

initQuiz();