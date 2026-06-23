import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { X, Camera } from "lucide-react";

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) throw new Error("Nenhuma câmera encontrada");
        const back =
          devices.find((d) => /back|rear|environment|traseira/i.test(d.label)) ?? devices[devices.length - 1];

        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result, err, ctrls) => {
            if (cancelled) return;
            if (result) {
              ctrls.stop();
              onDetected(result.getText());
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Não foi possível acessar a câmera";
        setError(
          msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Permissão da câmera negada. Libere o acesso nas configurações do navegador."
            : msg,
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Camera className="h-4 w-4" /> Aponte para o código de barras
        </div>
        <button onClick={onClose} className="rounded-md p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        {error ? (
          <div className="max-w-sm p-6 text-center text-sm text-white/80">
            {error}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </>
        )}
      </div>
    </div>
  );
}
