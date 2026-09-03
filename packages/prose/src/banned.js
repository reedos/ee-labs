// The constructions STYLE.md removes, with the replacement it gives.
//
// Each entry is one rule, one regex, and the hint a failing test prints. Keep
// the hints imperative and specific: a test that says only "banned phrase" makes
// the writer guess.

export const BANNED = [
  {
    rule: 'S7 personification',
    re: /\b(the )?(solver|circuit|loop|source|resistor|capacitor|inductor|integrator|filter|engine|app)s? (refuses?|decides?|wants?|knows?|remembers?|forgives?|admits?|insists?|fights?)\b/gi,
    hint: 'state what happens: "the circuit has no solution, and the app gives the reason"',
  },
  {
    rule: 'S7 personification',
    re: /\b(has no right to|fight(s|ing)? (it|them) off|pay(s)? its bills|shove the|the books balance)\b/gi,
    hint: 'name the mechanism instead of the attitude',
  },
  {
    rule: 'S8 praise of the work',
    re: /\b(worth loving|femto-dust|ceremony|confidently wrong|a sharp instrument|the real thing|is honest about|honestly)\b/gi,
    hint: 'delete, or state the fact the praise was standing in for',
  },
  {
    rule: 'S10 theatrical second person',
    re: /\b(in front of you|stands up|comes alive|before it sings|watch the number|nothing is free)\b/gi,
    hint: 'second person is for instructions only: "Set R to 100 Ω"',
  },
  {
    rule: 'S1 aphoristic closer',
    re: /\b(that is what .{0,24} means|which is what .{0,24} means|that is why .{0,24} exists)\b/gi,
    hint: 'state the property directly, without the epigram',
  },
  {
    rule: 'S4 negate then correct',
    re: /\b(not a convention|not a bigger number|not three approximations|is not a .{0,20}: it is)\b/gi,
    hint: 'say what it is; do not stage a correction',
  },
  {
    rule: 'S9 emphasis by capital',
    re: /(?<![A-Z0-9_])\b(THAT|NOT|PLANT|LINEAR|SAY SO)\b(?![A-Z0-9_])/g,
    hint: 'carry the emphasis in sentence order, not in capitals',
  },
]
