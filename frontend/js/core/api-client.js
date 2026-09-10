/** Shared JSON API client with structured errors. */
const ApiClient = (() => {
  function scopedUrl(url) {
    const prefix = window.PISCES_API_PREFIX || "";
    return prefix && url.startsWith("/api/") ? `${prefix}${url}` : url;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(scopedUrl(url), options);
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
    const result = await response.json();
    if (
      window.PISCES_API_PREFIX === "/region"
      && options.method === "DELETE"
      && url === "/api/session"
    ) {
      document.dispatchEvent(new CustomEvent("pisces:region-session-cleared"));
    }
    return result;
  }

  return { fetchJson };
})();
