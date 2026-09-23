let questions = [];
let currentIndex = 0;
let score = 0;

async function initQuiz() {
  const res = await fetch('questions.json');
  questions = await res.json();
  // Optional: Shuffle questions array here
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentIndex];
  document.getElementById('current-q').textContent = `${currentIndex + 1} / ${questions.length}`;
  document.getElementById('question-text').textContent = q.question;
  
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  document.getElementById('feedback').classList.add('hidden');

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.onclick = () => selectOption(idx, btn);
    container.appendChild(btn);
  });
}

function selectOption(selectedIdx, selectedBtn) {
  const q = questions[currentIndex];
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.disabled = true);

  if (selectedIdx === q.correctIndex) {
    selectedBtn.classList.add('correct');
    score++;
  } else {
    selectedBtn.classList.add('incorrect');
    allBtns[q.correctIndex].classList.add('correct');
  }

  document.getElementById('explanation-text').textContent = q.explanation;
  document.getElementById('feedback').classList.remove('hidden');
}

document.getElementById('next-btn').onclick = () => {
  currentIndex++;
  if (currentIndex < questions.length) {
    renderQuestion();
  } else {
    document.getElementById('options-container').classList.add('hidden');
    document.getElementById('feedback').classList.add('hidden');
    document.getElementById('question-text').classList.add('hidden');
    document.getElementById('progress').classList.add('hidden');
    
    const results = document.getElementById('results');
    results.classList.remove('hidden');
    document.getElementById('score-text').textContent = `You scored ${score} out of ${questions.length}!`;
  }
};

initQuiz();