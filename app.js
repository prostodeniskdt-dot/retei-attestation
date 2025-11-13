// Простое SPA на ванильном JS
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Элементы
const loginEl = $("#login");
const welcomeEl = $("#welcome");
const quizEl = $("#quiz");
const reportEl = $("#report");

const empNameInput = $("#empName");
const empRoleInput = $("#empRole");
const loginBtn = $("#loginBtn");

const startBtn = $("#startBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const finishBtn = $("#finishBtn");

const timerEl = $("#timer");
const progressText = $("#progressText");
const questionText = $("#questionText");
const answersEl = $("#answers");

const shareBtn = $("#shareBtn");
const printBtn = $("#printBtn");
const resetBtn = $("#resetBtn");

const reportMetaEl = $("#reportMeta");
const reportSummaryEl = $("#reportSummary");
const reportDetailsEl = $("#reportDetails");

const STORAGE_KEY = "retei_exam_v1";

let state = {
  employee: null,  // {name, role}
  startedAt: null, // timestamp (ms)
  finishedAt: null,
  currentIndex: 0,
  answers: {},     // {questionId: answerText}
  order: [],       // shuffled question ids
  questions: [],
};

// Таймер: 30 минут
const DURATION_MS = 30 * 60 * 1000;
let tickInterval = null;

function loadPersisted(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try { state = JSON.parse(raw); } catch(e){}
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMMSS(msRem){
  const totalSec = Math.max(0, Math.floor(msRem / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2,"0");
  const ss = (totalSec % 60).toString().padStart(2,"0");
  return `${mm}:${ss}`;
}

function updateTimer(){
  if(!state.startedAt){
    timerEl.textContent = "30:00";
    return;
  }
  const elapsed = Date.now() - state.startedAt;
  const remaining = Math.max(0, DURATION_MS - elapsed);
  timerEl.textContent = formatMMSS(remaining);
}

function startTicking(){
  if(tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(updateTimer, 250);
  updateTimer();
}

function show(section){
  // hide all
  [loginEl, welcomeEl, quizEl, reportEl].forEach(el => el.classList.add("hidden"));
  section.classList.remove("hidden");
}

async function loadQuestions(){
  const res = await fetch("./data/questions.json?" + Date.now());
  const json = await res.json();
  state.questions = json;
}

// Перемешивание (Fisher-Yates)
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startExam(){
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.currentIndex = 0;
  state.answers = {};
  state.order = shuffle(state.questions.map(q => q.id));
  persist();
  renderQuestion();
  show(quizEl);
  startTicking();
}

function renderQuestion(){
  const qid = state.order[state.currentIndex];
  const q = state.questions.find(x => x.id === qid);
  if(!q) return;
  progressText.textContent = `Вопрос ${state.currentIndex+1} / ${state.questions.length}`;
  questionText.textContent = q.text;

  // соберём варианты и перемешаем
  const shuffled = shuffle(q.answers);
  answersEl.innerHTML = "";
  shuffled.forEach(ans => {
    const div = document.createElement("div");
    div.className = "answer";
    div.textContent = ans.text;
    if(state.answers[q.id] === ans.text){
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      state.answers[q.id] = ans.text;
      persist();
      renderQuestion();
    });
    answersEl.appendChild(div);
  });

  prevBtn.disabled = state.currentIndex === 0;
  nextBtn.disabled = state.currentIndex >= state.questions.length - 1;
}

function goPrev(){
  if(state.currentIndex > 0){
    state.currentIndex--;
    persist();
    renderQuestion();
  }
}
function goNext(){
  if(state.currentIndex < state.questions.length - 1){
    state.currentIndex++;
    persist();
    renderQuestion();
  }
}

function isTimeFailed(){
  if(!state.startedAt) return false;
  const elapsed = (state.finishedAt ?? Date.now()) - state.startedAt;
  return elapsed > DURATION_MS;
}

function finishExam(){
  state.finishedAt = Date.now();
  persist();
  buildReport();
  show(reportEl);
  if(tickInterval) clearInterval(tickInterval);
  updateTimer(); // freeze display
}

function buildReport(){
  // собрать результаты
  const meta = [];
  meta.push(`<div><b>Сотрудник:</b> ${state.employee?.name ?? "—"}</div>`);
  meta.push(`<div><b>Должность:</b> ${state.employee?.role ?? "—"}</div>`);
  const started = new Date(state.startedAt).toLocaleString();
  const finished = new Date(state.finishedAt).toLocaleString();
  meta.push(`<div><b>Начал(а):</b> ${started}</div>`);
  meta.push(`<div><b>Закончил(а):</b> ${finished}</div>`);
  const elapsedMs = state.finishedAt - state.startedAt;
  meta.push(`<div><b>Затраченное время:</b> ${formatMMSS(elapsedMs)}</div>`);
  if(isTimeFailed()){
    meta.push(`<div><b>Статус времени:</b> <span class="wrong">Провалено (превышено 30 минут)</span></div>`);
  } else {
    meta.push(`<div><b>Статус времени:</b> Уложился(лась) в 30 минут</div>`);
  }
  reportMetaEl.innerHTML = `<div class="meta">${meta.join("")}</div>`;

  let correct = 0;
  const details = [];
  state.questions.forEach((q, i) => {
    const selected = state.answers[q.id];
    const right = q.answers.find(a => a.correct)?.text;
    const ok = selected === right;
    if(ok) correct++;
    details.push(`
      <div class="detail">
        <div class="q"><b>${i+1}.</b> ${q.text}</div>
        <div class="a ${ok ? "correct" : "wrong"}">
          Ваш ответ: ${selected ? selected : "<i>не выбран</i>"} ${ok ? "✓" : "✗"}
        </div>
        <div class="r">Верный ответ: <b>${right}</b></div>
      </div>
    `);
  });
  const total = state.questions.length;
  const pct = Math.round((correct/total)*100);
  reportSummaryEl.innerHTML = `<div class="summary">
    <div><b>Итог:</b> ${correct} из ${total} (${pct}%)</div>
  </div>`;
  reportDetailsEl.innerHTML = details.join("");
}

function resetAll(){
  // Полный сброс
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

async function init(){
  loadPersisted();
  await loadQuestions();

  // Если пользователь уже залогинен
  if(state.employee){
    // Если уже начинали и не закончили — продолжаем
    if(state.startedAt && !state.finishedAt){
      startTicking();
      show(quizEl);
      renderQuestion();
    } else if(state.finishedAt){
      show(reportEl);
      buildReport();
      updateTimer();
    } else {
      show(welcomeEl);
    }
  } else {
    show(loginEl);
  }
  updateTimer();
}

loginBtn.addEventListener("click", () => {
  const name = empNameInput.value.trim();
  const role = empRoleInput.value.trim();
  if(!name){
    alert("Введите имя сотрудника");
    return;
  }
  state.employee = {name, role};
  persist();
  show(welcomeEl);
});

startBtn.addEventListener("click", () => {
  if(state.startedAt && !state.finishedAt){
    // Уже идёт — просто покажем тест
    show(quizEl);
    renderQuestion();
    return;
  }
  startExam();
});

prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);
finishBtn.addEventListener("click", finishExam);

printBtn.addEventListener("click", () => {
  window.print();
});

shareBtn.addEventListener("click", async () => {
  // Поделиться текстом итога; файл PDF пользователь может приложить после «Скачать PDF»
  const started = new Date(state.startedAt).toLocaleString();
  const finished = new Date(state.finishedAt).toLocaleString();
  const total = state.questions.length;
  const correct = Object.keys(state.answers).reduce((acc, qid) => {
    const q = state.questions.find(x => x.id === qid);
    const right = q?.answers.find(a=>a.correct)?.text;
    return acc + (state.answers[qid] === right ? 1 : 0);
  }, 0);
  const pct = Math.round((correct/total)*100);
  const timeStatus = isTimeFailed() ? "Провалено по времени" : "Уложился(лась) в 30 минут";

  const text = `Аттестация «Рётэй»\nСотрудник: ${state.employee?.name} (${state.employee?.role})\nНачал(а): ${started}\nЗакончил(а): ${finished}\nИтог: ${correct}/${total} (${pct}%)\nСтатус времени: ${timeStatus}`;

  try{
    if(navigator.share){
      await navigator.share({ title: "Отчёт — Аттестация «Рётэй»", text });
    }else{
      await navigator.clipboard.writeText(text);
      alert("Итог скопирован в буфер обмена. Вставьте его в мессенджер и приложите PDF.");
    }
  }catch(e){
    console.error(e);
    alert("Не удалось поделиться. Попробуйте скопировать вручную после «Скачать PDF».");
  }
});

resetBtn.addEventListener("click", resetAll);

init();
