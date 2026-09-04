"use client";

import React, { forwardRef } from "react";
import { Printer } from "lucide-react";

export interface TicketCierreData {
  sucursalNombre: string;
  cajeroNombre: string;
  fechaApertura: string;
  fechaCierre: string;
  montoInicial: number;
  totalVentasProductos: number;
  totalVentasMesas: number;
  totalIngresosAdicionales: number;
  totalEgresos: number;
  saldoEstimado: number;
  montoCierreReal: number;
  diferencia: number;
  observacion?: string;
  desgloseProductos: {
    nombre: string;
    cantidad: number;
    precioUnitario?: number;
    subtotal: number;
  }[];
  desgloseMesas: {
    tipo: string;
    tiempoTotal: string;
    subtotal: number;
  }[];
  metodosPago: {
    efectivo: number;
    qr: number;
  };
}

interface Props {
  data: TicketCierreData | null;
}

const SEP = "--------------------------------";

const TicketCierre = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[80mm] mx-auto">
      {/* Botón Imprimir - siempre visible arriba */}
      <button
        onClick={handlePrint}
        className="mb-3 print:hidden flex items-center gap-2 bg-billar-primary text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-billar-primary-dark transition-colors text-sm shrink-0"
      >
        <Printer className="w-4 h-4" /> Imprimir Ticket Z
      </button>

      {/* Ticket visual */}
      <div className="bg-white text-black rounded-lg w-full shadow-2xl overflow-hidden">
        <div ref={ref} className="ticket-content font-mono px-2 py-2" style={{ fontSize: '13px', lineHeight: '1.3', fontWeight: 600 }}>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { margin: 0; size: auto; }
              body * { visibility: hidden; }
              .ticket-content, .ticket-content * { visibility: visible; }
              .ticket-content {
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                /* Se centra y llena el papel hasta 80mm (funciona en 58mm y 80mm). */
                width: 100%;
                max-width: 80mm;
                margin: 0 auto;
                padding: 2mm 3mm;
                font-size: 13px;
                line-height: 1.3;
                font-weight: 600;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `}} />

          {/* Encabezado */}
          <div className="text-center" style={{ marginBottom: '4px' }}>
            <p style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '1px' }}>BILLAR EL MALANDRO</p>
            <p style={{ fontSize: '13px' }}>{data.sucursalNombre}</p>
            <p>{SEP}</p>
            <p style={{ fontWeight: 'bold', fontSize: '16px' }}>CIERRE DE CAJA</p>
            <p>{SEP}</p>
          </div>

          {/* Info Turno */}
          <div style={{ marginBottom: '2px' }}>
            <p><strong>Cajero:</strong> {data.cajeroNombre}</p>
            <p><strong>Inicio:</strong> {new Date(data.fechaApertura).toLocaleString("es-BO")}</p>
            <p><strong>Fin:</strong> {new Date(data.fechaCierre).toLocaleString("es-BO")}</p>
          </div>

          <p>{SEP}</p>

          {/* Desglose Mesas */}
          {data.desgloseMesas.length > 0 && (
            <div style={{ marginBottom: '1px' }}>
              <p style={{ fontWeight: 'bold' }}>MESAS</p>
              <div className="flex justify-between" style={{ fontWeight: 'bold', borderBottom: '1px dashed #999', paddingBottom: '1px', marginBottom: '1px' }}>
                <span className="flex-1">Tipo</span>
                <span className="w-12 text-center">Hs.</span>
                <span className="w-16 text-right">Tot</span>
              </div>
              {data.desgloseMesas.map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span className="capitalize flex-1 truncate pr-1">{m.tipo}</span>
                  <span className="w-12 text-center">{m.tiempoTotal}</span>
                  <span className="w-16 text-right">{m.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <p style={{ textAlign: 'right', fontWeight: 'bold' }}>Sub: {data.totalVentasMesas.toFixed(2)}</p>
            </div>
          )}

          {data.desgloseMesas.length > 0 && <p>{SEP}</p>}

          {/* Desglose Productos */}
          {data.desgloseProductos.length > 0 && (
            <div style={{ marginBottom: '1px' }}>
              <p style={{ fontWeight: 'bold' }}>PRODUCTOS</p>
              <div className="flex justify-between" style={{ fontWeight: 'bold', borderBottom: '1px dashed #999', paddingBottom: '1px', marginBottom: '1px' }}>
                <span className="flex-1">Cant x Prod (P.U)</span>
                <span className="w-16 text-right">Tot</span>
              </div>
              {data.desgloseProductos.map((p, i) => (
                <div key={i} className="flex justify-between" style={{ lineHeight: '1.2' }}>
                  <span className="flex-1 pr-1">{p.cantidad}x {p.nombre} ({p.precioUnitario?.toFixed(2) || '-'})</span>
                  <span className="w-16 text-right shrink-0">{(p.subtotal || 0).toFixed(2)}</span>
                </div>
              ))}
              <p style={{ textAlign: 'right', fontWeight: 'bold' }}>Sub: {data.totalVentasProductos.toFixed(2)}</p>
            </div>
          )}

          <p>{SEP}</p>

          {/* Resumen Caja */}
          <div style={{ marginBottom: '1px' }}>
            <p style={{ fontWeight: 'bold' }}>RESUMEN</p>
            <div className="flex justify-between"><span>Monto Ini:</span><span>{data.montoInicial.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>+ Ventas:</span><span>{(data.totalVentasMesas + data.totalVentasProductos).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>+ Ingresos:</span><span>{data.totalIngresosAdicionales.toFixed(2)}</span></div>
            <div className="flex justify-between" style={{ color: '#dc2626' }}><span>- Egresos:</span><span>{data.totalEgresos.toFixed(2)}</span></div>
            <div className="flex justify-between" style={{ fontWeight: 'bold', borderTop: '1px solid #333', paddingTop: '1px', marginTop: '1px' }}>
              <span>SALDO ESPERADO:</span><span>{data.saldoEstimado.toFixed(2)}</span>
            </div>
          </div>

          <p>{SEP}</p>

          {/* Formas de Pago */}
          <div style={{ marginBottom: '1px' }}>
            <p style={{ fontWeight: 'bold' }}>PAGOS</p>
            <div className="flex justify-between"><span>Efectivo:</span><span>{data.metodosPago.efectivo.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>QR/Transf:</span><span>{data.metodosPago.qr.toFixed(2)}</span></div>
          </div>

          <p>================================</p>

          {/* Arqueo Real */}
          <div style={{ marginBottom: '1px' }}>
            <div className="flex justify-between" style={{ fontWeight: 'bold' }}>
              <span>CIERRE REAL:</span><span>{data.montoCierreReal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between" style={{ fontWeight: 'bold' }}>
              <span>DIFERENCIA:</span><span>{data.diferencia.toFixed(2)}</span>
            </div>
            {data.observacion && (
              <div style={{ marginTop: '2px', fontSize: '11px' }}>
                <p><strong>Obs:</strong> {data.observacion}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center" style={{ marginTop: '2px', paddingTop: '1px', borderTop: '1px dashed #999' }}>
            <p>*** FIN ***</p>
          </div>
        </div>
      </div>
    </div>
  );
});

TicketCierre.displayName = "TicketCierre";

export default TicketCierre;
