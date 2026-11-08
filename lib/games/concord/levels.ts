/**
 * Concord game content. Every level drills ONE confusion.
 * Rows are written as plain sentences with a ___ gap, so adding a level later is just adding data.
 * `s` = the answer is the singular form (first verb), `p` = the plural form (second verb).
 */

type Num = "s" | "p";
/** [sentence with ___, which form is right, optional reason, optional verbs overriding the level's pair] */
type Row = [text: string, num: Num, why?: string, verbs?: [string, string]];

export interface ConcordItem {
  text: string;
  answer: string;
  /** The right word and its wrong twin, in a fixed order. The game shuffles them. */
  options: [string, string];
  why: string;
}

export interface ConcordLevel {
  id: string;
  title: string;
  /** The confusion this level clears up, in the student's own words. */
  question: string;
  /** Short rule shown before the first round. */
  rule: string[];
  items: ConcordItem[];
}

function level(
  id: string,
  title: string,
  question: string,
  rule: string[],
  verbs: [string, string],
  defaultWhy: { s: string; p: string },
  rows: Row[],
): ConcordLevel {
  const items = rows.map(([text, num, why, own]): ConcordItem => {
    const pair = own ?? verbs;
    const answer = num === "s" ? pair[0] : pair[1];
    return {
      text,
      answer,
      options: [answer, num === "s" ? pair[1] : pair[0]],
      why: why ?? defaultWhy[num],
    };
  });
  return { id, title, question, rule, items };
}

const ONE_THING = "One person or thing, so we use the singular form.";
const MANY = "More than one, so we use the plural form.";

export const CONCORD_LEVELS: ConcordLevel[] = [
  level(
    "is-are",
    "is or are?",
    "When do we use is, and when do we use are?",
    ["One person or thing: is.", "More than one: are.", "Two names joined by and: are."],
    ["is", "are"],
    { s: "One person or thing, so \"is\".", p: "More than one, so \"are\"." },
    [
      ["The book ___ on the table.", "s"],
      ["The books ___ on the table.", "p"],
      ["My sister ___ a nurse.", "s"],
      ["My sisters ___ nurses.", "p"],
      ["Our school ___ very big.", "s"],
      ["Those mangoes ___ ripe.", "p"],
      ["Ade and Bola ___ best friends.", "p", "Two people joined by \"and\", so \"are\"."],
      ["The road ___ very rough.", "s"],
      ["Some students ___ late today.", "p"],
      ["A student ___ at the door.", "s"],
      ["The teacher ___ in the staff room.", "s"],
      ["The teachers ___ in the staff room.", "p"],
      ["This pen ___ mine.", "s"],
      ["These pens ___ mine.", "p"],
      ["The dog ___ barking.", "s"],
      ["The dogs ___ barking.", "p"],
      ["Lagos ___ a busy city.", "s"],
      ["My mother and my aunt ___ cooking.", "p", "Two people joined by \"and\", so \"are\"."],
      ["The window ___ open.", "s"],
    ],
  ),

  level(
    "has-have",
    "has or have?",
    "When do we use has, and when do we use have?",
    ["He, she, it and one person or thing: has.", "I, you, we, they and more than one: have."],
    ["has", "have"],
    { s: "One person or thing, so \"has\".", p: "More than one, so \"have\"." },
    [
      ["My brother ___ a new phone.", "s"],
      ["My brothers ___ new phones.", "p"],
      ["The girl ___ a red bag.", "s"],
      ["The girls ___ red bags.", "p"],
      ["I ___ a big family.", "p", "\"I\" always takes \"have\"."],
      ["You ___ a good voice.", "p", "\"You\" always takes \"have\"."],
      ["She ___ a good voice.", "s", "\"She\" takes \"has\"."],
      ["We ___ a test today.", "p", "\"We\" takes \"have\"."],
      ["They ___ finished their work.", "p", "\"They\" takes \"have\"."],
      ["He ___ finished his work.", "s", "\"He\" takes \"has\"."],
      ["The teacher ___ marked the scripts.", "s"],
      ["The teachers ___ marked the scripts.", "p"],
      ["Tolu and Kemi ___ gone home.", "p", "Two people joined by \"and\", so \"have\"."],
      ["Tolu ___ gone home.", "s"],
      ["It ___ four legs.", "s", "\"It\" takes \"has\"."],
      ["My parents ___ a car.", "p"],
      ["The man ___ been waiting for an hour.", "s"],
      ["The men ___ been waiting for an hour.", "p"],
      ["Our school ___ a library.", "s"],
    ],
  ),

  level(
    "do-does",
    "do or does?",
    "When do we use do, and when do we use does?",
    ["He, she, it and one person or thing: does.", "I, you, we, they and more than one: do.", "It works the same in questions and with \"not\"."],
    ["does", "do"],
    { s: "One person or thing, so \"does\".", p: "More than one, so \"do\"." },
    [
      ["___ the boy like rice?", "s"],
      ["___ the boys like rice?", "p"],
      ["___ she live here?", "s", "\"She\" takes \"does\"."],
      ["___ they live here?", "p", "\"They\" takes \"do\"."],
      ["___ your father work in Kano?", "s"],
      ["___ your parents work in Kano?", "p"],
      ["___ I need a pen?", "p", "\"I\" takes \"do\"."],
      ["What time ___ the class start?", "s"],
      ["Where ___ the students sit?", "p"],
      ["She ___ not like noise.", "s", "\"She\" takes \"does\"."],
      ["They ___ not like noise.", "p", "\"They\" takes \"do\"."],
      ["He ___ not know the answer.", "s", "\"He\" takes \"does\"."],
      ["We ___ not know the answer.", "p", "\"We\" takes \"do\"."],
      ["How ___ this machine work?", "s"],
      ["Why ___ the children cry?", "p", "\"Children\" is plural, so \"do\"."],
      ["___ Ade and Bola know you?", "p", "Two people joined by \"and\", so \"do\"."],
      ["___ it matter?", "s", "\"It\" takes \"does\"."],
      ["I ___ not think so.", "p", "\"I\" takes \"do\"."],
    ],
  ),

  level(
    "verb-s",
    "Which verb takes s?",
    "He goes, but they go. When does the verb take s?",
    ["He, she, it, one person or thing: the verb takes s (goes, plays).", "I, you, we, they, more than one: no s (go, play)."],
    ["", ""],
    { s: ONE_THING, p: MANY },
    [
      ["She ___ to school every day.", "s", "\"She\" is one person, so the verb takes s.", ["goes", "go"]],
      ["They ___ to school every day.", "p", "\"They\" takes no s.", ["goes", "go"]],
      ["I ___ football on Saturdays.", "p", "\"I\" takes no s.", ["plays", "play"]],
      ["He ___ football on Saturdays.", "s", "\"He\" takes s.", ["plays", "play"]],
      ["We ___ English every day.", "p", "\"We\" takes no s.", ["studies", "study"]],
      ["It ___ every night here.", "s", "\"It\" takes s.", ["rains", "rain"]],
      ["You ___ very well.", "p", "\"You\" takes no s.", ["sings", "sing"]],
      ["My sister ___ a lot.", "s", "One person, so the verb takes s.", ["reads", "read"]],
      ["The boys ___ a lot.", "p", "More than one, so no s.", ["reads", "read"]],
      ["Ngozi ___ in Lagos.", "s", "One person, so the verb takes s.", ["lives", "live"]],
      ["My parents ___ in Lagos.", "p", "More than one, so no s.", ["lives", "live"]],
      ["The bell ___ at eight.", "s", "One thing, so the verb takes s.", ["rings", "ring"]],
      ["The bells ___ at eight.", "p", "More than one, so no s.", ["rings", "ring"]],
      ["I ___ my lessons well.", "p", "\"I\" takes no s.", ["learns", "learn"]],
      ["The sun ___ in the east.", "s", "One thing, so the verb takes s.", ["rises", "rise"]],
      ["Birds ___ in the morning.", "p", "More than one, so no s.", ["sings", "sing"]],
      ["My friend ___ a bicycle.", "s", "One person, so the verb takes s.", ["owns", "own"]],
      ["The farmers ___ up early.", "p", "More than one, so no s.", ["wakes", "wake"]],
    ],
  ),

  level(
    "phrase-between",
    "Words in the middle",
    "What if there are words between the subject and the verb?",
    ["Find the real subject. It is usually the first noun.", "Ignore \"of ...\" and \"in ...\" phrases. They do not decide the verb."],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["The box of oranges ___ heavy.", "s", "The subject is \"box\", not \"oranges\". One box, so \"is\"."],
      ["The oranges in the box ___ ripe.", "p", "The subject is \"oranges\", not \"box\". More than one, so \"are\"."],
      ["The price of the shoes ___ high.", "s", "The subject is \"price\", not \"shoes\"."],
      ["The students in the hall ___ noisy.", "p", "The subject is \"students\", not \"hall\"."],
      ["A bunch of keys ___ on the table.", "s", "The subject is \"bunch\". One bunch, so \"is\"."],
      ["The leaders of the party ___ arrived.", "p", "The subject is \"leaders\", not \"party\".", ["has", "have"]],
      ["The quality of the books ___ improved.", "s", "The subject is \"quality\", not \"books\".", ["has", "have"]],
      ["The teacher of the new students ___ strict.", "s", "The subject is \"teacher\", not \"students\"."],
      ["The cost of the repairs ___ rising.", "s", "The subject is \"cost\", not \"repairs\"."],
      ["The windows in my room ___ broken.", "p", "The subject is \"windows\", not \"room\"."],
      ["The girl with the red shoes ___ my sister.", "s", "The subject is \"girl\", not \"shoes\"."],
      ["The girls near the gate ___ singing.", "p", "The subject is \"girls\", not \"gate\"."],
      ["The result of the exams ___ out.", "s", "The subject is \"result\", not \"exams\"."],
      ["The boys in the choir ___ good voices.", "p", "The subject is \"boys\", not \"choir\".", ["has", "have"]],
      ["The picture of my parents ___ on the wall.", "s", "The subject is \"picture\", not \"parents\"."],
      ["The books on the shelf ___ mine.", "p", "The subject is \"books\", not \"shelf\"."],
      ["The man in the long white robes ___ my uncle.", "s", "The subject is \"man\", not \"robes\"."],
    ],
  ),

  level(
    "collective",
    "Teams, crowds and the police",
    "Is committee singular or plural? What about police?",
    [
      "A group acting as one (committee, team, class, family, government): singular.",
      "Police, people, cattle, children: always plural, even without an s.",
    ],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["The committee ___ reached a decision.", "s", "A committee acting as one group is singular.", ["has", "have"]],
      ["The football team ___ won the match.", "s", "A team acting as one is singular.", ["has", "have"]],
      ["Our class ___ a test today.", "s", "\"Class\" acting as one group is singular.", ["has", "have"]],
      ["The government ___ promised new roads.", "s", "\"Government\" acting as one is singular.", ["has", "have"]],
      ["The jury ___ ready to give its verdict.", "s", "\"Jury\" acting as one group is singular."],
      ["The audience ___ clapping loudly.", "s", "\"Audience\" acting as one group is singular."],
      ["The family ___ moving to Abuja.", "s", "\"Family\" acting as one group is singular."],
      ["The choir ___ rehearsing now.", "s", "\"Choir\" acting as one group is singular."],
      ["The police ___ arrested the thief.", "p", "\"Police\" is always plural.", ["has", "have"]],
      ["The police ___ looking for him.", "p", "\"Police\" is always plural."],
      ["People ___ waiting outside.", "p", "\"People\" is always plural."],
      ["The cattle ___ grazing in the field.", "p", "\"Cattle\" is always plural."],
      ["The children ___ playing outside.", "p", "\"Children\" is plural, even though it has no s."],
      ["The crowd ___ growing bigger.", "s", "\"Crowd\" acting as one group is singular."],
      ["The army ___ a strong force.", "s", "\"Army\" acting as one group is singular."],
      ["The management ___ made its decision.", "s", "\"Management\" acting as one group is singular.", ["has", "have"]],
      ["The police ___ not found the car yet.", "p", "\"Police\" is always plural.", ["has", "have"]],
    ],
  ),

  level(
    "looks-plural",
    "Looks plural, isn't",
    "Is news singular? What about mathematics, or trousers?",
    [
      "News, mathematics, physics, economics, measles: end in s but are singular.",
      "Trousers, scissors, glasses, clothes: plural. \"A pair of ...\" is singular.",
    ],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["The news ___ good.", "s", "\"News\" ends in s but is singular."],
      ["Mathematics ___ my favourite subject.", "s", "School subjects like mathematics are singular."],
      ["Physics ___ difficult for some students.", "s", "School subjects like physics are singular."],
      ["Economics ___ taught in SS2.", "s", "School subjects like economics are singular."],
      ["Measles ___ a serious illness.", "s", "Illnesses like measles are singular."],
      ["Politics ___ his passion.", "s", "\"Politics\" here is singular."],
      ["Athletics ___ popular in my school.", "s", "\"Athletics\" is singular."],
      ["Civics ___ taught in primary school.", "s", "School subjects like civics are singular."],
      ["The trousers ___ too long for him.", "p", "\"Trousers\" is always plural."],
      ["My glasses ___ on the table.", "p", "\"Glasses\" (spectacles) is always plural."],
      ["The scissors ___ sharp.", "p", "\"Scissors\" is always plural."],
      ["A pair of trousers ___ on the bed.", "s", "The subject is \"pair\". One pair, so \"is\"."],
      ["The United States ___ a large country.", "s", "A country's name is singular, even with an s."],
      ["Her clothes ___ wet.", "p", "\"Clothes\" is always plural."],
      ["Diabetes ___ a common disease.", "s", "Illnesses like diabetes are singular."],
      ["The pliers ___ in the toolbox.", "p", "\"Pliers\" is always plural."],
      ["The goods ___ delivered yesterday.", "p", "\"Goods\" is always plural.", ["was", "were"]],
    ],
  ),

  level(
    "each-every",
    "Each, every, everyone, nobody",
    "Is everyone singular or plural?",
    [
      "Each, every, everyone, everybody, nobody, someone, anyone, everything: all singular.",
      "Both, all, many, several, few: plural.",
    ],
    ["is", "are"],
    { s: "This word is always singular.", p: "This word means more than one." },
    [
      ["Each of the boys ___ a book.", "s", "\"Each\" is singular.", ["has", "have"]],
      ["Every student ___ expected to attend.", "s", "\"Every\" is singular."],
      ["Everyone ___ here.", "s", "\"Everyone\" is singular."],
      ["Nobody ___ perfect.", "s", "\"Nobody\" is singular."],
      ["Somebody ___ knocking at the door.", "s", "\"Somebody\" is singular."],
      ["Each student ___ a locker.", "s", "\"Each\" is singular.", ["has", "have"]],
      ["Everybody ___ to bring a pen.", "s", "\"Everybody\" is singular.", ["has", "have"]],
      ["Anyone who ___ late must wait outside.", "s", "\"Anyone\" is singular."],
      ["Each of the girls ___ a bag.", "s", "\"Each\" is singular.", ["has", "have"]],
      ["Everything ___ ready.", "s", "\"Everything\" is singular."],
      ["No one ___ come yet.", "s", "\"No one\" is singular.", ["has", "have"]],
      ["Every boy and girl ___ welcome.", "s", "After \"every\", even two names count as one at a time."],
      ["Everyone in the hall ___ standing.", "s", "\"Everyone\" is the subject, not \"hall\"."],
      ["Someone ___ taken my pen.", "s", "\"Someone\" is singular.", ["has", "have"]],
      ["Nobody in the class ___ the answer.", "s", "\"Nobody\" is singular.", ["knows", "know"]],
      ["Both of the boys ___ here.", "p", "\"Both\" means two, so plural."],
      ["All the students ___ present.", "p", "\"All the students\" is plural."],
      ["Many of us ___ tired.", "p", "\"Many\" is plural."],
      ["Several of the books ___ missing.", "p", "\"Several\" is plural."],
      ["Few people ___ perfect.", "p", "\"Few\" is plural."],
    ],
  ),

  level(
    "either-neither",
    "Either/or, neither/nor",
    "Which verb do I use after either ... or and neither ... nor?",
    [
      "The verb agrees with the noun NEAREST to it.",
      "Either of / neither of + a group: singular.",
    ],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["Neither the teacher nor the students ___ ready.", "p", "The nearest noun is \"students\" (plural), so \"are\"."],
      ["Neither the students nor the teacher ___ ready.", "s", "The nearest noun is \"teacher\" (singular), so \"is\"."],
      ["Either Ade or Bola ___ coming.", "s", "The nearest noun is \"Bola\" (singular), so \"is\"."],
      ["Either the boys or the girl ___ lying.", "s", "The nearest noun is \"girl\" (singular), so \"is\"."],
      ["Either the girl or the boys ___ lying.", "p", "The nearest noun is \"boys\" (plural), so \"are\"."],
      ["Neither of the boys ___ here.", "s", "\"Neither of\" takes a singular verb."],
      ["Either of the books ___ fine.", "s", "\"Either of\" takes a singular verb."],
      ["Neither Tola nor her sisters ___ present.", "p", "The nearest noun is \"sisters\" (plural).", ["was", "were"]],
      ["Neither her sisters nor Tola ___ present.", "s", "The nearest noun is \"Tola\" (singular).", ["was", "were"]],
      ["Either my father or my uncles ___ coming.", "p", "The nearest noun is \"uncles\" (plural), so \"are\"."],
      ["Neither the pupils nor the headmaster ___ aware.", "s", "The nearest noun is \"headmaster\" (singular).", ["was", "were"]],
      ["Not only the boys but also the girl ___ guilty.", "s", "The nearest noun is \"girl\" (singular), so \"is\"."],
      ["Not only the girl but also the boys ___ guilty.", "p", "The nearest noun is \"boys\" (plural), so \"are\"."],
      ["Either he or his friends ___ to blame.", "p", "The nearest noun is \"friends\" (plural), so \"are\"."],
      ["Neither of the answers ___ correct.", "s", "\"Neither of\" takes a singular verb."],
      ["Neither he nor his brothers ___ been here.", "p", "The nearest noun is \"brothers\" (plural).", ["has", "have"]],
      ["Either the cook or the cleaners ___ responsible.", "p", "The nearest noun is \"cleaners\" (plural), so \"are\"."],
      ["Neither the cleaners nor the cook ___ responsible.", "s", "The nearest noun is \"cook\" (singular), so \"is\"."],
    ],
  ),

  level(
    "number-of",
    "One of, the number of, a number of",
    "What is the difference between \"the number of\" and \"a number of\"?",
    [
      "One of the ... , the number of ...: singular.",
      "A number of ..., a variety of ...: plural.",
      "Many a ..., more than one ...: singular.",
    ],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["One of the boys ___ absent.", "s", "The subject is \"one\", not \"boys\"."],
      ["One of my friends ___ a doctor.", "s", "The subject is \"one\", not \"friends\"."],
      ["The number of students ___ increasing.", "s", "\"The number of\" is singular. It talks about the count itself."],
      ["A number of students ___ absent.", "p", "\"A number of\" means \"several\", so plural."],
      ["A number of chairs ___ broken.", "p", "\"A number of\" means \"several\", so plural."],
      ["The number of candidates ___ large.", "s", "\"The number of\" is singular."],
      ["One of the books ___ torn.", "s", "The subject is \"one\", not \"books\"."],
      ["A large number of people ___ waiting.", "p", "\"A large number of\" means \"many\", so plural."],
      ["One of the reasons ___ poverty.", "s", "The subject is \"one\", not \"reasons\"."],
      ["The total number of seats ___ ten.", "s", "\"The number of\" is singular."],
      ["Many a student ___ failed this exam.", "s", "\"Many a\" is followed by a singular verb.", ["has", "have"]],
      ["More than one student ___ complained.", "s", "\"More than one\" takes a singular verb.", ["has", "have"]],
      ["A variety of fruits ___ sold here.", "p", "\"A variety of\" means \"many\", so plural."],
      ["A couple of days ___ passed.", "p", "\"A couple of\" means two or so, so plural.", ["has", "have"]],
      ["The number of days in a week ___ seven.", "s", "\"The number of\" is singular."],
      ["A number of my classmates ___ passed.", "p", "\"A number of\" means \"several\", so plural.", ["has", "have"]],
      ["One of the girls ___ lost her bag.", "s", "The subject is \"one\", not \"girls\".", ["has", "have"]],
    ],
  ),

  level(
    "together-with",
    "With, along with, as well as",
    "Does \"together with\" make the subject plural?",
    [
      "\"and\" joins two subjects: plural.",
      "\"with, along with, as well as, together with\" do NOT join them. The verb follows the FIRST subject.",
    ],
    ["is", "are"],
    { s: ONE_THING, p: MANY },
    [
      ["The teacher, together with the pupils, ___ here.", "s", "\"Together with\" adds extra words. The subject is still \"teacher\"."],
      ["The pupils, together with the teacher, ___ here.", "p", "The subject is \"pupils\" (plural)."],
      ["Ade, as well as his brothers, ___ a footballer.", "s", "\"As well as\" adds extra words. The subject is \"Ade\"."],
      ["Ade and his brothers ___ footballers.", "p", "\"And\" joins them, so plural."],
      ["The principal, along with two teachers, ___ attended.", "s", "\"Along with\" adds extra words. The subject is \"principal\".", ["has", "have"]],
      ["My mother, in addition to my aunts, ___ coming.", "s", "The subject is \"mother\"."],
      ["The boys, with their father, ___ gone.", "p", "The subject is \"boys\" (plural).", ["has", "have"]],
      ["The captain, accompanied by his men, ___ arrived.", "s", "The subject is \"captain\".", ["has", "have"]],
      ["Tunde and Femi ___ gone out.", "p", "\"And\" joins them, so plural.", ["has", "have"]],
      ["The driver, as well as the passengers, ___ injured.", "s", "The subject is \"driver\".", ["was", "were"]],
      ["The passengers, as well as the driver, ___ injured.", "p", "The subject is \"passengers\".", ["was", "were"]],
      ["Mr Bello, with his wife, ___ at the party.", "s", "The subject is \"Mr Bello\".", ["was", "were"]],
      ["Mr Bello and his wife ___ at the party.", "p", "\"And\" joins them, so plural.", ["was", "were"]],
      ["The chief, along with his elders, ___ welcomed us.", "s", "The subject is \"chief\".", ["has", "have"]],
      ["The elders, along with the chief, ___ welcomed us.", "p", "The subject is \"elders\".", ["has", "have"]],
      ["The cat, along with her kittens, ___ asleep.", "s", "The subject is \"cat\"."],
      ["The kittens, along with the cat, ___ asleep.", "p", "The subject is \"kittens\"."],
    ],
  ),

  level(
    "was-were",
    "was or were?",
    "When do we use was, and when do we use were?",
    [
      "I, he, she, it and one person or thing: was.",
      "You, we, they and more than one: were.",
      "Imagined things (if I were, I wish I were): were for everyone.",
    ],
    ["was", "were"],
    { s: ONE_THING, p: MANY },
    [
      ["I ___ at home yesterday.", "s", "\"I\" takes \"was\"."],
      ["You ___ right.", "p", "\"You\" always takes \"were\"."],
      ["They ___ at school.", "p", "\"They\" takes \"were\"."],
      ["He ___ ill last week.", "s", "\"He\" takes \"was\"."],
      ["We ___ happy.", "p", "\"We\" takes \"were\"."],
      ["The boys ___ playing.", "p"],
      ["The girl ___ crying.", "s"],
      ["If I ___ you, I would study.", "p", "An imagined situation (\"if I were you\") takes \"were\" for every subject."],
      ["I wish I ___ taller.", "p", "A wish takes \"were\" for every subject."],
      ["If he ___ rich, he would help us.", "p", "An imagined situation takes \"were\" for every subject."],
      ["She talks as if she ___ the owner.", "p", "\"As if\" an imagined situation takes \"were\"."],
      ["My parents ___ not at home.", "p"],
      ["Tolu and I ___ in the same class.", "p", "Two people joined by \"and\", so \"were\"."],
      ["The news ___ shocking.", "s", "\"News\" is singular."],
      ["Neither of them ___ present.", "s", "\"Neither of\" takes a singular verb."],
      ["There ___ many people at the party.", "p", "\"People\" is plural, so \"were\"."],
      ["There ___ a man at the door.", "s", "One man, so \"was\"."],
      ["The children ___ asleep.", "p", "\"Children\" is plural."],
    ],
  ),
];

export const MIXED_ID = "mixed";

export const levelById = (id: string) => CONCORD_LEVELS.find((l) => l.id === id);

export const ROUNDS_PER_LEVEL = 3;
export const SENTENCES_PER_ROUND = 5;
export const SENTENCES_PER_LEVEL = ROUNDS_PER_LEVEL * SENTENCES_PER_ROUND;

/** Fisher-Yates, so every play of a level is a fresh draw from the pool. */
function shuffle<T>(list: readonly T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fifteen items for one level, or fifteen from every level for Mixed. Options are shuffled too. */
export function drawItems(levelId: string): ConcordItem[] {
  const pool = levelId === MIXED_ID ? CONCORD_LEVELS.flatMap((l) => l.items) : (levelById(levelId)?.items ?? []);
  return shuffle(pool)
    .slice(0, SENTENCES_PER_LEVEL)
    .map((item) => ({ ...item, options: shuffle(item.options) as [string, string] }));
}

/** More generous than the practice stars: with two choices, guessing alone lands about 50%. */
export function concordStars(correct: number, total = SENTENCES_PER_LEVEL): 0 | 1 | 2 | 3 {
  const pct = (correct / total) * 100;
  if (pct >= 93) return 3;
  if (pct >= 80) return 2;
  if (pct >= 67) return 1;
  return 0;
}
