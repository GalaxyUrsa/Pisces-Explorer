/** Precomputed API responses used only while timeline playback is active. */
const PlaybackCache = (() => {
  const responses = new Map();
  let generation = 0;

  function requestKey(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    return `${method} ${url}\n${options.body || ""}`;
  }

  async function fetchJson(url, options = {}) {
    const key = requestKey(url, options);
    if (SessionStore.state.playing && responses.has(key)) {
      return responses.get(key);
    }
    return ApiClient.fetchJson(url, options);
  }

  function clear() {
    generation += 1;
    responses.clear();
  }

  async function preloadFrames(
    frameRequests,
    onProgress,
    shouldContinue,
  ) {
    clear();
    const currentGeneration = generation;
    for (let index = 0; index < frameRequests.length; index += 1) {
      if (!shouldContinue()) return false;
      const uniqueRequests = new Map();
      frameRequests[index].forEach(request => {
        uniqueRequests.set(
          requestKey(request.url, request.options),
          request
        );
      });
      const prepared = await Promise.all(
        [...uniqueRequests.entries()].map(async ([key, request]) => {
          const data = await ApiClient.fetchJson(
            request.url,
            request.options || {},
          );
          return [key, data];
        })
      );
      if (
        currentGeneration !== generation
        || !shouldContinue()
      ) {
        return false;
      }
      prepared.forEach(([key, data]) => responses.set(key, data));
      onProgress(index + 1, frameRequests.length);
    }
    return true;
  }

  return { fetchJson, preloadFrames, clear, requestKey };
})();
