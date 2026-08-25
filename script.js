/**
 * 抖音同款蜘蛛侠特效控制器 (高精生命周期锁 + 零延迟必出机制)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderVideo = document.getElementById('spiderVideo');

// 毫秒级精准切片定义（人物离开视线瞬间立即截断）
const clips = [
  { id: 0, start: 0.0, end: 3.1 },   // 第 1 款：正上方倒挂滑落
  { id: 1, start: 3.5, end: 6.7 },   // 第 2 款：顶部穿梭晃荡
  { id: 2, start: 7.1, end: 10.4 }   // 第 3 款：近距离俯冲
];

// 单调自增会话锁，防止异步竞态与误杀
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

// 停止特效
function stopSpiderEffect(targetId) {
  if (targetId && targetId !== activeEffectId) return;
  spiderVideo.pause();
  spiderOverlay.classList.remove('active');
}

// 触发特效 (零延迟秒开 + WebKit 寻轨保护)
function playSpiderEffect() {
  const thisEffectId = ++activeEffectId;
  const clip = getNextClip();

  const startTime = clip.start;
  const endTime = clip.end;
  const maxAllowedDuration = (endTime - startTime) + 0.4;
  const triggerTime = performance.now();

  // 同步初始化状态
  spiderVideo.currentTime = startTime;
  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  spiderOverlay.classList.add('active');

  // 主线程同步拉起播放，保留 iOS 音频手势权限
  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // 若受系统限制，降级为静音确保画面 100% 播放
      spiderVideo.muted = true;
      spiderVideo.play();
    });
  }

  // 高精帧监听循环（结合时间窗口与单调 ID 锁）
  function frameLoop() {
    if (thisEffectId !== activeEffectId) return;

    const cur = spiderVideo.currentTime;
    const elapsedSec = (performance.now() - triggerTime) / 1000;

    // 严密判定：视频已进入目标区间且到达结束点，或真实时间达到片段上限
    const inRange = (cur >= startTime - 0.1) && (cur <= endTime + 0.8);
    const reachedEnd = (cur >= endTime);
    const timeout = (elapsedSec >= maxAllowedDuration);

    if ((inRange && reachedEnd) || timeout) {
      stopSpiderEffect(thisEffectId);
      return;
    }

    requestAnimationFrame(frameLoop);
  }

  requestAnimationFrame(frameLoop);
}

spiderVideo.addEventListener('ended', () => stopSpiderEffect());

// 消息发送与触发处理
function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;

  // 渲染消息气泡
  const row = document.createElement('div');
  row.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatFlow.appendChild(row);

  msgInput.value = '';
  chatFlow.scrollTop = chatFlow.scrollHeight;

  // 大小写完全不敏感匹配 (mj / Mj / MJ / mJ 均可秒触发)
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});
