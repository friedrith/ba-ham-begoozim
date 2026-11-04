import type { Messages } from './messages'

export const en: Messages = {
  locale: 'en',
  dir: 'ltr',
  languageName: 'English',
  title: 'Toot Canal',
  menuTitle: 'Ba Ham Begoozim',
  tagline: 'Four beans. One bathtub. No engine.',
  menu: {
    levels: 'Levels',
    howToPlay: 'How to play',
    howToPlayTitle: 'Grab a corner of the keyboard',
    howToPlayTitleTouch: 'Grab a corner of the screen',
    howToPlayBody:
      '**Rear beans** push forward, **front beans** push back, and a blast from one side turns the tub. Blast within a blink of each other for a **harmony**: a bigger shove, gas back, and a chord.',
    howToPlaySolo:
      'Solo? `← →` work the rear and `↓` the front. On a touch screen, use the corner pads.',
    stars: (count) => `${count} of 3 stars`,
    par: (time) => `Par ${time}`,
  },
  hud: {
    time: 'Time',
    cans: 'Cans collected',
    mute: 'Mute',
    unmute: 'Unmute',
    restartLevel: 'Restart level',
    pause: 'Pause',
    seatPad: (seat) => `${seat.name} bean, key ${seat.key}`,
    seatPadTouch: (seat) => `${seat.name} bean`,
    holdCorner: 'Hold your corner to blast.',
  },
  paused: {
    title: 'Paused',
    resume: 'Keep tooting',
    restart: 'Restart',
    menu: 'Menu',
  },
  result: {
    title: 'Canal cleared!',
    time: (par) => `Time (par ${par})`,
    cans: 'Cans',
    harmonies: 'Harmonies',
    wipeouts: 'Wipeouts',
    nextLevel: 'Next canal',
    again: 'Go again',
    menu: 'Menu',
  },
  fx: {
    toots: ['TOOT!', 'PARP!', 'PFFT!', 'BRRT!', 'FWEEP!', 'POOT!'],
    harmony: 'HARMONY!',
    ignite: 'WHOOSH!',
    can: '+GAS',
    respawn: 'GLUG!',
    go: 'BLAST!',
  },
  seats: [
    { name: 'Front left', key: 'Q' },
    { name: 'Front right', key: 'P' },
    { name: 'Rear left', key: 'Z' },
    { name: 'Rear right', key: 'M' },
  ],
  levels: {
    'bathwater-bend': {
      name: 'Bathwater Bend',
      blurb: 'Soapy, warm and forgiving. Learn to steer before anyone gets hurt.',
      hint: 'Rear beans push you forward. Blast both at once for a harmony!',
    },
    'storm-drain': {
      name: 'Storm Drain',
      blurb: 'Sliding gates, spinning paddles and a current with a grudge.',
      hint: 'Front beans push you backward. Use them to brake and spin on the spot.',
    },
    'boiler-room': {
      name: 'The Boiler Room',
      blurb: 'Open flames and open plumbing. Blast near a flame and hold on tight.',
      hint: 'Blasting next to a pilot light ignites you for a huge boost. Whoosh.',
    },
  },
}
