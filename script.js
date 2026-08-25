/**
 * 抖音同款蜘蛛侠特效控制器 (Canvas 硬件投影 + 零延迟秒级响应)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderCanvas = document.getElementById('spiderCanvas');
const spiderVideo = document.getElementById('spiderVideo');
const ctx = spiderCanvas.getContext('2d');

// 毫秒级精准动作片段定义
const clips = [
  { id: 0, start: 0.0, end: 3.2 },   // 第 1 款：正上方倒挂滑落
  { id: 1, start: 3.6, end: 6.8 },   // 第 2 款：顶部穿梭晃荡
  { id: 2, start: 7.2, end: 10.5 }   // 第 3 款：近距离俯冲
];

let currentClipStart = 0;
let currentClipEnd = 0;
let isPlaying = false;
let isSeeking = false;
let animFrameId = null;

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

// 停止特效并清空画布
function stopSpiderEffect() {
  isPlaying = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  spiderVideo.pause();
  spiderOverlay.classList.remove('active');
  ctx.clearRect(0, 0, spiderCanvas.width, spiderCanvas.height);
}

// Canvas 逐帧投影渲染与结束判断
function renderFrame() {
  if (!isPlaying) return;

  // 将解码后的视频帧实时绘制到 Canvas 上
  if (spiderVideo.videoWidth > 0) {
    if (spiderCanvas.width !== spiderVideo.videoWidth) {
      spiderCanvas.width = spiderVideo.videoWidth;
      spiderCanvas.height = spiderVideo.videoHeight;
    }
    ctx.drawImage(spiderVideo, 0, 0, spiderCanvas.width, spiderCanvas.height);
  }

  const curTime = spiderVideo.currentTime;

  // 动作一结束（离开视野）瞬间关闭
  if (!isSeeking && curTime >= currentClipEnd) {
    stopSpiderEffect();
    return;
  }

  animFrameId = requestAnimationFrame(renderFrame);
}

// 零延迟触发播放 (同步执行，保留 iOS 权限)
function playSpiderEffect() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  const clip = getNextClip();
  currentClipStart = clip.start;
  currentClipEnd = clip.end;

  // 设置安全寻轨保护，防止时间差误判
  isSeeking = true;
  spiderVideo.currentTime = clip.start;
  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  spiderOverlay.classList.add('active');
  isPlaying = true;

  // 立即在主线程同步调用 play()，保留移动端音频手势权限
  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // 播放成功
    }).catch(() => {
      // 若系统策略限制有声播放，降级为静音秒播
      spiderVideo.muted = true;
      spiderVideo.play();
    });
  }

  // 100ms 后开启结束检测
  setTimeout(() => {
    isSeeking = false;
  }, 100);

  animFrameId = requestAnimationFrame(renderFrame);
}

spiderVideo.addEventListener('ended', stopSpiderEffect);

// 消息发送入口
function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;

  const row = document.createElement('div');
  row.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatFlow.appendChild(row);

  msgInput.value = '';
  chatFlow.scrollTop = chatFlow.scrollHeight;

  // 发送包含 mj 立即触发
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});
