/**
 * A game being played, as opposed to a list of games. While a game is on, the header and the bottom bar
 * go away so nothing pulls the student out of it. The lists (/games, /games/maths, a topic's levels) keep them.
 */
const SESSION = [/^\/games\/concord\/[^/]+/, /^\/games\/play\/[^/]+\/[^/]+/, /^\/games\/maths\/[^/]+\/[^/]+/];

export const isGameSession = (pathname: string) => SESSION.some((re) => re.test(pathname));

/** Reading a note. Like a game, it takes the whole screen: no header, no bottom bar. The Read list keeps them. */
export const isReadingSession = (pathname: string) => /^\/read\/[^/]+/.test(pathname);

/** Any page that takes over the screen. */
export const isFocusedPage = (pathname: string) => isGameSession(pathname) || isReadingSession(pathname);