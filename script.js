(() => {

  "use strict";


  /*
   * =========================================================
   * MJ Chat
   * 抖音私信彩蛋模拟核心
   * =========================================================
   *
   * 核心结构：
   *
   * 用户输入
   *      ↓
   * 正常添加聊天消息
   *      ↓
   * MJ Trigger
   *      ↓
   * Easter Egg Controller
   *      ↓
   * 视频立即出现
   *      ↓
   * 视频结束立即隐藏
   *
   * 聊天 UI 和彩蛋完全分离。
   */


  const CONFIG = {

    /*
     * 触发条件
     *
     * MJ
     * mj
     * hello MJ
     *
     * 会触发。
     *
     * emoji / major / mj123
     * 不触发。
     */

    trigger:
      /(?:^|[^a-z0-9])mj(?:$|[^a-z0-9])/i,


    /*
     * 推荐：
     *
     * 三个独立视频
     */

    clips: [

      "assets/clips/mj-1.mp4",

      "assets/clips/mj-2.mp4",

      "assets/clips/mj-3.mp4"

    ],


    /*
     * 兼容旧版 spider.mp4
     */

    combined:
      "spider.mp4",


    /*
     * 原始视频时间段
     */

    combinedSegments: [

      {
        start: 0.05,
        end: 2.80
      },

      {
        start: 3.55,
        end: 6.30
      },

      {
        start: 7.15,
        end: 9.95
      }

    ],


    /*
     * 彩蛋结束后消息回复延迟
     */

    replyDelay:
      550,


    /*
     * 淡出提前量
     */

    fadeLead:
      80,


    /*
     * 单文件模式超时时间
     */

    fallbackGrace:
      180

  };


  const $ =
    id =>
      document.getElementById(id);


  const DOM = {

    app:
      $("app"),

    viewport:
      $("chatViewport"),

    messages:
      $("messages"),

    composer:
      $("composer"),

    input:
      $("messageInput"),

    send:
      $("sendButton"),

    egg:
      $("easterEgg"),

    video:
      $("eggVideo"),

    sound:
      $("soundBtn"),

    soundOn:
      $("soundOn"),

    soundOff:
      $("soundOff"),

    toast:
      $("toast")

  };


  const STATE = {

    session:
      0,

    currentClip:
      -1,

    active:
      false,

    sound:
      true,

    standalone:
      [],

    combinedReady:
      false,

    timers:
      new Set(),

    viewportTimer:
      null,

    toastTimer:
      null

  };


  /* =========================================================
     Timer
  ========================================================= */

  function later(
    callback,
    delay
  ) {

    const id =
      setTimeout(
        () => {

          STATE.timers.delete(
            id
          );

          callback();

        },
        delay
      );

    STATE.timers.add(
      id
    );

    return id;

  }


  function clearTimers() {

    for (
      const id
      of STATE.timers
    ) {

      clearTimeout(
        id
      );

    }

    STATE.timers.clear();

  }


  /* =========================================================
     Toast
  ========================================================= */

  function showToast(
    message,
    duration = 2200
  ) {

    DOM.toast.textContent =
      message;

    DOM.toast.classList.add(
      "show"
    );


    clearTimeout(
      STATE.toastTimer
    );


    STATE.toastTimer =
      setTimeout(
        () => {

          DOM.toast.classList.remove(
            "show"
          );

        },
        duration
      );

  }


  /* =========================================================
     Viewport
  ========================================================= */

  function syncViewport() {

    const viewport =
      window.visualViewport;


    const height =
      Math.round(
        viewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight
      );


    document.documentElement.style.setProperty(

      "--app-height",

      `${height}px`

    );

  }


  function queueViewportSync() {

    clearTimeout(
      STATE.viewportTimer
    );


    STATE.viewportTimer =
      setTimeout(
        syncViewport,
        40
      );

  }


  /* =========================================================
     Sound
  ========================================================= */

  function loadSoundPreference() {

    try {

      const value =
        localStorage.getItem(
          "mj-chat-sound"
        );


      if (
        value !== null
      ) {

        STATE.sound =
          value === "true";

      }

    }
    catch (_) {}


    updateSoundUI();

  }


  function updateSoundUI() {

    DOM.soundOn.classList.toggle(
      "hidden",
      !STATE.sound
    );


    DOM.soundOff.classList.toggle(
      "hidden",
      STATE.sound
    );

  }


  function toggleSound() {

    STATE.sound =
      !STATE.sound;


    try {

      localStorage.setItem(

        "mj-chat-sound",

        String(
          STATE.sound
        )

      );

    }
    catch (_) {}


    updateSoundUI();

  }


  /* =========================================================
     Haptic
  ========================================================= */

  function haptic(
    duration = 15
  ) {

    try {

      if (
        navigator.vibrate
      ) {

        navigator.vibrate(
          duration
        );

      }

    }
    catch (_) {}

  }


  /* =========================================================
     Message
  ========================================================= */

  function appendMessage(
    text,
    mine
  ) {

    const row =
      document.createElement(
        "div"
      );


    row.className =
      mine
        ? "message-row me"
        : "message-row other";


    const bubble =
      document.createElement(
        "div"
      );


    bubble.className =
      mine
        ? "message-bubble me-bubble"
        : "message-bubble other-bubble";


    bubble.textContent =
      text;


    row.appendChild(
      bubble
    );


    DOM.messages.appendChild(
      row
    );


    requestAnimationFrame(
      () => {

        DOM.messages.scrollTo({

          top:
            DOM.messages.scrollHeight,

          behavior:
            "smooth"

        });

      }
    );

  }


  /* =========================================================
     Random clip
  ========================================================= */

  function chooseClip() {

    const count =
      CONFIG.clips.length;


    if (
      count === 0
    ) {

      return 0;

    }


    let index =
      Math.floor(
        Math.random() * count
      );


    /*
     * 避免连续两次完全一样
     */

    if (
      count > 1 &&
      index === STATE.currentClip
    ) {

      index =
        (index + 1) % count;

    }


    STATE.currentClip =
      index;


    return index;

  }


  /* =========================================================
     Stop Egg
  ========================================================= */

  function stopEgg() {

    STATE.active =
      false;


    DOM.egg.classList.remove(
      "is-active",
      "is-ending"
    );


    try {

      DOM.video.pause();

    }
    catch (_) {}


    try {

      DOM.video.removeAttribute(
        "src"
      );

      DOM.video.load();

    }
    catch (_) {}

  }


  /* =========================================================
     Invalidate old session
  ========================================================= */

  function invalidateSession() {

    STATE.session++;

    STATE.active =
      false;

    clearTimers();

  }


  /* =========================================================
     Independent clip
  ========================================================= */

  async function playStandalone(
    index,
    session
  ) {

    const src =
      CONFIG.clips[index];


    DOM.video.src =
      src;


    DOM.video.muted =
      true;

    DOM.video.defaultMuted =
      true;

    DOM.video.playsInline =
      true;


    try {

      await DOM.video.play();

    }
    catch (_) {

      if (
        session === STATE.session
      ) {

        stopEgg();

        showToast(
          "视频播放被浏览器拦截，请重新发送 MJ"
        );

      }

      return;

    }


    if (
      session !==
      STATE.session
    ) {

      return;

    }


    STATE.active =
      true;


    DOM.egg.classList.add(
      "is-active"
    );


    monitorStandalone(
      session
    );

  }


  function monitorStandalone(
    session
  ) {

    if (
      session !==
      STATE.session ||
      !STATE.active
    ) {

      return;

    }


    const current =
      Number(
        DOM.video.currentTime
      ) || 0;


    const duration =
      Number(
        DOM.video.duration
      ) || 0;


    if (
      duration &&
      current >=
        duration -
        CONFIG.fadeLead /
        1000
    ) {

      DOM.egg.classList.add(
        "is-ending"
      );

    }


    if (
      DOM.video.ended
    ) {

      finishEgg(
        session
      );

      return;

    }


    requestAnimationFrame(
      () =>
        monitorStandalone(
          session
        )
    );

  }


  /* =========================================================
     Combined MP4 fallback
  ========================================================= */

  async function playCombined(
    index,
    session
  ) {

    const segment =
      CONFIG.combinedSegments[
        index
      ];


    if (
      !segment
    ) {

      return;

    }


    const video =
      DOM.video;


    video.src =
      CONFIG.combined;


    video.muted =
      true;

    video.defaultMuted =
      true;

    video.playsInline =
      true;


    video.load();


    let started =
      false;


    let startClock =
      performance.now();


    const start = async () => {

      if (
        started ||
        session !==
        STATE.session
      ) {

        return;

      }


      started =
        true;


      startClock =
        performance.now();


      DOM.egg.classList.add(
        "is-active"
      );


      try {

        await video.play();

      }
      catch (_) {

        stopEgg();

        showToast(
          "视频播放被浏览器拦截，请重新发送 MJ"
        );

        return;

      }


      monitorCombined(
        segment,
        session,
        startClock
      );

    };


    const onSeeked =
      () => {

        video.removeEventListener(
          "seeked",
          onSeeked
        );

        start();

      };


    video.addEventListener(
      "seeked",
      onSeeked,
      {
        once:
          true
      }
    );


    try {

      video.currentTime =
        segment.start;

    }
    catch (_) {}


    /*
     * seeked 迟迟不来时的兜底
     */

    later(
      () => {

        if (
          !started &&
          session ===
          STATE.session
        ) {

          video.removeEventListener(
            "seeked",
            onSeeked
          );

          start();

        }

      },
      90
    );

  }


  function monitorCombined(
    segment,
    session,
    startClock
  ) {

    if (
      session !==
      STATE.session ||
      !STATE.active
    ) {

      return;

    }


    const current =
      Number(
        DOM.video.currentTime
      ) || segment.start;


    const elapsed =
      performance.now() -
      startClock;


    const length =
      (
        segment.end -
        segment.start
      ) * 1000;


    const fadeAt =
      Math.max(
        0,
        length -
        CONFIG.fadeLead
      );


    if (
      elapsed >= fadeAt ||
      current >=
        segment.end -
        CONFIG.fadeLead /
        1000
    ) {

      DOM.egg.classList.add(
        "is-ending"
      );

    }


    if (
      current >=
        segment.end ||
      elapsed >=
        length +
        CONFIG.fallbackGrace
    ) {

      finishEgg(
        session
      );

      return;

    }


    requestAnimationFrame(
      () =>
        monitorCombined(
          segment,
          session,
          startClock
        )
    );

  }


  /* =========================================================
     Finish
  ========================================================= */

  function finishEgg(
    session
  ) {

    if (
      session !==
      STATE.session
    ) {

      return;

    }


    STATE.active =
      false;


    DOM.egg.classList.add(
      "is-ending"
    );


    later(
      () => {

        if (
          session ===
          STATE.session
        ) {

          stopEgg();

        }

      },
      60
    );

  }


  /* =========================================================
     Trigger
  ========================================================= */

  async function triggerMJ(
    index
  ) {

    const session =
      ++STATE.session;


    clearTimers();


    stopEgg();


    haptic(
      18
    );


    if (
      STATE.standalone[index]
    ) {

      await playStandalone(
        index,
        session
      );

      return;

    }


    if (
      STATE.combinedReady
    ) {

      await playCombined(
        index,
        session
      );

      return;

    }


    showToast(
      "请放入 MJ 视频素材"
    );

  }


  /* =========================================================
     Probe media
  ========================================================= */

  function probeVideo(
    src,
    timeout = 1500
  ) {

    return new Promise(
      resolve => {

        const video =
          document.createElement(
            "video"
          );


        let finished =
          false;


        const done = ok => {

          if (
            finished
          ) {

            return;

          }


          finished =
            true;


          clearTimeout(
            timer
          );


          video.removeAttribute(
            "src"
          );

          video.load();


          resolve(
            ok
          );

        };


        const timer =
          setTimeout(
            () =>
              done(false),
            timeout
          );


        video.preload =
          "metadata";

        video.muted =
          true;


        video.onloadedmetadata =
          () =>
            done(true);


        video.onerror =
          () =>
            done(false);


        video.src =
          src;

      }
    );

  }


  async function detectAssets() {

    STATE.standalone =
      await Promise.all(
        CONFIG.clips.map(
          clip =>
            probeVideo(
              clip
            )
        )
      );


    STATE.combinedReady =
      await probeVideo(
        CONFIG.combined
      );


    console.log(
      "[MJ Chat]",
      {
        standalone:
          STATE.standalone,

        combined:
          STATE.combinedReady
      }
    );

  }


  /* =========================================================
     Send
  ========================================================= */

  function handleSend(
    event
  ) {

    event.preventDefault();


    const text =
      DOM.input.value.trim();


    if (
      !text
    ) {

      return;

    }


    DOM.input.value =
      "";


    /*
     * 先让聊天气泡出现
     */

    appendMessage(
      text,
      true
    );


    /*
     * 再检测 MJ
     */

    if (
      !CONFIG.trigger.test(
        text
      )
    ) {

      return;

    }


    const index =
      chooseClip();


    /*
     * 立即触发
     */

    triggerMJ(
      index
    );


    /*
     * 模拟聊天回复

     * 这里可以删除。

     * 真正仿抖音时，
     * 不一定需要机器人回复。
     */

    later(

      () => {

        appendMessage(
          "🕷️",
          false
        );

      },

      550

    );

  }


  /* =========================================================
     Boot
  ========================================================= */

  function boot() {

    loadSoundPreference();


    syncViewport();


    window.addEventListener(
      "resize",
      queueViewportSync,
      {
        passive:
          true
      }
    );


    if (
      window.visualViewport
    ) {

      window.visualViewport.addEventListener(
        "resize",
        queueViewportSync,
        {
          passive:
            true
        }
      );


      window.visualViewport.addEventListener(
        "scroll",
        queueViewportSync,
        {
          passive:
            true
        }
      );

    }


    DOM.sound.addEventListener(
      "click",
      toggleSound
    );


    DOM.composer.addEventListener(
      "submit",
      handleSend
    );


    DOM.video.addEventListener(
      "ended",
      () => {

        if (
          STATE.active
        ) {

          finishEgg(
            STATE.session
          );

        }

      }
    );


    /*
     * 页面完成首屏以后再检测视频。
     */

    setTimeout(
      detectAssets,
      0
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once:
          true
      }
    );

  }
  else {

    boot();

  }


})();
