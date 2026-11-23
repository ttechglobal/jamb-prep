/**
 * A game being played, as opposed to a list of games. While a game is on, the header and the bottom bar
 * go away so nothing pulls the student out of it. The lists (/games, /games/maths, a topic's levels) keep them.
 */
const SESSION = [/^\/games\/concord\/[^/]+/, /^\/games\/play\/[^/]+\/[^/]+/, /^\/games\/maths\/[^/]+\/[^/]+/];

export const isGameSession = (pathname: string) => SESSION.some((re) => re.test(pathname));