import { obstaclePoints } from '../modes/worldCollision.js';

export function bindWorldStick(stick, onInput) {
  const thumb = stick.querySelector('i');
  let activePointer = null;

  function move(event) {
    if (event.pointerId !== activePointer) return;
    const box = stick.getBoundingClientRect();
    const radius = box.width * .34;
    const x = (event.clientX - box.left - box.width / 2) / radius;
    const y = (event.clientY - box.top - box.height / 2) / radius;
    const distance = Math.hypot(x, y);
    const length = Math.max(1, distance);
    thumb.style.transform = `translate(${x / length * radius}px, ${y / length * radius}px)`;
    const magnitude = Math.max(0, Math.min(1, (distance - .18) / .82));
    const direction = distance || 1;
    onInput({ x: x / direction * magnitude, y: y / direction * magnitude });
  }

  function release(event) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    thumb.style.transform = '';
    onInput(null);
  }

  stick.addEventListener('pointerdown', event => {
    if (activePointer !== null || event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    move(event);
  });
  stick.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, release);
}

export function drawWorldMinimap(canvas, map, player, interactions, objective) {
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / map.world.width;
  const sy = canvas.height / map.world.height;
  ctx.fillStyle = '#657452';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#283a31';
  for (const item of map.collision.obstacles) {
    const points = obstaclePoints(item);
    ctx.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index === 0) ctx.moveTo(x * sx, y * sy);
      else ctx.lineTo(x * sx, y * sy);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (player.walkPath?.length) {
    ctx.beginPath();
    ctx.moveTo(player.x * sx, player.y * sy);
    for (const point of player.walkPath) ctx.lineTo(point.x * sx, point.y * sy);
    ctx.strokeStyle = '#eac271';
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  for (const item of interactions) {
    const x = item.x * sx;
    const y = item.y * sy;
    const active = item.action === objective;
    ctx.fillStyle = active ? '#ffdc83' : ['portal', 'room_door'].includes(item.kind) ? '#8dc6b4' : '#aab7a6';
    const size = active ? 7 : 3;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.beginPath();
  ctx.arc(player.x * sx, player.y * sy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ff886e';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#fff8e5';
  ctx.stroke();
}
