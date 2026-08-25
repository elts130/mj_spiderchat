/**
 * 蜘蛛侠抖音彩蛋特效控制器 (极速响应与帧级切片)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderVideo = document.getElementById('spiderVideo');

// 精确切片：人物一完全离开视线即刻切断，杜绝拖尾延迟
const clips = [
  { id: 0, start: 0.0, end: 3.2 },   // 第 1 款特效
  { id: 1, start: 3.6, end: 6.8 },   // 第 2 款特效
  { id: 2, start: 7.2, end: 10.5 }   // 第 3 款特效
];

let currentClipEnd = 0;
let isPlaying = false;
let animFrameId = null;

// 防连抽算法状态记录
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

// 结束当前播放并隐藏图层
function stopSpiderEffect() {
  isPlaying = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  spiderVideo.pause();
  spiderOverlay.classList.remove('active');
}

// 帧级高精循环检测（比 timeupdate 快 15 倍，16ms 瞬时切断）
function checkFrame() {
  if (!isPlaying) return;

  if (spiderVideo.currentTime >= currentClipEnd) {
    stopSpiderEffect();
    return;
  }
  animFrameId = requestAnimationFrame(checkFrame);
}

// 触发特效（支持无缝打断与快速连击）
function playSpiderEffect() {
  // 如果当前已有正在播放的特效，直接打断并切入新特效
  if (isPlaying) {
    stopSpiderEffect();
  }

  const selectedClip = getNextClip();
  currentClipEnd = selectedClip.end;

  spiderVideo.currentTime = selectedClip.start;
  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  spiderOverlay.classList.add('active');
  isPlaying = true;

  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      animFrameId = requestAnimationFrame(checkFrame);
    }).catch(() => {
      // 兼容移动端音频策略
      spiderVideo.muted = true;
      spiderVideo.play().then(() => {
        animFrameId = requestAnimationFrame(checkFrame);
      });
    });
  }
}

// 监听兜底
spiderVideo.addEventListener('ended', stopSpiderEffect);

// 消息发送
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

  // 包含 mj（不区分大小写）立即极速触发
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});
