/** Two-thumb range control synchronized with numeric inputs. */
const DualRange = (() => {
  function create(options) {
    const {
      wrap, minInput, maxInput, fillEl, thumbMin, thumbMax,
    } = options;
    let boundsLow = options.min;
    let boundsHigh = options.max;
    let valueLow = options.min;
    let valueHigh = options.max;
    const listenerOptions = options.signal
      ? { signal: options.signal }
      : undefined;

    function percentage(value) {
      return (
        (value - boundsLow) / (boundsHigh - boundsLow || 1)
      );
    }

    function updateUI() {
      const lowPercent = percentage(valueLow) * 100;
      const highPercent = percentage(valueHigh) * 100;
      thumbMin.style.left = `${lowPercent}%`;
      thumbMax.style.left = `${highPercent}%`;
      fillEl.style.left = `${lowPercent}%`;
      fillEl.style.width = `${highPercent - lowPercent}%`;
    }

    function setRange(low, high) {
      valueLow = Math.max(boundsLow, Math.min(low, boundsHigh));
      valueHigh = Math.max(boundsLow, Math.min(high, boundsHigh));
      if (valueLow > valueHigh) valueLow = valueHigh;
      minInput.value = +valueLow.toFixed(2);
      maxInput.value = +valueHigh.toFixed(2);
      updateUI();
    }

    function setBounds(low, high) {
      boundsLow = low;
      boundsHigh = high;
      valueLow = Math.max(low, Math.min(valueLow, high));
      valueHigh = Math.max(low, Math.min(valueHigh, high));
      updateUI();
    }

    function xToValue(clientX) {
      const rectangle = wrap.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rectangle.left) / rectangle.width)
      );
      return boundsLow + ratio * (boundsHigh - boundsLow);
    }

    wrap.addEventListener("mousedown", event => {
      event.preventDefault();
      const clickedValue = xToValue(event.clientX);
      const draggingLow = (
        Math.abs(clickedValue - valueLow)
        <= Math.abs(clickedValue - valueHigh)
      );

      function onMove(moveEvent) {
        const value = xToValue(moveEvent.clientX);
        if (draggingLow) {
          valueLow = Math.max(boundsLow, Math.min(value, valueHigh));
          minInput.value = +valueLow.toFixed(2);
        } else {
          valueHigh = Math.min(boundsHigh, Math.max(value, valueLow));
          maxInput.value = +valueHigh.toFixed(2);
        }
        updateUI();
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove, listenerOptions);
      document.addEventListener("mouseup", onUp, listenerOptions);
      onMove(event);
    }, listenerOptions);

    minInput.addEventListener("change", () => {
      const value = Number.parseFloat(minInput.value);
      if (!Number.isNaN(value)) setRange(value, valueHigh);
    }, listenerOptions);
    maxInput.addEventListener("change", () => {
      const value = Number.parseFloat(maxInput.value);
      if (!Number.isNaN(value)) setRange(valueLow, value);
    }, listenerOptions);

    setBounds(options.min, options.max);
    setRange(options.min, options.max);
    return { setRange, setBounds };
  }

  return { create };
})();
