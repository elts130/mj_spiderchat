/**
 * Spider-Man Chat 终极稳定版控制器
 * - 解决 iOS 异步权限拦截导致的无画面问题
 * - 解决白底遮挡与软键盘挤压变形
 */
(function () {
  'use strict';

  // 1. 动态视口高度适配 (键盘弹起自动调整)
  function syncViewport() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--viewport-height', `${height}px`);
  }

  window.addEventListener('resize', syncViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }
  syncViewport();

  // 2. 精准片段定义：人物露头起播 -> 人物完全离屏退场立即切断
  const CLIPS = [
    { id: 0, start: 0.05, end: 2.85 },  // 第 1 款：正上方倒挂滑落 -> 向上收回
    { id: 1, start: 3.50, end: 6.30 },  // 第 2 款：顶部晃荡穿梭 -> 飞出屏幕
    { id: 2, start: 7.10, end: 9.90 }   // 第 3 款：近距离俯冲 -> 弹回上方
  ];

  let chatFlow, msgInput, chatForm, sendBtn, spiderOverlay, spiderVideo;
  let activeSessionId = 0;
  let lastClipIndex = -1;
  let repeatCount = 0;
  let isThrottled = false;

  function initElements() {
    chatFlow = document.getElementById('chatFlow');
    msgInput = document.getElementById('msgInput');
    chatForm = document.getElementById('chatForm');
    sendBtn = document.getElementById('sendBtn');
    spiderOverlay = document.getElementById('spiderOverlay');
    spiderVideo = document.getElementById('spiderVideo');
  }

  // 随机抽取 (防连抽相同特效)
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

  // 停止特效并隐藏
  function stopSpiderEffect(sessionId) {
    if (sessionId && sessionId !== activeSessionId) return;
    if (spiderVideo) spiderVideo.pause();
    if (spiderOverlay) spiderOverlay.classList.remove('active');
  }

  // 核心特效播放逻辑 (同步直拉启动，确保 100% 展现画面)
  function playSpiderEffect() {
    if (!spiderVideo || !spiderOverlay) return;

    const currentSession = ++activeSessionId;
    const clip = getNextClip();
    const startTime = clip.start;
    const endTime = clip.end;
    const duration = endTime - startTime;
    const startTimestamp = performance.now();

    // 1. 同步设置指针与状态
    spiderVideo.currentTime = startTime;
    spiderVideo.muted = false;
    spiderVideo.volume = 1.0;
    spiderOverlay.classList.add('active');

    // 2. 主线程同步拉起 play()，保留 iOS 最高手势权限
    const promise = spiderVideo.play();
    if (promise !== undefined) {
      promise.catch(() => {
        spiderVideo.muted = true; // 降级静音秒起
        spiderVideo.play();
      });
    }

    let seekConfirmed = false;

    // 3. 高精帧循环检测 (防异步寻轨误判)
    function monitorLoop() {
      if (currentSession !== activeSessionId) return;

      const curTime = spiderVideo.currentTime;
      const elapsed = (performance.now() - startTimestamp) / 1000;

      // 确认时间指针已成功跳至当前片段附近
      if (!seekConfirmed) {
        if (Math.abs(curTime - startTime) < 0.6 || elapsed > 0.15) {
          seekConfirmed = true;
        }
      }

      // 仅在确认进入片段后，到达结束点或达到动作时长瞬间关闭
      if (seekConfirmed) {
        if (curTime >= endTime || elapsed >= duration + 0.3) {
          stopSpiderEffect(currentSession);
          return;
        }
      }

      requestAnimationFrame(monitorLoop);
    }

    requestAnimationFrame(monitorLoop);
  }

  // 消息发送核心
  function handleSend() {
    if (isThrottled) return;
    isThrottled = true;
    setTimeout(() => { isThrottled = false; }, 80);

    if (!msgInput || !chatFlow) initElements();
    if (!msgInput) return;

    const text = msgInput.value.trim();
    if (!text) return;

    // 1. 上屏渲染气泡
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

    // 2. 匹配 mj / MJ / Mj / mJ
    if (text.toLowerCase().includes('mj')) {
      playSpiderEffect();
    }
  }

  // 全局事件监听
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
