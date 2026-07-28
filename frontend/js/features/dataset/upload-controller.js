/** Unified dataset selection: A determines single/series, optional B enables comparison. */
const UploadController = (() => {
  let inputA = null;
  let inputB = null;
  let loadButton = null;

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
      return { valid: false, label: "请选择数据集 A" };
    }
    if (!allNetcdf([...selectedA, ...selectedB])) {
      return { valid: false, label: "只能选择 .nc 文件" };
    }
    if (selectedB.length) {
      if (selectedA.length < 2 || selectedB.length < 2) {
        return {
          valid: false,
          label: "双序列对比要求 A、B 各至少 2 个文件",
        };
      }
      return {
        valid: true,
        mode: "comparison",
        label: `将加载双序列对比（A ${selectedA.length} 个 / B ${selectedB.length} 个）`,
      };
    }
    if (selectedA.length === 1) {
      return { valid: true, mode: "single", label: "将加载单帧数据" };
    }
    return {
      valid: true,
      mode: "series",
      label: `将加载时间序列（${selectedA.length} 帧）`,
    };
  }

  function renderFileList(elementId, selected, emptyText) {
    const element = document.getElementById(elementId);
    element.innerHTML = "";
    const summary = document.createElement("summary");
    if (!selected.length) {
      summary.textContent = emptyText;
      element.appendChild(summary);
      element.removeAttribute("open");
      element.classList.add("empty");
      return;
    }
    element.classList.remove("empty");
    summary.textContent = `已选择 ${selected.length} 个文件`;
    element.appendChild(summary);
    const list = document.createElement("ol");
    selected.forEach(file => {
      const item = document.createElement("li");
      item.textContent = file.name;
      item.title = file.name;
      list.appendChild(item);
    });
    element.appendChild(list);
  }

  function updateSelectionSummary() {
    renderFileList("dataset-a-files", files(inputA), "尚未选择文件");
    renderFileList(
      "dataset-b-files",
      files(inputB),
      "未选择，不进行双序列对比"
    );
    const detected = detectedMode();
    const modeElement = document.getElementById("detected-load-mode");
    modeElement.textContent = detected.label;
    modeElement.classList.toggle("valid", detected.valid);
    loadButton.disabled = !detected.valid;
  }

  function showEmptyWorkspace() {
    const main = document.getElementById("main-screen");
    main.classList.add("no-data");
    document.getElementById("workspace-empty").classList.remove("hidden");
    const dataCard = document.querySelector(
      '.sidebar > .side-card[data-section="data"]'
    );
    if (dataCard && typeof SidebarSections !== "undefined") {
      SidebarSections.setOpen(dataCard, true);
    }
  }

  function showWorkspace() {
    const main = document.getElementById("main-screen");
    main.classList.remove("no-data");
    document.getElementById("workspace-empty").classList.add("hidden");
    const dataCard = document.querySelector(
      '.sidebar > .side-card[data-section="data"]'
    );
    if (dataCard && typeof SidebarSections !== "undefined") {
      SidebarSections.setOpen(dataCard, false);
    }
  }

  async function enterWorkspace(label) {
    showWorkspace();
    document.getElementById("loaded-filename").textContent = `已加载：${label}`;
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await initMainScreen();
  }

  async function uploadComparison(selectedA, selectedB) {
    setUploadStatus(
      `正在处理两组序列（${selectedA.length} + ${selectedB.length} 个文件）…`,
      "loading"
    );
    const form = new FormData();
    selectedA.forEach(file => form.append("files_a", file));
    selectedB.forEach(file => form.append("files_b", file));
    const data = await ApiClient.fetchJson("/api/upload_comparison", {
      method: "POST",
      body: form,
    });
    const dropped = data.dropped_a + data.dropped_b;
    const unchangedB = data.unchanged_b_dates || [];
    const status = `已配对 ${data.dates.length} 个共同日期`
      + (dropped ? `，忽略 ${dropped} 个未配对文件` : "");
    setUploadStatus(
      unchangedB.length
        ? `${status}；序列 B 有 ${unchangedB.length} 个日期与前一帧完全相同`
        : status,
      unchangedB.length ? "error" : "success"
    );
    await enterWorkspace(
      `双序列 ${data.dates[0]} → ${data.dates[data.dates.length - 1]}`
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
    setUploadStatus(`单帧加载完成：${data.filename}`, "success");
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
    setUploadStatus(`已加载 ${data.dates.length} 帧时间序列`, "success");
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
    loadButton.disabled = true;
    try {
      if (detected.mode === "single") {
        await uploadSingle(files(inputA)[0]);
      } else if (detected.mode === "series") {
        await uploadSeries(files(inputA));
      } else {
        await uploadComparison(files(inputA), files(inputB));
      }
    } catch (error) {
      showEmptyWorkspace();
      setUploadStatus(
        `加载失败：${error.detail || error.message}`,
        "error"
      );
    } finally {
      updateSelectionSummary();
    }
  }

  function clearSelection() {
    TimelineController.stop();
    SessionStore.resetDataSession();
    ComparisonView.reset();
    inputA.value = "";
    inputB.value = "";
    document.getElementById("loaded-filename").textContent = "";
    setUploadStatus("");
    updateSelectionSummary();
    showEmptyWorkspace();
  }

  function init() {
    inputA = document.getElementById("dataset-a-input");
    inputB = document.getElementById("dataset-b-input");
    loadButton = document.getElementById("load-data-btn");
    inputA.onchange = updateSelectionSummary;
    inputB.onchange = updateSelectionSummary;
    loadButton.onclick = loadSelection;
    document.getElementById("reload-btn").onclick = clearSelection;
    updateSelectionSummary();
  }

  return {
    init,
    showEmptyWorkspace,
    showWorkspace,
    uploadSingle,
    uploadSeries,
    uploadComparison,
  };
})();
