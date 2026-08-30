import React, { useEffect, useState } from "react";
import { COLORS } from "../theme.js";

export default function AnimatedPrompt({ examples }) {
  const [displayedText, setDisplayedText] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [phase, setPhase] = useState("typing");

  useEffect(() => {
    if (!examples?.length) return undefined;
    const currentExample = examples[exampleIndex];
    let timer;

    if (phase === "typing") {
      timer = displayedText.length < currentExample.length
        ? setTimeout(() => setDisplayedText(currentExample.slice(0, displayedText.length + 1)), 42)
        : setTimeout(() => setPhase("pausing"), 1300);
    } else if (phase === "pausing") {
      timer = setTimeout(() => setPhase("deleting"), 700);
    } else if (displayedText.length > 0) {
      timer = setTimeout(() => setDisplayedText(displayedText.slice(0, -1)), 22);
    } else {
      setExampleIndex((index) => (index + 1) % examples.length);
      setPhase("typing");
    }

    return () => clearTimeout(timer);
  }, [displayedText, exampleIndex, examples, phase]);

  if (!examples?.length) return null;

  return (
    <span aria-hidden="true" style={{ color: COLORS.muted }}>
      {displayedText}
      <span className="blink-caret">|</span>
    </span>
  );
}
