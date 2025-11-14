// SPA: фиксированный порядок ответов, завершение через «Далее» и более надёжная печать PDF
const $ = (s) => document.querySelector(s);

// Экраны и элементы
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

const STORAGE_KEY = "retei_exam_v3";

let state = {
  employee: null,
  startedAt: null,
  finishedAt: null,
  currentIndex: 0,
  answers: {},        // {questionId: answerText}
  order: [],          // порядок вопросов
  answerOrder: {},    // {questionId: [answerText...]} — фиксированный порядок вариантов
  questions: [],
};

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
  [loginEl, welcomeEl, quizEl, reportEl].forEach(el => el.classList.add("hidden"));
  section.classList.remove("hidden");
}

async function loadQuestions(){
  const res = await fetch("./data/questions.json?" + Date.now());
  const json = await res.json();
  state.questions = json;
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureAnswerOrder(){
  // создаём фиксированный порядок ответов для каждого вопроса один раз при старте
  state.answerOrder = {};
  state.questions.forEach(q => {
    const fixed = shuffle(q.answers).map(a => a.text);
    state.answerOrder[q.id] = fixed;
  });
}

function startExam(){
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.currentIndex = 0;
  state.answers = {};
  state.order = shuffle(state.questions.map(q => q.id));
  ensureAnswerOrder();
  persist();
  renderQuestion();
  show(quizEl);
  startTicking();
}

function getQuestionByIndex(i){
  const qid = state.order[i];
  return state.questions.find(x => x.id === qid);
}

function renderQuestion(){
  const q = getQuestionByIndex(state.currentIndex);
  if(!q) return;
  progressText.textContent = `Вопрос ${state.currentIndex+1} / ${state.questions.length}`;
  questionText.textContent = q.text;

  const fixedTexts = state.answerOrder[q.id]; // массив текстов в фиксированном порядке
  answersEl.innerHTML = "";
  fixedTexts.forEach(txt => {
    const ans = q.answers.find(a => a.text === txt);
    const div = document.createElement("div");
    div.className = "answer";
    div.textContent = ans.text;
    if(state.answers[q.id] === ans.text){
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      state.answers[q.id] = ans.text;
      persist();
      // просто перерисуем выделение без смены порядка
      renderQuestion();
    });
    answersEl.appendChild(div);
  });

  // Кнопки навигации
  prevBtn.disabled = state.currentIndex === 0;
  if(state.currentIndex >= state.questions.length - 1){
    nextBtn.textContent = "Закончить";
  }else{
    nextBtn.textContent = "Далее";
  }
}

function goPrev(){
  if(state.currentIndex > 0){
    state.currentIndex--;
    persist();
    renderQuestion();
  }
}
function goNextOrFinish(){
  if(state.currentIndex >= state.questions.length - 1){
    finishExam();
  } else {
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

function buildEmployeeLine(){
  const name = state.employee?.name?.trim();
  const role = state.employee?.role?.trim();
  if(!name && !role) return "—";
  if(name && !role) return name;
  if(!name && role) return role;
  return `${name} (${role})`;
}

function finishExam(){
  state.finishedAt = Date.now();
  persist();
  buildReport();
  show(reportEl);
  if(tickInterval) clearInterval(tickInterval);
  updateTimer();
}

function buildReport(){
  const meta = [];
  const empLine = buildEmployeeLine();
  meta.push(`<div><b>Сотрудник:</b> ${empLine}</div>`);
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
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

async function init(){
  loadPersisted();
  await loadQuestions();

  if(state.employee){
    if(state.startedAt && !state.finishedAt){
      startTicking();
      show(quizEl);
      if(!state.answerOrder || Object.keys(state.answerOrder).length === 0){
        ensureAnswerOrder();
      }
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

// Печать / PDF: более надёжный вариант с отдельным окном
function printReport(){
  const reportNode = document.querySelector("#report");
  if(!reportNode){
    alert("Отчёт не найден");
    return;
  }
  const html = reportNode.innerHTML;

  const win = window.open("", "_blank");
  if(!win){
    alert("Браузер заблокировал всплывающее окно. Разрешите его, чтобы скачать PDF.");
    return;
  }

  const doc = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Отчёт — Аттестация «Рётэй»</title>
  <style>
    body{
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', 'PT Sans', sans-serif;
      margin:20px;
      color:#000;
    }
    h2{ margin-top:0; }
    .correct{ color:#0a7d00; }
    .wrong{ color:#b00020; }
    .detail{ margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:6px; }
    .q{ margin-bottom:2px; }
    .a,.r{ font-size:14px; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

  win.document.open();
  win.document.write(doc);
  win.document.close();
  win.focus();
  if(typeof win.print === "function"){
    win.print();
  }
}

// Слушатели
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
    show(quizEl);
    renderQuestion();
    return;
  }
  startExam();
});

prevBtn.addEventListener("click", () => goPrev());
nextBtn.addEventListener("click", () => goNextOrFinish());
finishBtn.addEventListener("click", () => finishExam());

printBtn.addEventListener("click", printReport);

shareBtn.addEventListener("click", async () => {
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
  const empLine = buildEmployeeLine();

  const text = `Аттестация «Рётэй»\nСотрудник: ${empLine}\nНачал(а): ${started}\nЗакончил(а): ${finished}\nИтог: ${correct}/${total} (${pct}%)\nСтатус времени: ${timeStatus}`;

  try{
    if(navigator.share){
      await navigator.share({ title: "Отчёт — Аттестация «Рётэй»", text });
    }else if(navigator.clipboard){
      await navigator.clipboard.writeText(text);
      alert("Итог скопирован в буфер обмена. Вставьте его в мессенджер и приложите PDF.");
    }else{
      alert(text);
    }
  }catch(e){
    console.error(e);
    alert("Не удалось поделиться. Попробуйте скопировать вручную после формирования отчёта.");
  }
});

resetBtn.addEventListener("click", resetAll);

init();
