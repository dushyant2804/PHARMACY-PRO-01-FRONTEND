import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

/**
 * Barcode scanner modal using phone / laptop camera.
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   onScan: (decodedText) => void
 */
export default function BarcodeScanner({ open, onClose, onScan }) {
  const containerId = "barcode-reader";
  const qrRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          toast.error("No camera found");
          onClose();
          return;
        }
        // Prefer rear-facing camera on phones
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        const qr = new Html5Qrcode(containerId);
        qrRef.current = qr;
        if (cancelled) return;
        await qr.start(
          back.id,
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
           if (qrRef.current) {
             onScan(decodedText);
             stop();
           }
          },
          () => {}
        );
      } catch (e) {
        toast.error("Camera access denied. Please allow camera permission.");
        onClose();
      }
    };

    const stop = async () => {
      try {
        if (qrRef.current) {
          await qrRef.current.stop();
          await qrRef.current.clear();
          qrRef.current = null;
        }
      } catch {}
    };

    start();
    return () => { cancelled = true; stop(); };
  }, [open]); // eslint-disable-line

  return (
    <Dialog
  open={open}
  onOpenChange={(value) => {
    if (!value) onClose();
  }}
>
      <DialogContent className="rounded-sm max-w-md" data-testid="barcode-scanner">
        <DialogHeader>
          <DialogTitle className="font-heading">Scan Barcode</DialogTitle>
        </DialogHeader>
        <div className="bg-slate-900 rounded-sm overflow-hidden">
          <div id={containerId} className="w-full min-h-[260px] flex items-center justify-center text-slate-300 text-sm">
            Initialising camera…
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Point the camera at a product barcode. Allow camera access when prompted.
        </div>
        <Button variant="outline" onClick={onClose} className="rounded-sm">Cancel</Button>
      </DialogContent>
    </Dialog>
  );
}
