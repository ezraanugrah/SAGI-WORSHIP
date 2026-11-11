import { BookOpen } from "lucide-react";
/**
 * Scriptures tab: a single, still empty "Alkitab / Bible" section.
 * Its content will be added later. Scripture items already in schedules,
 * checkpoints and backups keep working through the Scripture engine.
 */
export function BibleLibrary() {
  return (
    <div className="scriptures-content">
      <section className="bible-section" aria-label="Alkitab / Bible">
        <div className="library-empty">
          <div className="library-art" aria-hidden="true">
            <BookOpen size={24} />
          </div>
          <div>
            <h3>Alkitab / Bible</h3>
            <p>Belum ada isi.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
