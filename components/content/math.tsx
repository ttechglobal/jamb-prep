"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/** KaTeX builds this markup from the formula alone, with HTML extensions switched off. */
export default function MathRender({ tex, display }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    fleqn: true,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    output: "htmlAndMathml",
  });

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
