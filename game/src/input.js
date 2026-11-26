// Keyboard and mouse input. Keys drive the plane; the mouse steers by
// position and the wheel sets the throttle; clicks confirm menu choices.
// The game reads a plain control object every frame, so the flight model
// never touches the DOM.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MENU = 'menu';
export const ACTION_GEAR = 'gear';
export const ACTION_BRAKE = 'brake';
export const ACTION_MUTE = 'mute';
export const ACTION_CAMERA = 'camera';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MENU,
  KeyG: ACTION_GEAR,
  KeyX: ACTION_MUTE,
  KeyC: ACTION_CAMERA,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last read
  const mouse = { x: 0, y: 0, active: false, held: false, wheel: 0 };
  let clicked = false;
  let clickX = 0;
  let clickY = 0;

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top) / rect.height;
    mouse.active = true;
  }
  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    clickX = (e.clientX - rect.left) / rect.width;
    clickY = (e.clientY - rect.top) / rect.height;
    clicked = true;
    mouse.active = true;
    mouse.held = true;
  }
  function onMouseUp() {
    mouse.held = false;
  }
  function onWheel(e) {
    e.preventDefault();
    mouse.wheel += e.deltaY < 0 ? 1 : -1;
  }
  function onBlur() {
    keys.clear();
    mouse.active = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    /** Flight controls for this frame, -1..1 each. */
    readControls() {
      const ctl = { pitch: 0, roll: 0, rudder: 0, throttleDelta: 0, brake: false };
      if (keys.has('ArrowUp') || keys.has('KeyW')) ctl.pitch += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) ctl.pitch -= 1;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) ctl.roll -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) ctl.roll += 1;
      if (keys.has('KeyQ')) ctl.rudder -= 1;
      if (keys.has('KeyE')) ctl.rudder += 1;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) ctl.throttleDelta += 0.9 / 60;
      if (keys.has('ControlLeft') || keys.has('ControlRight')) ctl.throttleDelta -= 0.9 / 60;
      if (keys.has('KeyB')) ctl.brake = true;
      // Mouse steering: hold the button and steer by pointer position.
      if (mouse.active && mouse.held) {
        const dx = mouse.x - 0.5;
        const dy = mouse.y - 0.5;
        if (Math.abs(dx) > 0.08) ctl.roll += Math.max(-1, Math.min(1, dx * 3));
        if (Math.abs(dy) > 0.08) ctl.pitch += Math.max(-1, Math.min(1, -dy * 3));
      }
      if (mouse.wheel !== 0) {
        ctl.throttleDelta += mouse.wheel * 0.06;
        mouse.wheel = 0;
      }
      ctl.roll = Math.max(-1, Math.min(1, ctl.roll));
      ctl.pitch = Math.max(-1, Math.min(1, ctl.pitch));
      return ctl;
    },
    /** One-shot actions pressed since the last read (Enter, P, R, ...). */
    readActions() {
      const found = new Set();
      for (const code of pressed) {
        const action = KEY_ACTIONS[code];
        if (action) found.add(action);
      }
      pressed.clear();
      if (clicked) {
        found.add(ACTION_CONFIRM);
        clicked = false;
      }
      return found;
    },
    clickPosition() {
      return { x: clickX, y: clickY };
    },
    mousePosition() {
      return { x: mouse.x, y: mouse.y };
    },
  };
}
