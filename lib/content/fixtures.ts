import { math, paragraph, text } from "@/lib/content/build";
import type { Block, SharedContext } from "@/lib/content/types";
import type { QuestionDraft } from "@/lib/content/validate";
import type { PublicQuestion, QuestionReveal } from "@/lib/types";

/**
 * TEST CONTENT for the renderer. Never imported into the question bank.
 * "fixture" means written for this test. "real row" means copied from the Exam Prep A1 sample.
 */

export interface ContentFixture {
  id: string;
  title: string;
  source: "fixture" | "real row";
  note?: string;
  question: PublicQuestion;
  reveal: QuestionReveal;
}

const svg = (body: string, w = 320, h = 200) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Arial" font-size="16"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`)}`;

const SOURCE_TRIANGLE = svg(`<polygon points="40,170 280,170 40,40" fill="#e0f2fe" stroke="#1f2937" stroke-width="2"/><rect x="40" y="154" width="16" height="16" fill="none" stroke="#1f2937"/><text x="150" y="192">12 cm</text><text x="6" y="110">5 cm</text><text x="165" y="96">x</text>`);
const SOLUTION_TRIANGLE = svg(`<polygon points="40,170 280,170 40,40" fill="#dcfce7" stroke="#16a34a" stroke-width="3"/><text x="150" y="192">12</text><text x="16" y="110">5</text><text x="150" y="92" font-weight="bold">x = 13</text><text x="84" y="30">5² + 12² = 13²</text>`);
const shape = (body: string) => svg(body, 120, 90);
const key = (k: "A" | "B" | "C" | "D", ...content: (string | ReturnType<typeof text>)[]) => ({ key: k, blocks: [paragraph(...content)] });
const plainOptions = (a: string, b: string, c: string, d: string) => [key("A", a), key("B", b), key("C", c), key("D", d)];
const base = { topicId: null, instruction: null, context: null, work: null };
const cell = (value: string) => [text(value)];
const answer = (questionId: string, correctOption: "A" | "B" | "C" | "D", ...answerBlocks: Block[]): QuestionReveal => ({
  questionId,
  correctOption,
  solution: { answer: answerBlocks },
});

const PASSAGE: SharedContext = {
  id: "fixture-passage",
  kind: "passage",
  title: "Passage: The Harmattan Market",
  credit: "Written for this test",
  blocks: [
    paragraph("Long before the first buses arrived, the traders of Ojuelegba had unrolled their mats. The harmattan had settled on the city overnight, and everything wore a thin coat of dust."),
    paragraph("Mama Tolu, who had sold pepper at the same corner for thirty years, said the dust was only the sky reminding Lagos who was in charge. Her neighbours laughed, but they covered their baskets all the same."),
    paragraph("By noon the wind had dropped. Customers came and went, and nobody spoke of the weather again until evening, when the cold returned and the mats were rolled up once more."),
  ],
};

const POEM: SharedContext = {
  id: "fixture-poem",
  kind: "poem",
  title: "Poem: Rain Season",
  credit: "Written for this test",
  blocks: [
    {
      type: "verse",
      stanzas: [
        [
          { number: 1, content: [text("The clouds come home at evening,")] },
          { content: [text("heavy with the sea;")] },
          { number: 3, content: [text("they knock on every roof of zinc")] },
          { content: [text("and ask the rain for me.")] },
        ],
        [
          { number: 5, content: [text("My mother leaves the basin out,")] },
          { content: [text("my father mends the door;")] },
          { number: 7, content: [text("and all the children of the street")] },
          { content: [text("run laughing to the shore.")] },
        ],
      ],
    },
  ],
};

const DIALOGUE: SharedContext = {
  id: "fixture-dialogue",
  kind: "dialogue",
  title: "Extract",
  credit: "Written for this test",
  blocks: [
    {
      type: "dialogue",
      turns: [
        { speaker: "Ada", content: [text("You said the meeting was at noon.")] },
        { speaker: "Bayo", content: [text("I said "), text("after", "italic"), text(" noon. There is a difference.")] },
        { speaker: "Ada", content: [text("Only to people who are always late.")] },
      ],
    },
  ],
};

export const FIXTURES: { group: string; items: ContentFixture[] }[] = [
  {
    group: "1. Shared passage, instruction and a marked letter",
    items: [
      {
        id: "passage-1",
        title: "First question on the passage",
        source: "fixture",
        question: {
          ...base,
          id: "passage-1",
          subjectId: "english",
          instruction: [paragraph("Read the passage and answer the questions that follow.")],
          context: PASSAGE,
          stem: [paragraph("According to the passage, the traders covered their baskets because")],
          options: plainOptions("Mama Tolu told them to", "dust had settled on the city", "the buses had arrived", "it was about to rain"),
        },
        reveal: answer("passage-1", "B", paragraph("The harmattan left dust on everything, so the traders protected their goods.")),
      },
      {
        id: "passage-2",
        title: "Second question, same passage",
        source: "fixture",
        question: {
          ...base,
          id: "passage-2",
          subjectId: "english",
          instruction: [paragraph("Read the passage and answer the questions that follow.")],
          context: PASSAGE,
          stem: [paragraph("The writer's tone in the second paragraph is best described as")],
          options: plainOptions("angry", "light-hearted", "fearful", "bitter"),
        },
        reveal: answer("passage-2", "B", paragraph("Mama Tolu's joke and the neighbours' laughter set a gentle, humorous tone.")),
      },
      {
        id: "underline-letter",
        title: "Underline on one letter inside a word",
        source: "fixture",
        question: {
          ...base,
          id: "underline-letter",
          subjectId: "english",
          instruction: [paragraph("Choose the word that has the same vowel sound as the letters underlined.")],
          stem: [
            paragraph("b", text("oo", "underline"), "k"),
            paragraph("Other marks: ", text("double", "double_underline"), ", ", text("shaded", "highlight"), ", H", text("2", "subscript"), "O, x", text("3", "superscript"), ", ", text("bold italic", "bold", "italic")),
          ],
          options: plainOptions("food", "put", "boot", "cool"),
        },
        reveal: answer("underline-letter", "B", paragraph("The vowel in “book” is /ʊ/, as in “put”.")),
      },
    ],
  },
  {
    group: "2. Poem and dialogue",
    items: [
      {
        id: "poem",
        title: "Poem with stanzas, line numbers and credit",
        source: "fixture",
        question: {
          ...base,
          id: "poem",
          subjectId: "literature",
          instruction: [paragraph("Read the poem and answer the question.")],
          context: POEM,
          stem: [paragraph("Line 3 contains an example of")],
          options: plainOptions("personification", "simile", "oxymoron", "hyperbole"),
        },
        reveal: answer("poem", "A", paragraph("The clouds are given a human action: they knock on roofs.")),
      },
      {
        id: "excerpt-in-stem",
        title: "One-line excerpt inside the question",
        source: "fixture",
        note: "Stored as plain text in quotation marks. The renderer sets the quoted line apart as an excerpt.",
        question: {
          ...base,
          id: "excerpt-in-stem",
          subjectId: "literature",
          stem: [paragraph("“The sun smiled upon the fields, bathing them in gold.” The literary device used in this excerpt is")],
          options: plainOptions("personification", "simile", "irony", "alliteration"),
        },
        reveal: answer("excerpt-in-stem", "A", paragraph("The sun is given a human action: it smiles.")),
      },
      {
        id: "excerpt-straight-quotes",
        title: "Excerpt in straight single quotes",
        source: "fixture",
        note: "The shape a real literature row arrived in: plain ' marks around the line.",
        question: {
          ...base,
          id: "excerpt-straight-quotes",
          subjectId: "literature",
          stem: [paragraph("'Her heart sang with joy, but her lips spoke only sorrow.' The literary device used in this excerpt is")],
          options: plainOptions("antithesis", "simile", "metaphor", "onomatopoeia"),
        },
        reveal: answer("excerpt-straight-quotes", "A", paragraph("Fixture text. Joy and sorrow are set against each other in one line.")),
      },
      {
        id: "dialogue",
        title: "Dialogue with speaker labels",
        source: "fixture",
        question: {
          ...base,
          id: "dialogue",
          subjectId: "english",
          context: DIALOGUE,
          stem: [paragraph("Ada's last remark suggests that Bayo is")],
          options: plainOptions("punctual", "often late", "forgetful", "dishonest"),
        },
        reveal: answer("dialogue", "B", paragraph("She implies that only late people care about the difference.")),
      },
    ],
  },
  {
    group: "3. Prescribed work",
    items: [
      {
        id: "work",
        title: "Question linked to a prescribed work",
        source: "fixture",
        note: "The question points to the book. Which years the book applies to is stored separately, so a later change of set book leaves this question and its history untouched.",
        question: {
          ...base,
          id: "work",
          subjectId: "english",
          work: { title: "The Lekki Headmaster", author: "Kabir Alabi Garba", reference: "Chapter 1, Dusk" },
          stem: [paragraph("What causes Mr. Bepo's emotional breakdown during the morning assembly?")],
          options: plainOptions("A student's accident", "Pressure to relocate to the UK", "Financial loss", "Conflict with staff"),
        },
        reveal: answer("work", "B", paragraph("Fixture text. The wording comes from an inactive row, so this answer has not been verified.")),
      },
    ],
  },
  {
    group: "4. Figures",
    items: [
      {
        id: "figures",
        title: "Source diagram, then a separate solution illustration",
        source: "fixture",
        note: "The green diagram only appears after the answer is revealed.",
        question: {
          ...base,
          id: "figures",
          subjectId: "mathematics",
          stem: [paragraph("Find x in the right-angled triangle below."), { type: "figure", src: SOURCE_TRIANGLE, alt: "Right-angled triangle with shorter sides 5 cm and 12 cm. The hypotenuse is marked x.", caption: [text("Not drawn to scale")] }],
          options: plainOptions("7 cm", "13 cm", "17 cm", "60 cm"),
        },
        reveal: {
          questionId: "figures",
          correctOption: "B",
          solution: {
            answer: [paragraph("The hypotenuse is 13 cm.")],
            steps: [{ title: "Apply Pythagoras", blocks: [{ type: "math", tex: "x^2 = 5^2 + 12^2 = 169" }, { type: "math", tex: "x = 13" }] }],
            figures: [{ type: "figure", src: SOLUTION_TRIANGLE, alt: "The same triangle with the sides labelled 5, 12 and 13." }],
          },
        },
      },
      {
        id: "image-options",
        title: "Image-only choices",
        source: "fixture",
        question: {
          ...base,
          id: "image-options",
          subjectId: "mathematics",
          stem: [paragraph("Which of these shapes has exactly one line of symmetry?")],
          options: [
            { key: "A", blocks: [{ type: "figure", src: shape(`<rect x="30" y="15" width="60" height="60" fill="#e0f2fe" stroke="#1f2937" stroke-width="2"/>`), alt: "A square" }] },
            { key: "B", blocks: [{ type: "figure", src: shape(`<polygon points="60,10 100,80 20,80" fill="#e0f2fe" stroke="#1f2937" stroke-width="2"/><line x1="60" y1="10" x2="60" y2="80" stroke="#94a3b8" stroke-dasharray="3"/>`), alt: "An isosceles triangle" }] },
            { key: "C", blocks: [{ type: "figure", src: shape(`<circle cx="60" cy="45" r="35" fill="#e0f2fe" stroke="#1f2937" stroke-width="2"/>`), alt: "A circle" }] },
            { key: "D", blocks: [{ type: "figure", src: shape(`<polygon points="35,75 15,15 85,15 105,75" fill="#e0f2fe" stroke="#1f2937" stroke-width="2"/>`), alt: "A parallelogram" }] },
          ],
        },
        reveal: answer("image-options", "B", paragraph("An isosceles triangle has one line of symmetry, from the top vertex to the middle of the base.")),
      },
    ],
  },
  {
    group: "5. Tables",
    items: [
      {
        id: "ledger",
        title: "Accounting ledger on a narrow screen",
        source: "fixture",
        note: "Blank cells stay blank and are not zero. Negatives keep their brackets. The table scrolls inside the question.",
        question: {
          ...base,
          id: "ledger",
          subjectId: "accounting",
          stem: [
            paragraph("The Cash Account of Ade Traders is shown below. What is the balance carried down?"),
            {
              type: "table",
              caption: [text("Cash Account for January 2023")],
              align: ["left", "left", "right", "left", "left", "right"],
              header: [[cell("Date"), cell("Details (Dr)"), cell("₦"), cell("Date"), cell("Details (Cr)"), cell("₦")]],
              rows: [
                [cell("Jan 1"), cell("Balance b/d"), cell("120,000.00"), cell("Jan 4"), cell("Purchases"), cell("75,500.00")],
                [cell("Jan 9"), cell("Sales"), cell("48,250.50"), cell("Jan 12"), cell("Wages"), cell("30,000.00")],
                [cell("Jan 20"), cell("Discount adj."), cell("(1,250.50)"), cell("Jan 30"), cell("Balance c/d"), null],
                [null, null, null, cell("Jan 31"), cell("Sundry"), cell("0.00")],
              ],
              footer: [[null, cell("Total"), cell("167,000.00"), null, cell("Total"), cell("167,000.00")]],
            },
          ],
          options: plainOptions("₦51,500.00", "₦61,500.00", "₦105,500.00", "₦167,000.00"),
        },
        reveal: answer("ledger", "B", paragraph("Debits total ₦167,000.00 and credits before the balance total ₦105,500.00, leaving ₦61,500.00.")),
      },
      {
        id: "frequency",
        title: "Frequency table",
        source: "real row",
        note: "Row 20bf0d2e. Held for source verification, so this is only a layout test. The old row stored this table as text.",
        question: {
          ...base,
          id: "frequency",
          subjectId: "mathematics",
          stem: [
            paragraph("The frequency table below shows the ages of students. Find the mode."),
            {
              type: "table",
              align: ["left", "right", "right", "right", "right", "right"],
              rows: [
                [cell("Age (years)"), cell("13"), cell("14"), cell("15"), cell("16"), cell("17")],
                [cell("No. of students"), cell("5"), cell("8"), cell("12"), cell("10"), cell("15")],
              ],
            },
          ],
          options: plainOptions("13", "14", "15", "17"),
        },
        reveal: answer("frequency", "D", paragraph("17 has the highest frequency, 15.")),
      },
    ],
  },
  {
    group: "6. Maths and Chemistry",
    items: [
      {
        id: "maths",
        title: "Multi-line working",
        source: "real row",
        note: "Row 000b3ec8.",
        question: {
          ...base,
          id: "maths",
          subjectId: "mathematics",
          stem: [paragraph("The perimeter of a rectangle is 28m, and its area is ", math("48\\text{ m}^2"), ". Find the length of the rectangle.")],
          options: plainOptions("8m", "10m", "12m", "14m"),
        },
        reveal: {
          questionId: "maths",
          correctOption: "A",
          solution: {
            concept: "Perimeter and area of a rectangle",
            intro: [paragraph("Let's use the perimeter to link length and width.")],
            formula: [{ type: "math", tex: "P = 2(l + w)" }],
            variables: [paragraph(math("P"), " = perimeter (m), ", math("l"), " = length (m), ", math("w"), " = width (m)")],
            steps: [
              { title: "Use the perimeter", blocks: [{ type: "math", tex: "2(l + w) = 28" }, { type: "math", tex: "l + w = 14" }] },
              { title: "Use the area", blocks: [{ type: "math", tex: "l(14 - l) = 48" }, { type: "math", tex: "l^{2} - 14l + 48 = 0" }] },
              { title: "Factorise", blocks: [{ type: "math", tex: "(l - 6)(l - 8) = 0" }] },
              { title: "Pick the length", blocks: [paragraph("The sides are 6 m and 8 m, and the length is the longer side.")] },
            ],
            answer: [paragraph("The two sides are 6 m and 8 m, and the length is normally the longer side.")],
            wrongOptions: {
              B: [paragraph("B: 10 m would need a width of 4 m, giving area 40, not 48.")],
              C: [paragraph("C: 12 m would need a width of 2 m, giving area 24, not 48.")],
              D: [paragraph("D: 14 m is the sum of length and width, not the length.")],
            },
            studyTip: [paragraph("Two numbers that add to 14 and multiply to 48 are 6 and 8.")],
          },
        },
      },
      {
        id: "formula-choice",
        title: "Formula inside the choices, with ₦ left as plain text",
        source: "fixture",
        question: {
          ...base,
          id: "formula-choice",
          subjectId: "mathematics",
          stem: [paragraph("A trader shares ₦1,200 in the ratio ", math("\\frac{1}{2} : \\frac{1}{3}"), ". Which expression gives the larger share?")],
          options: [
            { key: "A", blocks: [{ type: "paragraph", content: [math("\\frac{3}{5} \\times 1200")] }] },
            { key: "B", blocks: [{ type: "paragraph", content: [math("\\frac{2}{5} \\times 1200")] }] },
            { key: "C", blocks: [{ type: "paragraph", content: [math("\\sqrt{1200}")] }] },
            { key: "D", blocks: [{ type: "paragraph", content: [math("1200^{\\frac{1}{2}} \\div 3")] }] },
          ],
        },
        reveal: answer("formula-choice", "A", paragraph("The ratio simplifies to 3 : 2, so the larger share is three fifths of ₦1,200.")),
      },
      {
        id: "chemistry",
        title: "Balanced equation, charges and units",
        source: "fixture",
        question: {
          ...base,
          id: "chemistry",
          subjectId: "chemistry",
          stem: [
            paragraph("Consider the reaction below at 25 °C."),
            { type: "math", tex: "2\\text{Fe}^{3+}\\text{(aq)} + 3\\text{SO}_4^{2-}\\text{(aq)} \\xrightarrow{\\text{heat}} \\text{Fe}_2(\\text{SO}_4)_3\\text{(s)}" },
            { type: "math", tex: "\\text{N}_2\\text{(g)} + 3\\text{H}_2\\text{(g)} \\rightleftharpoons 2\\text{NH}_3\\text{(g)}" },
            paragraph("A solution contains 0.5 mol dm", text("−3", "superscript"), " of ", math("\\text{Fe}^{3+}"), ". What is the charge on the sulphate ion?"),
          ],
          options: [
            { key: "A", blocks: [paragraph(math("-1"))] },
            { key: "B", blocks: [paragraph(math("-2"))] },
            { key: "C", blocks: [paragraph(math("+2"))] },
            { key: "D", blocks: [paragraph(math("+3"))] },
          ],
        },
        reveal: answer("chemistry", "B", paragraph("The ion is ", math("\\text{SO}_4^{2-}"), ", so its charge is −2.")),
      },
    ],
  },
];

const valid = {
  stem: [paragraph("Which of the following is correct?")],
  options: plainOptions("One", "Two", "Three", "Four"),
  correctOption: "A",
};

/** Case 8: each of these must be stopped before it can reach a student. */
export const INVALID_EXAMPLES: { title: string; expected: string; draft: QuestionDraft }[] = [
  {
    title: "Two empty options (the Biology row fb7a856e)",
    expected: "empty_option",
    draft: {
      stem: [paragraph("Which of the following processes is NOT part of the oxygen cycle?")],
      options: [key("A", "Photosynthesis"), key("B", "Respiration"), { key: "C", blocks: [paragraph("")] }, { key: "D", blocks: [paragraph("")] }],
      correctOption: "A",
    },
  },
  { title: "Blank answer (the 31 Accounting rows)", expected: "missing_answer", draft: { ...valid, correctOption: "" } },
  {
    title: "Says “underlined”, but nothing is marked",
    expected: "unresolved_marked_text",
    draft: { ...valid, stem: [paragraph("Choose the option nearest in meaning to the underlined word: The chief was 'candid'.")] },
  },
  {
    title: "Refers to a passage that is missing",
    expected: "missing_extract",
    draft: { ...valid, stem: [paragraph("According to the passage, why did the traders leave?")] },
  },
  {
    title: "Refers to a diagram that is missing",
    expected: "missing_figure",
    draft: { ...valid, stem: [paragraph("In the diagram above, find the size of angle PQR.")] },
  },
];
