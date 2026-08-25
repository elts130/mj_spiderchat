/**
 * 蜘蛛侠抖音彩蛋特效核心控制器 (JavaScript)
 */
const chatFlow = document.getElementById('chatFlow');
const msgInput = document.getElementById('msgInput');
const chatForm = document.getElementById('chatForm');
const spiderOverlay = document.getElementById('spiderOverlay');
const spiderVideo = document.getElementById('spiderVideo');

// 视频 3 段特效时间轴 (单位: 秒)
const clips = [
  { id: 0, start: 0.0, end: 3.6 },   // 第 1 款特效
  { id: 1, start: 3.6, end: 7.2 },   // 第 2 款特效
  { id: 2, start: 7.2, end: 11.0 }   // 第 3 款特效
];

let currentClipEnd = 0;
let isPlaying = false;

// 随机算法状态：允许真随机连击，但限制同一特效最多连续出现 2 次
let lastClipIndex = -1;
let repeatCount = 0;

function getNextClip() {
  const allIndices = [0, 1, 2];
  let availableIndices = allIndices;

  // 若同一个特效已连续播放 2 次，本次强制从另外两款中抽取
  if (repeatCount >= 2) {
    availableIndices = allIndices.filter(i => i !== lastClipIndex);
  }

  // 随机抽取
  const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

  // 更新连续追踪状态
  if (chosenIndex === lastClipIndex) {
    repeatCount++;
  } else {
    lastClipIndex = chosenIndex;
    repeatCount = 1;
  }

  return clips[chosenIndex];
}

// 播放特效
function playSpiderEffect() {
  const selectedClip = getNextClip();
  currentClipEnd = selectedClip.end;

  spiderVideo.pause();
  spiderVideo.currentTime = selectedClip.start;
  spiderVideo.muted = false;
  spiderVideo.volume = 1.0;

  spiderOverlay.classList.add('active');
  isPlaying = true;

  const playPromise = spiderVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // 兼容部分移动端浏览器对带声音自动播放的限制策略
      spiderVideo.muted = true;
      spiderVideo.play();
    });
  }
}

// 监听播放帧：精准在段落终点暂停并隐藏视频层
spiderVideo.addEventListener('timeupdate', () => {
  if (isPlaying && spiderVideo.currentTime >= currentClipEnd) {
    isPlaying = false;
    spiderVideo.pause();
    spiderOverlay.classList.remove('active');
  }
});

spiderVideo.addEventListener('ended', () => {
  isPlaying = false;
  spiderOverlay.classList.remove('active');
});

// 消息发送处理
function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;

  // 构建消息气泡
  const row = document.createElement('div');
  row.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatFlow.appendChild(row);

  msgInput.value = '';
  chatFlow.scrollTop = chatFlow.scrollHeight;

  // 匹配关键词 (不区分大小写，包含 mj 即触发)
  if (text.toLowerCase().includes('mj')) {
    playSpiderEffect();
  }
}

// 事件绑定
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});
