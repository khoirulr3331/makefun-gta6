// Keyboard and mouse state: held keys, fresh presses, and the pointer.
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, clicked: false, held: false };

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(codeOf(event));
    down.add(codeOf(event));
  });
  window.addEventListener('keyup', (event) => {
    down.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    down.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.clicked = true;
    mouse.held = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.held = false;
  });

  return {
    down,
    pressed,
    mouse,
    // True while any of the given codes is held.
    held(...codes) {
      return codes.some((c) => down.has(c));
    },
    // True only on the frame the key went down; call once per frame per key.
    wasPressed(code) {
      return pressed.has(code);
    },
    // Clear the edge set at the end of each frame.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
