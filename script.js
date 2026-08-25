/**
 * Spider-Man Chat 终极高可用生产级控制器
 * 1. 视口适配引擎 (VisualViewport 动态测算)
 * 2. 音视频解耦体系 (独立 Audio 实例手势提权 + 静音 Video 硬件渲染)
 * 3. 严格会话状态机 (Session 锁 + Seek 握手 + 时钟双重守卫)
 * 4. 资源预热与容灾兜底 Toast
 */
(function () {
  'use strict';

  // 1. 动作片段精准时间戳定义 (秒)
  const CLIPS = [
    { id: 0, start: 0.05, end: 2.80, reply: '彼得·帕克倒挂路过！🕸️' },
    { id: 1, start: 3.55, end: 6.30, reply: '呼！荡蛛丝穿梭中！💨' },
    { id: 2, start: 7.15, end: 9.95, reply: '别怕，好邻居蜘蛛侠在此！🦸‍♂️' }
  ];

  // 2. DOM 元素句柄容器
  const DOM = {
    chatFlow: null,
    msgInput: null,
    chatForm: null,
    sendBtn: null,
    spiderOverlay: null,
    spiderVideo: null,
    soundToggleBtn: null,
    soundOnIcon: null,
    soundOffIcon: null,
    toastNotice: null
  };

  // 3. 运行态状态机
  let activeSessionId = 0;
  let lastClipIndex = -1;
  let repeatStreak = 0;
  let isThrottled = false;
  let audioEffect = null;
  let soundEnabled = true;

  // 4. 显示全局 Toast
  function showToast(msg, duration = 3000) {
    if (!DOM.toastNotice) return;
    DOM.toastNotice.textContent = msg;
    DOM.toastNotice.classList.add('show');
    setTimeout(() => {
      DOM.toastNotice.classList.remove('show');
    }, duration);
  }

  // 5. 动态视口高度测算 (免疫微信/iOS软键盘顶起)
  function syncViewport() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }

  // 6. 音效持久化与切换逻辑
  function initAudioSystem() {
    try {
      const savedPref = localStorage.getItem('spider_chat_sound');
      if (savedPref !== null) {
        soundEnabled = savedPref === 'true';
      }
    } catch (e) {}

    updateSoundUI();

    // 独立音频实例：复用 spider.mp4 的音轨或独立音效源
    audioEffect = new Audio('spider.mp4');
    audioEffect.preload = 'auto';

    if (DOM.soundToggleBtn) {
      DOM.soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        try {
          localStorage.setItem('spider_chat_sound', String(soundEnabled));
        } catch (e) {}
        updateSoundUI();
        triggerHaptic(10);
      });
    }
  }

  function updateSoundUI() {
    if (!DOM.soundOnIcon || !DOM.soundOffIcon) return;
    if (soundEnabled) {
      DOM.soundOnIcon.classList.remove('hidden');
      DOM.soundOffIcon.classList.add('hidden');
    } else {
      DOM.soundOnIcon.classList.add('hidden');
      DOM.soundOffIcon.classList.remove('hidden');
    }
  }

  // 7. 触觉振动反馈
  function triggerHaptic(duration = 20) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) {}
    }
  }

  // 8. 伪随机算法 (防连续抽中相同动作)
  function getNextClip() {
    const all = [0, 1, 2];
    let pool = all;
    if (repeatStreak >= 2) {
      pool = all.filter(i => i !== lastClipIndex);
    }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    if (idx === lastClipIndex) {
      repeatStreak++;
    } else {
      lastClipIndex = idx;
      repeatStreak = 1;
    }
    return CLIPS[idx];
  }

  // 9. 终止并隐藏特效
  function stopSpiderEffect(sessionId) {
    if (sessionId && sessionId !== activeSessionId) return;

    if (DOM.spiderOverlay) {
      DOM.spiderOverlay.classList.remove('active', 'fade-out');
    }
    if (DOM.spiderVideo) {
      DOM.spiderVideo.pause();
    }
    if (audioEffect) {
      audioEffect.pause();
    }
  }

  // 10. 核心特效播放器 (基于会话锁与 Seek 握手)
  function playSpiderEffect(clip) {
    if (!DOM.spiderVideo || !DOM.spiderOverlay) return;

    const thisSession = ++activeSessionId;
    const startTime = clip.start;
    const endTime = clip.end;
    const maxDurationMs = ((endTime - startTime) + 0.35) * 1000;
    const sessionStartTime = performance.now();

    // 先暂停旧状态并重置图层
    DOM.spiderVideo.pause();
    DOM.spiderOverlay.classList.remove('fade-out');
    DOM.spiderOverlay.classList.remove('active');

    // 音频同步在手势事件流中触发
    if (soundEnabled && audioEffect) {
      audioEffect.currentTime = startTime;
      audioEffect.play().catch(() => {});
    }

    // 视频强制静音保证 100% 渲染
    DOM.spiderVideo.muted = true;
    DOM.spiderVideo.currentTime = startTime;

    let isFrameRunning = false;

    function startPlaybackLoop() {
      if (thisSession !== activeSessionId) return;

      DOM.spiderOverlay.classList.add('active');
      const playPromise = DOM.spiderVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Video render error:', err);
        });
      }

      isFrameRunning = true;

      // 帧级高精监听
      function frameMonitor() {
        if (thisSession !== activeSessionId) return;

        const curTime = DOM.spiderVideo.currentTime;
        const elapsedRealTime = performance.now() - sessionStartTime;

        // 到达片段结束前 150ms 开启淡出动画
        if (curTime >= endTime - 0.15 || elapsedRealTime >= maxDurationMs - 150) {
          DOM.spiderOverlay.classList.add('fade-out');
        }

        // 到达结束点或超时瞬间物理切断
        if (curTime >= endTime || elapsedRealTime >= maxDurationMs) {
          stopSpiderEffect(thisSession);
          return;
        }

        requestAnimationFrame(frameMonitor);
      }

      requestAnimationFrame(frameMonitor);
    }

    // Seek 握手与超时兜底
    const onSeeked = () => {
      DOM.spiderVideo.removeEventListener('seeked', onSeeked);
      if (!isFrameRunning && thisSession === activeSessionId) {
        startPlaybackLoop();
      }
    };

    DOM.spiderVideo.addEventListener('seeked', onSeeked, { once: true });

    // 60ms 极速兜底
    setTimeout(() => {
      if (!isFrameRunning && thisSession === activeSessionId) {
        DOM.spiderVideo.removeEventListener('seeked', onSeeked);
        startPlaybackLoop();
      }
    }, 60);
  }

  // 11. 消息上屏与机器人互动生成
  function appendMessage(text, isUser = true) {
    if (!DOM.chatFlow) return;

    const row = document.createElement('div');
    row.className = `msg-row ${isUser ? 'user' : 'bot'}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    DOM.chatFlow.appendChild(row);

    DOM.chatFlow.scrollTop = DOM.chatFlow.scrollHeight;
  }

  // 12. 消息发送核心器 (节流 250ms)
  function handleSend() {
    if (isThrottled) return;
    isThrottled = true;
    setTimeout(() => { isThrottled = false; }, 250);

    if (!DOM.msgInput) return;
    const text = DOM.msgInput.value.trim();
    if (!text) return;

    appendMessage(text, true);
    DOM.msgInput.value = '';

    // 匹配 mj (大小写不敏感)
    if (text.toLowerCase().includes('mj')) {
      triggerHaptic(25);
      const clip = getNextClip();
      playSpiderEffect(clip);

      // 模拟互动回复
      setTimeout(() => {
        appendMessage(clip.reply, false);
      }, 700);
    }
  }

  // 13. 初始化与事件绑定
  function setup() {
    DOM.chatFlow = document.getElementById('chatFlow');
    DOM.msgInput = document.getElementById('msgInput');
    DOM.chatForm = document.getElementById('chatForm');
    DOM.sendBtn = document.getElementById('sendBtn');
    DOM.spiderOverlay = document.getElementById('spiderOverlay');
    DOM.spiderVideo = document.getElementById('spiderVideo');
    DOM.soundToggleBtn = document.getElementById('soundToggleBtn');
    DOM.soundOnIcon = document.getElementById('soundOnIcon');
    DOM.soundOffIcon = document.getElementById('soundOffIcon');
    DOM.toastNotice = document.getElementById('toastNotice');

    initAudioSystem();

    // 监听视口变化
    window.addEventListener('resize', syncViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }
    syncViewport();

    // 视频错误容灾监听
    if (DOM.spiderVideo) {
      DOM.spiderVideo.addEventListener('error', () => {
        showToast('⚠️ 视频解码或加载失败，请检查 spider.mp4 资源');
      });

      // 闲时自动预热预加载
      setTimeout(() => {
        DOM.spiderVideo.preload = 'auto';
        DOM.spiderVideo.load();
      }, 800);
    }

    // 事件绑定 (Click / Touch / Submit / Enter)
    if (DOM.chatForm) {
      DOM.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    if (DOM.sendBtn) {
      DOM.sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
      });
      DOM.sendBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    if (DOM.msgInput) {
      DOM.msgInput.addEventListener('keydown', (e) => {
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
