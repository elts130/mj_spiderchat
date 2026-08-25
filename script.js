/**
 * 终极重构版：
 * 1. VisualViewport 动态高度适配 (彻底杜绝键盘挤压)
 * 2. Canvas 像素级色度键抠像 (物理级 100% 透明去白底)
 * 3. 严格寻轨锁与防连击 (100% 触发且无拖尾)
 */
(function () {
  'use strict';

  // 【核心机制1】监听 VisualViewport，动态修正视口高度，废除 100vh 的隐患
  function adjustViewport() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
    window.scrollTo(0, 0);
  }
  window.addEventListener('resize', adjustViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustViewport);
  }
  adjustViewport();

  // 精确切片：露头起播 -> 离屏截断
  const CLIPS = [
    { id: 0, start: 0.05, end: 2.80 }, 
    { id: 1, start: 3.55, end: 6.30 }, 
    { id: 2, start: 7.15, end: 9.95 }
  ];

  let chatFlow, msgInput, chatForm, sendBtn;
  let spiderOverlay, spiderVideo, spiderCanvas, ctx;
  
  let activeEffectId = 0;
  let lastClipIndex = -1;
  let repeatCount = 0;
  let isSending = false;

  function initElements() {
    chatFlow = document.getElementById('chatFlow');
    msgInput = document.getElementById('msgInput');
    chatForm = document.getElementById('chatForm');
    sendBtn = document.getElementById('sendBtn');
    spiderOverlay = document.getElementById('spiderOverlay');
    spiderVideo = document.getElementById('spiderVideo');
    spiderCanvas = document.getElementById('spiderCanvas');
    if (spiderCanvas) {
      // willReadFrequently 提升像素级操作性能
      ctx = spiderCanvas.getContext('2d', { willReadFrequently: true }); 
    }
  }

  function getNextClip() {
    const all = [0, 1, 2];
    let pool = all;
    if (repeatCount >= 2) pool = all.filter(i => i !== lastClipIndex);
    const idx = pool[Math.floor(Math.random() * pool.length)];
    if (idx === lastClipIndex) repeatCount++;
    else { lastClipIndex = idx; repeatCount = 1; }
    return CLIPS[idx];
  }

  // 瞬间停止特效并清空画布
  function stopSpiderEffect(effectId) {
    if (effectId && effectId !== activeEffectId) return;
    if (spiderVideo) spiderVideo.pause();
    if (spiderOverlay) spiderOverlay.classList.remove('active');
    if (ctx && spiderCanvas) ctx.clearRect(0, 0, spiderCanvas.width, spiderCanvas.height);
  }

  // 【核心机制2】播放与物理抠像渲染
  function playSpiderEffect() {
    if (!spiderVideo || !spiderOverlay || !ctx) return;

    const currentId = ++activeEffectId;
    const clip = getNextClip();
    
    spiderOverlay.classList.add('active');

    try {
      spiderVideo.currentTime = clip.start;
      spiderVideo.muted = false;
      spiderVideo.volume = 1.0;
    } catch (e) {}

    const promise = spiderVideo.play();
    if (promise !== undefined) {
      promise.catch(() => {
        spiderVideo.muted = true; 
        spiderVideo.play();
      });
    }

    let hasSuccessfullyStarted = false;

    // 逐帧抠图循环
    function renderFrame() {
      if (currentId !== activeEffectId) return;

      const cur = spiderVideo.currentTime;

      if (!hasSuccessfullyStarted && Math.abs(cur - clip.start) < 0.5) {
        hasSuccessfullyStarted = true;
      }

      // 如果视频已就绪，进行像素级物理去背
      if (hasSuccessfullyStarted && spiderVideo.videoWidth > 0) {
        // 降低渲染分辨率以保性能 (控制在 400px 宽度内)
        const targetWidth = Math.min(400, spiderVideo.videoWidth);
        const scale = targetWidth / spiderVideo.videoWidth;
        const targetHeight = spiderVideo.videoHeight * scale;

        if (spiderCanvas.width !== targetWidth) {
          spiderCanvas.width = targetWidth;
          spiderCanvas.height = targetHeight;
        }

        ctx.drawImage(spiderVideo, 0, 0, targetWidth, targetHeight);
        
        // 像素级扫描：将白色背景彻底变为透明
        const frameData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = frameData.data;
        const len = data.length;

        for (let i = 0; i < len; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          // 只要 RGB 均大于 220，即判定为背景白块
          if (r > 220 && g > 220 && b > 220) {
            const minColor = Math.min(r, g, b);
            if (minColor > 240) {
              data[i+3] = 0; // 纯白或伪白完全透明
            } else {
              // 边缘抗锯齿平滑过渡
              data[i+3] = Math.floor((240 - minColor) * 12); 
            }
          }
        }
        ctx.putImageData(frameData, 0, 0);
      }

      if (hasSuccessfullyStarted && cur >= clip.end) {
        stopSpiderEffect(currentId);
        return;
      }

      requestAnimationFrame(renderFrame);
    }

    requestAnimationFrame(renderFrame);
  }

  // 消息发送核心器
  function handleSend() {
    if (isSending) return; 
    isSending = true;

    if (!msgInput || !chatFlow) initElements();
    if (!msgInput) { isSending = false; return; }

    const text = msgInput.value.trim();
    if (!text) { isSending = false; return; }

    try {
      const row = document.createElement('div');
      row.className = 'msg-row';
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = text;
      row.appendChild(bubble);
      chatFlow.appendChild(row);

      msgInput.value = '';
      chatFlow.scrollTop = chatFlow.scrollHeight;
    } catch (err) {}

    // 匹配 mj
    if (text.toLowerCase().includes('mj')) {
      playSpiderEffect();
    }

    setTimeout(() => { isSending = false; }, 100);
  }

  // 事件挂载
  window.triggerChatSend = handleSend;

  function setup() {
    initElements();

    if (spiderVideo) {
      spiderVideo.addEventListener('ended', () => stopSpiderEffect());
    }

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
      });
      sendBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          handleSend();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
