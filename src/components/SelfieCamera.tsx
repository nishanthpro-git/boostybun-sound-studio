import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function SelfieCamera({ onCapture }: { onCapture: (photo: string) => void }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!open || photo) return;
    let alive = true;
    let stream: MediaStream | undefined;
    setError("");
    setReady(false);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (e) {
        if (!alive) return;
        const denied = e instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(e.name);
        setError(denied ? "Camera permission was denied. Allow camera access in your browser, then try again, or pick a bunny avatar." : "Camera unavailable. Check that your camera is connected and not in use, or pick a bunny avatar.");
      }
    }
    void start();
    return () => { alive = false; stream?.getTracks().forEach(t => t.stop()); };
  }, [open, photo]);
  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    const S = 256;
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    ctx.translate(S, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, S, S);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
  };
  return <>
    <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setPhoto(null); setOpen(true); }}><Camera />Take Selfie</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogTitle>{photo ? "Your selfie" : "Take Selfie"}</DialogTitle>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : photo ?
          <div className="relative mx-auto aspect-square w-full max-w-72"><img src={photo} alt="Captured selfie" className="size-full rounded-full object-cover shadow-blue-glow ring-4 ring-electric" /></div> :
          <div className="relative mx-auto aspect-square w-full max-w-72"><video ref={video} muted autoPlay playsInline onLoadedData={() => setReady(true)} className="size-full -scale-x-100 rounded-full bg-muted object-cover ring-4 ring-electric/70" /><span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-background/70" /><p className="absolute inset-x-0 -bottom-6 text-center text-xs font-bold text-muted-foreground">Fit your face in the circle</p></div>}
        {photo ? <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPhoto(null)}><RotateCcw />Retake</Button>
          <Button variant="game" onClick={() => { onCapture(photo); setOpen(false); }}><Check />Use selfie</Button>
        </div> : !error && <Button variant="game" className="mt-6" disabled={!ready} onClick={capture}><Camera />Capture</Button>}
      </DialogContent>
    </Dialog>
  </>;
}