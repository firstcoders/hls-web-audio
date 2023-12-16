// Create an audio context that unmutes on IOS
// @see https://github.com/swevans/unmute
export default (ac) => {
  const buffer = ac.createBuffer(1, 1, 22050); // 1/10th of a second of silence
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.connect(ac.destination);

  const audio = document.createElement('audio');
  audio.controls = false;
  audio.preload = 'auto';
  audio.disableRemotePlayback = true;
  audio.loop = true;

  window.addEventListener(
    'touchstart',
    () => {
      audio.src =
        'data:audio/mp3;base64,//MkxAAHiAICWABElBeKPL/RANb2w+yiT1g/gTok//lP/W/l3h8QO/OCdCqCW2Cw//MkxAQHkAIWUAhEmAQXWUOFW2dxPu//9mr60ElY5sseQ+xxesmHKtZr7bsqqX2L//MkxAgFwAYiQAhEAC2hq22d3///9FTV6tA36JdgBJoOGgc+7qvqej5Zu7/7uI9l//MkxBQHAAYi8AhEAO193vt9KGOq+6qcT7hhfN5FTInmwk8RkqKImTM55pRQHQSq//MkxBsGkgoIAABHhTACIJLf99nVI///yuW1uBqWfEu7CgNPWGpUadBmZ////4sL//MkxCMHMAH9iABEmAsKioqKigsLCwtVTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVV//MkxCkECAUYCAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    },
    {
      once: true,
    },
  );

  window.addEventListener(
    'touchend',
    () => {
      audio.play();
      source.start();
    },
    {
      once: true,
    },
  );

  // wrap close so we can cleanup the silence audio node
  const { close } = ac;
  ac.close = async () => {
    audio.remove();
    return close.call(ac);
  };
};
