(() => {

  "use strict";


  /*
   * 三个独立蜘蛛侠动作
   */

  const CLIPS = [

    "assets/clips/mj-1.mp4",

    "assets/clips/mj-2.mp4",

    "assets/clips/mj-3.mp4"

  ];


  const input =
    document.getElementById(
      "input"
    );


  const composer =
    document.getElementById(
      "composer"
    );


  const messages =
    document.getElementById(
      "messages"
    );


  const egg =
    document.getElementById(
      "egg"
    );


  const video =
    document.getElementById(
      "effect"
    );


  let currentClip =
    -1;


  let session =
    0;


  let hideTimer =
    0;


  /* ======================================
     iPhone / 微信视口
  ====================================== */

  function syncHeight() {

    const height =
      Math.round(

        window.visualViewport?.height ||

        window.innerHeight

      );


    document.documentElement
      .style
      .setProperty(

        "--h",

        height + "px"

      );

  }


  syncHeight();


  window.addEventListener(
    "resize",
    syncHeight,
    {
      passive:
        true
    }
  );


  if (
    window.visualViewport
  ) {

    window.visualViewport
      .addEventListener(

        "resize",

        syncHeight,

        {
          passive:
            true
        }

      );

  }


  /* ======================================
     添加 MJ 气泡
  ====================================== */

  function addMJ(text) {

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


    requestAnimationFrame(
      () => {

        messages.scrollTop =
          messages.scrollHeight;

      }
    );

  }


  /* ======================================
     随机选择特效
  ====================================== */

  function chooseClip() {

    if (
      CLIPS.length === 1
    ) {

      return 0;

    }


    let index =
      Math.floor(

        Math.random() *
        CLIPS.length

      );


    /*
     * 连续两次不要相同
     */

    if (
      index ===
      currentClip
    ) {

      index =
        (
          index + 1
        ) %
        CLIPS.length;

    }


    currentClip =
      index;


    return index;

  }


  /* ======================================
     停止当前特效
  ====================================== */

  function stopEffect() {

    egg.classList.remove(
      "show",
      "hide"
    );


    try {

      video.pause();

    }
    catch (_) {}


    video.removeAttribute(
      "src"
    );


    video.load();

  }


  /* ======================================
     播放 MJ 特效
  ====================================== */

  function playEffect() {

    const mySession =
      ++session;


    clearTimeout(
      hideTimer
    );


    stopEffect();


    const clip =
      CLIPS[
        chooseClip()
      ];


    video.src =
      clip;


    /*
     * 用户点击发送本身就是用户手势。
     *
     * 因此直接 play。
     *
     * 不等待 loadedmetadata。
     * 不等待 seeked。
     * 不做 currentTime 跳转。
     *
     * 这是移动端最稳定的方式。
     */

    video.currentTime =
      0;


    video.muted =
      false;


    video.defaultMuted =
      false;


    video.playsInline =
      true;


    egg.classList.add(
      "show"
    );


    const playPromise =
      video.play();


    if (
      playPromise &&
      typeof playPromise.catch ===
        "function"
    ) {

      playPromise.catch(
        () => {

          /*
           * 某些 iOS / 微信 WebView
           * 会因为音频策略拒绝。
           *
           * 静音重新播放。
           *
           * 视觉特效依然保留。
           */

          video.muted =
            true;

          video.defaultMuted =
            true;


          const retry =
            video.play();


          retry?.catch?.(
            () => {}
          );

        }
      );

    }


    /* ==================================
       正常结束
    ================================== */

    video.onended =
      () => {

        if (
          mySession !==
          session
        ) {

          return;

        }


        egg.classList.add(
          "hide"
        );


        hideTimer =
          setTimeout(

            stopEffect,

            80

          );

      };


    /* ==================================
       某些 WebView ended 不可靠
    ================================== */

    video.ontimeupdate =
      () => {

        if (
          mySession !==
          session
        ) {

          return;

        }


        if (

          video.duration &&

          video.currentTime >=
            video.duration -
            0.06

        ) {

          egg.classList.add(
            "hide"
          );

        }

      };

  }


  /* ======================================
     发送
  ====================================== */

  composer.addEventListener(

    "submit",

    event => {

      event.preventDefault();


      const text =
        input.value.trim();


      if (
        !text
      ) {

        return;

      }


      /*
       * 这个版本不需要真正聊天。
       *
       * 只接受 MJ。
       */

      if (
        !/^mj$/i.test(
          text
        )
      ) {

        input.select();

        return;

      }


      /*
       * 最重要：
       *
       * 先显示消息。
       */

      addMJ(
        "MJ"
      );


      /*
       * 再清空。
       */

      input.value =
        "";


      /*
       * 播放彩蛋。
       */

      playEffect();

    }

  );


})();
