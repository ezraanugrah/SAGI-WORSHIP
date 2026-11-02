import {
  Radio,
  Monitor,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
function PanelTitle({
  icon,
  children,
  extra,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <span>
        {icon}
        {children}
      </span>
      {extra}
    </div>
  );
}
export function LivePlaceholder() {
  return (
    <section className="panel live">
      <PanelTitle
        icon={<Radio size={17} />}
        extra={
          <span className="disconnected">
            <i />
            Terputus
          </span>
        }
      >
        LIVE output
      </PanelTitle>
      <div className="live-inner">
        <div className="live-canvas">
          <Monitor size={29} />
          <strong>Output belum dibuka</strong>
          <span>Kontrol proyektor hadir di Phase 3</span>
        </div>
        <button className="button secondary full" disabled>
          <ArrowUpRight size={15} />
          Buka projector window
        </button>
        <div className="live-divider" />
        <div className="live-position">
          <span>SLIDE SAAT INI</span>
          <strong>— / —</strong>
        </div>
        <div className="playback">
          <button disabled aria-label="Slide sebelumnya">
            <ChevronLeft size={18} />
          </button>
          <button disabled className="button gold">
            <Play size={15} />
            Go Live
          </button>
          <button disabled aria-label="Slide berikutnya">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="output-buttons">
          <button disabled>
            Black <kbd>B</kbd>
          </button>
          <button disabled>
            Clear text <kbd>C</kbd>
          </button>
        </div>
        <p className="live-help">
          Materi tampil ke jemaat hanya
          <br />
          setelah Anda memilih Go Live.
        </p>
      </div>
    </section>
  );
}
