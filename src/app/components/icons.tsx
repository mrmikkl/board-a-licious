const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const IconCollections = () => (
  <svg {...common}>
    <path d="M12 2 20 6.5v11L12 22l-8-4.5v-11z" />
    <path d="M12 22V12M20 6.5 12 12 4 6.5" />
  </svg>
)
export const IconLists = () => (
  <svg {...common}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)
export const IconPlus = () => (
  <svg {...common} strokeWidth={3}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconSearch = () => (
  <svg {...common}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconConfig = () => (
  <svg {...common}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconShare = () => (
  <svg {...common}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)
export const IconFilter = () => (
  <svg {...common}>
    <path d="M3 5h18l-7 8v5l-4 2v-7z" />
  </svg>
)
/** F003: the app bar's menu button */
export const IconMenu = () => (
  <svg {...common} strokeWidth={2.4}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
/** F003: the main button inside a collection (BG-Tinder) */
export const IconHeart = () => (
  <svg {...common} strokeWidth={2.6}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
)
/** F003: edit a collection, beside its name */
export const IconPencil = () => (
  <svg {...common}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)
/** F004: Show-off, three hexagons of a honeycomb */
export const IconShowOff = () => (
  <svg {...common} strokeWidth={1.8}>
    <path d="M7 3.5 10.5 5.5v4L7 11.5 3.5 9.5v-4z" />
    <path d="M17 3.5 20.5 5.5v4L17 11.5 13.5 9.5v-4z" />
    <path d="M12 12.5 15.5 14.5v4L12 20.5 8.5 18.5v-4z" />
  </svg>
)
export const IconBag = () => (
  <svg {...common} width={18} height={18}>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)
export const IconBagCheck = () => (
  <svg {...common} width={18} height={18} strokeWidth={2.2}>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
)
/** F005: the Category action of a game row, two hexagons */
export const IconCategory = () => (
  <svg {...common} width={18} height={18} strokeWidth={1.9}>
    <path d="M9 3.5 13 5.8v4.6L9 12.7 5 10.4V5.8z" />
    <path d="M15 11.3 19 13.6v4.6l-4 2.3-4-2.3v-4.6z" />
  </svg>
)
export const IconResync = () => (
  <svg {...common} strokeWidth={2.2}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20v-4h-4" />
  </svg>
)
