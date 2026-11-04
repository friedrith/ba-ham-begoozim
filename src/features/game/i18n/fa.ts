import type { Messages } from './messages'

/**
 * Written in colloquial Persian to keep the game's silliness. The key letters are the
 * standard Persian layout (ISIRI 9147) on the same physical keys as Q, P, Z and M.
 */
export const fa: Messages = {
  locale: 'fa',
  dir: 'rtl',
  languageName: 'فارسی',
  title: 'با هم بگوزیم',
  menuTitle: 'با هم بگوزیم',
  tagline: 'چهار تا لوبیا. یه وان. موتور هم نداریم.',
  menu: {
    levels: 'مرحله‌ها',
    howToPlay: 'طرز بازی',
    howToPlayTitle: 'هر کی یه گوشهٔ کیبورد رو بگیره',
    howToPlayTitleTouch: 'هر کی یه گوشهٔ صفحه رو بگیره',
    howToPlayBody:
      '**لوبیاهای عقب** وان رو هل می‌دن جلو، **لوبیاهای جلو** هل می‌دن عقب، و گوزیدن از یه طرف وان رو می‌چرخونه. توی یه چشم به هم زدن با هم بگوزید تا **هم‌نوایی** بشه: هل گنده‌تر، یه کم گاز برگشتی و یه آکورد قشنگ.',
    howToPlaySolo:
      'تنهایی؟ `← →` کار لوبیاهای عقب رو می‌کنن و `↓` کار لوبیاهای جلو رو. روی صفحهٔ لمسی از دکمه‌های گوشه استفاده کن.',
    stars: (count) => `${count} از ۳ ستاره`,
    par: (time) => `هدف ${time}`,
  },
  hud: {
    time: 'زمان',
    cans: 'کنسروهای جمع‌شده',
    mute: 'بی‌صدا',
    unmute: 'باصدا',
    restartLevel: 'شروع دوبارهٔ مرحله',
    pause: 'مکث',
    seatPad: (seat) => `لوبیای ${seat.name}، کلید ${seat.key}`,
    seatPadTouch: (seat) => `لوبیای ${seat.name}`,
    holdCorner: 'گوشهٔ خودت رو نگه دار تا بگوزی.',
  },
  paused: {
    title: 'یه نفس بگیر',
    resume: 'به گوزیدن ادامه بده',
    restart: 'از اول',
    menu: 'منو',
  },
  result: {
    title: 'از کانال رد شدید!',
    time: (par) => `زمان (هدف ${par})`,
    cans: 'کنسرو',
    harmonies: 'هم‌نوایی',
    wipeouts: 'غرق‌شدن',
    nextLevel: 'کانال بعدی',
    again: 'یه بار دیگه',
    menu: 'منو',
  },
  fx: {
    toots: ['بوق!', 'پررت!', 'فیسسس!', 'تررق!', 'فیو!', 'پوف!'],
    harmony: 'هم‌نوایی!',
    ignite: 'ویژژژ!',
    can: '+گاز',
    respawn: 'قلپ قلپ!',
    go: 'بگوزید!',
  },
  seats: [
    { name: 'جلو چپ', key: 'ض' },
    { name: 'جلو راست', key: 'ح' },
    { name: 'عقب چپ', key: 'ظ' },
    { name: 'عقب راست', key: 'پ' },
  ],
  levels: {
    'bathwater-bend': {
      name: 'پیچ کف‌صابون',
      blurb:
        'کف‌آلود، گرم و دل‌رحم. فرمون گرفتن رو یاد بگیر، قبل از اینکه کسی آسیب ببینه.',
      hint: 'لوبیاهای عقب هلتون می‌دن جلو. هر دو با هم بگوزن، می‌شه هم‌نوایی!',
    },
    'storm-drain': {
      name: 'جوب طوفانی',
      blurb: 'دریچه‌های کشویی، پاروهای چرخون و جریانی که ازتون کینه به دل داره.',
      hint: 'لوبیاهای جلو هلتون می‌دن عقب. باهاشون ترمز کنید و درجا بچرخید.',
    },
    'boiler-room': {
      name: 'موتورخونه',
      blurb: 'شعلهٔ باز و لوله‌کشی باز. کنار شعله بگوز و محکم بچسب.',
      hint: 'گوزیدن کنار شعلهٔ پیلوت آتیشتون می‌زنه و پرتابتون می‌کنه. ویژژژ!',
    },
  },
}
