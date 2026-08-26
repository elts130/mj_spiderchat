(() => {

  "use strict";


  /*
   * ==========================================
   * 三个已经切好的独立视频
   * ==========================================
   */

  const CLIPS = [

    "assets/clips/mj-1.mp4",

    "assets/clips/mj-2.mp4",

    "assets/clips/mj-3.mp4"

  ];


  /*
   * Canvas 实际处理分辨率
   *
   * 不需要用 512 × 512 原尺寸逐帧抠像，
   * 256 × 256 对手机端已经足够。
   */

  const PROCESS_SIZE = 256;


  /*
   * 原素材浅灰背景的目标颜色。
   *
   * 你这份素材角落实际接近：
   *
   * RGB(238,238,238)
   */

  const BG = {

    r: 238,

    g: 238,

    b: 238

  };


  /*
   * 抠像参数
   *
   * threshold 越大：
   * 去掉更多灰色。
   *
   * feather 越大：
   * 边缘越柔和。
   */

  const KEY_THRESHOLD = 16;

  const FEATHER = 10;


  /*
   * DOM
   */

  const app =
    document.getElementById(
      "app"
    );


  const composer =
    document.getElementById(
      "composer"
    );


  const input =
    document.getElementById(
      "input"
    );


  const messages =
    document.getElementById(
      "messages"
    );


  const layer =
    document.getElementById(
      "effectLayer"
    );


  const video =
    document.getElementById(
      "effectVideo"
    );


  const canvas =
    document.getElementById(
      "effectCanvas"
    );


  const ctx =
    canvas.getContext(
      "2d",
      {
        alpha:
          true,

        willReadFrequently:
          true

      }
    );


  /*
   * ==========================================
   * 运行状态
   * ==========================================
   */

  const state = {

    session:
      0,

    currentClip:
      -1,

    raf:
      0,

    frameCallbackId:
      0,

    keyboardTimer:
      0,

    cleanupTimer:
      0,

    /*
     * 键盘弹起前的页面基准高度。
     *
     * 键盘出现以后不再改变。
     */

    layoutHeight:
      window.innerHeight ||
      document.documentElement.clientHeight,

    keyboardHeight:
      0,

    running:
      false

  };


  /*
   * ==========================================
   * CSS 变量
   * ==========================================
   */

  function setVar(
    name,
    value
  ) {

    document.documentElement
      .style
      .setProperty(
        name,
        value
      );

  }


  /*
   * ==========================================
   * 键盘 + VisualViewport
   *
   * 核心：
   *
   * 键盘出现：
   *   app 高度锁定
   *   顶部不动
   *   只有 composer 往上走
   * ==========================================
   */

  function syncViewport(
    forceLayout = false
  ) {

    const vv =
      window.visualViewport;


    const innerHeight =
      window.innerHeight ||
      document.documentElement
        .clientHeight ||
      0;


    const visualHeight =
      vv?.height ??
      innerHeight;


    const offsetTop =
      vv?.offsetTop ??
      0;


    const keyboardHeight =
      Math.max(

        0,

        innerHeight -
        visualHeight -
        offsetTop

      );


    const keyboardOpen =
      keyboardHeight >
      100;


    /*
     * 键盘打开时：
     *
     * 不再重新设置 app 高度。
     *
     * 所以顶部不会被挤。
     */

    if (
      forceLayout ||
      !keyboardOpen
    ) {

      state.layoutHeight =
        innerHeight;


      setVar(

        "--app-height",

        `${innerHeight}px`

      );

    }


    state.keyboardHeight =
      keyboardHeight;


    setVar(

      "--keyboard-height",

      `${keyboardHeight}px`

    );

  }


  /*
   * 防止键盘动画期间疯狂触发重排。
   */

  function queueViewportSync() {

    clearTimeout(
      state.keyboardTimer
    );


    state.keyboardTimer =
      setTimeout(

        () => {

          syncViewport(
            false
          );

        },

        20

      );

  }


  /*
   * ==========================================
   * 聊天自动滚到最新
   * ==========================================
   */

  function scrollToLatest() {

    requestAnimationFrame(

      () => {

        messages.scrollTop =
          messages.scrollHeight;


        setTimeout(

          () => {

            messages.scrollTop =
              messages.scrollHeight;

          },

          40

        );

      }

    );

  }


  /*
   * ==========================================
   * 添加 MJ 气泡
   * ==========================================
   */

  function addMessage(
    text
  ) {

    const row =
      document.createElement(
        "div"
      );


    row.className =
      "row";


    const bubble =
      document.createElement(
        "div"
      );


    bubble.className =
      "bubble";


    bubble.textContent =
      text;


    row.appendChild(
      bubble
    );


    messages.appendChild(
      row
    );


    scrollToLatest();

  }


  /*
   * ==========================================
   * 随机动作
   *
   * 连续两次不选同一个
   * ==========================================
   */

  function chooseClip() {

    let index =
      Math.floor(

        Math.random() *
        CLIPS.length

      );


    if (

      CLIPS.length > 1 &&

      index ===
      state.currentClip

    ) {

      index =
        (
          index + 1
        ) %
        CLIPS.length;

    }


    state.currentClip =
      index;


    return index;

  }


  /*
   * ==========================================
   * Canvas 初始化
   * ==========================================
   */

  function resizeProcessingCanvas() {

    canvas.width =
      PROCESS_SIZE;

    canvas.height =
      PROCESS_SIZE;


    ctx.clearRect(

      0,
      0,
      PROCESS_SIZE,
      PROCESS_SIZE

    );

  }


  /*
   * ==========================================
   * 计算一个像素与背景颜色的距离
   * ==========================================
   */

  function distanceToBackground(
    r,
    g,
    b
  ) {

    const dr =
      r -
      BG.r;


    const dg =
      g -
      BG.g;


    const db =
      b -
      BG.b;


    return Math.sqrt(

      dr * dr +
      dg * dg +
      db * db

    );

  }


  /*
   * ==========================================
   * 实时背景抠像
   *
   * 这里是解决灰色方框的核心。
   * ==========================================
   */

  function drawKeyedFrame() {

    if (
      video.readyState <
      HTMLMediaElement
        .HAVE_CURRENT_DATA
    ) {

      return;

    }


    /*
     * 清空上一帧
     */

    ctx.clearRect(

      0,
      0,
      PROCESS_SIZE,
      PROCESS_SIZE

    );


    /*
     * 原视频缩小到 256 × 256
     */

    ctx.drawImage(

      video,

      0,
      0,

      PROCESS_SIZE,
      PROCESS_SIZE

    );


    const frame =
      ctx.getImageData(

        0,
        0,

        PROCESS_SIZE,
        PROCESS_SIZE

      );


    const pixels =
      frame.data;


    /*
     * 每 4 个数字：
     *
     * R G B A
     */

    for (
      let i = 0;
      i < pixels.length;
      i += 4
    ) {

      const distance =
        distanceToBackground(

          pixels[i],
          pixels[i + 1],
          pixels[i + 2]

        );


      /*
       * 完全属于背景：
       * 直接变透明
       */

      if (
        distance <=
        KEY_THRESHOLD
      ) {

        pixels[i + 3] =
          0;

      }


      /*
       * 接近背景：
       * 做柔和过渡
       *
       * 避免人物边缘出现锯齿
       */

      else if (

        distance <
        KEY_THRESHOLD +
        FEATHER

      ) {

        pixels[i + 3] =
          Math.round(

            (
              (
                distance -
                KEY_THRESHOLD
              ) /
              FEATHER
            ) *
            255

          );

      }


      /*
       * 前景：
       * 完全保留
       */

    }


    ctx.putImageData(

      frame,

      0,
      0

    );

  }


  /*
   * ==========================================
   * 清理特效
   * ==========================================
   */

  function finishEffect(
    session
  ) {

    if (
      session !==
      state.session
    ) {

      return;

    }


    state.running =
      false;


    layer.classList.add(
      "hide"
    );


    clearTimeout(
      state.cleanupTimer
    );


    state.cleanupTimer =
      setTimeout(

        () => {

          if (
            session !==
            state.session
          ) {

            return;

          }


          layer.classList.remove(
            "show",
            "hide"
          );


          cancelAnimationFrame(
            state.raf
          );


          try {

            if (

              state.frameCallbackId &&

              video.cancelVideoFrameCallback

            ) {

              video.cancelVideoFrameCallback(

                state.frameCallbackId

              );

            }

          }
          catch (_) {}


          video.pause();


          video.removeAttribute(
            "src"
          );


          video.load();


          ctx.clearRect(

            0,
            0,

            PROCESS_SIZE,
            PROCESS_SIZE

          );

        },

        80

      );

  }


  /*
   * ==========================================
   * 普通 requestAnimationFrame
   * ==========================================
   */

  function frameLoop(
    session
  ) {

    if (

      session !==
      state.session ||

      !state.running

    ) {

      return;

    }


    drawKeyedFrame();


    if (
      video.ended
    ) {

      finishEffect(
        session
      );


      return;

    }


    state.raf =
      requestAnimationFrame(

        () => {

          frameLoop(
            session
          );

        }

      );

  }


  /*
   * ==========================================
   * 优先使用 requestVideoFrameCallback
   * ==========================================
   */

  function startVideoFrameLoop(
    session
  ) {

    if (

      typeof
      video.requestVideoFrameCallback ===
      "function"

    ) {

      const draw =
        () => {

          if (

            session !==
            state.session ||

            !state.running

          ) {

            return;

          }


          drawKeyedFrame();


          if (
            video.ended
          ) {

            finishEffect(
              session
            );


            return;

          }


          state.frameCallbackId =

            video.requestVideoFrameCallback(
              draw
            );

        };


      state.frameCallbackId =

        video.requestVideoFrameCallback(
          draw
        );

    }

    else {

      frameLoop(
        session
      );

    }

  }


  /*
   * ==========================================
   * 播放一个随机彩蛋
   * ==========================================
   */

  async function playEffect() {

    const session =
      ++state.session;


    clearTimeout(
      state.cleanupTimer
    );


    cancelAnimationFrame(
      state.raf
    );


    try {

      if (

        state.frameCallbackId &&

        video.cancelVideoFrameCallback

      ) {

        video.cancelVideoFrameCallback(

          state.frameCallbackId

        );

      }

    }
    catch (_) {}


    state.running =
      false;


    video.pause();


    video.removeAttribute(
      "src"
    );


    video.load();


    resizeProcessingCanvas();


    const src =
      CLIPS[
        chooseClip()
      ];


    video.src =
      src;


    video.playsInline =
      true;


    /*
     * 默认先尝试带声音。
     *
     * 用户刚刚点了发送按钮，
     * 仍处于用户手势调用链。
     */

    video.muted =
      false;


    video.defaultMuted =
      false;


    layer.classList.remove(
      "hide"
    );


    layer.classList.add(
      "show"
    );


    state.running =
      true;


    try {

      await video.play();

    }

    catch (_) {

      /*
       * 如果 iOS / WebView
       * 不允许带声音：
       *
       * 自动静音再播放。
       */

      video.muted =
        true;


      video.defaultMuted =
        true;


      try {

        await video.play();

      }

      catch (_) {

        finishEffect(
          session
        );


        return;

      }

    }


    if (
      session !==
      state.session
    ) {

      return;

    }


    startVideoFrameLoop(
      session
    );

  }


  /*
   * ==========================================
   * 发送 MJ
   * ==========================================
   */

  composer.addEventListener(

    "submit",

    event => {

      event.preventDefault();


      const text =
        input.value.trim();


      /*
       * 只接受 MJ
       */

      if (
        !/^mj$/i.test(
          text
        )
      ) {

        return;

      }


      /*
       * 先显示消息。
       *
       * 这点故意放在播放前。
       *
       * 即使视频失败，
       * MJ 也不会消失。
       */

      addMessage(
        "MJ"
      );


      input.value =
        "";


      /*
       * 再触发彩蛋。
       */

      playEffect();

    }

  );


  /*
   * ==========================================
   * 键盘
   * ==========================================
   */

  input.addEventListener(

    "focus",

    () => {

      queueViewportSync();

    },

    {
      passive:
        true

    }

  );


  input.addEventListener(

    "blur",

    () => {

      setTimeout(

        () => {

          syncViewport(
            false
          );

        },

        80

      );

    },

    {
      passive:
        true

    }

  );


  /*
   * 普通 resize
   */

  window.addEventListener(

    "resize",

    () => {

      syncViewport(
        false
      );

    },

    {
      passive:
        true

    }

  );


  /*
   * VisualViewport
   */

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


  /*
   * 横竖屏旋转：
   *
   * 这时候允许重新设置基准高度。
   */

  window.addEventListener(

    "orientationchange",

    () => {

      setTimeout(

        () => {

          syncViewport(
            true
          );

        },

        180

      );

    },

    {
      passive:
        true
    }

  );


  /*
   * ==========================================
   * 初始化
   * ==========================================
   */

  resizeProcessingCanvas();


  syncViewport(
    true
  );

})();
