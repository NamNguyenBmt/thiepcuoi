/**
 * Trang trò chơi đoán bài hát, nhân bản từ bản thiết kế trên Canva.
 *
 * Đã bỏ các script SDK của Canva, Tailwind và Lucide (chỉ dùng cho một icon
 * trái tim — thay bằng SVG nội tuyến). Nhạc lấy từ kho `/api/assets` của web.
 */
export const GAME_HTML = /* html */ `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đoán Bài Hát Cưới</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;600;700;800&amp;family=Playfair+Display:wght@600;700;800&amp;display=swap" rel="stylesheet">
  <style>
    :root{
      --ink:#422d30;
      --plum:#5b3540;
      --muted:#80656a;
      --ivory:#fffaf1;
      --rose:#bd7777;
      --champagne:#c69b5a;
      --gold:#aa7b39;
      --shadow:0 20px 55px rgba(91,53,64,.12);
    }

    *{box-sizing:border-box}
    html{background:var(--ivory)}
    body{
      width:100%;
      min-height:100vh;
      min-height:100dvh;
      margin:0;
      overflow-x:hidden;
      color:var(--ink);
      font-family:"Alegreya Sans",sans-serif;
      background:linear-gradient(125deg,#fffdf8,#fcf1e6,#f2ddd9);
    }

    button{font:inherit;touch-action:manipulation}
    button:focus-visible{
      outline:3px solid var(--rose);
      outline-offset:4px;
    }

    .wedding-stage{
      position:relative;
      isolation:isolate;
      width:100%;
      min-height:100vh;
      min-height:100dvh;
      overflow:hidden;
      background:
        radial-gradient(circle at 10% 12%,rgba(255,255,255,.92) 0 2px,transparent 3px),
        radial-gradient(circle at 76% 10%,rgba(198,155,90,.18) 0 2px,transparent 4px),
        radial-gradient(circle at 90% 72%,rgba(231,183,178,.28) 0 3px,transparent 5px),
        linear-gradient(125deg,#fffdf8 0%,#fcf1e6 47%,#f2ddd9 100%);
      background-size:58px 58px,86px 86px,103px 103px,auto;
    }

    .wedding-stage::before,
    .wedding-stage::after{
      content:"";
      position:absolute;
      z-index:-1;
      pointer-events:none;
      border:1px solid rgba(170,123,57,.18);
      border-radius:48% 52% 66% 34% / 42% 43% 57% 58%;
    }

    .wedding-stage::before{
      width:40rem;height:40rem;left:-21rem;top:-17rem;transform:rotate(22deg);
    }

    .wedding-stage::after{
      width:36rem;height:36rem;right:-18rem;bottom:-19rem;
      border-color:rgba(189,119,119,.22);
      transform:rotate(-18deg);
    }

    .title-font{font-family:"Playfair Display",serif}

    .game-shell{
      width:min(1160px,calc(100% - 2.5rem));
      min-height:100vh;
      min-height:100dvh;
      margin:auto;
      padding:1.5rem 0 2.5rem;
      display:flex;
      flex-direction:column;
    }

    .topbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      padding-bottom:1rem;
    }

    .kicker{
      margin:0 0 .3rem;
      color:var(--rose);
      font-size:18px;
      font-weight:800;
      letter-spacing:.12rem;
      text-transform:uppercase;
    }

    .round-pill{
      display:inline-flex;
      align-items:center;
      padding:.4rem .92rem;
      border:1px solid rgba(170,123,57,.35);
      border-radius:999px;
      color:var(--plum);
      background:rgba(255,253,248,.7);
      font-weight:800;
    }

    .progress-track{
      height:8px;
      overflow:hidden;
      border-radius:999px;
      background:rgba(91,53,64,.12);
      box-shadow:inset 0 1px 2px rgba(91,53,64,.12);
    }

    .progress-fill{
      height:100%;
      border-radius:inherit;
      background:linear-gradient(90deg,#bf7d7b,#d8b36f,#a8793b);
      transition:width .4s ease;
    }

    .game-grid{
      display:grid;
      grid-template-columns:minmax(290px,.95fr) minmax(300px,1.05fr);
      align-items:center;
      gap:clamp(2rem,6vw,6rem);
      flex:1;
      padding:1.5rem 0 .5rem;
    }

    .game-copy{animation:rise .65s both}
    .record-zone{display:grid;place-items:center;animation:rise .65s .12s both}

    .eyebrow{
      display:inline-flex;
      align-items:center;
      gap:.45rem;
      padding:.44rem 1rem;
      border:1px solid rgba(170,123,57,.38);
      border-radius:999px;
      background:rgba(255,253,248,.64);
      color:var(--gold);
      font-size:18px;
      font-weight:700;
      letter-spacing:.13em;
      text-transform:uppercase;
    }

    .eyebrow svg{width:1rem;height:1rem}

    .game-title{
      margin:.9rem 0 1.15rem;
      color:var(--ink);
      font-size:36px;
      font-weight:800;
      line-height:1.04;
    }

    .status-card{
      display:inline-flex;
      align-items:center;
      gap:.6rem;
      min-height:44px;
      padding:.6rem .9rem;
      border-left:3px solid var(--champagne);
      border-radius:0 13px 13px 0;
      color:#785c5e;
      background:rgba(255,253,248,.7);
      box-shadow:0 7px 18px rgba(91,53,64,.06);
      font-size:18px;
      font-weight:700;
    }

    .status-dot{
      width:.62rem;
      height:.62rem;
      flex:none;
      border-radius:50%;
      background:var(--rose);
    }

    .status-card.is-playing .status-dot{
      background:#87965a;
      animation:pulse 1.2s infinite;
    }

    .status-text{display:none}
    .status-text.is-visible{display:inline}
    #status-error{color:#a44445}

    .answer-card{
      width:100%;
      max-width:570px;
      min-height:134px;
      margin-top:1.55rem;
      padding:1.15rem;
      border:1px solid rgba(198,155,90,.52);
      border-radius:17px;
      background:rgba(255,252,245,.79);
      box-shadow:var(--shadow);
    }

    .answer-button{
      width:100%;
      min-height:98px;
      padding:1rem 1.2rem;
      border:0;
      border-radius:12px;
      cursor:pointer;
      background:linear-gradient(135deg,#fff8e9,#f5deda);
      color:#79555a;
      box-shadow:inset 0 0 0 1px rgba(170,123,57,.2);
      transition:transform .18s ease,filter .18s ease;
    }

    .answer-button:hover{transform:translateY(-2px);filter:brightness(1.015)}
    .answer-button:active{transform:translateY(1px)}

    .answer-hidden,
    .answer-revealed{display:none}

    .answer-hidden.is-visible,
    .answer-revealed.is-visible{display:block}

    .answer-hidden{font-size:22px;font-weight:700}

    .answer-revealed{
      text-align:center;
      animation:answerReveal .45s ease both;
    }

    .answer-label{
      margin:0;
      color:var(--rose);
      font-size:18px;
      font-weight:800;
      letter-spacing:.12em;
      text-transform:uppercase;
    }

    .answer-song{
      margin:.35rem 0 0;
      color:var(--plum);
      font-size:25px;
      font-weight:700;
      line-height:1.15;
    }

    .hint-copy{
      margin:.75rem 0 0;
      color:#765b50;
      font-size:18px;
      font-weight:700;
    }

    .audio-error{
      display:none;
      min-height:26px;
      margin-top:.8rem;
      color:#a44445;
      font-size:18px;
      font-weight:700;
    }

    .audio-error.is-visible{display:block}

    .action-row{
      display:flex;
      flex-wrap:wrap;
      gap:.75rem;
      margin-top:1.2rem;
    }

    .primary-action{
      min-height:54px;
      border:0;
      border-radius:999px;
      padding:.75rem 1.35rem;
      cursor:pointer;
      color:#fff;
      background:linear-gradient(135deg,#80515a,#5b3540);
      box-shadow:0 12px 24px rgba(91,53,64,.22);
      font-size:18px;
      font-weight:800;
      transition:transform .18s ease,box-shadow .18s ease;
    }

    .primary-action:hover{transform:translateY(-2px)}
    .primary-action:active{transform:translateY(1px)}

    .button-label{display:none}
    .button-label.is-visible{display:inline}

    .record-stack{
      position:relative;
      display:grid;
      place-items:center;
      width:min(72vw,495px);
      aspect-ratio:1;
    }

    .record-plinth{
      position:absolute;
      bottom:5%;
      width:91%;
      height:26%;
      border-radius:50%;
      background:linear-gradient(145deg,#e9d1a8,#b98846 52%,#f5e7ca);
      box-shadow:0 26px 35px rgba(93,55,42,.24),inset 0 2px 7px rgba(255,255,255,.8);
    }

    .record-shadow{
      position:absolute;
      width:82%;
      aspect-ratio:1;
      border-radius:50%;
      background:rgba(53,31,31,.28);
      filter:blur(20px);
      transform:translate(12px,17px);
    }

    .vinyl{
      position:relative;
      z-index:2;
      display:grid;
      place-items:center;
      width:88%;
      aspect-ratio:1;
      border:10px solid #cba363;
      border-radius:50%;
      cursor:pointer;
      background:repeating-radial-gradient(circle at center,#171416 0 4px,#292225 5px 6px,#151214 7px 10px);
      box-shadow:inset 0 0 0 2px rgba(255,255,255,.13),inset 8px 0 21px rgba(255,255,255,.04),0 22px 31px rgba(52,28,28,.27);
      transition:transform .2s ease;
    }

    .vinyl::before{
      content:"";
      position:absolute;
      inset:9%;
      border:1px solid rgba(235,204,142,.3);
      border-radius:inherit;
    }

    .vinyl:hover{transform:scale(1.018)}
    .vinyl.is-spinning{animation:spin 2.7s linear infinite}

    .record-label{
      position:relative;
      display:grid;
      place-items:center;
      width:36%;
      aspect-ratio:1;
      border:6px solid #eed397;
      border-radius:50%;
      background:radial-gradient(circle at 35% 25%,#dba2a0,#9f6063 67%,#744148);
      color:#fff8ed;
      text-align:center;
      font-family:"Playfair Display",serif;
      font-size:clamp(.85rem,2vw,1.2rem);
      font-weight:700;
      line-height:1.06;
      box-shadow:0 0 0 3px #70434a;
    }

    .record-hole{
      position:absolute;
      width:14px;
      aspect-ratio:1;
      border:3px solid #e8d5ac;
      border-radius:50%;
      background:#27191b;
    }

    .tap-hint{
      position:absolute;
      z-index:4;
      bottom:0;
      left:50%;
      width:max-content;
      max-width:90%;
      padding:.48rem .9rem;
      border-radius:999px;
      transform:translateX(-50%);
      color:#fff;
      background:rgb(72,42,45);
      box-shadow:0 8px 20px rgba(69,41,43,.2);
      font-size:18px;
      font-weight:700;
      cursor:pointer;
    }

    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{50%{transform:scale(1.5);opacity:.5}}
    @keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes answerReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    @media(max-width:760px){
      .game-shell{width:min(100% - 1.5rem,640px);padding-top:1rem}
      .game-grid{grid-template-columns:1fr;padding:1.2rem 0 1.5rem}
      .game-copy{text-align:center}
      .record-zone{order:-1}
      .record-stack{width:min(79vw,390px)}
      .status-card{text-align:left}
      .action-row{justify-content:center}
    }
  </style>
</head>
<body>
  <div class="wedding-stage">
    <main class="game-shell" aria-labelledby="game-title">
      <header class="topbar">
        <div>
          <p class="kicker">ĐOÁN GIAI ĐIỆU</p>
          <span id="round-label" class="round-pill" aria-live="polite">Vòng 1/5</span>
        </div>
        <div class="eyebrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>Wedding Music Game</span>
        </div>
      </header>
      <div class="progress-track" aria-label="Tiến trình trò chơi">
        <div id="progress-fill" class="progress-fill" style="width:20%"></div>
      </div>
      <section class="game-grid">
        <div class="game-copy">
          <h1 id="game-title" class="title-font game-title">Nghe giai điệu và đoán thử!</h1>
          <div id="status-card" class="status-card" aria-live="polite">
            <span class="status-dot"></span>
            <span id="status-ready" class="status-text is-visible">▶ Phát nhạc</span>
            <span id="status-playing" class="status-text">Ⅱ Tạm dừng</span>
            <span id="status-paused" class="status-text">▶ Phát tiếp</span>
            <span id="status-error" class="status-text">Không thể tải nhạc</span>
          </div>
          <section class="answer-card" aria-label="Khu vực mở đáp án">
            <button id="answer-button" class="answer-button" type="button" aria-expanded="false">
              <span id="answer-hidden" class="answer-hidden is-visible">Đáp án là: ........</span>
              <div id="answer-one" class="answer-revealed">
                <p class="answer-label">Đáp án là</p>
                <h2 class="title-font answer-song">Đám cưới trên đường quê</h2>
              </div>
              <div id="answer-two" class="answer-revealed">
                <p class="answer-label">Đáp án là</p>
                <h2 class="title-font answer-song">Ngày xuân vui cưới</h2>
              </div>
              <div id="answer-three" class="answer-revealed">
                <p class="answer-label">Đáp án là</p>
                <h2 class="title-font answer-song">Một nhà</h2>
              </div>
              <div id="answer-four" class="answer-revealed">
                <p class="answer-label">Đáp án là</p>
                <h2 class="title-font answer-song">Em đồng ý</h2>
              </div>
              <div id="answer-five" class="answer-revealed">
                <p class="answer-label">Đáp án là</p>
                <h2 class="title-font answer-song">Bài này không để đi diễn</h2>
              </div>
            </button>
          </section>
          <p class="hint-copy">Bấm vào dòng đáp án để mở tên bài hát.</p>
          <p id="audio-error-message" class="audio-error" role="status">Không tải được audio. Hãy bấm lại vào đĩa để thử lại.</p>
          <div class="action-row">
            <button id="next-button" class="primary-action" type="button">
              <span id="next-label" class="button-label is-visible">Vòng tiếp theo</span>
              <span id="restart-label" class="button-label">Chơi lại từ đầu</span>
            </button>
          </div>
        </div>
        <div class="record-zone">
          <div class="record-stack">
            <div class="record-plinth"></div>
            <div class="record-shadow"></div>
            <button id="vinyl-button" class="vinyl" type="button" aria-label="Phát nhạc">
              <span class="record-label">LOVE<br>SONGS</span>
              <span class="record-hole"></span>
            </button>
            <div id="record-hint" class="tap-hint" role="button" tabindex="0">Bấm vào đĩa để phát nhạc</div>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script>
    const rounds = [
      { audioUrl: "/api/assets/uploads/7e1659b8-117c-48ec-95b7-eb71031b7d98.mp3", answerId: "answer-one" },
      { audioUrl: "/api/assets/uploads/9feae10d-a764-4bef-9520-841b4e5065ae.mp3", answerId: "answer-two" },
      { audioUrl: "/api/assets/uploads/bb896dfa-387b-4c99-90cb-a5992b385a20.mp3", answerId: "answer-three" },
      { audioUrl: "/api/assets/uploads/4dd6433c-c7a1-4558-bdcd-f0258aa510c3.mp3", answerId: "answer-four" },
      { audioUrl: "/api/assets/uploads/1d104573-2b6b-4ae6-95b6-2edb3761b690.mp3", answerId: "answer-five" }
    ];

    const state = { currentRound: 0, audio: null, audioState: "ready" };

    const el = (id) => document.getElementById(id);
    const answerIds = rounds.map((round) => round.answerId);

    function setAudioStatus(nextState) {
      state.audioState = nextState;

      ["ready", "playing", "paused", "error"].forEach((name) => {
        el("status-" + name).classList.toggle("is-visible", name === nextState);
      });

      const isPlaying = nextState === "playing";
      el("status-card").classList.toggle("is-playing", isPlaying);
      el("vinyl-button").classList.toggle("is-spinning", isPlaying);

      const ariaLabels = {
        ready: "Phát nhạc",
        playing: "Tạm dừng nhạc",
        paused: "Phát tiếp nhạc",
        error: "Thử tải lại nhạc"
      };

      el("vinyl-button").setAttribute("aria-label", ariaLabels[nextState]);
    }

    function showAudioError(show) {
      el("audio-error-message").classList.toggle("is-visible", show);
    }

    function stopAndResetAudio() {
      if (state.audio) {
        state.audio.removeEventListener("ended", handleAudioEnded);
        state.audio.removeEventListener("error", handleAudioError);
        state.audio.pause();
        state.audio.currentTime = 0;
        state.audio.removeAttribute("src");
        state.audio.load();
      }

      state.audio = null;
      setAudioStatus("ready");
      showAudioError(false);
    }

    function resetAnswer() {
      el("answer-hidden").classList.add("is-visible");
      answerIds.forEach((id) => el(id).classList.remove("is-visible"));
      el("answer-button").setAttribute("aria-expanded", "false");
    }

    function revealCurrentAnswer() {
      el("answer-hidden").classList.remove("is-visible");
      answerIds.forEach((id) => el(id).classList.remove("is-visible"));
      el(rounds[state.currentRound].answerId).classList.add("is-visible");
      el("answer-button").setAttribute("aria-expanded", "true");
    }

    function updateRoundUI() {
      const number = state.currentRound + 1;
      const isLastRound = number === rounds.length;

      el("round-label").textContent = "Vòng " + number + "/" + rounds.length;
      el("progress-fill").style.width = (number / rounds.length * 100) + "%";

      el("next-label").classList.toggle("is-visible", !isLastRound);
      el("restart-label").classList.toggle("is-visible", isLastRound);

      resetAnswer();
      setAudioStatus("ready");
      showAudioError(false);
    }

    function handleAudioEnded() {
      setAudioStatus("ready");
    }

    function handleAudioError() {
      setAudioStatus("error");
      showAudioError(true);
    }

    function getCurrentAudio() {
      if (!state.audio) {
        state.audio = new Audio(rounds[state.currentRound].audioUrl);
        state.audio.preload = "none";
        state.audio.addEventListener("ended", handleAudioEnded);
        state.audio.addEventListener("error", handleAudioError);
      }
      return state.audio;
    }

    async function toggleAudio() {
      const audio = getCurrentAudio();
      showAudioError(false);

      if (!audio.paused) {
        audio.pause();
        setAudioStatus("paused");
        return;
      }

      try {
        if (audio.readyState === 0) audio.load();
        await audio.play();
        setAudioStatus("playing");
      } catch (error) {
        setAudioStatus("error");
        showAudioError(true);
      }
    }

    el("vinyl-button").addEventListener("click", toggleAudio);
    el("record-hint").addEventListener("click", toggleAudio);
    el("record-hint").addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleAudio();
      }
    });

    el("answer-button").addEventListener("click", revealCurrentAnswer);

    el("next-button").addEventListener("click", () => {
      stopAndResetAudio();
      state.currentRound = (state.currentRound + 1) % rounds.length;
      updateRoundUI();
    });

    updateRoundUI();
  </script>
</body>
</html>
`;
