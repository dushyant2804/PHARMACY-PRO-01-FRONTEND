import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtINR, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, Mail, MessageCircle, Download } from "lucide-react";
import { toast } from "sonner";

export default function InvoiceDetail() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [settings, setSettings] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    api.get(`/invoices/${id}`).then((r) => setInv(r.data)).catch(() => setInv(false));
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => setSettings({}));
  }, [id]);

  const downloadPdf = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(printRef.current, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight - margin * 2;
      }
      pdf.save(`${inv.invoice_no || "invoice"}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Failed to generate PDF");
    } finally { setDownloading(false); }
  };

  if (inv === false) return <div className="bg-red-50 border border-red-200 rounded-sm p-6 text-center text-red-800">Invoice not found</div>;
  if (!inv) return <div className="text-slate-500">Loading…</div>;

  const waMsg = encodeURIComponent(
    `Invoice ${inv.invoice_no}\nTotal: ${fmtINR(inv.total)}\nDate: ${fmtDate(inv.created_at)}\nThank you!`
  );
  const whatsappUrl = inv.customer_phone
    ? `https://wa.me/${inv.customer_phone.replace(/\D/g, "")}?text=${waMsg}`
    : `https://wa.me/?text=${waMsg}`;
  const mailto = `mailto:?subject=Invoice ${inv.invoice_no}&body=${waMsg}`;

  return (
    <div className="space-y-4" data-testid="invoice-detail">
      <div className="flex justify-between items-center no-print">
        <h1 className="font-heading text-2xl md:text-3xl font-bold">Invoice {inv.invoice_no}</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-sm" onClick={() => window.print()} data-testid="print-btn">
            <Printer className="w-4 h-4 mr-2" />Print
          </Button>
          <Button variant="outline" className="rounded-sm" onClick={downloadPdf} disabled={downloading} data-testid="download-pdf-btn">
            <Download className="w-4 h-4 mr-2" />{downloading ? "Generating…" : "Download PDF"}
          </Button>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="rounded-sm"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button>
          </a>
          <a href={mailto}>
            <Button variant="outline" className="rounded-sm"><Mail className="w-4 h-4 mr-2" />Email</Button>
          </a>
        </div>
      </div>

      <div className="print-area bg-white border border-slate-200 rounded-sm p-6 md:p-10 max-w-4xl" ref={printRef}>
        <div className="flex justify-between items-start border-b border-slate-300 pb-4">
          <div>
            <div className="font-heading text-2xl font-bold">{settings?.business_name || "MedStock Pharmacy"}</div>
            {settings?.business_address && <div className="text-xs text-slate-600">{settings.business_address}</div>}
            {settings?.business_phone && <div className="text-xs text-slate-600">Ph: {settings.business_phone}</div>}
            {settings?.business_gstin && <div className="text-xs font-mono text-slate-600">GSTIN: {settings.business_gstin}</div>}
            <div className="text-xs text-slate-500 mt-1">GST-Compliant Tax Invoice</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500">Invoice No.</div>
            <div className="font-mono-nums font-bold text-lg">{inv.invoice_no}</div>
            <div className="text-xs font-mono-nums">{fmtDate(inv.created_at)}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Billed to</div>
            <div className="mt-1 font-semibold">{inv.customer_name}</div>
            {inv.customer_phone && <div className="text-sm">{inv.customer_phone}</div>}
            {inv.customer_gstin && <div className="text-xs font-mono">GSTIN: {inv.customer_gstin}</div>}
            {inv.referring_doctor && (
              <div className="text-xs mt-2">
                <span className="text-slate-500 uppercase tracking-wider font-semibold">Ref. Doctor: </span>
                <span className="font-semibold">Dr. {inv.referring_doctor}</span>
              </div>
            )}
          </div>
          <div className="md:text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Payment</div>
            <div className="mt-1 uppercase tracking-wider text-sm font-semibold">{inv.payment_mode}</div>
            {inv.due_amount > 0 && <div className="text-xs text-red-600 font-semibold">Due: {fmtINR(inv.due_amount)}</div>}
          </div>
        </div>

        <table className="data-table mt-6">
          <thead>
            <tr>
              <th>Medicine</th><th>Batch</th><th>Exp</th>
              <th className="text-right">Qty</th><th className="text-right">MRP</th>
              <th className="text-right">Disc%</th><th className="text-right">GST%</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name} <span className="text-xs text-slate-400 ml-1">{it.category}</span></td>
                <td className="font-mono-nums text-xs">{it.batch_no}</td>
                <td className="font-mono-nums text-xs">{it.expiry_date}</td>
                <td className="num-cell">{it.quantity}</td>
                <td className="num-cell">{fmtINR(it.mrp)}</td>
                <td className="num-cell">{it.discount_pct}</td>
                <td className="num-cell">{it.gst_rate}</td>
                <td className="num-cell font-semibold">{fmtINR(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-6">
          <div className="w-full md:w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-nums">{fmtINR(inv.subtotal)}</span></div>
            {inv.bill_discount > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Bill Discount</span><span className="font-mono-nums">−{fmtINR(inv.bill_discount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-mono-nums">{fmtINR(inv.gst_total)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 font-heading font-bold text-base">
              <span>Total</span><span className="font-mono-nums">{fmtINR(inv.total)}</span>
            </div>
            <div className="flex justify-between text-xs"><span>Paid</span><span className="font-mono-nums">{fmtINR(inv.paid_amount)}</span></div>
            {inv.due_amount > 0 && <div className="flex justify-between text-xs text-red-600"><span>Due</span><span className="font-mono-nums">{fmtINR(inv.due_amount)}</span></div>}
          </div>
        </div>

        <div className="flex justify-between items-end mt-10 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 max-w-md">
            {inv.notes && <div className="mb-2">Note: {inv.notes}</div>}
            Computer-generated invoice. Thank you for your purchase.
          </div>
          {settings?.signature_b64 && (
            <div className="text-center" data-testid="invoice-signature">
              <img src={settings.signature_b64} alt="Authorised signature" className="h-14 mx-auto" />
              <div className="border-t border-slate-400 mt-1 pt-1 text-[10px] uppercase tracking-wider text-slate-600 min-w-[140px]">
                Authorised Signatory
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
