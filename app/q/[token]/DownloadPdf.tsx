'use client';

import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const currencySymbols: Record<string,string> = { GBP:'£', USD:'$', EUR:'€', AED:'د.إ', SAR:'ر.س', CAD:'CA$', AUD:'A$', CHF:'CHF ', SEK:'kr ', NOK:'kr ' };

function money(currency: string, value: number) {
  return (currencySymbols[currency] || currency + ' ') + Number(value || 0).toFixed(2);
}

function makeStyles(template: string, accent = '#2563eb') {
  const common = {
    page: { padding: 40, fontSize: 10, color: '#172033', fontFamily: 'Helvetica' as const },
    footer: { position: 'absolute' as const, bottom: 24, left: 40, right: 40, color: '#94a3b8', fontSize: 8, textAlign: 'center' as const },
    row: { flexDirection: 'row' as const, padding: 9, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    desc: { flex: 1 },
    qty: { width: 78 },
    amount: { width: 95, textAlign: 'right' as const },
    total: { marginTop: 18, marginLeft: 'auto' as const, width: 220 },
    totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 5 },
    section: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    sectionTitle: { fontSize: 8, color: '#64748b', marginBottom: 5 }
  };

  switch (template) {
    case 'classic':
      return StyleSheet.create({
        ...common,
        page: { ...common.page, color: '#2c241f', fontFamily: 'Times-Roman', padding: 46 },
        top: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 2, borderBottomColor: '#6b3f31' },
        logo: { width: 44, height: 44, objectFit: 'contain' as const, marginBottom: 7 },
        brand: { fontSize: 22, fontFamily: 'Times-Bold', color: '#6b3f31' },
        meta: { fontSize: 9, color: '#75675f', marginTop: 4 },
        title: { fontSize: 26, fontFamily: 'Times-Bold', color: '#6b3f31', marginTop: 24 },
        client: { marginTop: 18, padding: 12, backgroundColor: '#f7f1ec', borderLeftWidth: 3, borderLeftColor: '#6b3f31' },
        clientTitle: { fontSize: 9, color: '#8a7568', marginBottom: 4, fontFamily: 'Times-Bold' },
        table: { marginTop: 22, borderWidth: 1, borderColor: '#cfc1b8' },
        header: { backgroundColor: '#f7f1ec', fontFamily: 'Times-Bold' },
        grand: { borderTopWidth: 2, borderTopColor: '#6b3f31', paddingTop: 8, marginTop: 8, fontSize: 16, fontFamily: 'Times-Bold' },
        section: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#d8ccc4' },
        sectionTitle: { fontSize: 9, color: '#6b3f31', fontFamily: 'Times-Bold', marginBottom: 5 }
      });
    case 'bold':
      return StyleSheet.create({
        ...common,
        page: { ...common.page, color: '#111827', padding: 34 },
        top: { padding: 18, backgroundColor: '#111827', flexDirection: 'row', justifyContent: 'space-between' },
        logo: { width: 46, height: 46, objectFit: 'contain' as const },
        brand: { fontSize: 23, fontWeight: 700, color: '#ffffff' },
        meta: { fontSize: 9, color: '#cbd5e1', marginTop: 4 },
        title: { fontSize: 30, fontWeight: 700, marginTop: 24, color: '#111827' },
        client: { marginTop: 16, padding: 14, backgroundColor: '#e8f0ff', borderRadius: 4 },
        clientTitle: { fontSize: 9, color: '#2563eb', marginBottom: 5, fontWeight: 700 },
        table: { marginTop: 22 },
        header: { backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, borderBottomWidth: 0 },
        row: { ...common.row, borderBottomColor: '#dbeafe' },
        grand: { marginTop: 8, paddingTop: 9, borderTopWidth: 3, borderTopColor: '#111827', fontSize: 17, fontWeight: 700 }
      });
    case 'minimal':
      return StyleSheet.create({
        ...common,
        page: { ...common.page, color: '#404040', padding: 52 },
        top: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10 },
        logo: { width: 38, height: 38, objectFit: 'contain' as const, marginBottom: 6 },
        brand: { fontSize: 18, fontWeight: 700, color: '#222222' },
        meta: { fontSize: 8, color: '#888888', marginTop: 3 },
        title: { fontSize: 23, fontWeight: 700, marginTop: 28, color: '#222222' },
        client: { marginTop: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#dddddd' },
        clientTitle: { fontSize: 8, color: '#999999', marginBottom: 4 },
        table: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#bbbbbb', borderBottomWidth: 1, borderBottomColor: '#bbbbbb' },
        row: { ...common.row, borderBottomColor: '#eeeeee', paddingVertical: 8 },
        header: { backgroundColor: '#ffffff', color: '#888888', fontSize: 8 },
        grand: { borderTopWidth: 1, borderTopColor: '#222222', paddingTop: 7, marginTop: 7, fontSize: 14, fontWeight: 700 },
        section: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eeeeee' },
        sectionTitle: { fontSize: 8, color: '#888888', marginBottom: 5 }
      });
    case 'technical':
      return StyleSheet.create({
        ...common,
        page: { ...common.page, color: '#19323b', padding: 36 },
        top: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#2c6877', padding: 12, backgroundColor: '#eff8fa' },
        logo: { width: 42, height: 42, objectFit: 'contain' as const },
        brand: { fontSize: 20, fontWeight: 700, color: '#1f6575' },
        meta: { fontSize: 8, color: '#55737b', marginTop: 4 },
        title: { fontSize: 25, fontWeight: 700, color: '#1f6575', marginTop: 21 },
        client: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: '#b9d9df', backgroundColor: '#f7fcfd' },
        clientTitle: { fontSize: 8, color: '#2c6877', marginBottom: 4, fontWeight: 700 },
        table: { marginTop: 18, borderWidth: 1, borderColor: '#aacbd2' },
        header: { backgroundColor: '#dceff3', color: '#1f6575', fontWeight: 700 },
        grand: { borderTopWidth: 2, borderTopColor: '#2c6877', paddingTop: 7, marginTop: 7, fontSize: 15, color: '#1f6575', fontWeight: 700 },
        section: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#c9e0e5' },
        sectionTitle: { fontSize: 8, color: '#2c6877', marginBottom: 5, fontWeight: 700 }
      });
    default:
      return StyleSheet.create({
        ...common,
        top: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#dbe3ee' },
        logo: { width: 44, height: 44, objectFit: 'contain' as const, marginBottom: 7 },
        brand: { fontSize: 21, fontWeight: 700, color: accent },
        meta: { fontSize: 9, color: '#64748b', marginTop: 4 },
        title: { fontSize: 24, fontWeight: 700, marginTop: 24, color: '#0f172a' },
        client: { marginTop: 18, padding: 12, backgroundColor: '#f8fafc', borderRadius: 7 },
        clientTitle: { fontSize: 9, color: '#64748b', marginBottom: 4 },
        table: { marginTop: 22, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 7 },
        header: { backgroundColor: '#f8fafc', fontWeight: 700 },
        grand: { borderTopWidth: 1, borderTopColor: accent, paddingTop: 8, marginTop: 8, fontSize: 15, fontWeight: 700 },
        section: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
        sectionTitle: { fontSize: 8, color: '#64748b', marginBottom: 5 }
      });
  }
}

export default function DownloadPdf({ quote, business, removeBrand = false }: { quote: any; business: any; removeBrand?: boolean }) {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const template = ['modern','classic','bold','minimal','technical'].includes(quote.template) ? quote.template : 'modern';
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(business?.primary_color || '')) ? business.primary_color : '#2563eb';
  const styles = makeStyles(template, accent);
  const showLogo = Boolean(business?.logo_url && business?.allow_custom_logo);
  const name = (quote.quote_number || 'quote') + '.pdf';
  const document = (
    <Document title={quote.quote_number} author={business?.business_name || 'QUVOTO'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <View>
            {showLogo ? <Image src={business.logo_url} style={styles.logo} /> : null}
            <Text style={styles.brand}>{business?.business_name || 'QUVOTO'}</Text>
            {business?.email ? <Text style={styles.meta}>{business.email}</Text> : null}
            {business?.phone ? <Text style={styles.meta}>{business.phone}</Text> : null}
          </View>
          <View>
            <Text style={styles.meta}>QUOTE</Text>
            <Text style={{fontSize: 12, fontWeight: 700}}>{quote.quote_number}</Text>
            <Text style={styles.meta}>{new Date(quote.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        <Text style={styles.title}>{template === 'technical' ? 'WORK QUOTATION' : template === 'bold' ? 'QUOTE' : 'Professional Quote'}</Text>

        <View style={styles.client}>
          <Text style={styles.clientTitle}>PREPARED FOR</Text>
          <Text>{quote.client_name || 'Client'}</Text>
          {quote.client_email ? <Text style={styles.meta}>{quote.client_email}</Text> : null}
          {quote.client_phone ? <Text style={styles.meta}>{quote.client_phone}</Text> : null}
          {quote.client_address ? <Text style={styles.meta}>{quote.client_address}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <Text style={styles.desc}>Description</Text>
            <Text style={styles.qty}>Qty</Text>
            <Text style={styles.amount}>Amount</Text>
          </View>
          {items.map((item:any, i:number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.desc}>{item.description || 'Item'}</Text>
              <Text style={styles.qty}>{item.quantity || 0} {item.unit || ''}</Text>
              <Text style={styles.amount}>{money(quote.currency, Number(item.quantity || 0) * Number(item.price || 0))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.total}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>{money(quote.currency, quote.subtotal)}</Text></View>
          {Number(quote.discount) > 0 ? <View style={styles.totalRow}><Text>Discount</Text><Text>-{money(quote.currency, quote.discount)}</Text></View> : null}
          {Number(quote.vat_amount) > 0 ? <View style={styles.totalRow}><Text>VAT ({quote.vat_rate}%)</Text><Text>{money(quote.currency, quote.vat_amount)}</Text></View> : null}
          <View style={[styles.totalRow, styles.grand]}><Text>Total</Text><Text>{money(quote.currency, quote.total)}</Text></View>
        </View>

        {Array.isArray(quote.notes) && quote.notes.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            {quote.notes.map((note: string, i: number) => <Text key={i}>{note}</Text>)}
          </View>
        ) : null}

        {business?.payment_terms || business?.warranty_terms ? (
          <View style={styles.section}>
            {business?.payment_terms ? <><Text style={styles.sectionTitle}>PAYMENT TERMS</Text><Text>{business.payment_terms}</Text></> : null}
            {business?.warranty_terms ? <><Text style={styles.sectionTitle}>SERVICE / WARRANTY</Text><Text>{business.warranty_terms}</Text></> : null}
          </View>
        ) : null}

        <Text style={styles.footer}>{business?.business_name || 'VoiceQuote'}{removeBrand ? '' : ' · Generated with VoiceQuote'}</Text>
      </Page>
    </Document>
  );

  return <PDFDownloadLink document={document} fileName={name} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{({loading}) => loading ? 'Preparing PDF…' : 'Download PDF'}</PDFDownloadLink>;
}