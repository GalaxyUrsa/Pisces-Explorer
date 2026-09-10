/** Shared timeline and playback controller for any multi-frame session. */
const TimelineController = (() => {
  let onFrameChange = null;
  let onPlaybackStop = null;
  let onPreparePlayback = null;
  let debounceTimer = null;
  let playbackRun = 0;
  let manualRun = 0;
  let activeFramePromise = null;

  function syncControls(index) {
    const select = document.getElementById("date-select");
    const slider = document.getElementById("date-slider");
    const label = document.getElementById("date-index");
    if (select) select.value = index;
    if (slider) slider.value = index;
    if (label) label.textContent = `第 ${index + 1} 帧`;
  }

  function setup(
    dates,
    callback,
    stopCallback = callback,
    prepareCallback = null,
  ) {
    stop();
    onFrameChange = callback;
    onPlaybackStop = stopCallback;
    onPreparePlayback = prepareCallback;
    const card = document.getElementById("timeline-card");
    const select = document.getElementById("date-select");
    const slider = document.getElementById("date-slider");
    const playButton = document.getElementById("play-btn");
    const visible = dates.length > 1;
    card.style.display = visible ? "" : "none";
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
    const initialIndex = Math.max(
      0, Math.min(dates.length - 1, SessionStore.state.dateIdx || 0)
    );
    slider.value = initialIndex;
    document.getElementById("date-total").textContent = `共 ${dates.length} 帧`;
    syncControls(initialIndex);
    const intervalInput = document.getElementById("play-interval");
    if (intervalInput) {
      intervalInput.value = SessionStore.state.playInterval || 3;
      intervalInput.onchange = async () => {
        SessionStore.state.playInterval = Math.max(
          1, Math.min(60, Number.parseInt(intervalInput.value) || 3)
        );
        intervalInput.value = SessionStore.state.playInterval;
        await RangeControls.save(ApiClient.fetchJson);
      };
    }

    select.onchange = async () => {
      const currentManualRun = ++manualRun;
      clearTimeout(debounceTimer);
      await stop({ waitForActive: true });
      if (currentManualRun !== manualRun) return;
      const index = parseInt(select.value);
      syncControls(index);
      await onFrameChange(index);
    };
    slider.oninput = () => {
      const index = parseInt(slider.value);
      const currentManualRun = ++manualRun;
      syncControls(index);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await stop({ waitForActive: true });
        if (currentManualRun !== manualRun) return;
        await onFrameChange(index);
      }, 150);
    };
    playButton.onclick = async () => {
      const state = SessionStore.state;
      if (state.playing || state.preparingPlayback) {
        await stop({
          waitForActive: true,
          refreshFull: state.playing,
        });
      }
      else await start();
    };
  }

  async function start() {
    const state = SessionStore.state;
    if (!state.dates.length) return;
    clearTimeout(debounceTimer);
    manualRun += 1;
    const currentRun = ++playbackRun;
    state.playing = false;
    state.preparingPlayback = true;
    const playButton = document.getElementById("play-btn");
    const status = document.getElementById("play-status");
    playButton.textContent = "取消准备";
    playButton.classList.add("playing");
    status.textContent = `正在准备 0/${state.dates.length} 帧`;

    try {
      const prepared = !onPreparePlayback || await onPreparePlayback(
        (completed, total) => {
          if (
            currentRun === playbackRun
            && state.preparingPlayback
          ) {
            status.textContent = `正在准备 ${completed}/${total} 帧`;
          }
        },
        () => (
          currentRun === playbackRun
          && state.preparingPlayback
        ),
      );
      if (
        !prepared
        || currentRun !== playbackRun
        || !state.preparingPlayback
      ) {
        return;
      }
    } catch (error) {
      console.error("播放帧准备失败", error);
      if (currentRun === playbackRun) {
        await stop();
        status.textContent = "准备失败，请重试";
      }
      return;
    }

    state.preparingPlayback = false;
    state.playing = true;
    playButton.textContent = "⏹ 停止";
    const intervalSeconds =
      parseInt(document.getElementById("play-interval")?.value || "3");
    state.playInterval = intervalSeconds;
    const intervalMs = intervalSeconds * 1000;

    async function tick() {
      if (!state.playing || currentRun !== playbackRun) return;
      const next = (state.dateIdx + 1) % state.dates.length;
      syncControls(next);
      try {
        const framePromise = Promise.resolve(onFrameChange(next));
        activeFramePromise = framePromise;
        await framePromise;
      } catch (error) {
        console.error("时间帧渲染失败", error);
        stop();
        return;
      } finally {
        activeFramePromise = null;
      }
      if (state.playing && currentRun === playbackRun) {
        state.playTimer = setTimeout(tick, intervalMs);
      }
    }
    state.playTimer = setTimeout(tick, intervalMs);
    document.getElementById("play-status").textContent =
      `${intervalSeconds}s / 帧`;
  }

  async function stop({
    waitForActive = false,
    refreshFull = false,
  } = {}) {
    const state = SessionStore.state;
    const pendingFrame = activeFramePromise;
    playbackRun += 1;
    state.playing = false;
    state.preparingPlayback = false;
    PlaybackCache.clear();
    clearTimeout(state.playTimer);
    state.playTimer = null;
    const playButton = document.getElementById("play-btn");
    const status = document.getElementById("play-status");
    if (playButton) {
      playButton.textContent = "▶ 播放";
      playButton.classList.remove("playing");
    }
    if (status) status.textContent = "";
    if (waitForActive && pendingFrame) {
      try {
        await pendingFrame;
      } catch (_error) {
        // The playback loop reports frame failures.
      }
    }
    if (refreshFull && onPlaybackStop) {
      await onPlaybackStop(state.dateIdx);
    }
  }

  return { setup, start, stop, syncControls };
})();
