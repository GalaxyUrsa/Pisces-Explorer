/** Unified dataset selection: A determines single/series, optional B enables comparison. */
const UploadController = (() => {
  let inputA = null;
  let inputB = null;
  let loadButton = null;
  let loading = false;
  let workspaceLoaded = false;
  let currentSession = null;
  let replacementOpen = false;

  function files(input) {
    return Array.from(input?.files || []);
  }

  function allNetcdf(selected) {
    return selected.every(file => file.name.toLowerCase().endsWith(".nc"));
  }

  function detectedMode() {
    const selectedA = files(inputA);
    const selectedB = files(inputB);
    if (!selectedA.length) {
      return {
        valid: false,
        label: selectedB.length ? "请先选择数据集 A" : "",
      };
    }
    if (!allNetcdf([...selectedA, ...selectedB])) {
      return { valid: false, label: "只能选择 .nc 文件" };
    }
    if (selectedB.length) {
      const singleComparison =
        selectedA.length === 1 && selectedB.length === 1;
      const seriesComparison =
        selectedA.length >= 2 && selectedB.length >= 2;
      if (!singleComparison && !seriesComparison) {
        return {
          valid: false,
          label: "A、B 需各选 1 个文件，或各选至少 2 个文件",
        };
      }
      return {
        valid: true,
        mode: "comparison",
        label: singleComparison ? "单帧 A/B 对比" : "双序列对比",
        buttonLabel: "开始 A/B 对比",
      };
    }
    if (selectedA.length === 1) {
      return {
        valid: true,
        mode: "single",
        label: "单帧数据",
        buttonLabel: "加载单帧数据",
      };
    }
    return {
      valid: true,
      mode: "series",
      label: `${selectedA.length} 帧时间序列`,
      buttonLabel: `加载 ${selectedA.length} 帧时间序列`,
    };
  }

  function selectionLabel(selected) {
    if (!selected.length) return "尚未选择文件";
    if (selected.length === 1) return selected[0].name;
    const dates = selected
      .map(file => file.name.match(/(\d{8})/)?.[1])
      .filter(Boolean)
      .sort();
    return dates.length
      ? `${selected.length} 个文件 · ${dates[0]} → ${dates[dates.length - 1]}`
      : `${selected.length} 个文件`;
  }

  function renderFileSelection(dataset, selected) {
    const picker = document.getElementById(`dataset-${dataset}-picker`);
    const summaryText = document.getElementById(`dataset-${dataset}-summary`);
    const action = document.getElementById(`dataset-${dataset}-action`);
    const details = document.getElementById(`dataset-${dataset}-files`);
    summaryText.textContent = selectionLabel(selected);
    action.textContent = selected.length ? "更换" : "选择文件";
    picker.classList.toggle("selected", selected.length > 0);
    details.innerHTML = "";
    details.removeAttribute("open");
    details.classList.toggle("hidden", selected.length <= 1);
    if (selected.length <= 1) return;
    const summary = document.createElement("summary");
    summary.textContent = `查看 ${selected.length} 个文件`;
    details.appendChild(summary);
    const list = document.createElement("ol");
    selected.forEach(file => {
      const item = document.createElement("li");
      item.textContent = file.name;
      item.title = file.name;
      list.appendChild(item);
    });
    details.appendChild(list);
  }

  function setBExpanded(expanded) {
    document.getElementById("dataset-b-section").classList.toggle("hidden", !expanded);
    document.getElementById("add-dataset-b").classList.toggle("hidden", expanded);
  }

  function modeLabel(session) {
    if (session?.mode === "comparison") return "A/B 对比";
    if (session?.mode === "series") return "时间序列";
    return "单帧数据";
  }

  function renderCurrentDataset(id, label, items) {
    const element = document.getElementById(id);
    element.innerHTML = "";
    const required = id === "current-dataset-a";
    element.classList.toggle("hidden", !required && !items.length);
    const title = document.createElement("strong");
    title.textContent = label;
    const summary = document.createElement("span");
    summary.textContent = !items.length
      ? "文件信息不可用，请重新加载数据"
      : items.length === 1
      ? (items[0].name || "未知文件")
      : `${items.length} 个文件`;
    element.append(title, summary);
    if (items.length > 1) {
      const details = document.createElement("details");
      const toggle = document.createElement("summary");
      toggle.textContent = "查看";
      const list = document.createElement("ol");
      items.forEach(item => {
        const row = document.createElement("li");
        row.textContent = item.name || "未知文件";
        list.appendChild(row);
      });
      details.append(toggle, list);
      element.appendChild(details);
    }
  }

  function renderSessionSummary() {
    const ready = currentSession?.ready === true;
    document.getElementById("current-session-summary").classList.toggle(
      "hidden", !ready
    );
    document.getElementById("dataset-replacement-editor").classList.toggle(
      "hidden", ready && !replacementOpen
    );
    document.getElementById("cancel-replace-btn").classList.toggle(
      "hidden", !ready
    );
    if (!ready) return;
    document.getElementById("current-session-mode").textContent = modeLabel(currentSession);
    const datasets = currentSession.datasets || { a: [], b: [] };
    renderCurrentDataset("current-dataset-a", "数据集 A", datasets.a || []);
    renderCurrentDataset("current-dataset-b", "数据集 B", datasets.b || []);
    const dates = currentSession.dates || [];
    document.getElementById("current-session-dates").textContent = !dates.length
      ? "" : dates.length === 1 ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`;
    document.getElementById("data-editor-title").textContent = "替换数据";
  }

  function resetPendingSelection() {
    inputA.value = "";
    inputB.value = "";
    setBExpanded(false);
    updateSelectionSummary({ preserveStatus: true });
  }

  function setReplacementOpen(value) {
    replacementOpen = value;
    if (!value) resetPendingSelection();
    renderSessionSummary();
  }

  function updateSelectionSummary({ preserveStatus = false } = {}) {
    const selectedA = files(inputA);
    const selectedB = files(inputB);
    if (selectedB.length) setBExpanded(true);
    renderFileSelection("a", selectedA);
    renderFileSelection("b", selectedB);
    const detected = detectedMode();
    if (!preserveStatus) {
      setUploadStatus(
        detected.valid || (!selectedA.length && !selectedB.length)
          ? "" : detected.label,
        "error"
      );
    }
    if (!loading) {
      loadButton.textContent = detected.buttonLabel || "请选择数据";
      loadButton.disabled = !detected.valid;
    }
  }

  function setLoading(value) {
    loading = value;
    inputA.disabled = value;
    inputB.disabled = value;
    document.getElementById("add-dataset-b").disabled = value;
    document.getElementById("remove-dataset-b").disabled = value;
    document.getElementById("dataset-a-picker").classList.toggle("disabled", value);
    document.getElementById("dataset-b-picker").classList.toggle("disabled", value);
    if (value) {
      loadButton.disabled = true;
      loadButton.textContent = "正在加载…";
    }
  }

  function showEmptyWorkspace() {
    currentSession = null;
    workspaceLoaded = false;
    replacementOpen = false;
    const main = document.getElementById("main-screen");
    main.classList.add("no-data");
    document.getElementById("workspace-empty").classList.remove("hidden");
    if (inputA) renderSessionSummary();
    PiscesUIEvents.workspace({ ready: false });
  }

  function showWorkspace() {
    const main = document.getElementById("main-screen");
    main.classList.remove("no-data");
    document.getElementById("workspace-empty").classList.add("hidden");
  }

  async function enterWorkspace(label) {
    workspaceLoaded = true;
    showWorkspace();
    document.getElementById("loaded-filename").textContent = `已加载：${label}`;
    currentSession = await ApiClient.fetchJson("/api/status");
    replacementOpen = false;
    resetPendingSelection();
    renderSessionSummary();
    PiscesUIEvents.workspace({
      ready: true,
      label: currentSession.label || label,
      mode: modeLabel(currentSession),
    });
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await initMainScreen();
  }

  async function uploadComparison(selectedA, selectedB) {
    const singleComparison =
      selectedA.length === 1 && selectedB.length === 1;
    setUploadStatus("正在处理 A/B 对比…", "loading");
    const form = new FormData();
    selectedA.forEach(file => form.append("files_a", file));
    selectedB.forEach(file => form.append("files_b", file));
    const data = await ApiClient.fetchJson("/api/upload_comparison", {
      method: "POST",
      body: form,
    });
    setUploadStatus("");
    await enterWorkspace(
      singleComparison
        ? `单日对比 ${data.dates[0]}`
        : `双序列 ${data.dates[0]} → ${data.dates[data.dates.length - 1]}`
    );
  }

  async function uploadSingle(file) {
    setUploadStatus("正在处理单帧数据…", "loading");
    const form = new FormData();
    form.append("file", file);
    const data = await ApiClient.fetchJson("/api/upload", {
      method: "POST",
      body: form,
    });
    setUploadStatus("");
    await enterWorkspace(data.filename);
  }

  async function uploadSeries(selected) {
    setUploadStatus(`正在处理 ${selected.length} 帧时间序列…`, "loading");
    const form = new FormData();
    selected.forEach(file => form.append("files", file));
    const data = await ApiClient.fetchJson("/api/upload_series", {
      method: "POST",
      body: form,
    });
    setUploadStatus("");
    await enterWorkspace(
      `时间序列 ${data.dates[0]} → ${data.dates[data.dates.length - 1]}`
    );
  }

  async function loadSelection() {
    const detected = detectedMode();
    if (!detected.valid) {
      setUploadStatus(detected.label, "error");
      return;
    }
    setLoading(true);
    let failed = false;
    try {
      if (detected.mode === "single") {
        await uploadSingle(files(inputA)[0]);
      } else if (detected.mode === "series") {
        await uploadSeries(files(inputA));
      } else {
        await uploadComparison(files(inputA), files(inputB));
      }
    } catch (error) {
      failed = true;
      if (!currentSession?.ready) {
        workspaceLoaded = false;
        showEmptyWorkspace();
      }
      setUploadStatus(
        `加载失败：${error.detail || error.message}`,
        "error"
      );
    } finally {
      setLoading(false);
      updateSelectionSummary({ preserveStatus: failed });
    }
  }

  async function clearSelection() {
    TimelineController.stop();
    try {
      await ApiClient.fetchJson("/api/session", { method: "DELETE" });
      SessionStore.resetDataSession();
      ComparisonView.reset();
      currentSession = null;
      workspaceLoaded = false;
      replacementOpen = false;
      resetPendingSelection();
      document.getElementById("loaded-filename").textContent = "";
      document.getElementById("data-editor-title").textContent = "数据加载";
      setUploadStatus("");
      renderSessionSummary();
      showEmptyWorkspace();
    } catch (error) {
      setUploadStatus(`清空失败：${error.detail || error.message}`, "error");
    }
  }

  async function restoreSession(session) {
    currentSession = session;
    workspaceLoaded = session?.ready === true;
    replacementOpen = false;
    renderSessionSummary();
    if (!workspaceLoaded) {
      showEmptyWorkspace();
      return;
    }
    showWorkspace();
    document.getElementById("loaded-filename").textContent = session.label
      ? `已加载：${session.label}` : "已加载数据";
    PiscesUIEvents.workspace({
      ready: true,
      label: session.label || "已加载数据",
      mode: modeLabel(session),
    });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await initMainScreen();
  }

  function init() {
    inputA = document.getElementById("dataset-a-input");
    inputB = document.getElementById("dataset-b-input");
    loadButton = document.getElementById("load-data-btn");
    inputA.onchange = updateSelectionSummary;
    inputB.onchange = updateSelectionSummary;
    loadButton.onclick = loadSelection;
    document.getElementById("reload-btn").onclick = clearSelection;
    document.getElementById("replace-data-btn").onclick = () => {
      setReplacementOpen(true);
      setUploadStatus("");
    };
    document.getElementById("cancel-replace-btn").onclick = () => {
      setReplacementOpen(false);
      setUploadStatus("");
    };
    document.getElementById("add-dataset-b").onclick = () => {
      setBExpanded(true);
      setUploadStatus("");
    };
    document.getElementById("remove-dataset-b").onclick = () => {
      inputB.value = "";
      setBExpanded(false);
      updateSelectionSummary();
    };
    updateSelectionSummary();
  }

  return {
    init,
    showEmptyWorkspace,
    showWorkspace,
    uploadSingle,
    uploadSeries,
    uploadComparison,
    restoreSession,
  };
})();
