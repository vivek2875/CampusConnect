import QRCode from 'qrcode';

export async function renderTicketQr(canvas, ticket) {
  await QRCode.toCanvas(canvas, ticket, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 176,
    color: { dark: '#102b5c', light: '#ffffff' },
  });
}
