/** Shared JSON API client with structured errors. */
const ApiClient = (() => {
  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      let detail = text;
      try {
        detail = JSON.parse(text).detail || text;
      } catch {}
      const error = new Error(`API error ${response.status}: ${detail}`);
      error.status = response.status;
      error.detail = detail;
      throw error;
    }
    return response.json();
  }

  return { fetchJson };
})();
