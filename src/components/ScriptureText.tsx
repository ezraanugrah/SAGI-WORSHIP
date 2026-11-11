import type { CSSProperties } from "react";
import type { ScriptureCaption } from "../presentation/models";
/** Slide body: plain text, or two columns for two-language Scripture. */
export function SlideText({
  text,
  parallel,
}: {
  text: string;
  parallel?: string;
}) {
  if (parallel === undefined) return <>{text}</>;
  return (
    <>
      <div className="slide-column" data-column="left">
        {text}
      </div>
      <div className="slide-column" data-column="right">
        {parallel}
      </div>
    </>
  );
}
/** Reference and attribution lines; two-language slides name both editions. */
export function CaptionText({
  caption,
  referenceStyle,
  attributionStyle,
}: {
  caption: ScriptureCaption;
  referenceStyle?: CSSProperties;
  attributionStyle?: CSSProperties;
}) {
  const part = caption.total > 1 ? ` · ${caption.part}/${caption.total}` : "",
    other = caption.parallel;
  return (
    <>
      <div
        className={`scripture-reference${other ? " scripture-columns" : ""}`}
        style={referenceStyle}
      >
        {other ? (
          <>
            <span>
              {caption.reference} · {caption.translation}
              {part}
            </span>
            <span>
              {other.reference} · {other.translation}
              {part}
            </span>
          </>
        ) : (
          <>
            {caption.reference} · {caption.translation}
            {part}
          </>
        )}
      </div>
      <div className="scripture-attribution" style={attributionStyle}>
        {other
          ? `${caption.attribution} · ${other.attribution}`
          : caption.attribution}
      </div>
    </>
  );
}
