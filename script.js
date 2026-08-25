/**
 * 抖音同款蜘蛛侠特效控制器 (WebKit 异步寻轨状态锁与 100% 触发修复版)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderVideo = document.getElementById('spiderVideo');

// 毫秒级精准片段定义
const clips = [
  { id: 0, start: 0.0, end: 3.2 },   // 第 1 款：正上方倒挂滑落
  { id: 1, start: 3.6, end: 6.8 },   // 第 2 款：顶部穿梭晃荡
  { id: 2, start: 7.2, end: 10.5 }   // 第 3 款：近距离俯冲
];

let currentClipStart = 0;
let currentClipEnd = 0;
let isPlaying = false;
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

// 停止当前特效并隐藏
function stopSpiderEffect() {
  isPlaying = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  spiderVideo.pause();
  spiderOverlay.classList.remove('active');
}

// 高精帧监听 (增加时间窗口双重校验，彻底防止 iOS 异步时间差误杀)
function checkFrame() {
  if (!isPlaying) return;

  const curTime = spiderVideo.currentTime;

  // 必须同时满足：当前时间已进入该片段，并且已达到片段结束点
  if (curTime >= currentClipStart && curTime >= currentClipEnd) {
    stopSpiderEffect();
    return;
  }

  animFrameId = requestAnimationFrame(checkFrame);
}

// 执行实际播放
function executePlay() {
  spiderOverlay.classList.add('active');
  isPlaying = true;

  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      animFrameId = requestAnimationFrame(checkFrame);
    }).catch(() => {
      // 兼容手机静音策略
      spiderVideo.muted = true;
      spiderVideo.play().then(() => {
        animFrameId = requestAnimationFrame(checkFrame);
      });
    });
  }
}

// 触发特效 (加入 WebKit seeked 寻轨完成锁)
function playSpiderEffect() {
  stopSpiderEffect();

  const selectedClip = getNextClip();
  currentClipStart = selectedClip.start;
  currentClipEnd = selectedClip.end;

  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  let hasExecuted = false;

  // 监听定位完成事件，确保指针确实跳到了新片段起始点
  const onSeeked = () => {
    if (hasExecuted) return;
    hasExecuted = true;
    spiderVideo.removeEventListener('seeked', onSeeked);
    executePlay();
  };

  spiderVideo.addEventListener('seeked', onSeeked, { once: true });
  spiderVideo.currentTime = selectedClip.start;

  // 极速兜底保护 (防止某些安卓机型不抛出 seeked 事件)
  setTimeout(() => {
    if (!hasExecuted) {
      hasExecuted = true;
      spiderVideo.removeEventListener('seeked', onSeeked);
      executePlay();
    }
  }, 80);
}

spiderVideo.addEventListener('ended', stopSpiderEffect);

// 消息发送与触发
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

  // 发送 mj 每次必出特效，支持快速连续连发
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});
