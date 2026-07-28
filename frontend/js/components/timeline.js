/** Shared timeline and playback controller for any multi-frame session. */
const TimelineController = (() => {
  let onFrameChange = null;
  let debounceTimer = null;
  let playbackRun = 0;

  function syncControls(index) {
    const select = document.getElementById("date-select");
    const slider = document.getElementById("date-slider");
    const label = document.getElementById("date-index");
    if (select) select.value = index;
    if (slider) slider.value = index;
    if (label) label.textContent = `第 ${index + 1} 帧`;
  }

  function setup(dates, callback) {
    onFrameChange = callback;
    const card = document.getElementById("timeline-card");
    const select = document.getElementById("date-select");
    const slider = document.getElementById("date-slider");
    const playButton = document.getElementById("play-btn");
    const visible = dates.length > 1;
    card.style.display = visible ? "" : "none";
    stop();
    if (!visible) return;

    select.innerHTML = "";
    dates.forEach((date, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent =
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      select.appendChild(option);
    });
    slider.max = dates.length - 1;
    slider.value = 0;
    document.getElementById("date-total").textContent = `共 ${dates.length} 帧`;
    syncControls(0);

    select.onchange = () => {
      const index = parseInt(select.value);
      syncControls(index);
      onFrameChange(index);
    };
    slider.oninput = () => {
      const index = parseInt(slider.value);
      syncControls(index);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onFrameChange(index), 150);
    };
    playButton.onclick = () => {
      if (SessionStore.state.playing) stop();
      else start();
    };
  }

  function start() {
    const state = SessionStore.state;
    if (!state.dates.length) return;
    const currentRun = ++playbackRun;
    state.playing = true;
    const playButton = document.getElementById("play-btn");
    playButton.textContent = "⏹ 停止";
    playButton.classList.add("playing");
    const intervalSeconds =
      parseInt(document.getElementById("play-interval")?.value || "3");
    const intervalMs = intervalSeconds * 1000;

    async function tick() {
      if (!state.playing || currentRun !== playbackRun) return;
      const next = (state.dateIdx + 1) % state.dates.length;
      syncControls(next);
      try {
        await onFrameChange(next);
      } catch (error) {
        console.error("时间帧渲染失败", error);
        stop();
        return;
      }
      if (state.playing && currentRun === playbackRun) {
        state.playTimer = setTimeout(tick, intervalMs);
      }
    }
    state.playTimer = setTimeout(tick, intervalMs);
    document.getElementById("play-status").textContent =
      `${intervalSeconds}s / 帧`;
  }

  function stop() {
    const state = SessionStore.state;
    playbackRun += 1;
    state.playing = false;
    clearTimeout(state.playTimer);
    state.playTimer = null;
    const playButton = document.getElementById("play-btn");
    const status = document.getElementById("play-status");
    if (playButton) {
      playButton.textContent = "▶ 播放";
      playButton.classList.remove("playing");
    }
    if (status) status.textContent = "";
  }

  return { setup, start, stop, syncControls };
})();
