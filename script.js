/**
 * 抖音同款蜘蛛侠特效控制器 (Canvas 硬件级正片叠底 + 精确起止切片)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const sendBtn = document.getElementById('sendBtn');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderCanvas = document.getElementById('spiderCanvas');
const spiderVideo = document.getElementById('spiderVideo');
const ctx = spiderCanvas.getContext('2d');

// 精确起止时间戳：从人物在画面中露头开始，到人物完全缩回/飞出视野的瞬间立即切断
const clips = [
  { id: 0, start: 0.05, end: 2.85 },  // 第 1 款：正上方倒挂滑落 -> 缩回顶部
  { id: 1, start: 3.55, end: 6.35 },  // 第 2 款：顶部穿梭晃荡 -> 飞出屏幕
  { id: 2, start: 7.15, end: 10.05 }  // 第 3 款：近距离俯冲 -> 弹回上方
];

let activeEffectId = 0;
let lastClipIndex = -1;
let repeatCount = 0;

function getNextClip() {
  const allIndices = [0, 1, 2];
  let availableIndices = allIndices;

  if (repeatCount >= 2) {
    availableIndices = allIndices.filter(i => i !== lastClipIndex);
  }

  const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

  if (chosenIndex === lastClipIndex) {
    repeatCount++;
  } else {
    lastClipIndex = chosenIndex;
    repeatCount = 1;
  }

  return clips[chosenIndex];
}

// 停止特效并立即清空画布
function stopSpiderEffect(targetId) {
  if (targetId && targetId !== activeEffectId) return;
  spiderVideo.pause();
  spiderOverlay.classList.remove('active');
  ctx.clearRect(0, 0, spiderCanvas.width, spiderCanvas.height);
}

// 触发特效 (Canvas 实时逐帧转绘 + 纯净正片叠底)
function playSpiderEffect() {
  const thisEffectId = ++activeEffectId;
  const clip = getNextClip();

  const startTime = clip.start;
  const endTime = clip.end;
  const maxAllowedDuration = (endTime - startTime) + 0.35;
  const triggerTime = performance.now();

  spiderVideo.currentTime = startTime;
  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  spiderOverlay.classList.add('active');

  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      spiderVideo.muted = true;
      spiderVideo.play();
    });
  }

  // 逐帧绘制循环
  function renderLoop() {
    if (thisEffectId !== activeEffectId) return;

    // 同步 Canvas 尺寸并绘制当前帧
    if (spiderVideo.videoWidth > 0) {
      if (spiderCanvas.width !== spiderVideo.videoWidth) {
        spiderCanvas.width = spiderVideo.videoWidth;
        spiderCanvas.height = spiderVideo.videoHeight;
      }
      ctx.drawImage(spiderVideo, 0, 0, spiderCanvas.width, spiderCanvas.height);
    }

    const cur = spiderVideo.currentTime;
    const elapsedSec = (performance.now() - triggerTime) / 1000;

    // 精确判定：到达结束点或超时立即切断
    const inRange = (cur >= startTime - 0.1) && (cur <= endTime + 0.5);
    const reachedEnd = (cur >= endTime);
    const timeout = (elapsedSec >= maxAllowedDuration);

    if ((inRange && reachedEnd) || timeout) {
      stopSpiderEffect(thisEffectId);
      return;
    }

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}

spiderVideo.addEventListener('ended', () => stopSpiderEffect());

// 消息发送与触发处理
function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;

  // 1. 渲染发送气泡
  const row = document.createElement('div');
  row.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatFlow.appendChild(row);

  msgInput.value = '';
  chatFlow.scrollTop = chatFlow.scrollHeight;

  // 2. 大小写不敏感匹配 (mj / MJ / Mj / mJ)
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

// 多重事件绑定
sendBtn.addEventListener('click', (e) => {
  e.preventDefault();
  handleSend();
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSend();
  }
});
