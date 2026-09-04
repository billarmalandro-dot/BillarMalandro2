export interface ReceiptData {
  tipo: "mesa" | "directa";
  mesaNumero?: number;
  cajero: string;
  cliente?: string;
  tiempo?: {
    horas: string;
    costo: number;
    tarifaNombre?: string;
    horaInicio?: string;
    precioPorHora?: number;
    horasRegaloPromo?: number;
  };
  productos: {
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
  totalGeneral: number;
  metodoPago: string;
}

export function printReceipt(data: ReceiptData) {
  const dateStr = new Date().toLocaleString("es-BO");
  const logoUrl = "/logo_transparente.png"; // Se asume que el logo está en public/logo_transparente.png

  let timeSection = "";
  if (data.tipo === "mesa" && data.tiempo) {
    timeSection = `
      <div class="divider"></div>
      <div style="text-align:center; font-weight:bold; margin: 7px 0 4px 0; font-size: 16px; letter-spacing: 0.5px;">
        DETALLE DE CONSUMO
      </div>
      ${data.tiempo.horaInicio ? `
      <div class="row text-sm">
        <span>Hora inicio juego</span>
        <span>${data.tiempo.horaInicio}</span>
      </div>
      ` : ''}
      ${data.tiempo.precioPorHora ? `
      <div class="row text-sm">
        <span>Precio por hora</span>
        <span>${data.tiempo.precioPorHora.toFixed(2)} Bs.</span>
      </div>
      ` : ''}
      <div class="row text-sm">
        <span>Tiempo total jugado</span>
        <span>${data.tiempo.horas} hrs</span>
      </div>
      ${(data.tiempo.horasRegaloPromo && data.tiempo.horasRegaloPromo > 0) ? `
      <div class="row text-sm">
        <span>Horas Regalo (Promo)</span>
        <span>- ${data.tiempo.horasRegaloPromo} hrs</span>
      </div>
      ` : ''}
      <div class="row text-sm" style="margin-bottom: 2px;">
        <span>Costo del tiempo</span>
        <span>${data.tiempo.costo.toFixed(2)} Bs.</span>
      </div>
    `;
  } else if (data.productos.length > 0) {
    timeSection = `
      <div class="divider"></div>
      <div style="text-align:center; font-weight:bold; margin: 7px 0 4px 0; font-size: 16px; letter-spacing: 0.5px;">
        DETALLE DE CONSUMO
      </div>
    `;
  }

  let productsSection = "";
  if (data.productos.length > 0) {
    productsSection = `
      ${data.productos.map(p => `
        <div class="row text-sm">
          <span>${p.cantidad}x ${p.nombre}</span>
          <span>Bs. ${p.subtotal.toFixed(2)}</span>
        </div>
      `).join('')}
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket de Venta</title>
      <style>
        /* size: auto => usa el ancho real del rollo (58mm u 80mm). */
        @page { margin: 0; size: auto; }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          /* Se centra y llena el papel hasta 80mm (funciona en 58mm y 80mm). */
          width: 100%;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm 3mm;
          color: #000;
          font-weight: 600; /* Más grueso => se imprime más nítido en térmica */
        }
        .ticket { width: 100%; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 6px; }
        .header img { max-width: 130px; margin-bottom: 4px; }
        .header h1 {
          font-size: 24px;
          margin: 0;
          padding: 0;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          line-height: 1.1;
        }
        .header p { font-size: 13px; margin: 2px 0; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          margin: 3px 0;
          font-size: 15px;
          line-height: 1.25;
        }
        .row span:last-child { white-space: nowrap; text-align: right; }
        .text-sm { font-size: 14px; }
        .total-row { font-size: 19px; font-weight: 800; margin-top: 6px; }
        .footer { text-align: center; font-size: 13px; margin-top: 8px; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="header">
          <!-- <img src="${logoUrl}" alt="Logo" /> -->
          <h1>BILLAR EL MALANDRO</h1>
          <p>Ticket de Consumo</p>
          <p>${dateStr}</p>
        </div>
        
        <div class="divider"></div>
        <div class="row text-sm">
          <span>Tipo:</span>
          <span>${data.tipo === "mesa" ? "Uso de Mesa" : "Venta Directa"}</span>
        </div>
        ${data.tipo === "mesa" ? `
        <div class="row text-sm">
          <span>Mesa:</span>
          <span>#${data.mesaNumero}</span>
        </div>
        ` : ''}
        ${data.cliente ? `
        <div class="row text-sm">
          <span>Cliente:</span>
          <span>${data.cliente}</span>
        </div>
        ` : ''}
        <div class="row text-sm">
          <span>Atendido por:</span>
          <span>${data.cajero}</span>
        </div>

        ${timeSection}
        ${productsSection}

        <div class="divider"></div>
        <div class="row total-row">
          <span>TOTAL A PAGAR</span>
          <span>Bs. ${data.totalGeneral.toFixed(2)}</span>
        </div>
        <div class="row text-sm">
          <span>Método de Pago:</span>
          <span style="text-transform: capitalize;">${data.metodoPago}</span>
        </div>

        <div class="divider"></div>
        <div class="footer">
          <p>¡Gracias por tu preferencia!</p>
          <p>¡Te esperamos pronto!</p>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        }
      </script>
    </body>
    </html>
  `;

  // Abrir ventana oculta para imprimir
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
