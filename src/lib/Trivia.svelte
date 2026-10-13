<script>
  // trivia.dat — one question at a time, from Open Trivia DB.
  //
  // Nothing is fetched until you ask. The endpoint is keyless and CORS-open,
  // and a single question is about a kilobyte. It serves both kinds of
  // question — `multiple` (four answers) and `boolean` (true / false) — so
  // there is a small switch between them, plus a mixed mode that picks one at
  // random each time.
  //
  // The API answers in html entities by default; `encode=url3986` asks for
  // percent-encoded text instead, which decodeURIComponent unwraps cleanly.
  // It also rate-limits to roughly one request a second and says so with
  // response_code 5 — that is shown as a friendly "slow down", not an error.

  import { unlock } from "./achievements.svelte.js";
  import { readStore, writeStore, share } from "./share.svelte.js";
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  const API = "https://opentdb.com/api.php";

  const MODES = [
    { id: "mixed", label: "mixed" },
    { id: "multiple", label: "multiple choice" },
    { id: "boolean", label: "true / false" },
  ];

  let mode = $state("mixed");
  let phase = $state("idle"); // idle | loading | error | asking | answered
  let question = $state(null);
  let picked = $state(null);
  let note = $state(""); // the friendly line shown when a fetch does not land

  // a small tally for the visit. not persisted — see the README.
  let asked = $state(0);
  let right = $state(0);
  let streak = $state(0);

  // which kinds of question you have answered this visit, for the "both
  // kinds" trophy. like the tally, it is not kept across reloads.
  const kinds = new Set();

  // The tally above is for this visit. This is the one thing trivia keeps
  // between visits: the run of *days* on which you got at least one
  // question right. A wrong answer does not break it — only a missed day
  // does — so it is a reason to come back rather than a reason to stop
  // guessing. Kept under `yours.trivia`, plainly, like a high score.
  const STREAK_KEY = "yours.trivia";

  // the visitor's own day, as a sortable key — the same shape the encounter
  // store uses, so the day turns at local midnight rather than at UTC.
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  // the day before a key, stepped on the calendar rather than by subtracting
  // 86 400 000 ms, so a daylight-saving shift cannot skip or repeat a day.
  function dayBefore(key) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return dayKey(dt);
  }

  // `last` is the last day you got one right, `run` how many days in a row
  // that reached. Read back only if it looks the part.
  function loadStreak() {
    try {
      const raw = JSON.parse(readStore(STREAK_KEY) || "null");
      if (
        raw &&
        typeof raw.last === "string" &&
        raw.last &&
        Number.isInteger(raw.run) &&
        raw.run > 0
      )
        return { last: raw.last, run: raw.run };
    } catch {
      /* private mode, or nothing stored yet */
    }
    return { last: "", run: 0 };
  }

  function saveStreak() {
    writeStore(STREAK_KEY, JSON.stringify({ last: lastDay, run: daysRun }));
  }

  const stored = loadStreak();
  let lastDay = $state(stored.last);
  let daysRun = $state(stored.run);

  // entering or leaving guest mode swaps the streak for the sharer's
  $effect(() => {
    share.payload;
    const s = loadStreak();
    lastDay = s.last;
    daysRun = s.run;
  });

  const today = dayKey();
  const yesterday = dayBefore(today);

  // The run is only live if it reaches today or yesterday. Miss a day and it
  // has lapsed, so the chip reads nothing until you answer again — better a
  // quiet zero than a streak you did not keep.
  const daysLive = $derived(
    lastDay === today || lastDay === yesterday ? daysRun : 0,
  );

  // advance the run once you get one right today. the day is read fresh
  // here rather than reused from the constants above, so an answer just
  // after local midnight still lands on the new day.
  function creditDay() {
    const day = dayKey();
    if (lastDay === day) return; // already counted today
    daysRun = lastDay === dayBefore(day) ? daysRun + 1 : 1;
    lastDay = day;
    saveStreak();
    if (daysRun >= 3) unlock("trivia-regular");
  }

  const decode = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };

  // fisher-yates, so the right answer is not always in the same seat
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shape(r) {
    const correct = decode(r.correct_answer);
    return {
      category: decode(r.category),
      difficulty: r.difficulty,
      type: r.type,
      text: decode(r.question),
      correct,
      answers: shuffle([...r.incorrect_answers.map(decode), correct]),
    };
  }

  async function ask() {
    phase = "loading";
    picked = null;
    note = "";
    try {
      const type =
        mode === "mixed"
          ? Math.random() < 0.5
            ? "multiple"
            : "boolean"
          : mode;
      const res = await fetch(`${API}?amount=1&type=${type}&encode=url3986`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data.response_code === 5) {
        note = "the machine asks for a moment between questions.";
        phase = "error";
        return;
      }
      if (data.response_code !== 0 || !data.results?.length) {
        note = "no question came back. try again?";
        phase = "error";
        return;
      }
      question = shape(data.results[0]);
      phase = "asking";
    } catch {
      note = "the machine is offline — probably napping.";
      phase = "error";
    }
  }

  function pick(answer) {
    if (phase !== "asking" || picked) return;
    picked = answer;
    phase = "answered";
    asked++;
    unlock("trivia-first");
    if (answer === question.correct) {
      right++;
      streak++;
      creditDay();
      unlock("trivia-correct");
      if (streak >= 5) unlock("trivia-streak");
      if (question.difficulty === "hard") unlock("trivia-hard");
      if (right >= 10) unlock("trivia-scholar");
    } else {
      streak = 0;
    }
    // both kinds, within this visit
    kinds.add(question.type);
    if (kinds.has("multiple") && kinds.has("boolean")) unlock("trivia-both");
  }

  function setMode(id) {
    if (mode === id) return;
    mode = id;
    // a question already on screen no longer matches the new type
    if (phase === "asking" || phase === "answered") ask();
  }
</script>

<section class="panel" id="trivia" class:min={windowState("trivia") === "min"}>
  <div class="panel__bar">
    <span class="panel__title">trivia.dat</span>
    <WinBtns id="trivia" />
  </div>

  <div class="panel__body quiz">
    <div class="quiz__modes" role="group" aria-label="question type">
      <span class="quiz__modes-label">type</span>
      {#each MODES as m}
        <button
          class="quiz__mode"
          class:on={mode === m.id}
          onclick={() => setMode(m.id)}
          aria-pressed={mode === m.id}
        >
          {m.label}
        </button>
      {/each}
      {#if daysLive > 0}
        <span
          class="quiz__streak"
          title="days in a row you have answered a question right — miss a day and it starts again"
        >
          <b>{daysLive}</b> day streak
        </span>
      {/if}
    </div>

    {#if phase === "idle"}
      <div class="quiz__screen">
        <p class="quiz__wait">a question is waiting.</p>
      </div>
      <div class="quiz__actions">
        <button class="btn" onclick={ask}>ask me something</button>
        <p class="quiz__note">
          one question, one small request, only when you ask. nothing is fetched
          until you press it.
        </p>
      </div>
    {:else if phase === "loading"}
      <div class="quiz__screen">
        <p class="quiz__wait"><span class="cursor"></span> thinking…</p>
      </div>
    {:else if phase === "error"}
      <div class="quiz__screen">
        <p class="quiz__wait quiz__wait--err">{note}</p>
      </div>
      <div class="quiz__actions">
        <button class="btn" onclick={ask}>try again</button>
      </div>
    {:else if question}
      <div class="quiz__screen">
        <div class="quiz__meta">
          <span class="quiz__cat">{question.category}</span>
          <span class="quiz__diff">{question.difficulty}</span>
        </div>
        <p class="quiz__q">{question.text}</p>
      </div>

      <ul class="quiz__answers">
        {#each question.answers as a}
          <li>
            <button
              class="answer"
              class:correct={picked !== null && a === question.correct}
              class:wrong={picked === a && a !== question.correct}
              class:faded={picked !== null &&
                a !== question.correct &&
                picked !== a}
              disabled={picked !== null}
              onclick={() => pick(a)}
            >
              <span class="answer__mark" aria-hidden="true">
                {picked !== null && a === question.correct
                  ? "✓"
                  : picked === a
                    ? "✕"
                    : ""}
              </span>
              <span class="answer__text">{a}</span>
            </button>
          </li>
        {/each}
      </ul>

      {#if picked !== null}
        <p class="quiz__verdict" class:ok={picked === question.correct}>
          {#if picked === question.correct}
            ✓ correct
          {:else}
            ✕ not quite — it was <b>{question.correct}</b>
          {/if}
        </p>
      {/if}

      <div class="quiz__actions">
        <button class="btn" onclick={ask}>
          {picked !== null ? "next question" : "skip this one"}
        </button>
        {#if asked > 0}
          <p class="quiz__tally">
            {right} / {asked} right{#if streak > 1}
              · {streak} in a row{/if}
          </p>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .quiz {
    display: grid;
    gap: 12px;
  }

  .quiz__modes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .quiz__modes-label {
    margin-right: 2px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .quiz__mode {
    padding: 4px 10px;
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .quiz__mode:hover {
    color: var(--ink);
    border-color: var(--line-hot);
  }
  .quiz__mode.on {
    color: var(--violet);
    background: color-mix(in srgb, var(--violet) 12%, transparent);
    border-color: color-mix(in srgb, var(--violet) 50%, transparent);
    box-shadow: 0 0 14px -4px color-mix(in srgb, var(--violet) 70%, transparent);
  }

  /* the day-streak chip, pushed to the right of the type row. it shows
     whenever the run reaches today or yesterday, even before you answer,
     so it is a nudge to keep it going. */
  .quiz__streak {
    margin-left: auto;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 3px 10px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
    border-radius: 999px;
  }
  .quiz__streak b {
    font-family: var(--pixel);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }

  .quiz__screen {
    position: relative;
    display: grid;
    gap: 10px;
    align-content: center;
    min-height: 96px;
    padding: 16px;
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    background:
      radial-gradient(
        120% 90% at 50% 130%,
        color-mix(in srgb, var(--violet) 16%, transparent),
        transparent 62%
      ),
      linear-gradient(180deg, var(--bg-2), var(--bg));
    box-shadow: inset 0 0 40px -16px
      color-mix(in srgb, var(--violet) 50%, transparent);
    overflow: hidden;
  }

  .quiz__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .quiz__cat {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--violet);
  }
  .quiz__diff {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .quiz__q {
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 17px;
    line-height: 1.45;
    color: var(--ink);
  }
  .quiz__wait {
    margin: 0;
    font-family: var(--pixel);
    font-size: 19px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .quiz__wait--err {
    color: var(--orange);
  }

  .quiz__answers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 7px;
  }
  .answer {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    text-align: left;
    font-family: var(--mono);
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--ink-dim);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      transform 0.12s ease,
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;
  }
  .answer:hover:not(:disabled) {
    transform: translateX(3px);
    color: var(--ink);
    border-color: var(--line-hot);
    background: rgba(255, 255, 255, 0.05);
  }
  .answer:disabled {
    cursor: default;
  }
  .answer__mark {
    flex: 0 0 1em;
    font-weight: 700;
    text-align: center;
  }
  .answer__text {
    min-width: 0;
  }
  .answer.correct {
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 12%, transparent);
    border-color: color-mix(in srgb, var(--lime) 55%, transparent);
    box-shadow: 0 0 16px -5px color-mix(in srgb, var(--lime) 70%, transparent);
  }
  .answer.wrong {
    color: var(--orange);
    background: color-mix(in srgb, var(--orange) 12%, transparent);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }
  .answer.faded {
    opacity: 0.45;
  }

  .quiz__verdict {
    margin: 0;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.05em;
    color: var(--orange);
  }
  .quiz__verdict.ok {
    color: var(--lime);
    text-shadow: var(--glow-lime);
  }
  .quiz__verdict b {
    color: var(--ink);
    font-weight: 400;
  }

  .quiz__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .quiz__note {
    flex: 1 1 200px;
    margin: 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }
  .quiz__tally {
    margin: 0;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  @media (max-width: 620px) {
    .quiz__q {
      font-size: 15.5px;
    }
  }
</style>
