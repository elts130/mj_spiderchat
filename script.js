/**
 * 抖音同款蜘蛛侠特效控制器 (终极防御版)
 * - 解决 WebKit 异步寻轨导致的瞬间闪退
 * - 解决移动端双击、Ghost Click 导致发送失败
 * - 解决延迟与拖尾
 */
(function () {
  'use strict';

  // 严苛的起止时间：露头瞬间(start) -> 离开屏幕瞬间(end)
  const CLIPS = [
    { id: 0, start: 0.05, end: 2.80 },  // 倒挂
    { id: 1, start: 3.55, end: 6.30 },  // 晃荡
    { id: 2, start: 7.15, end: 9.95 }   // 俯冲
  ];

  let chatFlow, msgInput, chatForm, sendBtn, spiderOverlay, spiderVideo;
  
  // 状态锁
  let activeEffectId = 0;
  let lastClipIndex = -1;
  let repeatCount = 0;
  let isSending = false; // 防连击锁

  // DOM 绑定
  function initElements() {
    chatFlow = document.getElementById('chatFlow');
    msgInput = document.getElementById('msgInput');
    chatForm = document.getElementById('chatForm');
    sendBtn = document.getElementById('sendBtn');
    spiderOverlay = document.getElementById('spiderOverlay');
    spiderVideo = document.getElementById('spiderVideo');
  }

  // 伪随机防连续抽取相同特效
  function getNextClip() {
    const all = [0, 1, 2];
    let pool = all;
    if (repeatCount >= 2) {
      pool = all.filter(i => i !== lastClipIndex);
    }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    if (idx === lastClipIndex) {
      repeatCount++;
    } else {
      lastClipIndex = idx;
      repeatCount = 1;
    }
    return CLIPS[idx];
  }

  // 立即安全隐藏特效
  function stopSpiderEffect(effectId) {
    if (effectId && effectId !== activeEffectId) return;
    if (spiderVideo) spiderVideo.pause();
    if (spiderOverlay) spiderOverlay.classList.remove('active');
  }

  // 核心：无懈可击的视频播放逻辑
  function playSpiderEffect() {
    if (!spiderVideo || !spiderOverlay) return;

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
        spiderVideo.muted = true; // 系统降权兜底
        spiderVideo.play();
      });
    }

    let hasSuccessfullyStarted = false; // 寻轨异步安全锁

    function monitorFrame() {
      if (currentId !== activeEffectId) return; // 已经被打断

      const cur = spiderVideo.currentTime;

      // 寻轨保护：确认 currentTime 已经跳到了目标片段附近，才算真正开始
      if (!hasSuccessfullyStarted && Math.abs(cur - clip.start) < 0.5) {
        hasSuccessfullyStarted = true;
      }

      // 只有在真正开始后，才进行结束检测，杜绝 iOS 异步时间导致的 1 毫秒秒关 bug
      if (hasSuccessfullyStarted && cur >= clip.end) {
        stopSpiderEffect(currentId);
        return;
      }

      requestAnimationFrame(monitorFrame);
    }

    requestAnimationFrame(monitorFrame);
  }

  // 核心：节流发信器，保证任何手势下 100% 触发且不重影
  function handleSend() {
    if (isSending) return; // 拦截 100ms 内的重复点击
    isSending = true;

    if (!msgInput || !chatFlow) initElements();
    if (!msgInput) {
      isSending = false;
      return;
    }

    const text = msgInput.value.trim();
    if (!text) {
      isSending = false;
      return;
    }

    // 1. 上屏渲染
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
    } catch (err) {
      console.error(err);
    }

    // 2. 匹配规则 (大小写不敏感)
    if (text.toLowerCase().includes('mj')) {
      playSpiderEffect();
    }

    // 3. 解除节流锁
    setTimeout(() => { isSending = false; }, 100);
  }

  // 全局事件绑定
  function setup() {
    initElements();

    if (spiderVideo) {
      spiderVideo.addEventListener('ended', () => stopSpiderEffect());
    }

    // 处理表单提交 (包含键盘发送键)
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    // 处理点击与触屏 (双重绑定防移动端失效)
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
      });
      // 捕获 touchend 优先响应，防 click 穿透丢失
      sendBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    // 兜底回车键
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          handleSend();
        }
      });
    }
  }

  // 确保 DOM 稳定后再挂载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
