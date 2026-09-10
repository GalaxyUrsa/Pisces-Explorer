/** Persistent Simulator and Inference page workflows. */
const ModelWorkflows = (() => {
  const STORAGE_KEYS = {
    simulator: "pisces.workflow.simulator.v1",
    inference: "pisces.workflow.inference.v1",
  };
  const FORM_FIELDS = {
    simulator: [
      "simulator-phenomenon",
      "simulator-input-source",
      "simulator-hub-input",
      "simulator-lon",
      "simulator-lat",
      "simulator-radius",
      "simulator-amplitude",
      "simulator-depth",
      "simulator-kind",
      "simulator-decay",
    ],
    inference: [
      "inference-model",
      "inference-input-source",
      "inference-hub-input",
      "inference-weights-source",
      "inference-hub-weights",
      "inference-steps",
      "inference-device",
      "inference-start-date",
      "inference-amp",
    ],
  };

  function emptyRecord() {
    return {
      form: {},
      files: {},
      task: { status: "idle" },
    };
  }

  function loadRecord(kind) {
    try {
      return {
        ...emptyRecord(),
        ...JSON.parse(localStorage.getItem(STORAGE_KEYS[kind]) || "{}"),
      };
    } catch {
      return emptyRecord();
    }
  }

  function saveRecord(kind, record) {
    localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(record));
  }

  function setStatus(id, message, type = "") {
    const element = document.getElementById(id);
    element.textContent = message;
    element.className = `workflow-status${type ? ` ${type}` : ""}`;
  }

  function value(id) {
    return document.getElementById(id).value;
  }

  function selectedHubReference(id) {
    const selected = value(id);
    if (!selected) return null;
    try {
      return JSON.parse(selected);
    } catch {
      return null;
    }
  }

  function setSourceVisibility(sourceId, localId, hubId) {
    const useHub = value(sourceId) === "hub";
    document.getElementById(localId).classList.toggle("hidden", useHub);
    document.getElementById(hubId).classList.toggle("hidden", !useHub);
  }

  function setResult(id, items) {
    const element = document.getElementById(id);
    element.replaceChildren();
    items.forEach(({ tag, text }) => {
      const child = document.createElement(tag);
      child.textContent = text;
      element.appendChild(child);
    });
    element.classList.remove("hidden");
  }

  function captureDraft(kind, record) {
    FORM_FIELDS[kind].forEach(id => {
      const element = document.getElementById(id);
      record.form[id] = element.type === "checkbox"
        ? element.checked
        : element.value;
    });
    if (kind === "simulator") {
      const file = document.getElementById("simulator-input").files[0];
      if (file) record.files.input = file.name;
    } else {
      const input = document.getElementById("inference-input").files[0];
      const weights = document.getElementById("inference-weights").files[0];
      if (input) record.files.input = input.name;
      if (weights) record.files.weights = weights.name;
    }
    saveRecord(kind, record);
    showRememberedFiles(kind, record);
  }

  function restoreDraft(kind, record) {
    FORM_FIELDS[kind].forEach(id => {
      const element = document.getElementById(id);
      if (!(id in record.form)) return;
      if (element.type === "checkbox") {
        element.checked = Boolean(record.form[id]);
      } else {
        element.value = record.form[id];
      }
    });
    showRememberedFiles(kind, record);
  }

  function showRememberedFile(id, filename) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = filename
      ? `上次选择：${filename}（重新运行时需要再次选择文件）`
      : "";
  }

  function showRememberedFiles(kind, record) {
    if (kind === "simulator") {
      showRememberedFile("simulator-input-memory", record.files.input);
      return;
    }
    showRememberedFile("inference-input-memory", record.files.input);
    showRememberedFile("inference-weights-memory", record.files.weights);
  }

  function bindDraftPersistence(kind, record) {
    FORM_FIELDS[kind].forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener("change", () => captureDraft(kind, record));
      element.addEventListener("input", () => captureDraft(kind, record));
    });
    const fileIds = kind === "simulator"
      ? ["simulator-input"]
      : ["inference-input", "inference-weights"];
    fileIds.forEach(id => {
      document.getElementById(id).addEventListener(
        "change",
        () => captureDraft(kind, record)
      );
    });
  }

  function populateNetcdfSelect(selectId, assets, selectedValue) {
    const select = document.getElementById(selectId);
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = assets.length
      ? "请选择 Pisces-Hub 数据"
      : "Pisces-Hub 中暂无 NetCDF";
    select.appendChild(placeholder);
    assets.forEach(asset => {
      const members = asset.kind === "series"
        ? asset.files.map(item => item.filename)
        : [null];
      members.forEach(member => {
        const option = document.createElement("option");
        option.value = JSON.stringify({ id: asset.id, member });
        option.textContent = asset.kind === "series"
          ? `推理 ${asset.name} / ${member}`
          : `${asset.source === "simulator" ? "模拟" : "数据"} / ${asset.name}`;
        select.appendChild(option);
      });
    });
    if ([...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    }
  }

  function populateModelSelect(selectId, assets, selectedValue) {
    const select = document.getElementById(selectId);
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = assets.length
      ? "请选择 Pisces-Hub 权重"
      : "Pisces-Hub 中暂无模型权重";
    select.appendChild(placeholder);
    assets.forEach(asset => {
      const option = document.createElement("option");
      option.value = JSON.stringify({ id: asset.id });
      option.textContent = asset.name;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    }
  }

  function formatBytes(size) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function historyParameterItems(kind, asset) {
    const parameters = asset.parameters;
    if (!parameters || !Object.keys(parameters).length) {
      return ["旧记录 · 参数未保存"];
    }
    if (kind === "simulator") {
      return [
        `中心 ${parameters.longitude}°, ${parameters.latitude}°`,
        `半径 ${parameters.radius_km} km`,
        `振幅 ${parameters.amplitude_cm} cm`,
        `深度 ${parameters.influence_depth_m} m`,
        `结构 ${parameters.kind}`,
        `衰减 ${parameters.vertical_decay}`,
      ];
    }
    return [
      `模型 ${parameters.model}`,
      `权重 ${asset.weights?.filename || "未知"}`,
      `预测 ${parameters.steps} 天`,
      `设备 ${parameters.device}`,
      `AMP ${parameters.amp ? "开启" : "关闭"}`,
      `起始日期 ${parameters.start_date || "自动"}`,
    ];
  }

  async function loadHistoryIntoExplorer(kind, asset) {
    setStatus(`${kind}-status`, "正在载入历史结果…", "loading");
    try {
      await ApiClient.fetchJson(
        `/api/hub/assets/${encodeURIComponent(asset.id)}/load`,
        { method: "POST" }
      );
      window.location.href = "/";
    } catch (error) {
      setStatus(
        `${kind}-status`,
        `载入失败：${error.detail || error.message}`,
        "error"
      );
    }
  }

  async function removeHistoryAsset(kind, asset, record) {
    const confirmed = window.confirm(
      `确定删除 Pisces-Hub 历史记录“${asset.name}”吗？此操作不可恢复。`
    );
    if (!confirmed) return;
    try {
      await ApiClient.fetchJson(
        `/api/hub/assets/${encodeURIComponent(asset.id)}`,
        { method: "DELETE" }
      );
      const result = record.task.result;
      const isCurrent = result && (
        result.filename === asset.name || result.run_id === asset.name
      );
      if (isCurrent) {
        record.task = { status: "idle" };
        saveRecord(kind, record);
        hidePreviousResult(kind);
      }
      setStatus(`${kind}-status`, "历史记录已从 Pisces-Hub 删除。", "success");
      await refreshHubAssets(kind, record);
    } catch (error) {
      setStatus(
        `${kind}-status`,
        `删除失败：${error.detail || error.message}`,
        "error"
      );
    }
  }

  function renderHistory(kind, assets, record) {
    const container = document.getElementById(`${kind}-history`);
    container.replaceChildren();
    const history = assets.filter(asset => asset.source === kind);
    if (!history.length) {
      const empty = document.createElement("p");
      empty.className = "workflow-history-empty";
      empty.textContent = "暂无历史记录。";
      container.appendChild(empty);
      return;
    }
    history.forEach(asset => {
      const row = document.createElement("article");
      row.className = "workflow-history-item";
      const info = document.createElement("div");
      info.className = "workflow-history-info";
      const title = document.createElement("strong");
      title.textContent = asset.name;
      const detail = document.createElement("small");
      const count = asset.kind === "series"
        ? `${asset.files.length} 帧 · `
        : "";
      detail.textContent = `${count}${formatBytes(asset.size_bytes)} · ${
        new Date(asset.created_at_ms).toLocaleString()
      }`;
      const parameters = document.createElement("div");
      parameters.className = "workflow-history-parameters";
      historyParameterItems(kind, asset).forEach(text => {
        const item = document.createElement("span");
        item.textContent = text;
        parameters.appendChild(item);
      });
      const input = asset.input?.filename;
      if (input) {
        const source = document.createElement("small");
        source.className = "workflow-history-source";
        source.textContent = `输入：${input}`;
        info.append(title, detail, parameters, source);
      } else {
        info.append(title, detail, parameters);
      }
      const actions = document.createElement("div");
      actions.className = "workflow-history-actions";
      const loadButton = document.createElement("button");
      loadButton.className = "workflow-history-btn";
      loadButton.textContent = "在 Explorer 查看";
      loadButton.onclick = () => loadHistoryIntoExplorer(kind, asset);
      const deleteButton = document.createElement("button");
      deleteButton.className = "workflow-history-btn danger";
      deleteButton.textContent = "删除";
      deleteButton.onclick = () => removeHistoryAsset(kind, asset, record);
      actions.append(loadButton, deleteButton);
      row.append(info, actions);
      container.appendChild(row);
    });
  }

  async function refreshHubAssets(kind, record) {
    const container = document.getElementById(`${kind}-history`);
    container.textContent = "正在读取 Pisces-Hub…";
    try {
      const response = await ApiClient.fetchJson("/api/hub/assets");
      const assets = response.assets;
      const netcdfAssets = assets.filter(
        asset => asset.asset_type === "netcdf"
      );
      if (kind === "simulator") {
        populateNetcdfSelect(
          "simulator-hub-input",
          netcdfAssets,
          record.form["simulator-hub-input"]
        );
      } else {
        populateNetcdfSelect(
          "inference-hub-input",
          netcdfAssets,
          record.form["inference-hub-input"]
        );
        populateModelSelect(
          "inference-hub-weights",
          assets.filter(asset => asset.asset_type === "model"),
          record.form["inference-hub-weights"]
        );
      }
      renderHistory(kind, assets, record);
    } catch (error) {
      container.textContent = `历史记录读取失败：${error.detail || error.message}`;
    }
  }

  function bindSourceControls(kind, record) {
    const bindings = kind === "simulator"
      ? [["simulator-input-source", "simulator-input-local", "simulator-input-hub"]]
      : [
          ["inference-input-source", "inference-input-local", "inference-input-hub"],
          ["inference-weights-source", "inference-weights-local", "inference-weights-hub"],
        ];
    bindings.forEach(([sourceId, localId, hubId]) => {
      setSourceVisibility(sourceId, localId, hubId);
      document.getElementById(sourceId).addEventListener("change", () => {
        setSourceVisibility(sourceId, localId, hubId);
        captureDraft(kind, record);
      });
    });
  }

  async function loadResultIntoExplorer(kind, result) {
    const url = kind === "simulator"
      ? `/api/simulator/results/${encodeURIComponent(result.filename)}/load`
      : `/api/inference/results/${encodeURIComponent(result.run_id)}/load`;
    const statusId = `${kind}-status`;
    setStatus(statusId, "正在将保存结果载入 Explorer…", "loading");
    try {
      await ApiClient.fetchJson(url, { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      setStatus(
        statusId,
        `载入失败：${error.detail || error.message}`,
        "error"
      );
    }
  }

  function renderSimulatorSuccess(record) {
    const response = record.task.result;
    setStatus(
      "simulator-status",
      "模拟完成，结果已保存在 Pisces-Hub。",
      "success"
    );
    setResult(
      "simulator-result",
      [
        { tag: "strong", text: "模拟结果" },
        { tag: "span", text: response.filename },
      ]
    );
    const viewResult = document.getElementById("simulator-view-result");
    const downloadResult = document.getElementById(
      "simulator-download-result"
    );
    viewResult.classList.remove("hidden");
    viewResult.onclick = event => {
      event.preventDefault();
      loadResultIntoExplorer("simulator", response);
    };
    downloadResult.href = response.download_url;
    downloadResult.setAttribute("download", response.filename);
    downloadResult.classList.remove("hidden");
  }

  function renderInferenceSuccess(record) {
    const response = record.task.result;
    const firstDate = response.dates[0];
    const lastDate = response.dates[response.dates.length - 1];
    setStatus(
      "inference-status",
      "推理完成，预测序列已保存在 Pisces-Hub。",
      "success"
    );
    setResult(
      "inference-result",
      [
        { tag: "strong", text: response.model },
        {
          tag: "span",
          text: `${response.dates.length} 天 · ${firstDate} → ${lastDate}`,
        },
        {
          tag: "small",
          text: `权重：${response.weights || record.files.weights || "未知"}`,
        },
      ]
    );
    const viewResult = document.getElementById("inference-view-result");
    viewResult.classList.remove("hidden");
    viewResult.onclick = event => {
      event.preventDefault();
      loadResultIntoExplorer("inference", response);
    };
    const downloads = document.getElementById("inference-downloads");
    downloads.replaceChildren();
    response.results.forEach(item => {
      const link = document.createElement("a");
      link.className = "workflow-download-link";
      link.href = item.download_url;
      link.download = item.filename;
      link.textContent = `下载 ${item.filename}`;
      downloads.appendChild(link);
    });
    downloads.classList.remove("hidden");
  }

  function renderStoredTask(kind, record) {
    if (record.task.status === "success" && record.task.result) {
      if (kind === "simulator") renderSimulatorSuccess(record);
      else renderInferenceSuccess(record);
    } else if (record.task.status === "error") {
      setStatus(`${kind}-status`, record.task.message || "任务失败", "error");
    } else if (record.task.status === "running") {
      setStatus(
        `${kind}-status`,
        "上次任务已提交，正在检查 Pisces-Hub 中的结果…",
        "loading"
      );
    }
  }

  function hidePreviousResult(kind) {
    const viewResult = document.getElementById(`${kind}-view-result`);
    const resultPanel = document.getElementById(`${kind}-result`);
    viewResult.classList.add("hidden");
    resultPanel.classList.add("hidden");
    if (kind === "simulator") {
      document.getElementById(
        "simulator-download-result"
      ).classList.add("hidden");
    } else {
      const downloads = document.getElementById("inference-downloads");
      downloads.replaceChildren();
      downloads.classList.add("hidden");
    }
  }

  async function recoverRunningTask(kind, record) {
    if (record.task.status !== "running") return;
    const endpoint = kind === "simulator"
      ? "/api/simulator/results/latest"
      : "/api/inference/results/latest";
    try {
      const latest = await ApiClient.fetchJson(endpoint);
      if (
        latest.ok
        && latest.completed_at_ms >= record.task.started_at_ms
      ) {
        record.task = { status: "success", result: latest };
        saveRecord(kind, record);
        renderStoredTask(kind, record);
        return;
      }
    } catch {
      // Keep the locally saved running state when the backend is unavailable.
    }
    setStatus(
      `${kind}-status`,
      "任务尚未发现完成结果；如果仍在执行，稍后重新打开此页面即可恢复。",
      "loading"
    );
  }

  function beginTask(kind, record) {
    hidePreviousResult(kind);
    captureDraft(kind, record);
    record.task = {
      status: "running",
      started_at_ms: Date.now(),
    };
    saveRecord(kind, record);
  }

  function completeTask(kind, record, response) {
    record.task = { status: "success", result: response };
    saveRecord(kind, record);
    renderStoredTask(kind, record);
  }

  function failTask(kind, record, error, prefix) {
    record.task = {
      status: "error",
      message: `${prefix}：${error.detail || error.message}`,
    };
    saveRecord(kind, record);
    renderStoredTask(kind, record);
  }

  async function runSimulator(record = loadRecord("simulator")) {
    const button = document.getElementById("run-simulator-btn");
    const useHub = value("simulator-input-source") === "hub";
    const file = document.getElementById("simulator-input").files[0];
    const hubInput = selectedHubReference("simulator-hub-input");
    if ((!useHub && !file) || (useHub && !hubInput)) {
      setStatus("simulator-status", "请选择背景场 NetCDF。", "error");
      return;
    }
    const form = new FormData();
    if (useHub) {
      form.append("hub_asset_id", hubInput.id);
      if (hubInput.member) form.append("hub_member", hubInput.member);
    } else {
      form.append("file", file);
    }
    form.append("longitude", value("simulator-lon"));
    form.append("latitude", value("simulator-lat"));
    form.append("radius_km", value("simulator-radius"));
    form.append("amplitude_cm", value("simulator-amplitude"));
    form.append("influence_depth_m", value("simulator-depth"));
    form.append("kind", value("simulator-kind"));
    form.append("vertical_decay", value("simulator-decay"));
    beginTask("simulator", record);
    button.disabled = true;
    button.textContent = "正在生成…";
    setStatus(
      "simulator-status",
      "正在上传背景场并构造理想化涡旋。",
      "loading"
    );
    try {
      const response = await ApiClient.fetchJson("/api/simulator/eddy", {
        method: "POST",
        body: form,
      });
      completeTask("simulator", record, response);
      await refreshHubAssets("simulator", record);
    } catch (error) {
      failTask("simulator", record, error, "模拟失败");
    } finally {
      button.disabled = false;
      button.textContent = "生成模拟结果";
    }
  }

  async function runInference(record = loadRecord("inference")) {
    const button = document.getElementById("run-inference-btn");
    const useHubInput = value("inference-input-source") === "hub";
    const useHubWeights = value("inference-weights-source") === "hub";
    const input = document.getElementById("inference-input").files[0];
    const weights = document.getElementById("inference-weights").files[0];
    const hubInput = selectedHubReference("inference-hub-input");
    const hubWeights = selectedHubReference("inference-hub-weights");
    if (
      (!useHubInput && !input)
      || (useHubInput && !hubInput)
      || (!useHubWeights && !weights)
      || (useHubWeights && !hubWeights)
    ) {
      setStatus(
        "inference-status",
        "请选择初始场 NetCDF 和模型权重。",
        "error"
      );
      return;
    }
    const form = new FormData();
    if (useHubInput) {
      form.append("input_hub_asset_id", hubInput.id);
      if (hubInput.member) {
        form.append("input_hub_member", hubInput.member);
      }
    } else {
      form.append("input_nc", input);
    }
    if (useHubWeights) {
      form.append("weights_hub_asset_id", hubWeights.id);
    } else {
      form.append("weights", weights);
    }
    form.append("model", value("inference-model"));
    form.append("steps", value("inference-steps"));
    form.append("device", value("inference-device"));
    form.append("start_date", value("inference-start-date"));
    form.append("amp", document.getElementById("inference-amp").checked);
    beginTask("inference", record);
    button.disabled = true;
    button.textContent = "正在推理…";
    setStatus(
      "inference-status",
      "正在上传权重并执行模型推理。",
      "loading"
    );
    try {
      const response = await ApiClient.fetchJson("/api/inference/run", {
        method: "POST",
        body: form,
      });
      completeTask("inference", record, response);
      await refreshHubAssets("inference", record);
    } catch (error) {
      failTask("inference", record, error, "推理失败");
    } finally {
      button.disabled = false;
      button.textContent = "运行模型推理";
    }
  }

  function initialize(kind, runner) {
    const record = loadRecord(kind);
    restoreDraft(kind, record);
    bindDraftPersistence(kind, record);
    bindSourceControls(kind, record);
    renderStoredTask(kind, record);
    recoverRunningTask(kind, record);
    refreshHubAssets(kind, record);
    document.getElementById(`${kind}-history-refresh`).onclick = () => {
      refreshHubAssets(kind, record);
    };
    document.getElementById(`run-${kind}-btn`).onclick = () => runner(record);
  }

  function initializeSimulator() {
    initialize("simulator", runSimulator);
  }

  function initializeInference() {
    initialize("inference", runInference);
  }

  return {
    initializeSimulator,
    initializeInference,
    runSimulator,
    runInference,
  };
})();
