export const WORLD = Object.freeze({
  width: 1600,
  height: 900,
  gridCell: 80,
});

export const LOOP = Object.freeze({
  step: 1 / 60,
  maxSteps: 5,
  maxFrameDelta: 0.25,
});

export const COLORS = Object.freeze({
  white: '#ffffff',
  cyan: '#51f6ff',
  cyanBright: '#8ffbff',
  cyanPale: '#eaffff',
  cyanKnob: '#bafcff',
  cyanInk: '#0a2233',
  cyanSoft: 'rgba(81, 246, 255, 0.14)',
  cyanShield: 'rgba(81, 246, 255, 0.45)',
  cyanBorder: 'rgba(81, 246, 255, 0.4)',
  cyanGridMajor: 'rgba(81, 246, 255, 0.09)',
  cyanGridMinor: 'rgba(81, 246, 255, 0.035)',
  cyanJoystick: 'rgba(81, 246, 255, 0.18)',
  cyanReticle: 'rgba(81, 246, 255, 0.55)',
  pink: '#ff3bd4',
  pinkFlame: 'rgba(255, 59, 212, 0.85)',
  pinkReticle: 'rgba(255, 59, 212, 0.6)',
  pinkGridMajor: 'rgba(255, 59, 212, 0.07)',
  pinkBorder: 'rgba(255, 59, 212, 0.25)',
  red: '#ff3b6b',
  redLight: '#ff8a9c',
  redSoft: 'rgba(255, 59, 107, 0.18)',
  amber: '#ffb340',
  amberSoft: 'rgba(255, 179, 64, 0.16)',
  violet: '#b45cff',
  violetSoft: 'rgba(180, 92, 255, 0.17)',
  boss: '#ff2bd6',
  bossSoft: 'rgba(255, 43, 214, 0.16)',
  green: '#8dff6e',
  bgInner: '#0b1228',
  bgMid: '#060a18',
  bgOuter: '#02030a',
  vignetteClear: 'rgba(0, 0, 0, 0)',
  vignetteEdge: 'rgba(0, 0, 0, 0.62)',
  tankHpBack: 'rgba(4, 8, 18, 0.8)',
  hitFlashRgb: '255, 42, 92',
  dangerVignetteClear: 'rgba(255, 28, 80, 0)',
  dangerVignetteEdge: 'rgba(255, 28, 80, 0.72)',
  dashRingBack: 'rgba(81, 246, 255, 0.2)',
  dashRingReady: 'rgba(81, 246, 255, 0.4)',
});

export const TIME = Object.freeze({
  hitStop: Object.freeze({
    bossHitFrames: 2,
    bossHitCooldown: 0.12,
    bossDeathFrames: 4,
    tankDeathFrames: 3,
  }),
  slowMo: Object.freeze({
    scale: 0.34,
    levelUpDuration: 0.45,
    bossDeathDuration: 0.7,
  }),
});

export const DASH = Object.freeze({
  duration: 0.16,
  speed: 1050,
  cooldown: 1.15,
  minInput: 0.001,
  ring: Object.freeze({
    radiusPad: 11,
    width: 3,
    readyAlpha: 0.38,
    cooldownAlpha: 0.92,
    readyPulseSpeed: 4,
    readyPulseAmp: 0.08,
    startAngle: -Math.PI / 2,
  }),
});

export const INPUT = Object.freeze({
  joystickRadius: 72,
  knobRadius: 30,
  touchSplit: 0.5,
  pulseBase: 0.55,
  pulseAmplitude: 0.1,
  pulseSpeed: 8,
  joystickAlpha: 0.4,
  lineWidth: 2,
});
