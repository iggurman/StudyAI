// ── STATE ──
const state = {
  notes: JSON.parse(localStorage.getItem('notes') || '[]'),
  flashcards: [],
  quizQuestions: [],
  quizCurrent: 0,
  quizScore: 0,
  quizDifficulty: 'easy',
  chatMessages: [{ role: 'user', content: 'You are an expert AI study tutor named StudyAI. You help students understand concepts clearly, give relatable examples, break down complex ideas, and make learning fun. Keep responses focused and use markdown-style formatting when helpful.' }],
  timerInterval: null,
  timerSeconds: 25 * 60,
  timerRunning: false,
  timerMode: 'pomodoro',
  pomCount: 0,
  focusMinutes: parseInt(localStorage.getItem('focusMinutes') || '0'),
  quizCount: parseInt(localStorage.getItem('quizCount') || '0'),
  currentNoteText: '',
  currentSummaryText: ''
};

// ── INIT ──
document.getElementById('dateStr').textContent = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
updateStats();

// ── PAGE NAV ──
const pageTitles = {
  home: 'Dashboard',
  notes: 'Scan & Summarize',
  library: 'Notes Library',
  flashcards: 'Flashcards',
  quiz: 'Quiz Mode',
  chat: 'AI Tutor',
  timer: 'Focus Timer'
};

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.getAttribute('onclick') === `showPage('${page}')`) b.classList.add('active');
  });
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;
  if (page === 'library') renderLibrary();
  if (page === 'home') renderRecentNotes();
}

// ── STATS ──
function updateStats() {
  document.getElementById('statNotes').textContent = state.notes.length;
  document.getElementById('statCards').textContent = state.flashcards.length;
  document.getElementById('statQuizzes').textContent = state.quizCount;
  document.getElementById('statFocus').textContent = state.focusMinutes + 'm';
  document.getElementById('notesCount').textContent = state.notes.length;
}

// ── API CALL ──
async function callAI(prompt) {
  const API_KEY = "/api/chat"; // your Groq key

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // ✅ FIXED MODEL
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await res.json();
    console.log("Groq response:", data);

    if (data.error) {
      throw new Error(data.error.message);
    }

if (!data.choices || !data.choices[0]) {
  throw new Error("Invalid response from Groq");
}

return data.choices[0].message.content;
  } catch (err) {
    console.error("Groq ERROR:", err);
    throw err;
  }
}

// ── OCR + NOTES ──
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('⚠️ Please upload an image file', 'amber'); return; }

  const img = document.getElementById('preview-img');
  img.src = URL.createObjectURL(file);
  img.style.display = 'block';

  document.getElementById('ocrProgress').classList.remove('hidden');
  document.getElementById('notesResult').classList.add('hidden');
  document.getElementById('extractedText').textContent = '...';
  document.getElementById('summaryText').textContent = '...';

  try {
    const result = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          document.getElementById('ocrFill').style.width = pct + '%';
          document.getElementById('ocrLabel').textContent = `Recognizing text... ${pct}%`;
        }
      }
    });

    const text = result.data.text.trim();
    state.currentNoteText = text;
    document.getElementById('extractedText').textContent = text || 'No text detected.';

    if (!text || text.length < 15) {
      document.getElementById('summaryText').textContent = '⚠️ Not enough text detected. Try a clearer image.';
    } else {
      document.getElementById('ocrLabel').textContent = 'Generating AI summary...';
      let summary = "";

try {
  summary = await callAI(
    `Summarize the following text into clear bullet points:\n\n${text}`
  );
} catch (err) {
  summary = "⚠️ AI failed. See console (F12)";
}
      state.currentSummaryText = summary;
      document.getElementById('summaryText').textContent = summary;
    }

    document.getElementById('ocrProgress').classList.add('hidden');
    document.getElementById('notesResult').classList.remove('hidden');
    showToast('✅ Notes processed successfully!', 'green');
  } catch (e) {
    document.getElementById('ocrProgress').classList.add('hidden');
    showToast('❌ Error processing image', 'red');
  }
}

function saveCurrentNote() {
  const text = state.currentNoteText;
  const summary = state.currentSummaryText;
  if (!text) { showToast('⚠️ Nothing to save', 'amber'); return; }

  const note = {
    id: Date.now(),
    title: 'Note from ' + new Date().toLocaleDateString(),
    text,
    summary,
    date: new Date().toISOString()
  };
  state.notes.unshift(note);
  localStorage.setItem('notes', JSON.stringify(state.notes));
  updateStats();
  showToast('💾 Note saved to library!', 'green');
}

// ── LIBRARY ──
function renderLibrary() {
  const q = document.getElementById('notesSearch').value.toLowerCase();
  const filtered = state.notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.text.toLowerCase().includes(q) ||
    (n.summary || '').toLowerCase().includes(q)
  );
  const el = document.getElementById('libraryList');
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📚</span><p>${q ? 'No matching notes.' : 'No saved notes yet.'}</p></div>`;
    return;
  }
  el.innerHTML = filtered.map(n => `
    <div class="note-card">
      <div class="note-card-header">
        <div style="font-size:22px">📝</div>
        <div class="note-card-title">${n.title}</div>
        <span class="note-tag badge-purple" style="background:rgba(108,99,255,0.15);color:var(--accent2)">OCR</span>
        <div class="note-card-time">${new Date(n.date).toLocaleDateString()}</div>
      </div>
      <div class="note-card-preview">${n.summary || n.text}</div>
      <div class="panel-actions" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn-sm btn-ghost" onclick="deleteNote(${n.id})">🗑️ Delete</button>
        <button class="btn-sm" onclick="chatAboutNote(${n.id})" style="color:var(--text)">💬 Ask AI</button>
      </div>
    </div>
  `).join('');
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  localStorage.setItem('notes', JSON.stringify(state.notes));
  updateStats();
  renderLibrary();
  renderRecentNotes();
  showToast('🗑️ Note deleted', 'red');
}

function chatAboutNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  state.chatMessages.push({ role: 'user', content: 'I have these notes. Help me study them:\n\n' + note.text });
  showPage('chat');
  appendMsg('user', 'I have these notes. Help me study them!');
  sendAutoMessage('Analyze these notes and give me 3 key things to remember and 2 exam-style questions:\n\n' + note.text);
}

function renderRecentNotes() {
  const el = document.getElementById('recentNotes');
  if (!state.notes.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📂</span><p>No notes yet. Scan your first image to get started!</p></div>`;
    return;
  }
  el.innerHTML = state.notes.slice(0, 3).map(n => `
    <div class="note-card" onclick="showPage('library')" style="margin-bottom:10px">
      <div class="note-card-header">
        <div style="font-size:18px">📝</div>
        <div class="note-card-title">${n.title}</div>
        <div class="note-card-time">${new Date(n.date).toLocaleDateString()}</div>
      </div>
      <div class="note-card-preview">${(n.summary || n.text).slice(0, 120)}...</div>
    </div>
  `).join('');
}

// ── FROM NOTES ──
async function generateFlashcardsFromNotes() {
  if (!state.currentNoteText) { showToast('No notes to use', 'amber'); return; }
  document.getElementById('fcTopic').value = state.currentNoteText;
  showPage('flashcards');
  generateFlashcards();
}

async function generateQuizFromNotes() {
  if (!state.currentNoteText) { showToast('No notes to use', 'amber'); return; }
  document.getElementById('quizTopic').value = state.currentNoteText.slice(0, 200);
  showPage('quiz');
}

function askAboutNotes() {
  if (!state.currentNoteText) { showToast('No notes to use', 'amber'); return; }
  showPage('chat');
  appendMsg('user', 'I want to study these notes');
  sendAutoMessage('I have these notes. Give me a study breakdown with key concepts, a memory tip, and 2 practice questions:\n\n' + state.currentNoteText);
}

// ── FLASHCARDS ──
async function generateFlashcards() {
  const topic = document.getElementById('fcTopic').value.trim();
  const count = document.getElementById('fcCount').value;
  if (!topic) { showToast('Enter a topic first!', 'amber'); return; }

  showLoading('Generating flashcards...');
  try {
    const raw = await callAI(
      `Generate exactly ${count} flashcard question-answer pairs about: "${topic}". Return ONLY a JSON array like:
[{"q":"Question here","a":"Answer here"},...]
No extra text, no markdown fences, just the JSON array.`,
      'You are a flashcard generator. Return ONLY valid JSON arrays, no other text.'
    );

    let cards;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      cards = JSON.parse(clean);
    } catch {
      cards = [{ q: 'Could not parse cards', a: 'Try again with a clearer topic' }];
    }

    state.flashcards = cards;
    updateStats();
    renderFlashcards();
    showToast(`⚡ ${cards.length} flashcards generated!`, 'green');
  } catch {
    showToast('Error generating flashcards', 'red');
  }
  hideLoading();
}

function renderFlashcards() {
  const grid = document.getElementById('cardGrid');
  if (!state.flashcards.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = state.flashcards.map((c, i) => `
    <div class="flashcard" id="fc${i}" onclick="toggleCard(${i})">
      <div class="fc-num">CARD ${i + 1} OF ${state.flashcards.length}</div>
      <div class="fc-q">${c.q}</div>
      <button class="fc-reveal-btn" onclick="event.stopPropagation();toggleCard(${i})">Tap to reveal answer</button>
      <div class="fc-answer">${c.a}</div>
    </div>
  `).join('');
}

function toggleCard(i) {
  document.getElementById('fc' + i).classList.toggle('revealed');
}

function clearFlashcards() {
  state.flashcards = [];
  document.getElementById('fcTopic').value = '';
  document.getElementById('cardGrid').innerHTML = '';
  updateStats();
}

// ── QUIZ ──
let quizDifficulty = 'easy';

function selectDiff(btn, d) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  quizDifficulty = d;
}

async function startQuiz() {
  const topic = document.getElementById('quizTopic').value.trim();
  const count = parseInt(document.getElementById('quizCount').value);
  if (!topic) { showToast('Enter a topic first!', 'amber'); return; }

  showLoading('Generating quiz questions...');
  try {
    const raw = await callAI(
      `Generate exactly ${count} multiple-choice quiz questions about "${topic}" at ${quizDifficulty} difficulty level.
Return ONLY a JSON array:
[{"q":"Question?","opts":["A","B","C","D"],"correct":0,"exp":"Brief explanation why A is correct"}]
"correct" is the 0-based index of the right answer. No markdown, no extra text.`,
      'You are a quiz generator. Return ONLY valid JSON arrays, no other text.'
    );

    let qs;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      qs = JSON.parse(clean);
    } catch {
      hideLoading();
      showToast('Error parsing quiz. Try again.', 'red');
      return;
    }

    state.quizQuestions = qs;
    state.quizCurrent = 0;
    state.quizScore = 0;

    document.getElementById('quizSetup').style.display = 'none';
    document.getElementById('quizScore').style.display = 'none';
    document.getElementById('quizActive').style.display = 'block';
    renderQuizQ();
  } catch {
    showToast('Error generating quiz', 'red');
  }
  hideLoading();
}

function renderQuizQ() {
  const q = state.quizQuestions[state.quizCurrent];
  const total = state.quizQuestions.length;
  const pct = (state.quizCurrent / total) * 100;

  document.getElementById('quizProgress').style.width = pct + '%';
  document.getElementById('quizProgressLabel').textContent = `${state.quizCurrent} / ${total}`;
  document.getElementById('quizQNum').textContent = `QUESTION ${state.quizCurrent + 1} OF ${total}`;
  document.getElementById('quizQuestion').textContent = q.q;
  document.getElementById('quizExp').style.display = 'none';
  document.getElementById('nextBtn').style.display = 'none';

  document.getElementById('quizOptions').innerHTML = q.opts.map((opt, i) =>
    `<button class="quiz-opt" onclick="answerQuiz(${i})">${String.fromCharCode(65 + i)}. ${opt}</button>`
  ).join('');
}

function answerQuiz(chosen) {
  const q = state.quizQuestions[state.quizCurrent];
  const correct = q.correct;
  const btns = document.querySelectorAll('.quiz-opt');

  btns.forEach(b => b.disabled = true);
  btns[correct].classList.add('correct');
  if (chosen !== correct) {
    btns[chosen].classList.add('wrong');
  } else {
    state.quizScore++;
  }

  document.getElementById('quizExp').textContent = '💡 ' + q.exp;
  document.getElementById('quizExp').style.display = 'block';
  document.getElementById('nextBtn').style.display = 'inline-flex';
}

function nextQuizQ() {
  state.quizCurrent++;
  if (state.quizCurrent >= state.quizQuestions.length) {
    showQuizScore();
  } else {
    renderQuizQ();
  }
}

function showQuizScore() {
  state.quizCount++;
  localStorage.setItem('quizCount', state.quizCount);
  updateStats();

  document.getElementById('quizActive').style.display = 'none';
  document.getElementById('quizScore').style.display = 'block';

  const s = state.quizScore;
  const t = state.quizQuestions.length;
  const pct = Math.round((s / t) * 100);

  document.getElementById('finalScore').textContent = s;
  document.getElementById('finalTotal').textContent = '/ ' + t;
  document.getElementById('scoreMessage').textContent =
    pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good job!' : '📚 Keep studying!';
  document.getElementById('scoreSubtext').textContent =
    `You scored ${pct}% — ${pct >= 80 ? 'Outstanding performance!' : pct >= 60 ? 'Solid effort, review the tricky ones.' : 'Review the material and try again.'}`;
}

function restartQuiz() {
  document.getElementById('quizScore').style.display = 'none';
  document.getElementById('quizActive').style.display = 'none';
  document.getElementById('quizSetup').style.display = 'block';
}

// ── CHAT ──
function qpSend(el) {
  document.getElementById('userInput').value = el.textContent;
  sendMessage();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
}

function appendMsg(role, text) {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'bot' ? 'AI' : 'G'}</div>
    <div class="bubble">${text.replace(/\n/g, '<br>')}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.id = 'typing';
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-avatar">AI</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  appendMsg('user', text);
  input.value = '';
  input.style.height = 'auto';

  state.chatMessages.push({ role: 'user', content: text });
  showTyping();

  try {
    const reply = await callAI(text);
    document.getElementById('typing')?.remove();
    appendMsg('bot', reply);
    state.chatMessages.push({ role: 'assistant', content: reply });
  } catch {
    document.getElementById('typing')?.remove();
    appendMsg('bot', 'Sorry, I had trouble connecting. Please try again!');
  }
}

async function sendAutoMessage(prompt) {
  showTyping();
  try {
    const reply = await callAI(prompt);
    document.getElementById('typing')?.remove();
    appendMsg('bot', reply);
    state.chatMessages.push({ role: 'assistant', content: reply });
  } catch {
    document.getElementById('typing')?.remove();
    appendMsg('bot', 'Error getting response. Please try again.');
  }
}

// ── TIMER ──
const TIMER_CONFIGS = {
  pomodoro: { mins: 25, label: 'FOCUS SESSION', color: 'var(--accent)' },
  short:    { mins: 5,  label: 'SHORT BREAK',   color: 'var(--green)' },
  long:     { mins: 15, label: 'LONG BREAK',    color: 'var(--amber)' }
};

function setTimerMode(mode, mins, label, btn) {
  if (state.timerRunning) return;
  state.timerMode = mode;
  state.timerSeconds = mins * 60;
  document.getElementById('timerPhase').textContent = label;
  document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTimer();
}

function renderTimer() {
  const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const s = (state.timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

function toggleTimer() {
  if (state.timerRunning) {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    document.getElementById('timerToggle').textContent = '▶';
  } else {
    state.timerRunning = true;
    document.getElementById('timerToggle').textContent = '⏸';
    state.timerInterval = setInterval(() => {
      state.timerSeconds--;
      renderTimer();
      if (state.timerSeconds <= 0) {
        clearInterval(state.timerInterval);
        state.timerRunning = false;
        document.getElementById('timerToggle').textContent = '▶';
        timerDone();
      }
    }, 1000);
  }
}

function timerDone() {
  const cfg = TIMER_CONFIGS[state.timerMode];
  if (state.timerMode === 'pomodoro') {
    state.focusMinutes += cfg.mins;
    localStorage.setItem('focusMinutes', state.focusMinutes);
    state.pomCount = (state.pomCount + 1) % 4;
    updatePomDots();
    addLog('🔴 Pomodoro complete — ' + cfg.mins + ' min', 'var(--accent)');
    updateStats();
    showToast('🎉 Pomodoro done! Take a break.', 'green');
  } else {
    addLog('✅ Break complete', 'var(--green)');
    showToast('Break over! Back to work 💪', 'amber');
  }
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  document.getElementById('timerToggle').textContent = '▶';
  const cfg = TIMER_CONFIGS[state.timerMode];
  state.timerSeconds = cfg.mins * 60;
  renderTimer();
}

function skipTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  document.getElementById('timerToggle').textContent = '▶';
  timerDone();
  const cfg = TIMER_CONFIGS[state.timerMode];
  state.timerSeconds = cfg.mins * 60;
  renderTimer();
}

function startWithTask() {
  const task = document.getElementById('taskInput').value.trim();
  if (task) {
    addLog('📌 Started: ' + task, 'var(--accent2)');
    if (!state.timerRunning) toggleTimer();
  }
}

function updatePomDots() {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('dot' + i);
    d.classList.toggle('done', i < state.pomCount);
  }
}

function addLog(text, color) {
  const log = document.getElementById('sessionLog');
  if (log.children.length === 1 && log.children[0].style.textAlign === 'center') log.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'log-item';
  d.innerHTML = `<div class="log-dot" style="background:${color}"></div>${text}<span style="margin-left:auto;font-size:11px">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  log.prepend(d);
}

function clearLog() {
  document.getElementById('sessionLog').innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px">No sessions yet</div>';
}

// ── UTILS ──
function copyText(id) {
  navigator.clipboard.writeText(document.getElementById(id).textContent);
  showToast('📋 Copied!', 'green');
}

function showToast(msg, type = 'green') {
  const colors = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', purple: 'var(--accent2)' };
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${colors[type]};flex-shrink:0"></div>${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showLoading(text = 'Processing...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}
